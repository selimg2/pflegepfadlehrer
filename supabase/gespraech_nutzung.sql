-- Fallpfad Training "Kommunikation": Tageszähler für Sprachgespräche und Auswertungen
-- Einmal im Supabase SQL-Editor ausführen (wiederholbar). Die Tabelle ist nur für die Edge Functions
-- "gespraech-sitzung" und "gespraech-auswertung" (Service-Rolle) zugänglich. Gespeichert werden nur Zahlen, keine Inhalte.

create table if not exists public.fp_gespraech_nutzung (
  user_id uuid not null references auth.users(id) on delete cascade,
  tag date not null,
  gespraeche integer not null default 0,
  auswertungen integer not null default 0,
  primary key (user_id, tag)
);

alter table public.fp_gespraech_nutzung enable row level security;
-- Keine Policies: ohne Policy haben angemeldete Nutzer und anon keinen Zugriff, nur die Service-Rolle.

-- Aufräumen nach 7 Tagen (zusätzlich räumen die Funktionen selbst gelegentlich auf)
create or replace function public.fp_gespraech_aufraeumen() returns void language sql security definer set search_path = public as $$
  delete from public.fp_gespraech_nutzung where tag < current_date - 7;
$$;
revoke all on function public.fp_gespraech_aufraeumen() from public, anon, authenticated;

-- Optional mit pg_cron:
-- select cron.schedule('fp-gespraech-aufraeumen', '23 3 * * *', 'select public.fp_gespraech_aufraeumen()');
