-- =====================================================================
-- Fallpfad Lehrer-Portal: Datenbankschema (Supabase / PostgreSQL)
-- Voraussetzung: supabase/schema.sql (Tabelle public.progress) wurde bereits ausgeführt.
-- Ausführen: Supabase-Dashboard > SQL Editor > New query > Inhalt einfügen > Run.
-- Das Skript ist wiederholbar: Es legt nur an, was fehlt, und überschreibt keine Daten.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- 1. Kurse ----------
create table if not exists public.courses (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) between 1 and 80),
  code        text not null unique,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ---------- 2. Profile (eine Zeile je Konto) ----------
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text,
  display_name  text,
  role          text not null default 'student' check (role in ('student', 'teacher')),
  course_id     uuid references public.courses (id) on delete set null,
  year          int check (year between 1 and 3),
  updated_at    timestamptz not null default now()
);
create index if not exists profiles_course_idx on public.profiles (course_id);

-- ---------- 3. Module aus dem Lehrer-Portal ----------
-- id = Modul-ID. Gleiche ID wie ein eingebautes Modul (z. B. fm4) = bearbeitete Fassung, die das Original ersetzt.
-- Neue ID (z. B. cm_ab12cd) = eigenes Modul. data enthält das komplette Modul im Format der App.
create table if not exists public.modules (
  id          text primary key check (id ~ '^[a-z0-9_]{2,40}$'),
  title       text not null,
  area        text,
  difficulty  text,
  year        int check (year between 1 and 3),
  status      text not null default 'draft' check (status in ('draft', 'published')),
  course_ids  uuid[] not null default '{}',
  base_id     text,
  data        jsonb not null,
  updated_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------- 4. Einladungscodes für weitere Lehrkräfte ----------
create table if not exists public.teacher_invites (
  code        text primary key,
  created_by  uuid references auth.users (id) on delete cascade,
  used_by     uuid references auth.users (id) on delete set null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

-- ---------- 5. Hilfsfunktion: Ist die angemeldete Person Lehrkraft? ----------
-- security definer: liest profiles ohne Rücksicht auf RLS, verhindert eine Endlosschleife in den Policies.
create or replace function public.is_teacher()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'teacher');
$$;

-- ---------- 6. Profil automatisch anlegen, sobald sich jemand registriert ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Bestehende Konten nachtragen
insert into public.profiles (id, email, display_name)
select id, email, coalesce(raw_user_meta_data ->> 'name', '') from auth.users
on conflict (id) do nothing;

-- ---------- 7. Rollen-Schutz ----------
-- Niemand kann sich über die App selbst zur Lehrkraft machen. Erlaubt sind nur:
-- der SQL Editor (keine Anmeldung, auth.role() ist leer), der service_role-Schlüssel
-- und die Funktion redeem_teacher_invite (setzt dafür eine Freigabe für die laufende Transaktion).
create or replace function public.protect_role()
returns trigger language plpgsql as $$
begin
  if new.role is distinct from old.role
     and coalesce(auth.role(), '') in ('authenticated', 'anon')
     and coalesce(current_setting('fallpfad.allow_role', true), '') <> 'on' then
    raise exception 'Die Rolle kann nur von einer Administratorin oder per Einladungscode geändert werden.';
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role before update on public.profiles
  for each row execute function public.protect_role();

-- ---------- 8. Einladungscode einlösen ----------
create or replace function public.redeem_teacher_invite(p_code text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  if auth.uid() is null then raise exception 'Bitte zuerst anmelden.'; end if;
  select code into v_code from public.teacher_invites
   where code = upper(trim(p_code)) and used_by is null for update;
  if v_code is null then return false; end if;
  perform set_config('fallpfad.allow_role', 'on', true);
  insert into public.profiles (id, role) values (auth.uid(), 'teacher')
    on conflict (id) do update set role = 'teacher';
  update public.teacher_invites set used_by = auth.uid(), used_at = now() where code = v_code;
  return true;
end $$;

revoke all on function public.redeem_teacher_invite(text) from public;
grant execute on function public.redeem_teacher_invite(text) to authenticated;
grant execute on function public.is_teacher() to anon, authenticated;

-- ---------- 9. Row Level Security ----------
alter table public.courses          enable row level security;
alter table public.profiles         enable row level security;
alter table public.modules          enable row level security;
alter table public.teacher_invites  enable row level security;

-- Kurse: alle Angemeldeten sehen die Kursnamen (für die Auswahl im Onboarding), nur Lehrkräfte ändern sie.
drop policy if exists courses_select on public.courses;
create policy courses_select on public.courses for select to authenticated using (true);
drop policy if exists courses_write on public.courses;
create policy courses_write on public.courses for all to authenticated
  using (public.is_teacher()) with check (public.is_teacher());

-- Profile: Schülerinnen und Schüler sehen und ändern nur ihr eigenes Profil, Lehrkräfte sehen alle.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_teacher());
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated
  with check (id = auth.uid() and role = 'student');
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_teacher())
  with check (id = auth.uid() or public.is_teacher());

-- Module: veröffentlichte Module darf jede Person lesen (auch vor der Anmeldung, damit die App sie beim Start laden kann).
-- Entwürfe sehen nur Lehrkräfte. Schreiben dürfen nur Lehrkräfte.
drop policy if exists modules_select on public.modules;
create policy modules_select on public.modules for select to anon, authenticated
  using (status = 'published' or public.is_teacher());
drop policy if exists modules_write on public.modules;
create policy modules_write on public.modules for all to authenticated
  using (public.is_teacher()) with check (public.is_teacher());

-- Lernfortschritt: zusätzlich zu den bestehenden Policies dürfen Lehrkräfte alle Datensätze lesen (nicht ändern).
drop policy if exists progress_select_teacher on public.progress;
create policy progress_select_teacher on public.progress for select to authenticated
  using (public.is_teacher());

-- Einladungen: nur Lehrkräfte.
drop policy if exists invites_all on public.teacher_invites;
create policy invites_all on public.teacher_invites for all to authenticated
  using (public.is_teacher()) with check (public.is_teacher());

-- ---------- 10. Zeitstempel für Module ----------
create or replace function public.touch_updated()
returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
drop trigger if exists modules_touch on public.modules;
create trigger modules_touch before update on public.modules
  for each row execute function public.touch_updated();

-- =====================================================================
-- ERSTE LEHRKRAFT FREISCHALTEN (einmalig, E-Mail anpassen und separat ausführen):
--   update public.profiles set role = 'teacher' where email = 'lehrkraft@schule.de';
-- =====================================================================
