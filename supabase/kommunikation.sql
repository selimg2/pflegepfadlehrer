-- =====================================================================
-- Fallpfad: Eigene Gruppenarbeiten, Nachrichten und Stundenplan
-- Voraussetzung: supabase/lehrer_schema.sql und supabase/team.sql wurden ausgeführt.
-- Ausführen: Supabase-Dashboard > SQL Editor > New query > Inhalt einfügen > Run. Wiederholbar.
-- Danach erledigen Lehrkräfte alles im Lehrer-Portal; weitere Änderungen in Supabase sind nicht nötig.
-- =====================================================================

-- ---------- 1. Eigene Gruppenarbeiten (Team-Krankenhaus) ----------
-- Eine eigene Gruppenarbeit ist eine Zeile in team_cases mit case_key 'c_…' und dem Fall samt Bausteinen in data.
alter table public.team_cases add column if not exists data jsonb;
alter table public.team_cases add column if not exists published boolean not null default false;

create or replace function public.team_case_list(p_course uuid default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('key', t.case_key, 'data', t.data) order by t.updated_at desc), '[]'::jsonb)
    from public.team_cases t
   where t.data is not null and t.published and (t.course_id is null or t.course_id = p_course);
$$;

-- team_get liefert zusätzlich den Fall einer eigenen Gruppenarbeit
create or replace function public.team_get(p_code text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('code', r.code, 'case_key', r.case_key, 'course_id', r.course_id, 'doc', r.doc, 'members', r.members, 'at', r.updated_at,
           'tasks', coalesce((select t.tasks from public.team_cases t where t.case_key = r.case_key and t.course_id = r.course_id and jsonb_array_length(t.tasks) > 0),
                             (select t.tasks from public.team_cases t where t.case_key = r.case_key and t.course_id is null and jsonb_array_length(t.tasks) > 0),
                             (select t.tasks from public.team_cases t where t.case_key = r.case_key and t.data is not null and jsonb_array_length(t.tasks) > 0 limit 1)),
           'note',  coalesce((select t.note from public.team_cases t where t.case_key = r.case_key and t.course_id = r.course_id),
                             (select t.note from public.team_cases t where t.case_key = r.case_key and t.course_id is null),
                             (select t.note from public.team_cases t where t.case_key = r.case_key and t.data is not null limit 1)),
           'case',  (select t.data from public.team_cases t where t.case_key = r.case_key and t.data is not null limit 1))
    from public.team_rooms r
   where r.code = upper(trim(p_code)) and r.created_at > now() - interval '60 days';
$$;

revoke all on function public.team_case_list(uuid) from public;
grant execute on function public.team_case_list(uuid) to anon, authenticated;
grant execute on function public.team_get(text) to anon, authenticated;

-- ---------- 2. Nachrichten an Kurse oder einzelne Lernende ----------
-- course_id und student_id leer: an alle. Nur course_id: an den Kurs. student_id: nur an diese Person.
create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid references public.courses (id) on delete cascade,
  student_id  uuid references auth.users (id) on delete cascade,
  title       text not null check (length(trim(title)) between 1 and 140),
  body        text check (body is null or length(body) <= 4000),
  important   boolean not null default true,
  author      text check (author is null or length(author) <= 80),
  batch       uuid,
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz
);
create index if not exists messages_course on public.messages (course_id, created_at desc);
create index if not exists messages_student on public.messages (student_id, created_at desc);

create table if not exists public.message_reads (
  message_id  uuid not null references public.messages (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  read_at     timestamptz not null default now(),
  primary key (message_id, user_id)
);

alter table public.messages enable row level security;
alter table public.message_reads enable row level security;
drop policy if exists messages_teacher on public.messages;
create policy messages_teacher on public.messages for all to authenticated using (public.is_teacher()) with check (public.is_teacher());
drop policy if exists message_reads_teacher on public.message_reads;
create policy message_reads_teacher on public.message_reads for select to authenticated using (public.is_teacher());

-- Lernende lesen ihre Nachrichten über diese Funktion. Ohne Anmeldung nur die Kursnachrichten des gewählten Kurses.
create or replace function public.my_messages(p_course uuid default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'title', m.title, 'body', m.body, 'important', m.important, 'author', m.author,
           'created_at', m.created_at, 'expires_at', m.expires_at, 'personal', m.student_id is not null) order by m.created_at desc), '[]'::jsonb)
    from public.messages m
   where (m.expires_at is null or m.expires_at > now()) and m.created_at > now() - interval '90 days'
     and ((m.student_id is not null and m.student_id = auth.uid())
       or (m.student_id is null and m.course_id is not null and (m.course_id = p_course or m.course_id = (select p.course_id from public.profiles p where p.id = auth.uid())))
       or (m.student_id is null and m.course_id is null));
$$;

create or replace function public.message_read(p_id uuid)
returns void language sql security definer set search_path = public as $$
  insert into public.message_reads (message_id, user_id) select p_id, auth.uid() where auth.uid() is not null and exists (select 1 from public.messages where id = p_id)
  on conflict do nothing;
$$;

revoke all on function public.my_messages(uuid) from public;
revoke all on function public.message_read(uuid) from public;
grant execute on function public.my_messages(uuid) to anon, authenticated;
grant execute on function public.message_read(uuid) to authenticated;

-- ---------- 3. Stundenplan je Kurs ----------
create table if not exists public.timetable (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references public.courses (id) on delete cascade,
  day         date not null,
  t_start     time not null,
  t_end       time not null,
  title       text not null check (length(trim(title)) between 1 and 120),
  teacher     text check (teacher is null or length(teacher) <= 80),
  room        text check (room is null or length(room) <= 60),
  note        text check (note is null or length(note) <= 500),
  status      text not null default 'normal' check (status in ('normal', 'ausfall', 'raum', 'vertretung', 'geaendert')),
  old_room    text check (old_room is null or length(old_room) <= 60),
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at  timestamptz not null default now(),
  check (t_end > t_start)
);
create index if not exists timetable_course_day on public.timetable (course_id, day, t_start);
drop trigger if exists timetable_touch on public.timetable;
create trigger timetable_touch before update on public.timetable for each row execute function public.touch_updated();

alter table public.timetable enable row level security;
drop policy if exists timetable_teacher on public.timetable;
create policy timetable_teacher on public.timetable for all to authenticated using (public.is_teacher()) with check (public.is_teacher());

-- Lernende lesen den Stundenplan ihres Kurses für einen Zeitraum von höchstens neun Wochen
create or replace function public.course_timetable(p_course uuid, p_from date, p_to date)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'day', t.day, 't_start', to_char(t.t_start, 'HH24:MI'), 't_end', to_char(t.t_end, 'HH24:MI'),
           'title', t.title, 'teacher', t.teacher, 'room', t.room, 'note', t.note, 'status', t.status, 'old_room', t.old_room) order by t.day, t.t_start), '[]'::jsonb)
    from public.timetable t
   where t.course_id = p_course and t.day between p_from and least(p_to, p_from + 62);
$$;

revoke all on function public.course_timetable(uuid, date, date) from public;
grant execute on function public.course_timetable(uuid, date, date) to anon, authenticated;
