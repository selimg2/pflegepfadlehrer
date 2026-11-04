-- Fallpfad: Erweiterung Lehrer-Portal (Lehrer-Stundenplan, neue Aufgabenarten)
-- Einmal im Supabase SQL-Editor ausführen. Das Skript kann gefahrlos mehrfach laufen.

-- ---------- 1. Aufgaben: Training, Team-Krankenhaus und Live-Fall ----------
-- module_id enthält bei kind = 'training' den Schlüssel des Trainings (z. B. 'praxexamen:innere'),
-- bei kind = 'team' den Schlüssel des Team-Falls. Bei kind = 'live' steht der Fall in questions[0].live.
alter table public.assignments drop constraint if exists assignments_kind_check;
alter table public.assignments add constraint assignments_kind_check
  check (kind in ('module', 'custom', 'training', 'team', 'live'));

-- ---------- 2. Lehrer-Stundenplan ----------
-- Jede Lehrkraft sieht und bearbeitet nur ihre eigenen Stunden.
create table if not exists public.teacher_lessons (
  id          uuid primary key default gen_random_uuid(),
  teacher_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day         date not null,
  t_start     time not null,
  t_end       time not null,
  course_id   uuid references public.courses (id) on delete set null,
  kurs_text   text check (kurs_text is null or length(kurs_text) <= 80),
  topic       text not null check (length(trim(topic)) between 1 and 140),
  room        text check (room is null or length(room) <= 60),
  note        text check (note is null or length(note) <= 2000),
  plan        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (t_end > t_start)
);
create index if not exists teacher_lessons_owner_day_idx on public.teacher_lessons (teacher_id, day);

alter table public.teacher_lessons enable row level security;
drop policy if exists "teacher_lessons_own" on public.teacher_lessons;
create policy "teacher_lessons_own" on public.teacher_lessons for all
  using (teacher_id = auth.uid() and public.is_teacher())
  with check (teacher_id = auth.uid() and public.is_teacher());

grant select, insert, update, delete on public.teacher_lessons to authenticated;
