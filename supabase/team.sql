-- =====================================================================
-- Fallpfad: Team-Krankenhaus (Gruppenarbeit in Echtzeit)
-- Voraussetzung: supabase/lehrer_schema.sql wurde ausgeführt.
-- Ausführen: Supabase-Dashboard > SQL Editor > New query > Inhalt einfügen > Run. Wiederholbar.
-- Die Live-Synchronisation läuft über Supabase Realtime (Broadcast und Presence); dafür ist keine Tabelle nötig.
-- =====================================================================

-- Angepasste Arbeitsaufträge der Lehrkräfte je Fall, für alle Kurse (course_id null) oder einen Kurs
create table if not exists public.team_cases (
  id          uuid primary key default gen_random_uuid(),
  case_key    text not null check (length(case_key) between 1 and 40),
  course_id   uuid references public.courses (id) on delete cascade,
  tasks       jsonb not null default '[]'::jsonb check (jsonb_typeof(tasks) = 'array'),
  note        text check (note is null or length(note) <= 2000),
  updated_by  uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at  timestamptz not null default now()
);
create unique index if not exists team_cases_case_course on public.team_cases (case_key, coalesce(course_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Gruppenräume. doc enthält die gemeinsame Dokumentation (Feld -> Text), members die Vornamen der Beteiligten.
create table if not exists public.team_rooms (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  case_key    text not null check (length(case_key) between 1 and 40),
  course_id   uuid references public.courses (id) on delete set null,
  doc         jsonb not null default '{}'::jsonb,
  members     jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists team_rooms_course on public.team_rooms (course_id, updated_at desc);

drop trigger if exists team_cases_touch on public.team_cases;
create trigger team_cases_touch before update on public.team_cases for each row execute function public.touch_updated();
drop trigger if exists team_rooms_touch on public.team_rooms;
create trigger team_rooms_touch before update on public.team_rooms for each row execute function public.touch_updated();

alter table public.team_cases enable row level security;
alter table public.team_rooms enable row level security;

drop policy if exists team_cases_teacher on public.team_cases;
create policy team_cases_teacher on public.team_cases for all to authenticated using (public.is_teacher()) with check (public.is_teacher());
drop policy if exists team_rooms_teacher_read on public.team_rooms;
create policy team_rooms_teacher_read on public.team_rooms for select to authenticated using (public.is_teacher());
drop policy if exists team_rooms_teacher_del on public.team_rooms;
create policy team_rooms_teacher_del on public.team_rooms for delete to authenticated using (public.is_teacher());

-- Lernende arbeiten nur über diese Funktionen; der Raumcode ist der Zugang.
create or replace function public.team_get(p_code text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('code', r.code, 'case_key', r.case_key, 'course_id', r.course_id, 'doc', r.doc, 'members', r.members, 'at', r.updated_at,
           'tasks', coalesce((select t.tasks from public.team_cases t where t.case_key = r.case_key and t.course_id = r.course_id),
                             (select t.tasks from public.team_cases t where t.case_key = r.case_key and t.course_id is null)),
           'note',  coalesce((select t.note from public.team_cases t where t.case_key = r.case_key and t.course_id = r.course_id),
                             (select t.note from public.team_cases t where t.case_key = r.case_key and t.course_id is null)))
    from public.team_rooms r
   where r.code = upper(trim(p_code)) and r.created_at > now() - interval '60 days';
$$;

create or replace function public.team_create(p_case text, p_course uuid default null, p_name text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_code text; v_course uuid; i int := 0;
begin
  if p_case is null or p_case !~ '^[a-z0-9_-]{1,40}$' then raise exception 'Ungültiger Fall'; end if;
  select id into v_course from public.courses where id = p_course;
  loop
    v_code := (select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '') from generate_series(1, 6));
    begin
      insert into public.team_rooms (code, case_key, course_id, members)
      values (v_code, p_case, v_course, case when length(trim(coalesce(p_name, ''))) between 1 and 40 then jsonb_build_array(trim(p_name)) else '[]'::jsonb end);
      exit;
    exception when unique_violation then
      i := i + 1; if i > 5 then raise; end if;
    end;
  end loop;
  return public.team_get(v_code);
end $$;

create or replace function public.team_join(p_code text, p_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_name text := trim(coalesce(p_name, ''));
begin
  if length(v_name) between 1 and 40 then
    update public.team_rooms set members = members || jsonb_build_array(v_name)
     where code = upper(trim(p_code)) and not members ? v_name and jsonb_array_length(members) < 12;
  end if;
  return public.team_get(p_code);
end $$;

-- Änderungen feldweise zusammenführen: Felder, die andere gerade bearbeiten, bleiben unberührt.
create or replace function public.team_patch(p_code text, p_patch jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then return false; end if;
  if (select count(*) from jsonb_object_keys(p_patch)) > 80 then return false; end if;
  if exists (select 1 from jsonb_each(p_patch) e
              where length(e.key) > 40 or e.key !~ '^[a-z0-9_:]+$'
                 or (jsonb_typeof(e.value) not in ('string', 'null'))
                 or (jsonb_typeof(e.value) = 'string' and length(e.value #>> '{}') > 5000)) then return false; end if;
  select id into v_id from public.team_rooms where code = upper(trim(p_code)) and created_at > now() - interval '60 days';
  if v_id is null then return false; end if;
  update public.team_rooms set doc = jsonb_strip_nulls(doc || p_patch) where id = v_id and pg_column_size(doc || p_patch) < 300000;
  return found;
end $$;

revoke all on function public.team_get(text) from public;
revoke all on function public.team_create(text, uuid, text) from public;
revoke all on function public.team_join(text, text) from public;
revoke all on function public.team_patch(text, jsonb) from public;
grant execute on function public.team_get(text) to anon, authenticated;
grant execute on function public.team_create(text, uuid, text) to anon, authenticated;
grant execute on function public.team_join(text, text) to anon, authenticated;
grant execute on function public.team_patch(text, jsonb) to anon, authenticated;
