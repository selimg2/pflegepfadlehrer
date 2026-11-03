-- =====================================================================
-- Fallpfad: Aufgaben für Kurse (Erweiterung des Lehrer-Portals)
-- Voraussetzung: supabase/lehrer_schema.sql wurde bereits ausgeführt.
-- Ausführen: Supabase-Dashboard > SQL Editor > New query > Inhalt einfügen > Run.
-- Wiederholbar: legt nur an, was fehlt, und löscht keine Daten.
-- =====================================================================

-- ---------- 1. Aufgaben ----------
-- kind = 'module': ein Modul der App bearbeiten (module_id). kind = 'custom': eigene Aufgabe mit Aufgabenstellung und Fragen.
-- announce_at: ab dann sehen die Lernenden die Aufgabe als angekündigt (ohne Inhalt).
-- opens_at: ab dann ist sie freigeschaltet und kann bearbeitet und abgegeben werden. due_at: Abgabefrist (optional).
create table if not exists public.assignments (
  id            uuid primary key default gen_random_uuid(),
  course_id     uuid not null references public.courses (id) on delete cascade,
  title         text not null check (length(trim(title)) between 1 and 120),
  kind          text not null check (kind in ('module', 'custom')),
  module_id     text,
  instructions  text not null default '',
  questions     jsonb not null default '[]'::jsonb,
  announce_at   timestamptz not null default now(),
  opens_at      timestamptz not null default now(),
  due_at        timestamptz,
  allow_late    boolean not null default true,
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (announce_at <= opens_at),
  check (due_at is null or due_at > opens_at),
  check (kind <> 'module' or module_id is not null)
);
create index if not exists assignments_course_idx on public.assignments (course_id, opens_at);

-- ---------- 2. Abgaben ----------
create table if not exists public.submissions (
  assignment_id  uuid not null references public.assignments (id) on delete cascade,
  user_id        uuid not null references auth.users (id) on delete cascade,
  status         text not null default 'started' check (status in ('started', 'submitted', 'returned')),
  answers        jsonb not null default '{}'::jsonb,
  score          jsonb,
  submitted_at   timestamptz,
  feedback       text,
  feedback_at    timestamptz,
  updated_at     timestamptz not null default now(),
  primary key (assignment_id, user_id)
);
create index if not exists submissions_user_idx on public.submissions (user_id);

-- ---------- 3. Darf die angemeldete Person diese Aufgabe gerade bearbeiten? ----------
create or replace function public.can_submit(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.assignments a join public.profiles p on p.id = auth.uid() and p.course_id = a.course_id
     where a.id = p_id and now() >= a.opens_at and (a.due_at is null or now() <= a.due_at or a.allow_late));
$$;
grant execute on function public.can_submit(uuid) to authenticated;

-- ---------- 4. Aufgaben für Lernende ----------
-- Lernende lesen Aufgaben nur über diese Funktion: nur ihr Kurs, erst ab der Ankündigung,
-- und Aufgabenstellung und Fragen erst ab der Freischaltung.
drop function if exists public.my_assignments();
create function public.my_assignments()
returns table (id uuid, course_id uuid, title text, kind text, module_id text, instructions text, questions jsonb,
               announce_at timestamptz, opens_at timestamptz, due_at timestamptz, allow_late boolean, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select a.id, a.course_id, a.title, a.kind, a.module_id,
         case when now() >= a.opens_at then a.instructions else '' end,
         case when now() >= a.opens_at then a.questions else '[]'::jsonb end,
         a.announce_at, a.opens_at, a.due_at, a.allow_late, a.created_at
    from public.assignments a
    join public.profiles p on p.id = auth.uid() and p.course_id = a.course_id
   where now() >= a.announce_at
   order by a.opens_at;
$$;
revoke all on function public.my_assignments() from public;
grant execute on function public.my_assignments() to authenticated;

-- ---------- 5. Rückmeldung schützen ----------
-- Lernende können Rückmeldung und Status "zurückgegeben" nicht selbst setzen. Abgabezeit setzt die Datenbank.
create or replace function public.protect_submission()
returns trigger language plpgsql as $$
begin
  if not public.is_teacher() and coalesce(auth.role(), '') in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.feedback := null; new.feedback_at := null;
      if new.status = 'returned' then new.status := 'started'; end if;
    else
      new.feedback := old.feedback; new.feedback_at := old.feedback_at;
      if new.status = 'returned' and old.status <> 'returned' then new.status := old.status; end if;
    end if;
    if new.status = 'submitted' and (tg_op = 'INSERT' or old.status <> 'submitted') then new.submitted_at := now();
    elsif tg_op = 'UPDATE' then new.submitted_at := old.submitted_at; end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists submissions_protect on public.submissions;
create trigger submissions_protect before insert or update on public.submissions
  for each row execute function public.protect_submission();

drop trigger if exists assignments_touch on public.assignments;
create trigger assignments_touch before update on public.assignments
  for each row execute function public.touch_updated();

-- ---------- 6. Row Level Security ----------
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;

-- Aufgaben: direkter Zugriff nur für Lehrkräfte (Lernende nutzen my_assignments).
drop policy if exists assignments_teacher on public.assignments;
create policy assignments_teacher on public.assignments for all to authenticated
  using (public.is_teacher()) with check (public.is_teacher());

-- Abgaben: Lernende sehen ihre eigenen und schreiben nur, solange die Aufgabe offen ist. Lehrkräfte sehen alle und geben Rückmeldung.
drop policy if exists submissions_select on public.submissions;
create policy submissions_select on public.submissions for select to authenticated
  using (user_id = auth.uid() or public.is_teacher());
drop policy if exists submissions_insert on public.submissions;
create policy submissions_insert on public.submissions for insert to authenticated
  with check (user_id = auth.uid() and public.can_submit(assignment_id));
drop policy if exists submissions_update_own on public.submissions;
create policy submissions_update_own on public.submissions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.can_submit(assignment_id));
drop policy if exists submissions_teacher on public.submissions;
create policy submissions_teacher on public.submissions for update to authenticated
  using (public.is_teacher()) with check (public.is_teacher());
drop policy if exists submissions_delete on public.submissions;
create policy submissions_delete on public.submissions for delete to authenticated
  using (public.is_teacher());
