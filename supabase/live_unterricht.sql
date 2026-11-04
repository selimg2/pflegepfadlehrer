-- =====================================================================
-- Fallpfad: Live-Unterricht (Live-Stunden, Module live, Wortwolke, Schätzfrage, Reihenfolge)
-- und Freischalten von Modulen je Kurs.
-- Voraussetzung: live.sql, kurse_examen.sql. Wiederholbar. Nach schulen.sql ausführen.
-- =====================================================================

-- Freitext-Antworten (Wortwolke, Schätzfrage). Höchstens 200 Zeichen, keine Namen nötig.
alter table public.live_votes add column if not exists txt text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'live_votes_txt_len') then
    alter table public.live_votes add constraint live_votes_txt_len check (txt is null or length(txt) <= 200);
  end if;
end $$;

-- Öffentlicher Stand inklusive eigener Freitext-Antwort
create or replace function public.live_get(p_code text, p_voter text default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('phase', s.phase, 'step', s.step, 'pub', s.pub, 'at', s.updated_at,
           'mine', (select v.choice from public.live_votes v where v.session_id = s.id and v.step = s.step and v.voter = p_voter),
           'mytxt', (select v.txt from public.live_votes v where v.session_id = s.id and v.step = s.step and v.voter = p_voter),
           'n', (select count(*) from public.live_votes v where v.session_id = s.id and v.step = s.step))
    from public.live_sessions s
   where s.code = upper(trim(p_code)) and (s.ended_at is null or s.ended_at > now() - interval '2 hours') and s.created_at > now() - interval '12 hours'
   order by s.created_at desc limit 1;
$$;

-- Freitext abgeben: nur solange die Frage offen ist
create or replace function public.live_answer(p_code text, p_voter text, p_step int, p_text text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_t text := left(regexp_replace(coalesce(p_text, ''), '\s+', ' ', 'g'), 200);
begin
  if p_voter is null or length(p_voter) not between 8 and 64 then return false; end if;
  v_t := trim(v_t);
  if length(v_t) < 1 then return false; end if;
  select id into v_id from public.live_sessions
   where code = upper(trim(p_code)) and phase = 'question' and step = p_step and ended_at is null and created_at > now() - interval '12 hours';
  if v_id is null then return false; end if;
  insert into public.live_votes (session_id, step, voter, choice, txt) values (v_id, p_step, p_voter, '{0}', v_t)
    on conflict (session_id, step, voter) do update set txt = excluded.txt, choice = excluded.choice, created_at = now();
  return true;
end $$;

revoke all on function public.live_get(text, text) from public;
revoke all on function public.live_answer(text, text, int, text) from public;
grant execute on function public.live_get(text, text) to anon, authenticated;
grant execute on function public.live_answer(text, text, int, text) to anon, authenticated;

-- Kurs-Einstellungen: zusätzlich gesperrte (noch nicht freigeschaltete) Module
create or replace function public.course_settings(p_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('years', coalesce(settings -> 'years', '[]'::jsonb),
                            'hidden', coalesce(settings -> 'hidden', '[]'::jsonb),
                            'locked', coalesce(settings -> 'locked', '[]'::jsonb))
    from public.courses where id = p_id;
$$;
revoke all on function public.course_settings(uuid) from public;
grant execute on function public.course_settings(uuid) to anon, authenticated;
