-- Fallpfad "Assistent": Tageszähler für Nachrichten an den KI-Assistenten (Schüler-App und Lehrer-Portal)
-- Einmal im Supabase SQL-Editor ausführen (wiederholbar). Die Tabelle ist nur für die Edge Function "assistent"
-- (Service-Rolle) zugänglich. Gespeichert wird nur die Anzahl der Nachrichten je Konto und Tag, keine Inhalte.

create table if not exists public.fp_assistent_nutzung (
  user_id uuid not null references auth.users(id) on delete cascade,
  tag date not null,
  nachrichten integer not null default 0,
  primary key (user_id, tag)
);

alter table public.fp_assistent_nutzung enable row level security;
-- Keine Policies: ohne Policy haben angemeldete Nutzer und anon keinen Zugriff, nur die Service-Rolle.

-- Zähler atomar erhöhen, aber nur bis zum Limit. Gibt die neue Anzahl zurück oder -1, wenn das Limit erreicht ist.
create or replace function public.fp_assistent_zaehlen(p_user uuid, p_limit integer) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  insert into public.fp_assistent_nutzung (user_id, tag, nachrichten) values (p_user, current_date, 0)
    on conflict (user_id, tag) do nothing;
  update public.fp_assistent_nutzung set nachrichten = nachrichten + 1
    where user_id = p_user and tag = current_date and nachrichten < p_limit
    returning nachrichten into n;
  return coalesce(n, -1);
end $$;
revoke all on function public.fp_assistent_zaehlen(uuid, integer) from public, anon, authenticated;
grant execute on function public.fp_assistent_zaehlen(uuid, integer) to service_role;

-- Eine Nachricht zurückgeben, wenn die KI keine Antwort liefern konnte (zählt dann nicht).
create or replace function public.fp_assistent_zurueck(p_user uuid) returns void
language sql security definer set search_path = public as $$
  update public.fp_assistent_nutzung set nachrichten = greatest(0, nachrichten - 1) where user_id = p_user and tag = current_date;
$$;
revoke all on function public.fp_assistent_zurueck(uuid) from public, anon, authenticated;
grant execute on function public.fp_assistent_zurueck(uuid) to service_role;

-- Aufräumen nach 7 Tagen
create or replace function public.fp_assistent_aufraeumen() returns void language sql security definer set search_path = public as $$
  delete from public.fp_assistent_nutzung where tag < current_date - 7;
$$;
revoke all on function public.fp_assistent_aufraeumen() from public, anon, authenticated;

-- Optional mit pg_cron:
-- select cron.schedule('fp-assistent-aufraeumen', '29 3 * * *', 'select public.fp_assistent_aufraeumen()');
