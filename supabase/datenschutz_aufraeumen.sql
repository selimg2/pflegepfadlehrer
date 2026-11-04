-- Fallpfad: automatische Löschfristen (Löschkonzept, Anlage 3 des AVV)
-- Einmal im Supabase SQL-Editor ausführen. Danach läuft die Bereinigung jede Nacht (pg_cron).
-- Supabase: Database > Extensions > pg_cron aktivieren, falls noch nicht geschehen.

create or replace function public.fp_datenschutz_aufraeumen() returns void
language plpgsql security definer set search_path = public as $$
begin
  -- Live-Unterricht: Sitzungen und Stimmen nach 30 Tagen (Stimmen hängen per Fremdschlüssel an der Sitzung)
  if to_regclass('public.live_sessions') is not null then
    delete from public.live_sessions where created_at < now() - interval '30 days';
  end if;
  -- Nachrichten mit Ablaufdatum: 30 Tage nach Ablauf endgültig löschen
  if to_regclass('public.messages') is not null then
    delete from public.messages where expires_at is not null and expires_at < now() - interval '30 days';
  end if;
  -- Zähler für KI-Import und Übersetzungen
  if to_regclass('public.fp_import_log') is not null then
    delete from public.fp_import_log where created_at < now() - interval '90 days';
  end if;
  if to_regclass('public.fp_ls_nutzung') is not null then
    delete from public.fp_ls_nutzung where tag < current_date - 7;
  end if;
  if to_regclass('public.fp_uebersetzungen') is not null then
    delete from public.fp_uebersetzungen where created_at < now() - interval '365 days';
  end if;
  -- Team-Krankenhaus: Gruppenräume 60 Tage nach letzter Änderung
  if to_regclass('public.team_rooms') is not null and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'team_rooms' and column_name = 'updated_at') then
    execute 'delete from public.team_rooms where updated_at < now() - interval ''60 days''';
  end if;
end $$;
revoke all on function public.fp_datenschutz_aufraeumen() from public, anon, authenticated;

-- Täglich um 03:17 Uhr (UTC)
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'fp-datenschutz';
    perform cron.schedule('fp-datenschutz', '17 3 * * *', 'select public.fp_datenschutz_aufraeumen()');
  else
    raise notice 'pg_cron ist nicht aktiv: bitte unter Database > Extensions aktivieren und dieses Skript erneut ausführen.';
  end if;
end $$;
