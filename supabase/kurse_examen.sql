-- =====================================================================
-- Fallpfad: Kurs-Einstellungen und Ergebnisse des Examenssimulators
-- Voraussetzung: supabase/lehrer_schema.sql wurde ausgeführt. Wiederholbar.
-- =====================================================================

-- 1. Kurs-Einstellungen: welche Ausbildungsjahre und Module ein Kurs sieht
--    settings = {"years": [1], "hidden": ["fm7"]}
alter table public.courses add column if not exists settings jsonb not null default '{}'::jsonb;

-- Die App liest die Einstellungen schon vor der Anmeldung (nur Jahre und ausgeblendete Module, keine personenbezogenen Daten)
create or replace function public.course_settings(p_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('years', coalesce(settings -> 'years', '[]'::jsonb), 'hidden', coalesce(settings -> 'hidden', '[]'::jsonb))
    from public.courses where id = p_id;
$$;
revoke all on function public.course_settings(uuid) from public;
grant execute on function public.course_settings(uuid) to anon, authenticated;

-- 2. Ergebnisse des Examenssimulators
create table if not exists public.exam_results (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  mode        text,
  n           int not null check (n between 1 and 500),
  correct     int not null check (correct >= 0),
  pct         numeric(5, 1) not null check (pct between 0 and 100),
  duration_s  int,
  by_area     jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists exam_results_user_idx on public.exam_results (user_id, created_at desc);
alter table public.exam_results enable row level security;
drop policy if exists exam_insert_own on public.exam_results;
create policy exam_insert_own on public.exam_results for insert to authenticated with check (user_id = auth.uid());
drop policy if exists exam_select on public.exam_results;
create policy exam_select on public.exam_results for select to authenticated using (user_id = auth.uid() or public.is_teacher());
drop policy if exists exam_delete_teacher on public.exam_results;
create policy exam_delete_teacher on public.exam_results for delete to authenticated using (public.is_teacher());
