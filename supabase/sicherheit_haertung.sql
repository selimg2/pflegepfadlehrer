-- Fallpfad: Sicherheits-Härtung und Datenschutz-Funktionen (Schritt 13, nach allen anderen Dateien ausführen).
-- Einmal im Supabase SQL-Editor ausführen. Die Datei ist wiederholbar und löscht keine Daten.
--
-- Inhalt:
--   1. Fester search_path für alle Funktionen (verhindert, dass fremde Objekte untergeschoben werden)
--   2. Trigger-Funktionen sind nicht mehr über die API aufrufbar
--   3. Reine Wartungsfunktionen sind nicht mehr ohne Anmeldung aufrufbar
--   4. Einwilligungsprotokoll (Nachweis nach Art. 7 Abs. 1 DSGVO) mit Widerruf
--   5. Datenauskunft zum Herunterladen (Art. 15 und Art. 20 DSGVO)
--   6. Ausdrückliche Sperr-Regeln für Tabellen, die nur der Server nutzt

-- 1. search_path festlegen -------------------------------------------------------------------------------------
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e') -- keine Funktionen aus Erweiterungen
  loop
    execute format('alter function %s set search_path = public, extensions, pg_temp', f.sig);
  end loop;
end $$;

-- 2. Trigger-Funktionen: kein Aufruf über /rest/v1/rpc ----------------------------------------------------------
-- Trigger laufen unabhängig vom EXECUTE-Recht weiter; das Recht wird nur beim Anlegen des Triggers geprüft.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prorettype = 'trigger'::regtype
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;

-- 3. Wartungsfunktionen: nie ohne Anmeldung ---------------------------------------------------------------------
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig, p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('fp_import_purge', 'fp_pruef_aufraeumen', 'messages_aufraeumen', 'fp_datenschutz_aufraeumen')
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    if f.proname in ('fp_import_purge', 'fp_datenschutz_aufraeumen') then
      execute format('revoke execute on function %s from authenticated', f.sig); -- laufen nur über pg_cron bzw. den Server
    else
      execute format('grant execute on function %s to authenticated', f.sig);    -- ruft das Lehrer-Portal auf
    end if;
  end loop;
end $$;

-- 4. Einwilligungsprotokoll --------------------------------------------------------------------------------------
-- Je Konto und Zweck genau eine Zeile: wann eingewilligt, welche Textfassung, wann widerrufen.
-- Kein Inhalt, keine IP-Adresse. Wird mit dem Konto gelöscht.
create table if not exists public.fp_einwilligungen (
  user_id       uuid not null references auth.users (id) on delete cascade,
  zweck         text not null check (zweck in ('sprachsimulation', 'uebersetzung')),
  fassung       text not null default 'v1',
  erteilt_at    timestamptz not null default now(),
  widerrufen_at timestamptz,
  primary key (user_id, zweck)
);
alter table public.fp_einwilligungen enable row level security;

drop policy if exists "einwilligung_eigene_lesen" on public.fp_einwilligungen;
create policy "einwilligung_eigene_lesen" on public.fp_einwilligungen
  for select to authenticated using (user_id = (select auth.uid()));
-- Schreiben nur über die beiden Funktionen unten (Zeitstempel setzt der Server, nicht die App).
revoke insert, update, delete on public.fp_einwilligungen from anon, authenticated;

create or replace function public.fp_einwilligung_erteilen(p_zweck text, p_fassung text default 'v1')
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet' using errcode = '28000'; end if;
  insert into public.fp_einwilligungen (user_id, zweck, fassung)
  values (auth.uid(), p_zweck, left(coalesce(p_fassung, 'v1'), 20))
  on conflict (user_id, zweck) do update
    set fassung = excluded.fassung,
        erteilt_at = case when public.fp_einwilligungen.widerrufen_at is null and public.fp_einwilligungen.fassung = excluded.fassung
                          then public.fp_einwilligungen.erteilt_at else now() end,
        widerrufen_at = null;
end $$;

create or replace function public.fp_einwilligung_widerrufen(p_zweck text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet' using errcode = '28000'; end if;
  update public.fp_einwilligungen set widerrufen_at = now()
  where user_id = auth.uid() and zweck = p_zweck and widerrufen_at is null;
end $$;

revoke all on function public.fp_einwilligung_erteilen(text, text) from public, anon;
revoke all on function public.fp_einwilligung_widerrufen(text) from public, anon;
grant execute on function public.fp_einwilligung_erteilen(text, text) to authenticated;
grant execute on function public.fp_einwilligung_widerrufen(text) to authenticated;

-- 5. Datenauskunft ------------------------------------------------------------------------------------------------
-- Liefert alle Zeilen, die auf das eigene Konto verweisen, als JSON. Die Funktion läuft mit den Rechten der
-- angemeldeten Person (SECURITY INVOKER): Es gelten alle Zugriffsregeln (RLS). Sie kann also nichts ausgeben,
-- was die Person nicht ohnehin sehen darf. Neue Tabellen mit Verweis auf auth.users sind automatisch enthalten.
create or replace function public.fp_meine_daten()
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  uid uuid := auth.uid();
  r record;
  zeilen jsonb;
  daten jsonb := '{}'::jsonb;
begin
  if uid is null then raise exception 'Nicht angemeldet' using errcode = '28000'; end if;
  for r in
    select cl.relname as tab, a.attname as col
    from pg_constraint c
    join pg_class cl on cl.oid = c.conrelid
    join pg_namespace n on n.oid = cl.relnamespace
    join pg_class f on f.oid = c.confrelid
    join pg_namespace fn on fn.oid = f.relnamespace
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f' and n.nspname = 'public' and fn.nspname = 'auth' and f.relname = 'users'
      and array_length(c.conkey, 1) = 1
    order by 1, 2
  loop
    begin
      execute format('select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) from (select * from public.%I where %I = $1 limit 10000) t', r.tab, r.col)
        into zeilen using uid;
      if zeilen <> '[]'::jsonb then
        daten := daten || jsonb_build_object(r.tab || '.' || r.col, zeilen);
      end if;
    exception when insufficient_privilege then
      null; -- Tabelle nur für den Server (z. B. Tageszähler): enthält keine Inhalte und wird übersprungen
    end;
  end loop;
  return jsonb_build_object(
    'erstellt_am', now(),
    'konto', uid,
    'hinweis', 'Auskunft nach Art. 15 DSGVO und Datenübertragbarkeit nach Art. 20 DSGVO. Enthalten sind alle in Fallpfad gespeicherten Datensätze, die auf dein Konto verweisen. Schlüssel: Tabelle.Spalte.',
    'daten', daten
  );
end $$;
revoke all on function public.fp_meine_daten() from public, anon;
grant execute on function public.fp_meine_daten() to authenticated;

-- 6. Tabellen nur für den Server ----------------------------------------------------------------------------------
-- RLS ist an und es gibt absichtlich keine Regel: Dann darf nur der Server (service_role) zugreifen.
-- Die ausdrückliche Sperr-Regel macht diese Absicht sichtbar und hält die Sicherheitsprüfung von Supabase sauber.
do $$
declare t text;
begin
  foreach t in array array['fp_gespraech_nutzung', 'fp_ls_nutzung', 'fp_uebersetzungen'] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('drop policy if exists "nur_server" on public.%I', t);
      execute format('create policy "nur_server" on public.%I as restrictive for all to anon, authenticated using (false) with check (false)', t);
    end if;
  end loop;
end $$;

-- Zum Schluss von Hand im Dashboard (lässt sich nicht per SQL setzen):
--   Authentication > Sign In / Providers > Email: "Leaked password protection" einschalten,
--   Mindestlänge des Passworts auf 10 Zeichen, Bestätigung der E-Mail-Adresse einschalten.
