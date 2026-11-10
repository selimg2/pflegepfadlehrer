-- Fallpfad: Pflegeplanung (Tageszähler) und Sicherheits-Härtung, Stand 10.11.2026.
-- Einmal im Supabase SQL-Editor ausführen (wiederholbar).

-- =====================================================================
-- 1. Pflegeplanung: Tageszähler für die KI-Rückmeldung (nur Anzahl, keine Inhalte)
-- =====================================================================
create table if not exists public.fp_pp_nutzung (
  user_id uuid not null references auth.users(id) on delete cascade,
  tag date not null,
  anzahl integer not null default 0,
  primary key (user_id, tag)
);
alter table public.fp_pp_nutzung enable row level security;
comment on table public.fp_pp_nutzung is 'Pflegeplanung: nur Anzahl der KI-Rückmeldungen je Konto und Tag (Kostenschutz). Keine Inhalte. Löschung nach 7 Tagen.';

create or replace function public.fp_pp_zaehlen(p_user uuid, p_limit integer) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  insert into public.fp_pp_nutzung (user_id, tag, anzahl) values (p_user, current_date, 0)
    on conflict (user_id, tag) do nothing;
  update public.fp_pp_nutzung set anzahl = anzahl + 1
    where user_id = p_user and tag = current_date and anzahl < p_limit
    returning anzahl into n;
  return coalesce(n, -1);
end $$;
revoke all on function public.fp_pp_zaehlen(uuid, integer) from public, anon, authenticated;
grant execute on function public.fp_pp_zaehlen(uuid, integer) to service_role;

create or replace function public.fp_pp_zurueck(p_user uuid) returns void
language sql security definer set search_path = public as $$
  update public.fp_pp_nutzung set anzahl = greatest(0, anzahl - 1) where user_id = p_user and tag = current_date;
$$;
revoke all on function public.fp_pp_zurueck(uuid) from public, anon, authenticated;
grant execute on function public.fp_pp_zurueck(uuid) to service_role;

-- =====================================================================
-- 2. Tabellen, die nur die Edge Functions (Service-Rolle) nutzen: ausdrücklich ohne Zugriff für Apps
--    (beseitigt den Hinweis "RLS enabled, no policy" und dokumentiert die Absicht)
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array['fp_assistent_nutzung', 'fp_pp_nutzung'] loop
    execute format('drop policy if exists kein_zugriff on public.%I', t);
    execute format('create policy kein_zugriff on public.%I for all to anon, authenticated using (false) with check (false)', t);
  end loop;
end $$;

-- =====================================================================
-- 3. Funktionen, die nur angemeldete Konten brauchen: nicht mehr ohne Anmeldung aufrufbar
--    (Funktionen für Live-Unterricht, Unterschrift per Einmal-Link und Gruppen-Code bleiben bewusst öffentlich,
--     sie prüfen selbst Code bzw. Token.)
-- =====================================================================
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef and p.proname in (
      'can_submit', 'course_timetable', 'message_read', 'my_assignments', 'my_messages', 'my_school',
      'nw_korrektur', 'nw_lehrer_eintrag', 'nw_loeschen', 'nw_pa_list', 'nw_sign_azubi', 'nw_sign_onsite',
      'nw_token_create', 'nw_vorlage_get', 'redeem_teacher_invite', 'team_case_list', 'team_create')
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;

-- Wartungsfunktionen laufen nur über den Zeitplan (pg_cron), nicht aus den Apps
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('fp_assistent_aufraeumen', 'fp_gespraech_aufraeumen', 'fp_ls_aufraeumen', 'fp_import_purge', 'nw_token_cleanup', 'fp_datenschutz_aufraeumen', 'fp_pp_aufraeumen')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;

-- =====================================================================
-- 4. Automatische Löschfristen (pg_cron). Aktiviert die Erweiterung, falls sie fehlt.
-- =====================================================================
create extension if not exists pg_cron;

create or replace function public.fp_pp_aufraeumen() returns void language sql security definer set search_path = public as $$
  delete from public.fp_pp_nutzung where tag < current_date - 7;
$$;
revoke all on function public.fp_pp_aufraeumen() from public, anon, authenticated;

do $$
declare j record;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    for j in select * from (values
      ('fp-datenschutz', '17 3 * * *', 'fp_datenschutz_aufraeumen'),
      ('fp-pp-aufraeumen', '21 3 * * *', 'fp_pp_aufraeumen'),
      ('fp-assistent-aufraeumen', '29 3 * * *', 'fp_assistent_aufraeumen'),
      ('fp-gespraech-aufraeumen', '23 3 * * *', 'fp_gespraech_aufraeumen'),
      ('fp-pruef-aufraeumen', '33 3 * * *', 'fp_pruef_aufraeumen'),
      ('fp-nachrichten-aufraeumen', '37 3 * * *', 'messages_aufraeumen'),
      ('fp-token-aufraeumen', '41 3 * * *', 'nw_token_cleanup')
    ) as v(name, plan, fn) loop
      if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = j.fn and p.pronargs = 0) then
        perform cron.unschedule(jobid) from cron.job where jobname = j.name;
        perform cron.schedule(j.name, j.plan, format('select public.%I()', j.fn));
      end if;
    end loop;
  end if;
end $$;
