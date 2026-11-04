-- Fallpfad "Meine Sprache": Cache für übersetzte Lerninhalte und Tageszähler
-- Einmal im Supabase SQL-Editor ausführen. Beide Tabellen sind nur für die Edge Function "uebersetzen"
-- (Service-Rolle) zugänglich; die Apps lesen und schreiben sie nie direkt.

create table if not exists public.fp_uebersetzungen (
  h text not null,                 -- SHA-256 aus Sprache und Ausgangstext (kein Personenbezug)
  lang text not null,
  out text not null,
  created_at timestamptz not null default now(),
  primary key (h, lang)
);

create table if not exists public.fp_ls_nutzung (
  user_id uuid not null references auth.users(id) on delete cascade,
  tag date not null,
  zeichen integer not null default 0,  -- nur die Zahl übersetzter Zeichen, keine Inhalte
  primary key (user_id, tag)
);

alter table public.fp_uebersetzungen enable row level security;
alter table public.fp_ls_nutzung enable row level security;
-- Keine Policies: ohne Policy haben angemeldete Nutzer und anon keinen Zugriff, nur die Service-Rolle.

-- Aufräumen: Zähler nach 7 Tagen, Cache nach 365 Tagen (Inhalte könnten sich ändern)
create or replace function public.fp_ls_aufraeumen() returns void language sql security definer set search_path = public as $$
  delete from public.fp_ls_nutzung where tag < current_date - 7;
  delete from public.fp_uebersetzungen where created_at < now() - interval '365 days';
$$;
revoke all on function public.fp_ls_aufraeumen() from public, anon, authenticated;

-- Optional mit pg_cron (Supabase: Database > Extensions > pg_cron aktivieren):
-- select cron.schedule('fp-ls-aufraeumen', '17 3 * * *', 'select public.fp_ls_aufraeumen()');
