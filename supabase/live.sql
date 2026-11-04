-- =====================================================================
-- Fallpfad: Live-Klassenfall (Beamer-Modus)
-- Voraussetzung: supabase/lehrer_schema.sql wurde ausgeführt.
-- Ausführen: Supabase-Dashboard > SQL Editor > New query > Inhalt einfügen > Run. Wiederholbar.
-- =====================================================================

-- Eigene Fälle der Lehrkräfte
create table if not exists public.live_cases (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (length(trim(title)) between 1 and 120),
  data        jsonb not null,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Laufende Sitzungen. pub enthält nur, was die Lernenden sehen dürfen (Lösungen erst nach dem Auflösen).
create table if not exists public.live_sessions (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  title       text,
  teacher_id  uuid references auth.users (id) on delete set null,
  step        int not null default -1,
  phase       text not null default 'lobby' check (phase in ('lobby', 'question', 'reveal', 'end')),
  pub         jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  ended_at    timestamptz
);

-- Stimmen. voter ist eine zufällige Gerätekennung, kein Name.
create table if not exists public.live_votes (
  session_id  uuid not null references public.live_sessions (id) on delete cascade,
  step        int not null,
  voter       text not null check (length(voter) between 8 and 64),
  choice      int[] not null,
  created_at  timestamptz not null default now(),
  primary key (session_id, step, voter)
);

drop trigger if exists live_sessions_touch on public.live_sessions;
create trigger live_sessions_touch before update on public.live_sessions for each row execute function public.touch_updated();
drop trigger if exists live_cases_touch on public.live_cases;
create trigger live_cases_touch before update on public.live_cases for each row execute function public.touch_updated();

alter table public.live_cases    enable row level security;
alter table public.live_sessions enable row level security;
alter table public.live_votes    enable row level security;

drop policy if exists live_cases_teacher on public.live_cases;
create policy live_cases_teacher on public.live_cases for all to authenticated using (public.is_teacher()) with check (public.is_teacher());
drop policy if exists live_sessions_teacher on public.live_sessions;
create policy live_sessions_teacher on public.live_sessions for all to authenticated using (public.is_teacher()) with check (public.is_teacher());
drop policy if exists live_votes_teacher on public.live_votes;
create policy live_votes_teacher on public.live_votes for select to authenticated using (public.is_teacher());
drop policy if exists live_votes_teacher_del on public.live_votes;
create policy live_votes_teacher_del on public.live_votes for delete to authenticated using (public.is_teacher());

-- Lernende lesen den öffentlichen Stand über den Code, auch ohne Anmeldung
create or replace function public.live_get(p_code text, p_voter text default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('phase', s.phase, 'step', s.step, 'pub', s.pub, 'at', s.updated_at,
           'mine', (select v.choice from public.live_votes v where v.session_id = s.id and v.step = s.step and v.voter = p_voter),
           'n', (select count(*) from public.live_votes v where v.session_id = s.id and v.step = s.step))
    from public.live_sessions s
   where s.code = upper(trim(p_code)) and (s.ended_at is null or s.ended_at > now() - interval '2 hours') and s.created_at > now() - interval '12 hours'
   order by s.created_at desc limit 1;
$$;

-- Abstimmen: nur solange die Frage offen ist
create or replace function public.live_vote(p_code text, p_voter text, p_step int, p_choice int[])
returns boolean language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if p_voter is null or length(p_voter) not between 8 and 64 then return false; end if;
  if p_choice is null or cardinality(p_choice) not between 1 and 8 then return false; end if;
  if exists (select 1 from unnest(p_choice) c where c < 0 or c > 9) then return false; end if;
  select id into v_id from public.live_sessions
   where code = upper(trim(p_code)) and phase = 'question' and step = p_step and ended_at is null and created_at > now() - interval '12 hours';
  if v_id is null then return false; end if;
  insert into public.live_votes (session_id, step, voter, choice) values (v_id, p_step, p_voter, p_choice)
    on conflict (session_id, step, voter) do update set choice = excluded.choice, created_at = now();
  return true;
end $$;

revoke all on function public.live_get(text, text) from public;
revoke all on function public.live_vote(text, text, int, int[]) from public;
grant execute on function public.live_get(text, text) to anon, authenticated;
grant execute on function public.live_vote(text, text, int, int[]) to anon, authenticated;
