-- =====================================================================
-- Fallpfad: mehrere Schulen in einer Datenbank (Mandantenfähigkeit)
-- Jede Schule sieht nur ihre eigenen Kurse, Lernenden, Module, Aufgaben, Nachweise usw.
-- Voraussetzung: alle anderen SQL-Dateien wurden ausgeführt (zuletzt lehrer_erweiterung.sql).
-- Ausführen: Supabase-Dashboard > SQL Editor > New query > Inhalt einfügen > Run.
-- Wiederholbar. Beim ersten Lauf werden alle vorhandenen Daten der Schule
-- „Erste Pflegeschule“ zugeordnet (Name später im Lehrer-Portal unter Schulen ändern).
-- =====================================================================

-- ---------- 1. Schulen ----------
create table if not exists public.schools (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (length(trim(name)) between 2 and 120),
  ort           text,
  kontakt       text,
  aktiv         boolean not null default true,
  max_lernende  int,
  notiz         text,
  created_at    timestamptz not null default now()
);
alter table public.schools enable row level security;

insert into public.schools (name)
select 'Erste Pflegeschule' where not exists (select 1 from public.schools);

-- ---------- 2. Rollen: zusätzlich "admin" (Plattform-Administration) ----------
alter table public.profiles add column if not exists school_id uuid references public.schools (id) on delete set null;
alter table public.profiles add column if not exists schulleitung boolean not null default false;
do $$ declare c text; begin
  select conname into c from pg_constraint
   where conrelid = 'public.profiles'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%role%';
  if c is not null then execute format('alter table public.profiles drop constraint %I', c); end if;
end $$;
alter table public.profiles add constraint profiles_role_check check (role in ('student', 'teacher', 'admin'));

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Lehrkraft = teacher oder admin
create or replace function public.is_teacher()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('teacher', 'admin'));
$$;

-- Schule der angemeldeten Person. Ist die Schule deaktiviert, kommt eine Kennung zurück, zu der es keine Daten gibt.
create or replace function public.my_school()
returns uuid language sql stable security definer set search_path = public as $$
  select case when s.id is null then null when s.aktiv then s.id else '00000000-0000-0000-0000-000000000000'::uuid end
  from public.profiles p left join public.schools s on s.id = p.school_id
  where p.id = auth.uid();
$$;

-- Zugriffsregel: Admin ohne gewählte Schule sieht alles, sonst nur die eigene Schule.
create or replace function public.fp_school_ok(s uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case when public.is_admin() then (public.my_school() is null or s is not distinct from public.my_school())
              else s is not distinct from public.my_school() end;
$$;

grant execute on function public.is_admin(), public.is_teacher(), public.my_school(), public.fp_school_ok(uuid) to anon, authenticated;

-- ---------- 3. Schul-Spalte in allen Tabellen + automatische Zuordnung ----------
-- fp_set_school('tabelle','spalte', ...): übernimmt die Schule vom ersten gefundenen Bezug
-- (z. B. vom Kurs oder von der Person), sonst die Schule der angemeldeten Person.
create or replace function public.fp_set_school()
returns trigger language plpgsql security definer set search_path = public as $$
declare v uuid; val text; i int := 0;
begin
  if new.school_id is not null and (public.is_admin() or auth.uid() is null) then return new; end if;
  while i + 1 < tg_nargs and v is null loop
    val := to_jsonb(new) ->> tg_argv[i + 1];
    if val is not null and val <> '' then
      execute format('select school_id from public.%I where id::text = $1', tg_argv[i]) into v using val;
    end if;
    i := i + 2;
  end loop;
  if v is null and auth.uid() is not null then v := public.my_school(); end if;
  if v = '00000000-0000-0000-0000-000000000000'::uuid then v := null; end if;
  new.school_id := coalesce(v, new.school_id);
  return new;
end $$;

do $$
declare
  d record;
  first_school uuid := (select id from public.schools order by created_at limit 1);
begin
  for d in select * from (values
    ('courses',             array[]::text[]),
    ('modules',             array[]::text[]),
    ('teacher_invites',     array['profiles','created_by']),
    ('assignments',         array['courses','course_id']),
    ('submissions',         array['profiles','user_id','assignments','assignment_id']),
    ('progress',            array['profiles','user_id']),
    ('exam_results',        array['profiles','user_id']),
    ('messages',            array['courses','course_id','profiles','student_id']),
    ('message_reads',       array['profiles','user_id']),
    ('timetable',           array['courses','course_id']),
    ('live_cases',          array[]::text[]),
    ('live_sessions',       array['profiles','teacher_id']),
    ('live_votes',          array['live_sessions','session_id']),
    ('team_cases',          array['courses','course_id']),
    ('team_rooms',          array['courses','course_id']),
    ('nw_einsatz',          array['profiles','user_id']),
    ('nw_pa',               array['profiles','created_by']),
    ('nw_pa_device',        array['nw_pa','pa_id']),
    ('nw_aufgabe',          array['courses','course_id','profiles','student_id']),
    ('nw_eintrag',          array['profiles','user_id','nw_einsatz','einsatz_id']),
    ('nw_signatur',         array['nw_eintrag','eintrag_id']),
    ('nw_token',            array['profiles','user_id']),
    ('nw_vorlage',          array['profiles','created_by']),
    ('nw_zeugnis',          array['profiles','user_id']),
    ('nw_log',              array['profiles','user_id','nw_eintrag','eintrag_id']),
    ('fp_bezug',            array['profiles','user_id']),
    ('fp_einsatz_feedback', array['profiles','user_id']),
    ('fp_meldung',          array['profiles','user_id']),
    ('fp_puls',             array['profiles','user_id','courses','course_id']),
    ('fp_pruefung',         array['profiles','owner']),
    ('fp_pruef_lauf',       array['profiles','owner']),
    ('teacher_lessons',     array['profiles','teacher_id'])
  ) as t(tbl, args)
  loop
    if to_regclass('public.' || d.tbl) is null then continue; end if;
    execute format('alter table public.%I add column if not exists school_id uuid references public.schools (id) on delete cascade', d.tbl);
    execute format('create index if not exists %I on public.%I (school_id)', d.tbl || '_school_idx', d.tbl);
    execute format('alter table public.%I disable trigger user', d.tbl);
    execute format('update public.%I set school_id = %L where school_id is null', d.tbl, first_school);
    execute format('alter table public.%I enable trigger user', d.tbl);
    execute format('drop trigger if exists fp_school_set on public.%I', d.tbl);
    execute format('create trigger fp_school_set before insert or update on public.%I for each row execute function public.fp_set_school(%s)',
      d.tbl, coalesce((select string_agg(quote_literal(a), ', ') from unnest(d.args) a), ''));
    execute format('alter table public.%I enable row level security', d.tbl);
    if d.tbl <> 'courses' then
      execute format('drop policy if exists fp_school_gate on public.%I', d.tbl);
      execute format('create policy fp_school_gate on public.%I as restrictive for all to authenticated using (public.fp_school_ok(school_id)) with check (public.fp_school_ok(school_id))', d.tbl);
    end if;
  end loop;
  -- Bestehende Konten der ersten Schule zuordnen (außer Admins)
  update public.profiles set school_id = first_school where school_id is null and role <> 'admin';
end $$;

-- Anonyme Zugriffe (ohne Anmeldung) sehen keine schuleigenen Module mehr
drop policy if exists fp_school_gate_anon on public.modules;
create policy fp_school_gate_anon on public.modules as restrictive for select to anon using (false);

-- Kurse: Wer noch keiner Schule angehört, darf Kurse finden (Beitritt per Kurscode). Ändern nur in der eigenen Schule.
drop policy if exists fp_school_gate on public.courses;
drop policy if exists fp_school_gate_sel on public.courses;
drop policy if exists fp_school_gate_ins on public.courses;
drop policy if exists fp_school_gate_upd on public.courses;
drop policy if exists fp_school_gate_del on public.courses;
create policy fp_school_gate_sel on public.courses as restrictive for select to authenticated
  using (public.fp_school_ok(school_id) or public.my_school() is null);
create policy fp_school_gate_ins on public.courses as restrictive for insert to authenticated with check (public.fp_school_ok(school_id));
create policy fp_school_gate_upd on public.courses as restrictive for update to authenticated using (public.fp_school_ok(school_id)) with check (public.fp_school_ok(school_id));
create policy fp_school_gate_del on public.courses as restrictive for delete to authenticated using (public.fp_school_ok(school_id));

-- Module: dieselbe Modul-ID darf es in jeder Schule einmal geben (z. B. eine eigene Fassung von fm4)
alter table public.modules alter column school_id set not null;
do $$ begin
  if (select array_length(conkey, 1) from pg_constraint where conname = 'modules_pkey' and conrelid = 'public.modules'::regclass) = 1 then
    alter table public.modules drop constraint modules_pkey;
    alter table public.modules add constraint modules_pkey primary key (id, school_id);
  end if;
end $$;

-- ---------- 4. Profile: Schule folgt dem Kurs, niemand wechselt die Schule selbst ----------
create or replace function public.fp_profile_school()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') in ('authenticated', 'anon')
     and not public.is_admin()
     and coalesce(current_setting('fallpfad.allow_school', true), '') <> 'on' then
    if new.course_id is not null and (tg_op = 'INSERT' or new.course_id is distinct from old.course_id) then
      new.school_id := (select school_id from public.courses where id = new.course_id);
    elsif tg_op = 'UPDATE' then
      new.school_id := old.school_id;
      new.schulleitung := old.schulleitung;
    else
      new.school_id := null;
      new.schulleitung := false;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists fp_profile_school on public.profiles;
create trigger fp_profile_school before insert or update on public.profiles for each row execute function public.fp_profile_school();

-- Wechselt eine Person die Schule, ziehen ihre Daten mit
create or replace function public.fp_profile_school_move()
returns trigger language plpgsql security definer set search_path = public as $$
declare t text;
begin
  if new.school_id is not distinct from old.school_id or new.school_id is null then return new; end if;
  foreach t in array array['progress','exam_results','submissions','message_reads','nw_einsatz','nw_eintrag','nw_token','nw_zeugnis','nw_log',
                           'fp_bezug','fp_einsatz_feedback','fp_meldung','fp_puls'] loop
    if to_regclass('public.' || t) is not null then
      execute format('update public.%I set school_id = $1 where user_id = $2', t) using new.school_id, new.id;
    end if;
  end loop;
  update public.nw_signatur s set school_id = new.school_id from public.nw_eintrag e where s.eintrag_id = e.id and e.user_id = new.id;
  return new;
end $$;
drop trigger if exists fp_profile_school_move on public.profiles;
create trigger fp_profile_school_move after update on public.profiles for each row execute function public.fp_profile_school_move();

-- Profile: eigenes Profil immer, sonst nur die eigene Schule
drop policy if exists fp_school_gate on public.profiles;
create policy fp_school_gate on public.profiles as restrictive for all to authenticated
  using (id = auth.uid() or public.fp_school_ok(school_id))
  with check (id = auth.uid() or public.fp_school_ok(school_id));

-- ---------- 5. Einladungscodes gehören zu einer Schule ----------
create or replace function public.redeem_teacher_invite(p_code text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v record;
begin
  if auth.uid() is null then raise exception 'Bitte zuerst anmelden.'; end if;
  select i.code, i.school_id, coalesce(i.schulleitung, false) as sl into v from public.teacher_invites i
   where i.code = upper(trim(p_code)) and i.used_by is null for update;
  if v.code is null then return false; end if;
  if v.school_id is not null and not exists (select 1 from public.schools where id = v.school_id and aktiv) then
    raise exception 'Diese Schule ist derzeit nicht freigeschaltet.';
  end if;
  perform set_config('fallpfad.allow_role', 'on', true);
  perform set_config('fallpfad.allow_school', 'on', true);
  insert into public.profiles (id, role, school_id, schulleitung) values (auth.uid(), 'teacher', v.school_id, v.sl)
    on conflict (id) do update set role = case when public.profiles.role = 'admin' then 'admin' else 'teacher' end,
                                   school_id = coalesce(v.school_id, public.profiles.school_id),
                                   schulleitung = v.sl or public.profiles.schulleitung;
  update public.teacher_invites set used_by = auth.uid(), used_at = now() where code = v.code;
  return true;
end $$;
alter table public.teacher_invites add column if not exists schulleitung boolean not null default false;
revoke all on function public.redeem_teacher_invite(text) from public;
grant execute on function public.redeem_teacher_invite(text) to authenticated;

-- Lehrkräfte-Auswahl in der App: nur Lehrkräfte der eigenen Schule
create or replace function public.fp_lehrkraefte() returns table (id uuid, name text)
language sql stable security definer set search_path = public as $$
  select p.id, coalesce(nullif(trim(p.display_name), ''), split_part(p.email, '@', 1)) as name
  from public.profiles p
  where p.role = 'teacher' and auth.uid() is not null and p.school_id is not distinct from public.my_school()
  order by 2;
$$;

-- ---------- 6. Schulen lesen: jede Person ihre eigene, Admin alle ----------
drop policy if exists schools_select on public.schools;
create policy schools_select on public.schools for select to authenticated
  using (public.is_admin() or id = (select school_id from public.profiles where id = auth.uid()));
drop policy if exists schools_admin on public.schools;
create policy schools_admin on public.schools for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
grant select on public.schools to authenticated;
grant insert, update, delete on public.schools to authenticated;

-- ---------- 7. Funktionen für den Admin-Bereich im Lehrer-Portal ----------
create or replace function public.fp_admin_check() returns void language plpgsql stable security definer set search_path = public as $$
begin if not public.is_admin() then raise exception 'Nur für die Plattform-Administration.'; end if; end $$;

-- Übersicht aller Schulen mit Zahlen
create or replace function public.fp_admin_schools()
returns table (id uuid, name text, ort text, kontakt text, aktiv boolean, max_lernende int, notiz text, created_at timestamptz,
               lehrkraefte bigint, lernende bigint, kurse bigint, module bigint, offene_codes bigint, zuletzt_aktiv timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.fp_admin_check();
  return query
  select s.id, s.name, s.ort, s.kontakt, s.aktiv, s.max_lernende, s.notiz, s.created_at,
    (select count(*) from public.profiles p where p.school_id = s.id and p.role = 'teacher'),
    (select count(*) from public.profiles p where p.school_id = s.id and p.role = 'student'),
    (select count(*) from public.courses c where c.school_id = s.id),
    (select count(*) from public.modules m where m.school_id = s.id),
    (select count(*) from public.teacher_invites i where i.school_id = s.id and i.used_by is null),
    (select max(g.updated_at) from public.progress g where g.school_id = s.id)
  from public.schools s order by s.created_at;
end $$;

-- Schule anlegen oder ändern
create or replace function public.fp_admin_school_save(p_id uuid, p_name text, p_ort text, p_kontakt text, p_aktiv boolean, p_max int, p_notiz text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  perform public.fp_admin_check();
  if p_id is null then
    insert into public.schools (name, ort, kontakt, aktiv, max_lernende, notiz) values (trim(p_name), p_ort, p_kontakt, coalesce(p_aktiv, true), p_max, p_notiz) returning id into v;
  else
    update public.schools set name = trim(p_name), ort = p_ort, kontakt = p_kontakt, aktiv = coalesce(p_aktiv, aktiv), max_lernende = p_max, notiz = p_notiz where id = p_id;
    v := p_id;
  end if;
  return v;
end $$;

-- Einladungscodes für Lehrkräfte einer Schule erzeugen
create or replace function public.fp_admin_invites(p_school uuid, p_anzahl int, p_schulleitung boolean)
returns setof text language plpgsql security definer set search_path = public as $$
declare k int; c text;
begin
  perform public.fp_admin_check();
  for k in 1 .. greatest(1, least(coalesce(p_anzahl, 1), 50)) loop
    c := upper(substr(md5(random()::text || clock_timestamp()::text || k::text), 1, 8));
    insert into public.teacher_invites (code, created_by, school_id, schulleitung) values (c, auth.uid(), p_school, coalesce(p_schulleitung, false));
    return next c;
  end loop;
end $$;

-- Offene und benutzte Codes einer Schule
create or replace function public.fp_admin_codes(p_school uuid)
returns table (code text, schulleitung boolean, created_at timestamptz, used_at timestamptz, used_email text)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.fp_admin_check();
  return query select i.code, i.schulleitung, i.created_at, i.used_at, p.email
    from public.teacher_invites i left join public.profiles p on p.id = i.used_by
    where i.school_id = p_school order by i.created_at desc limit 200;
end $$;

-- Lehrkräfte einer Schule
create or replace function public.fp_admin_people(p_school uuid)
returns table (id uuid, email text, display_name text, role text, schulleitung boolean, kurs text, updated_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.fp_admin_check();
  return query select p.id, p.email, p.display_name, p.role, p.schulleitung, c.name, p.updated_at
    from public.profiles p left join public.courses c on c.id = p.course_id
    where p.school_id = p_school and p.role in ('teacher', 'admin') order by p.role, p.display_name;
end $$;

-- Person verschieben, Rolle ändern, Schulleitung setzen
create or replace function public.fp_admin_person(p_user uuid, p_school uuid, p_role text, p_schulleitung boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.fp_admin_check();
  if p_role is not null and p_role not in ('student', 'teacher') then raise exception 'Unbekannte Rolle.'; end if;
  perform set_config('fallpfad.allow_role', 'on', true);
  perform set_config('fallpfad.allow_school', 'on', true);
  update public.profiles set school_id = coalesce(p_school, school_id), role = coalesce(p_role, role),
         schulleitung = coalesce(p_schulleitung, schulleitung) where id = p_user and role <> 'admin';
end $$;

-- Admin: Portal als eine bestimmte Schule ansehen (null = alle Schulen)
create or replace function public.fp_admin_view(p_school uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.fp_admin_check();
  perform set_config('fallpfad.allow_school', 'on', true);
  update public.profiles set school_id = p_school where id = auth.uid();
end $$;

-- Meine Schule (für die Anzeige im Portal)
create or replace function public.fp_my_school()
returns table (id uuid, name text, aktiv boolean, rolle text, schulleitung boolean)
language sql stable security definer set search_path = public as $$
  select s.id, s.name, s.aktiv, p.role, p.schulleitung from public.profiles p left join public.schools s on s.id = p.school_id where p.id = auth.uid();
$$;

revoke all on function public.fp_admin_check(), public.fp_admin_schools(), public.fp_admin_school_save(uuid, text, text, text, boolean, int, text),
  public.fp_admin_invites(uuid, int, boolean), public.fp_admin_codes(uuid), public.fp_admin_people(uuid),
  public.fp_admin_person(uuid, uuid, text, boolean), public.fp_admin_view(uuid), public.fp_my_school() from public, anon;
grant execute on function public.fp_admin_check(), public.fp_admin_schools(), public.fp_admin_school_save(uuid, text, text, text, boolean, int, text),
  public.fp_admin_invites(uuid, int, boolean), public.fp_admin_codes(uuid), public.fp_admin_people(uuid),
  public.fp_admin_person(uuid, uuid, text, boolean), public.fp_admin_view(uuid), public.fp_my_school() to authenticated;

-- ---------- 8. Folien-Import: Protokoll für das Tageslimit (ohne Inhalte, Löschung nach 90 Tagen) ----------
create table if not exists public.fp_import_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users (id) on delete set null default auth.uid(),
  school_id   uuid references public.schools (id) on delete cascade,
  ziel        text,
  datei       text,
  seiten      int,
  zeichen     int,
  created_at  timestamptz not null default now()
);
alter table public.fp_import_log enable row level security;
drop trigger if exists fp_school_set on public.fp_import_log;
create trigger fp_school_set before insert or update on public.fp_import_log for each row execute function public.fp_set_school('profiles', 'user_id');
drop policy if exists fp_import_rw on public.fp_import_log;
create policy fp_import_rw on public.fp_import_log for all to authenticated
  using (public.is_teacher() and public.fp_school_ok(school_id)) with check (public.is_teacher());
grant select, insert on public.fp_import_log to authenticated;

-- Datenminimierung: Protokolleinträge werden nach 90 Tagen automatisch gelöscht (bei jedem neuen Eintrag)
create or replace function public.fp_import_purge()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.fp_import_log where created_at < now() - interval '90 days';
  return null;
end $$;
drop trigger if exists fp_import_purge on public.fp_import_log;
create trigger fp_import_purge after insert on public.fp_import_log for each statement execute function public.fp_import_purge();
comment on table public.fp_import_log is 'Folien-Import: nur Zeitpunkt, Person, Schule, Zielart, Seitenzahl, Zeichenzahl. Keine Inhalte, keine Dateinamen. Löschung nach 90 Tagen.';

-- =====================================================================
-- Dich selbst zur Administration machen (einmal, mit deiner E-Mail-Adresse):
--   update public.profiles set role = 'admin', school_id = null where email = 'deine@email.de';
-- =====================================================================
