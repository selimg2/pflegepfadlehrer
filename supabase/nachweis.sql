-- =====================================================================
-- Fallpfad: Digitaler Ausbildungsnachweis (§ 3 Abs. 5 PflAPrV, § 17 Nr. 3 PflBG: "schriftlich oder elektronisch")
-- Voraussetzung: supabase/lehrer_schema.sql wurde ausgeführt.
-- Ausführen: Supabase-Dashboard > SQL Editor > New query > Inhalt einfügen > Run. Wiederholbar.
-- Grundsätze: Azubis erfassen; Praxisanleitende bestätigen ohne Konto per QR-Code, Einmal-Link oder vor Ort
-- mit Name und Unterschrift; ihr Gerät kann dauerhaft verbunden werden, die Schule gibt neue Personen frei.
-- Mehrere Praxisanleitende je Einsatz, Haupt-Praxisanleitung für Abschlussgespräch und Leistungseinschätzung.
-- Formulare (Gespräche, Felder, Regeln, Export) sind als Vorlage je Schule oder Kurs konfigurierbar.
-- Bestätigte Einträge sind gesperrt (Prüfsumme SHA-256), jede Änderung wird protokolliert.
-- =====================================================================

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------- Tabellen ----------
create table if not exists public.nw_einsatz (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  art           text not null check (art in ('orientierung','pflicht_akut','pflicht_lang','pflicht_ambulant','paediatrie','psychiatrie','vertiefung','weitere','frei')),
  einrichtung   text not null check (length(trim(einrichtung)) between 1 and 160),
  bereich       text check (bereich is null or length(bereich) <= 160),
  beginn        date not null,
  ende          date not null,
  soll_stunden  numeric(6,1) not null check (soll_stunden between 0 and 2500),
  freigegeben   boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (ende >= beginn)
);
create index if not exists nw_einsatz_user on public.nw_einsatz (user_id, beginn);

-- Praxisanleitende und Pflegefachpersonen: von der Schule eingeladen oder bei der ersten Bestätigung selbst angelegt
create table if not exists public.nw_pa (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (length(trim(name)) between 2 and 120),
  einrichtung   text not null check (length(trim(einrichtung)) between 1 and 160),
  email         text check (email is null or length(email) <= 200),
  invite        text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 10)),
  aktiv         boolean not null default true,
  created_by    uuid default auth.uid() references auth.users (id) on delete set null,
  created_at    timestamptz not null default now()
);

alter table public.nw_pa add column if not exists freigegeben   boolean not null default false;
alter table public.nw_pa add column if not exists quelle        text not null default 'schule';
alter table public.nw_pa add column if not exists rolle         text not null default 'praxisanleitung';
alter table public.nw_pa add column if not exists qualifikation boolean not null default false;
alter table public.nw_pa add column if not exists last_seen     timestamptz;
alter table public.nw_pa drop column if exists hat_code;
alter table public.nw_pa drop column if exists pin_hash;
alter table public.nw_pa drop column if exists fails;
alter table public.nw_pa drop column if exists locked_until;
alter table public.nw_pa drop constraint if exists nw_pa_quelle_check;
alter table public.nw_pa add constraint nw_pa_quelle_check check (quelle in ('schule','selbst'));
alter table public.nw_pa drop constraint if exists nw_pa_rolle_check;
alter table public.nw_pa add constraint nw_pa_rolle_check check (rolle in ('praxisanleitung','pflegefachperson','leitung'));
create index if not exists nw_pa_name on public.nw_pa (lower(name), lower(einrichtung));

-- verbundene Geräte der Praxisanleitenden: nur der SHA-256-Wert des Geräteschlüssels wird gespeichert
create table if not exists public.nw_pa_device (
  id          uuid primary key default gen_random_uuid(),
  pa_id       uuid not null references public.nw_pa (id) on delete cascade,
  key_hash    text not null unique,
  user_agent  text check (user_agent is null or length(user_agent) <= 300),
  created_at  timestamptz not null default now(),
  last_used   timestamptz not null default now()
);

alter table public.nw_einsatz add column if not exists haupt_pa uuid references public.nw_pa (id) on delete set null;
-- Zeiterfassung: 'manuell' = Azubis tragen Arbeitstage ein, 'stempel' = Stunden aus der Zeiterfassung der Einrichtung, bestätigt im Einsatznachweis
alter table public.nw_einsatz add column if not exists zeiterfassung text not null default 'manuell';
alter table public.nw_einsatz drop constraint if exists nw_einsatz_zeiterfassung_check;
alter table public.nw_einsatz add constraint nw_einsatz_zeiterfassung_check check (zeiterfassung in ('manuell','stempel'));

create table if not exists public.nw_aufgabe (
  id            uuid primary key default gen_random_uuid(),
  course_id     uuid references public.courses (id) on delete cascade,
  student_id    uuid references auth.users (id) on delete cascade,
  titel         text not null check (length(trim(titel)) between 1 and 160),
  beschreibung  text check (beschreibung is null or length(beschreibung) <= 4000),
  kompetenz     text check (kompetenz is null or length(kompetenz) <= 40),
  faellig       date,
  created_by    uuid default auth.uid() references auth.users (id) on delete set null,
  created_at    timestamptz not null default now()
);

create table if not exists public.nw_eintrag (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  einsatz_id       uuid references public.nw_einsatz (id) on delete cascade,
  typ              text not null check (typ in ('arbeitszeit','anleitung','fehlzeit','fehlzeit_theorie','gespraech','aufgabe','nacht','begleitung','leistung','zwischenpruefung','sonstiges','einsatznachweis')),
  datum            date not null,
  stunden          numeric(5,2) not null default 0 check (stunden between 0 and 400),
  data             jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 60000),
  aufgabe_id       uuid references public.nw_aufgabe (id) on delete set null,
  status           text not null default 'entwurf' check (status in ('entwurf','offen','bestaetigt','korrektur')),
  hash             text,
  bestaetigt_at    timestamptz,
  korrektur_grund  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
alter table public.nw_eintrag drop constraint if exists nw_eintrag_typ_check;
alter table public.nw_eintrag add constraint nw_eintrag_typ_check check (typ in ('arbeitszeit','anleitung','fehlzeit','fehlzeit_theorie','gespraech','aufgabe','nacht','begleitung','leistung','zwischenpruefung','sonstiges','einsatznachweis'));
create index if not exists nw_eintrag_user on public.nw_eintrag (user_id, datum);
create index if not exists nw_eintrag_einsatz on public.nw_eintrag (einsatz_id);

create table if not exists public.nw_signatur (
  id             uuid primary key default gen_random_uuid(),
  eintrag_id     uuid not null references public.nw_eintrag (id) on delete cascade,
  rolle          text not null check (rolle in ('azubi','praxisanleitung','pflegefachperson','leitung','lehrkraft')),
  name           text not null check (length(trim(name)) between 2 and 120),
  pa_id          uuid references public.nw_pa (id) on delete set null,
  verifiziert    boolean not null default false,
  methode        text not null check (methode in ('vor_ort','qr','link','konto')),
  strokes        text check (strokes is null or length(strokes) <= 60000),
  hash           text not null,
  signed_at      timestamptz not null default now(),
  widerrufen_at  timestamptz
);
alter table public.nw_signatur add column if not exists funktion text;
alter table public.nw_signatur add column if not exists geraet   text;
alter table public.nw_signatur add column if not exists bekannt  boolean not null default false;
alter table public.nw_signatur add column if not exists titel    text check (titel is null or length(titel) <= 80);
alter table public.nw_signatur drop constraint if exists nw_signatur_rolle_check;
alter table public.nw_signatur add constraint nw_signatur_rolle_check check (rolle in ('azubi','praxisanleitung','pflegefachperson','leitung','lehrkraft'));
alter table public.nw_signatur drop constraint if exists nw_signatur_methode_check;
alter table public.nw_signatur add constraint nw_signatur_methode_check check (methode in ('vor_ort','qr','link','konto'));
create index if not exists nw_signatur_eintrag on public.nw_signatur (eintrag_id);
create index if not exists nw_signatur_pa on public.nw_signatur (pa_id);

create table if not exists public.nw_token (
  token       text primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  eintrag_ids uuid[] not null,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);
alter table public.nw_token add column if not exists art text not null default 'qr';

-- Formularvorlagen: Gespräche, Felder, Pflichten, Regeln und Export je Schule oder Kurs (Abweichungen der Landesbehörde)
create table if not exists public.nw_vorlage (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) between 1 and 120),
  land        text check (land is null or length(land) <= 60),
  data        jsonb not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 200000),
  aktiv       boolean not null default true,
  standard    boolean not null default false,
  course_ids  uuid[] not null default '{}',
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at  timestamptz not null default now()
);
drop trigger if exists nw_vorlage_touch on public.nw_vorlage;
create trigger nw_vorlage_touch before update on public.nw_vorlage for each row execute function public.touch_updated();

-- Jahreszeugnisse der Pflegeschule (§ 6 PflAPrV), Fehlzeiten werden aus dem Nachweis übernommen
create table if not exists public.nw_zeugnis (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  jahr          int not null check (jahr between 1 and 3),
  data          jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 60000),
  fehl_theorie  numeric(6,1) not null default 0,
  fehl_praxis   numeric(6,1) not null default 0,
  name          text,
  strokes       text check (strokes is null or length(strokes) <= 60000),
  erstellt_von  uuid default auth.uid() references auth.users (id) on delete set null,
  signed_at     timestamptz not null default now(),
  unique (user_id, jahr)
);

create table if not exists public.nw_log (
  id          bigserial primary key,
  eintrag_id  uuid,
  user_id     uuid,
  aktion      text not null,
  rolle       text,
  actor       uuid,
  detail      jsonb,
  at          timestamptz not null default now()
);
create index if not exists nw_log_user on public.nw_log (user_id, at desc);

drop trigger if exists nw_einsatz_touch on public.nw_einsatz;
create trigger nw_einsatz_touch before update on public.nw_einsatz for each row execute function public.touch_updated();

-- Einsatz: Plausibilität; nach der ersten Bestätigung ändern Azubis Art, Zeitraum, Soll und Zeiterfassung nicht mehr
create or replace function public.nw_einsatz_guard()
returns trigger language plpgsql set search_path = public as $$
declare heute date := (now() at time zone 'Europe/Berlin')::date;
begin
  if public.is_teacher() then return new; end if;
  if new.ende - new.beginn > 400 then raise exception 'Ein Einsatz dauert höchstens etwa ein Jahr.'; end if;
  if new.beginn > heute + 365 then raise exception 'Der Beginn liegt mehr als ein Jahr in der Zukunft.'; end if;
  if tg_op = 'UPDATE' and exists (select 1 from public.nw_eintrag e where e.einsatz_id = old.id and e.status = 'bestaetigt')
     and (new.art, new.beginn, new.ende, new.soll_stunden, new.zeiterfassung, new.einrichtung) is distinct from (old.art, old.beginn, old.ende, old.soll_stunden, old.zeiterfassung, old.einrichtung) then
    raise exception 'Der Einsatz enthält bestätigte Einträge. Art, Zeitraum, Soll-Stunden, Einrichtung und Zeiterfassung ändert jetzt nur die Pflegeschule.';
  end if;
  if tg_op = 'UPDATE' then new.user_id := old.user_id; end if;
  return new;
end $$;
drop trigger if exists nw_einsatz_guard on public.nw_einsatz;
create trigger nw_einsatz_guard before insert or update on public.nw_einsatz for each row execute function public.nw_einsatz_guard();

-- ---------- Schutz: bestätigte Einträge sind gesperrt ----------
create or replace function public.nw_guard()
returns trigger language plpgsql set search_path = public as $$
declare internal boolean := coalesce(current_setting('fp.nw_internal', true), '') = '1';
        heute date := (now() at time zone 'Europe/Berlin')::date; x public.nw_einsatz;
begin
  if tg_op = 'DELETE' then
    if old.status = 'bestaetigt' and not internal then raise exception 'Bestätigte Einträge können nicht gelöscht werden.'; end if;
    return old;
  end if;
  if tg_op = 'UPDATE' then
    if old.status = 'bestaetigt' and not internal then raise exception 'Bestätigte Einträge sind gesperrt. Eine Korrektur gibt nur die Lehrkraft frei.'; end if;
    if not internal then new.user_id := old.user_id; new.created_at := old.created_at; new.typ := old.typ; end if;
  end if;
  -- Datensparsamkeit (Art. 5 Abs. 1 lit. c, Art. 9 DSGVO): bei Fehlzeiten nur die Art, keine Diagnose, kein Freitext
  if new.typ in ('fehlzeit','fehlzeit_theorie') then
    new.data := jsonb_build_object('art', case when new.data ->> 'art' in ('krank','urlaub','sonstiges') then new.data ->> 'art' else 'sonstiges' end);
  end if;
  if not internal then
    if new.typ in ('fehlzeit_theorie','begleitung','zwischenpruefung') then raise exception 'Diesen Eintrag legt nur die Pflegeschule an.'; end if;
    if new.status not in ('entwurf','offen') then new.status := 'offen'; end if;
    new.hash := null; new.bestaetigt_at := null;
    if tg_op = 'INSERT' then new.korrektur_grund := null; end if;
    -- Plausibilität: kein Datum in der Zukunft, Datum im Einsatz, Stunden in sinnvollen Grenzen
    if new.datum > heute then raise exception 'Das Datum liegt in der Zukunft.'; end if;
    if new.einsatz_id is null then raise exception 'Bitte den Einsatz angeben.'; end if;
    select * into x from public.nw_einsatz where id = new.einsatz_id;
    if x.id is null or x.user_id <> new.user_id then raise exception 'Unbekannter Einsatz.'; end if;
    if new.datum < x.beginn or new.datum > x.ende + (case when new.typ in ('gespraech','einsatznachweis','leistung','sonstiges') then 14 else 0 end) then
      raise exception 'Das Datum liegt außerhalb des Einsatzes (% bis %).', to_char(x.beginn, 'DD.MM.YYYY'), to_char(x.ende, 'DD.MM.YYYY');
    end if;
    if x.zeiterfassung = 'stempel' and new.typ in ('arbeitszeit','fehlzeit') then raise exception 'In diesem Einsatz kommen Arbeitszeit und Fehlzeit aus der Zeiterfassung der Einrichtung.'; end if;
    if (new.typ = 'arbeitszeit' and new.stunden > 13) or (new.typ = 'anleitung' and new.stunden > 10) or (new.typ = 'fehlzeit' and new.stunden > 12) then raise exception 'Die Stundenzahl ist für einen Tag nicht plausibel.'; end if;
    if new.typ in ('arbeitszeit','anleitung','fehlzeit') and new.stunden <= 0 then raise exception 'Bitte die Stunden angeben.'; end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists nw_eintrag_guard on public.nw_eintrag;
create trigger nw_eintrag_guard before insert or update or delete on public.nw_eintrag for each row execute function public.nw_guard();

create or replace function public.nw_logger()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.nw_log (eintrag_id, user_id, aktion, actor, detail)
  values (coalesce(new.id, old.id), coalesce(new.user_id, old.user_id), lower(tg_op) || ':' || coalesce(new.status, old.status), auth.uid(),
          case when tg_op = 'DELETE' then to_jsonb(old) else null end);
  return coalesce(new, old);
end $$;
drop trigger if exists nw_eintrag_log on public.nw_eintrag;
create trigger nw_eintrag_log after insert or update or delete on public.nw_eintrag for each row execute function public.nw_logger();

-- ---------- Zugriffsrechte ----------
alter table public.nw_einsatz  enable row level security;
alter table public.nw_pa       enable row level security;
alter table public.nw_aufgabe  enable row level security;
alter table public.nw_eintrag  enable row level security;
alter table public.nw_signatur enable row level security;
alter table public.nw_token    enable row level security;
alter table public.nw_log      enable row level security;
alter table public.nw_pa_device enable row level security;
alter table public.nw_vorlage  enable row level security;
alter table public.nw_zeugnis  enable row level security;

drop policy if exists nw_einsatz_own on public.nw_einsatz;
create policy nw_einsatz_own on public.nw_einsatz for all to authenticated using (user_id = auth.uid() or public.is_teacher()) with check (user_id = auth.uid() or public.is_teacher());
drop policy if exists nw_pa_teacher on public.nw_pa;
create policy nw_pa_teacher on public.nw_pa for all to authenticated using (public.is_teacher()) with check (public.is_teacher());
drop policy if exists nw_aufgabe_teacher on public.nw_aufgabe;
create policy nw_aufgabe_teacher on public.nw_aufgabe for all to authenticated using (public.is_teacher()) with check (public.is_teacher());
drop policy if exists nw_aufgabe_student on public.nw_aufgabe;
create policy nw_aufgabe_student on public.nw_aufgabe for select to authenticated
  using (student_id = auth.uid() or (student_id is null and (course_id is null or course_id = (select p.course_id from public.profiles p where p.id = auth.uid()))));
drop policy if exists nw_eintrag_own on public.nw_eintrag;
create policy nw_eintrag_own on public.nw_eintrag for all to authenticated using (user_id = auth.uid() or public.is_teacher()) with check (user_id = auth.uid() or public.is_teacher());
drop policy if exists nw_signatur_read on public.nw_signatur;
create policy nw_signatur_read on public.nw_signatur for select to authenticated
  using (public.is_teacher() or exists (select 1 from public.nw_eintrag e where e.id = eintrag_id and e.user_id = auth.uid()));
drop policy if exists nw_device_teacher on public.nw_pa_device;
create policy nw_device_teacher on public.nw_pa_device for all to authenticated using (public.is_teacher()) with check (public.is_teacher());
drop policy if exists nw_vorlage_teacher on public.nw_vorlage;
create policy nw_vorlage_teacher on public.nw_vorlage for all to authenticated using (public.is_teacher()) with check (public.is_teacher());
drop policy if exists nw_zeugnis_teacher on public.nw_zeugnis;
create policy nw_zeugnis_teacher on public.nw_zeugnis for all to authenticated using (public.is_teacher()) with check (public.is_teacher());
drop policy if exists nw_zeugnis_own on public.nw_zeugnis;
create policy nw_zeugnis_own on public.nw_zeugnis for select to authenticated using (user_id = auth.uid());
drop policy if exists nw_log_read on public.nw_log;
create policy nw_log_read on public.nw_log for select to authenticated using (user_id = auth.uid() or public.is_teacher());

-- ---------- alte Fassungen entfernen (persönlicher Code entfällt) ----------
drop function if exists public.nw_confirm(uuid[], uuid, text, uuid, text, text, text);
drop function if exists public.nw_check_pin(uuid, text);
drop function if exists public.nw_sign_onsite(uuid[], text, uuid, text, text);
drop function if exists public.nw_token_create(uuid[]);
drop function if exists public.nw_token_sign(text, text, uuid, text, text);
drop function if exists public.nw_pa_setup(text, text);
drop function if exists public.nw_resolve_pa(text, uuid, text, text, text, text);
drop function if exists public.nw_sign_onsite(uuid[], uuid, text, text, text, boolean, text, jsonb, text);
drop function if exists public.nw_token_sign(text, text, text, text, text, boolean, text, jsonb, text);

-- ---------- Hilfsfunktionen ----------
create or replace function public.nw_hash(e public.nw_eintrag)
returns text language sql immutable set search_path = public, extensions as $$
  select encode(digest(concat_ws('|', e.id::text, e.user_id::text, e.typ, e.datum::text, e.stunden::text, coalesce(e.einsatz_id::text, ''), e.data::text), 'sha256'), 'hex');
$$;

create or replace function public.nw_keyhash(p_key text)
returns text language sql immutable set search_path = public, extensions as $$
  select encode(digest('fallpfad-pa|' || p_key, 'sha256'), 'hex');
$$;

-- gültige Vorlage für eine Person: Kursvorlage vor Schulstandard; null = BIBB-Standard in der App
create or replace function public.nw_vorlage_for(p_user uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(
    (select jsonb_build_object('id', v.id, 'name', v.name, 'land', v.land, 'data', v.data) from public.nw_vorlage v
      where v.aktiv and (select p.course_id from public.profiles p where p.id = p_user) = any(v.course_ids) order by v.updated_at desc limit 1),
    (select jsonb_build_object('id', v.id, 'name', v.name, 'land', v.land, 'data', v.data) from public.nw_vorlage v
      where v.aktiv and v.standard order by v.updated_at desc limit 1));
$$;

-- braucht dieser Eintrag die Haupt-Praxisanleitung? (Vorlage, sonst Abschlussgespräch und Leistungseinschätzung)
create or replace function public.nw_needs_haupt(e public.nw_eintrag)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare v jsonb := public.nw_vorlage_for(e.user_id) -> 'data'; r boolean;
begin
  if e.typ = 'leistung' then return coalesce((v -> 'leistung' ->> 'nur_haupt')::boolean, true); end if;
  if e.typ = 'gespraech' then
    select (g ->> 'nur_haupt')::boolean into r from jsonb_array_elements(coalesce(v -> 'gespraeche', '[]'::jsonb)) g where g ->> 'key' = e.data ->> 'art' limit 1;
    return coalesce(r, e.data ->> 'art' = 'abschluss');
  end if;
  return false;
end $$;

-- wer darf diesen Eintrag bestätigen? Stunden: Praxisanleitung, Pflegefachperson, Leitung; Einsatznachweis und eigene Arten laut Vorlage
create or replace function public.nw_allowed_roles(e public.nw_eintrag)
returns text[] language plpgsql stable security definer set search_path = public as $$
declare v jsonb := public.nw_vorlage_for(e.user_id) -> 'data'; r text[];
begin
  if e.typ in ('arbeitszeit','fehlzeit','nacht') then return array['praxisanleitung','pflegefachperson','leitung']; end if;
  if e.typ = 'einsatznachweis' then
    select array_agg(x) into r from jsonb_array_elements_text(coalesce(v -> 'einsatznachweis' -> 'rollen', '[]'::jsonb)) x;
    return coalesce(r, array['leitung']);
  end if;
  if e.typ = 'sonstiges' then
    select array_agg(x) into r from jsonb_array_elements(coalesce(v -> 'eigene', '[]'::jsonb)) t, jsonb_array_elements_text(coalesce(t -> 'rollen', '["praxisanleitung"]'::jsonb)) x where t ->> 'key' = e.data ->> 'vorlage_typ';
    return coalesce(r, array['praxisanleitung']);
  end if;
  return array['praxisanleitung'];
end $$;

-- wer bestätigt? Gerät bekannt > aus Liste gewählt > Name eingetippt (wird wiedererkannt oder neu angelegt)
create or replace function public.nw_resolve_pa(p_device text, p_pa uuid, p_name text, p_einrichtung text, p_rolle text, p_ua text, p_titel text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.nw_pa; v_name text := trim(coalesce(p_name, '')); v_ein text := trim(coalesce(p_einrichtung, '')); v_rolle text := coalesce(nullif(p_rolle, ''), 'praxisanleitung'); v_titel text := nullif(left(trim(coalesce(p_titel, '')), 80), '');
begin
  if p_device is not null and length(p_device) >= 32 then
    select a.* into r from public.nw_pa_device d join public.nw_pa a on a.id = d.pa_id where d.key_hash = public.nw_keyhash(p_device);
    if r.id is not null then
      if not r.aktiv then raise exception 'Diese Person wurde von der Pflegeschule deaktiviert.'; end if;
      update public.nw_pa_device set last_used = now() where key_hash = public.nw_keyhash(p_device);
      update public.nw_pa set last_seen = now() where id = r.id;
      return jsonb_build_object('pa', r.id, 'name', r.name, 'rolle', coalesce(nullif(p_rolle, ''), r.rolle), 'titel', v_titel, 'verifiziert', r.freigegeben, 'bekannt', true);
    end if;
  end if;
  if p_pa is not null then
    select * into r from public.nw_pa where id = p_pa;
    if r.id is null or not r.aktiv then raise exception 'Diese Person ist nicht mehr aktiv.'; end if;
    return jsonb_build_object('pa', r.id, 'name', r.name, 'rolle', coalesce(nullif(p_rolle, ''), r.rolle), 'titel', v_titel, 'verifiziert', false, 'bekannt', false);
  end if;
  if length(v_name) < 3 or position(' ' in v_name) = 0 then raise exception 'Bitte Vor- und Nachnamen eintragen.'; end if;
  if length(v_ein) < 2 then raise exception 'Bitte die Einrichtung eintragen.'; end if;
  if v_rolle not in ('praxisanleitung','pflegefachperson','leitung') then raise exception 'Bitte die Funktion wählen.'; end if;
  if p_device is null then
    select * into r from public.nw_pa where lower(name) = lower(v_name) and lower(einrichtung) = lower(v_ein) and aktiv order by freigegeben desc, created_at limit 1;
  end if;
  if r.id is null then
    insert into public.nw_pa (name, einrichtung, quelle, rolle, qualifikation, freigegeben, created_by, last_seen)
    values (v_name, v_ein, 'selbst', v_rolle, v_rolle = 'praxisanleitung', false, null, now()) returning * into r;
  end if;
  if p_device is not null and length(p_device) >= 32 then
    insert into public.nw_pa_device (pa_id, key_hash, user_agent) values (r.id, public.nw_keyhash(p_device), left(p_ua, 300)) on conflict (key_hash) do nothing;
  end if;
  return jsonb_build_object('pa', r.id, 'name', r.name, 'rolle', v_rolle, 'titel', v_titel, 'verifiziert', r.freigegeben and p_device is not null, 'bekannt', false, 'neu', r.created_at > now() - interval '5 seconds');
end $$;

-- Kern der Bestätigung
create or replace function public.nw_confirm(p_ids uuid[], p_owner uuid, p_who jsonb, p_strokes text, p_methode text, p_geraet text, p_haupt boolean, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare e public.nw_eintrag; n int := 0; v_hash text; v_pa uuid := (p_who ->> 'pa')::uuid; v_name text := p_who ->> 'name'; v_rolle text := coalesce(p_who ->> 'rolle', 'praxisanleitung');
        v_ver boolean := coalesce((p_who ->> 'verifiziert')::boolean, false); v_bek boolean := coalesce((p_who ->> 'bekannt')::boolean, false);
        v_haupt uuid; v_hname text; v_fn text; v_add jsonb; v_titel text := p_who ->> 'titel'; v_erl text[];
begin
  if p_ids is null or cardinality(p_ids) = 0 or cardinality(p_ids) > 100 then raise exception 'Keine Einträge ausgewählt.'; end if;
  if p_strokes is null or length(p_strokes) < 20 then raise exception 'Bitte unterschreiben.'; end if;
  perform set_config('fp.nw_internal', '1', true);
  for e in select * from public.nw_eintrag where id = any(p_ids) order by datum for update loop
    if e.user_id <> p_owner then raise exception 'Eintrag gehört nicht zu dieser Person.'; end if;
    if e.status = 'bestaetigt' then continue; end if;
    if e.typ in ('fehlzeit_theorie','begleitung','zwischenpruefung') then raise exception 'Dieser Eintrag wird von der Lehrkraft bestätigt.'; end if;
    v_erl := public.nw_allowed_roles(e);
    if not (v_rolle = any(v_erl)) then
      raise exception 'Diesen Eintrag bestätigt: %.', array_to_string(array(select case x when 'praxisanleitung' then 'Praxisanleitung' when 'pflegefachperson' then 'Pflegefachperson' when 'leitung' then 'Stations- oder Wohnbereichsleitung bzw. Vertretung' else x end from unnest(v_erl) x), ' oder ');
    end if;
    select haupt_pa into v_haupt from public.nw_einsatz where id = e.einsatz_id for update;
    if v_haupt is null and coalesce(p_haupt, false) and v_pa is not null and v_rolle = 'praxisanleitung' and e.einsatz_id is not null then
      update public.nw_einsatz set haupt_pa = v_pa where id = e.einsatz_id; v_haupt := v_pa;
    end if;
    if public.nw_needs_haupt(e) then
      if v_haupt is null then raise exception 'Dieser Eintrag wird von der Haupt-Praxisanleitung bestätigt. Bitte zuerst festlegen, wer die Haupt-Praxisanleitung des Einsatzes ist.'; end if;
      if v_pa is distinct from v_haupt then
        select name into v_hname from public.nw_pa where id = v_haupt;
        raise exception 'Diesen Eintrag bestätigt die Haupt-Praxisanleitung (%).', v_hname;
      end if;
    end if;
    if e.typ = 'einsatznachweis' then
      v_add := p_data -> e.id::text;
      if v_add is not null and jsonb_typeof(v_add) = 'object' then
        update public.nw_eintrag set data = e.data || v_add, stunden = coalesce(nullif(v_add ->> 'ist', '')::numeric, e.stunden) where id = e.id returning * into e;
      end if;
      if coalesce(e.data ->> 'ist', '') = '' then raise exception 'Bitte die geleisteten Stunden eintragen.'; end if;
    end if;
    if e.typ = 'leistung' then
      v_add := p_data -> e.id::text;
      if v_add is not null and jsonb_typeof(v_add) = 'object' then
        update public.nw_eintrag set data = e.data || v_add where id = e.id returning * into e;
      end if;
      if (select count(*) from jsonb_object_keys(e.data - 'art')) = 0 then raise exception 'Bitte die Leistungseinschätzung ausfüllen.'; end if;
    end if;
    v_fn := case when v_pa is not null and v_pa = v_haupt then 'haupt' else 'pa' end;
    v_hash := public.nw_hash(e);
    insert into public.nw_signatur (eintrag_id, rolle, name, pa_id, verifiziert, methode, strokes, hash, funktion, geraet, bekannt, titel)
    values (e.id, v_rolle, v_name, v_pa, v_ver, p_methode, p_strokes, v_hash, v_fn, left(p_geraet, 200), v_bek, v_titel);
    if e.typ not in ('gespraech','einsatznachweis') or exists (select 1 from public.nw_signatur s where s.eintrag_id = e.id and s.rolle = 'azubi' and s.widerrufen_at is null and s.hash = v_hash) then
      update public.nw_eintrag set status = 'bestaetigt', hash = v_hash, bestaetigt_at = now(), korrektur_grund = null where id = e.id;
    else
      update public.nw_eintrag set status = 'offen' where id = e.id;
    end if;
    insert into public.nw_log (eintrag_id, user_id, aktion, rolle, actor, detail)
    values (e.id, e.user_id, 'bestaetigt', v_rolle, null, jsonb_build_object('name', v_name, 'titel', v_titel, 'pa', v_pa, 'funktion', v_fn, 'methode', p_methode, 'verifiziert', v_ver, 'geraet_bekannt', v_bek, 'hash', v_hash));
    n := n + 1;
  end loop;
  perform set_config('fp.nw_internal', '', true);
  return jsonb_build_object('bestaetigt', n, 'name', v_name, 'verifiziert', v_ver, 'bekannt', v_bek, 'neu', coalesce((p_who ->> 'neu')::boolean, false));
end $$;

-- ---------- Funktionen für Azubis (angemeldet) ----------
-- bekannte Personen: von der Schule freigegeben oder haben schon für diese Person bestätigt
create or replace function public.nw_pa_list()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'einrichtung', a.einrichtung, 'rolle', a.rolle, 'freigegeben', a.freigegeben) order by a.einrichtung, a.name), '[]'::jsonb)
    from public.nw_pa a where a.aktiv and (
      exists (select 1 from public.nw_signatur s join public.nw_eintrag e on e.id = s.eintrag_id where s.pa_id = a.id and e.user_id = auth.uid())
      or (a.freigegeben and exists (select 1 from public.nw_einsatz x where x.user_id = auth.uid() and lower(trim(x.einrichtung)) = lower(trim(a.einrichtung)))));
$$;

create or replace function public.nw_vorlage_get()
returns jsonb language sql stable security definer set search_path = public as $$ select public.nw_vorlage_for(auth.uid()); $$;

-- Bestätigung auf dem Gerät der Azubis: Person aus der Liste wählen oder Name eintragen, unterschreiben
create or replace function public.nw_sign_onsite(p_ids uuid[], p_pa uuid, p_name text, p_einrichtung text, p_rolle text, p_titel text, p_haupt boolean, p_strokes text, p_data jsonb, p_ua text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Bitte anmelden.'; end if;
  return public.nw_confirm(p_ids, auth.uid(), public.nw_resolve_pa(null, p_pa, p_name, p_einrichtung, p_rolle, p_ua, p_titel), p_strokes, 'vor_ort', p_ua, p_haupt, p_data);
end $$;

create or replace function public.nw_sign_azubi(p_id uuid, p_strokes text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e public.nw_eintrag; v_name text; v_hash text;
begin
  select * into e from public.nw_eintrag where id = p_id and user_id = auth.uid() for update;
  if e.id is null then raise exception 'Eintrag nicht gefunden.'; end if;
  if e.status = 'bestaetigt' then return jsonb_build_object('status', e.status); end if;
  if p_strokes is null or length(p_strokes) < 20 then raise exception 'Bitte unterschreiben.'; end if;
  select coalesce(nullif(trim(display_name), ''), email, 'Auszubildende Person') into v_name from public.profiles where id = auth.uid();
  v_hash := public.nw_hash(e);
  perform set_config('fp.nw_internal', '1', true);
  update public.nw_signatur set widerrufen_at = now() where eintrag_id = e.id and rolle = 'azubi' and widerrufen_at is null;
  insert into public.nw_signatur (eintrag_id, rolle, name, verifiziert, methode, strokes, hash) values (e.id, 'azubi', coalesce(v_name, 'Auszubildende Person'), true, 'konto', p_strokes, v_hash);
  if exists (select 1 from public.nw_signatur s where s.eintrag_id = e.id and s.rolle <> 'azubi' and s.widerrufen_at is null and s.hash = v_hash) then
    update public.nw_eintrag set status = 'bestaetigt', hash = v_hash, bestaetigt_at = now() where id = e.id;
  else
    update public.nw_eintrag set status = 'offen' where id = e.id;
  end if;
  perform set_config('fp.nw_internal', '', true);
  return jsonb_build_object('status', (select status from public.nw_eintrag where id = e.id));
end $$;

-- QR-Code (Standard 30 Minuten) oder Einmal-Link zum Versenden (bis 72 Stunden); jeder Link gilt genau einmal
create or replace function public.nw_token_create(p_ids uuid[], p_minuten int default 30, p_art text default 'qr')
returns text language plpgsql security definer set search_path = public as $$
declare v_token text;
begin
  if auth.uid() is null then raise exception 'Bitte anmelden.'; end if;
  if p_ids is null or cardinality(p_ids) = 0 then raise exception 'Keine Einträge ausgewählt.'; end if;
  if exists (select 1 from unnest(p_ids) i where not exists (select 1 from public.nw_eintrag e where e.id = i and e.user_id = auth.uid())) then raise exception 'Unbekannter Eintrag.'; end if;
  perform public.nw_token_cleanup();
  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into public.nw_token (token, user_id, eintrag_ids, expires_at, art)
  values (v_token, auth.uid(), p_ids, now() + make_interval(mins => least(greatest(coalesce(p_minuten, 30), 5), 4320)), case when p_art = 'link' then 'link' else 'qr' end);
  return v_token;
end $$;

-- ---------- Funktionen für Praxisanleitende (ohne Konto) ----------
create or replace function public.nw_token_get(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when t.used_at is not null or t.expires_at < now() then jsonb_build_object('expires_at', t.expires_at, 'used', t.used_at is not null, 'eintraege', '[]'::jsonb) else jsonb_build_object(
      'azubi', coalesce((select nullif(trim(p.display_name), '') from public.profiles p where p.id = t.user_id), 'Auszubildende Person'),
      'expires_at', t.expires_at, 'used', false, 'art', t.art,
      'vorlage', public.nw_vorlage_for(t.user_id),
      'eintraege', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'typ', e.typ, 'datum', e.datum, 'stunden', e.stunden, 'data', e.data, 'status', e.status,
                                       'einsatz_id', e.einsatz_id, 'einrichtung', x.einrichtung, 'einsatz_art', x.art, 'beginn', x.beginn, 'ende', x.ende,
                                       'haupt_id', x.haupt_pa, 'haupt_name', (select a.name from public.nw_pa a where a.id = x.haupt_pa),
                                       'braucht_haupt', public.nw_needs_haupt(e), 'rollen', to_jsonb(public.nw_allowed_roles(e)), 'zeiterfassung', x.zeiterfassung, 'soll_stunden', x.soll_stunden) order by e.datum)
                             from public.nw_eintrag e left join public.nw_einsatz x on x.id = e.einsatz_id
                            where e.id = any(t.eintrag_ids) and e.user_id = t.user_id), '[]'::jsonb)) end
    from public.nw_token t where t.token = p_token and t.expires_at > now() - interval '1 day';
$$;

-- erkennt ein verbundenes Gerät (für vorausgefüllte Bestätigung)
create or replace function public.nw_whoami(p_device text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', a.id, 'name', a.name, 'einrichtung', a.einrichtung, 'rolle', a.rolle, 'freigegeben', a.freigegeben)
    from public.nw_pa_device d join public.nw_pa a on a.id = d.pa_id where d.key_hash = public.nw_keyhash(p_device) and a.aktiv;
$$;

create or replace function public.nw_token_sign(p_token text, p_device text, p_name text, p_einrichtung text, p_rolle text, p_titel text, p_haupt boolean, p_strokes text, p_data jsonb, p_ua text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.nw_token; r jsonb;
begin
  select * into t from public.nw_token where token = p_token for update;
  if t.token is null or t.expires_at < now() then raise exception 'Dieser Link ist abgelaufen. Bitte in der App einen neuen erstellen lassen.'; end if;
  if t.used_at is not null then raise exception 'Dieser Link wurde schon verwendet.'; end if;
  r := public.nw_confirm(t.eintrag_ids, t.user_id, public.nw_resolve_pa(p_device, null, p_name, p_einrichtung, p_rolle, p_ua, p_titel), p_strokes, t.art, p_ua, p_haupt, p_data);
  update public.nw_token set used_at = now() where token = p_token;
  return r;
end $$;

-- Gerät abmelden ("Ich bin nicht diese Person")
create or replace function public.nw_device_forget(p_device text)
returns void language sql security definer set search_path = public as $$
  delete from public.nw_pa_device where key_hash = public.nw_keyhash(p_device);
$$;

-- Einladung der Schule: Gerät einmalig verbinden, danach gilt der Link nicht mehr
create or replace function public.nw_pa_info(p_invite text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('name', name, 'einrichtung', einrichtung, 'rolle', rolle) from public.nw_pa where invite = upper(trim(p_invite)) and aktiv;
$$;

create or replace function public.nw_pa_bind(p_invite text, p_device text, p_ua text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.nw_pa;
begin
  if p_device is null or length(p_device) < 32 then raise exception 'Gerät nicht erkannt.'; end if;
  select * into r from public.nw_pa where invite = upper(trim(p_invite)) and aktiv for update;
  if r.id is null then raise exception 'Dieser Einladungslink ist ungültig oder wurde schon verwendet.'; end if;
  insert into public.nw_pa_device (pa_id, key_hash, user_agent) values (r.id, public.nw_keyhash(p_device), left(p_ua, 300)) on conflict (key_hash) do update set pa_id = excluded.pa_id, last_used = now();
  update public.nw_pa set invite = upper(substr(md5(gen_random_uuid()::text), 1, 10)), freigegeben = true, last_seen = now() where id = r.id;
  return jsonb_build_object('name', r.name, 'einrichtung', r.einrichtung, 'rolle', r.rolle);
end $$;

-- ---------- Funktionen für Lehrkräfte ----------
create or replace function public.nw_korrektur(p_id uuid, p_grund text)
returns void language plpgsql security definer set search_path = public as $$
declare e public.nw_eintrag;
begin
  if not public.is_teacher() then raise exception 'Nur Lehrkräfte können Korrekturen freigeben.'; end if;
  if length(trim(coalesce(p_grund, ''))) < 3 then raise exception 'Bitte einen Grund angeben.'; end if;
  select * into e from public.nw_eintrag where id = p_id for update;
  if e.id is null then raise exception 'Eintrag nicht gefunden.'; end if;
  perform set_config('fp.nw_internal', '1', true);
  insert into public.nw_log (eintrag_id, user_id, aktion, rolle, actor, detail) values (e.id, e.user_id, 'korrektur', 'lehrkraft', auth.uid(), jsonb_build_object('grund', p_grund, 'vorher', to_jsonb(e)));
  update public.nw_signatur set widerrufen_at = now() where eintrag_id = e.id and widerrufen_at is null;
  update public.nw_eintrag set status = 'korrektur', hash = null, bestaetigt_at = null, korrektur_grund = trim(p_grund) where id = e.id;
  perform set_config('fp.nw_internal', '', true);
end $$;

-- Lehrkraft erfasst Fehlzeiten im Unterricht, Praxisbegleitung und Zwischenprüfung (sofort bestätigt)
create or replace function public.nw_lehrer_eintrag(p_student uuid, p_typ text, p_datum date, p_stunden numeric, p_data jsonb, p_einsatz uuid, p_strokes text)
returns uuid language plpgsql security definer set search_path = public as $$
declare e public.nw_eintrag; v_name text; v_hash text;
begin
  if not public.is_teacher() then raise exception 'Nur für Lehrkräfte.'; end if;
  if p_typ not in ('fehlzeit_theorie','begleitung','zwischenpruefung') then raise exception 'Ungültiger Typ.'; end if;
  select coalesce(nullif(trim(display_name), ''), email, 'Lehrkraft') into v_name from public.profiles where id = auth.uid();
  perform set_config('fp.nw_internal', '1', true);
  insert into public.nw_eintrag (user_id, einsatz_id, typ, datum, stunden, data, status) values (p_student, p_einsatz, p_typ, p_datum, coalesce(p_stunden, 0), coalesce(p_data, '{}'::jsonb), 'offen') returning * into e;
  v_hash := public.nw_hash(e);
  insert into public.nw_signatur (eintrag_id, rolle, name, verifiziert, methode, strokes, hash) values (e.id, 'lehrkraft', coalesce(v_name, 'Lehrkraft'), true, 'konto', p_strokes, v_hash);
  update public.nw_eintrag set status = 'bestaetigt', hash = v_hash, bestaetigt_at = now() where id = e.id;
  perform set_config('fp.nw_internal', '', true);
  return e.id;
end $$;

-- Löschung nach Ablauf der Aufbewahrungsfrist (Art. 17 DSGVO): entfernt den gesamten Nachweis einer Person; nur Lehrkräfte, mit Bestätigung des Namens
create or replace function public.nw_loeschen(p_student uuid, p_bestaetigung text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_name text; n int;
begin
  if not public.is_teacher() then raise exception 'Nur für Lehrkräfte.'; end if;
  select coalesce(nullif(trim(display_name), ''), email) into v_name from public.profiles where id = p_student;
  if v_name is null or lower(trim(coalesce(p_bestaetigung, ''))) <> lower(trim(v_name)) then raise exception 'Zur Bestätigung bitte den Namen der Person genau eintragen.'; end if;
  perform set_config('fp.nw_internal', '1', true);
  select count(*) into n from public.nw_eintrag where user_id = p_student;
  delete from public.nw_token where user_id = p_student;
  delete from public.nw_eintrag where user_id = p_student;
  delete from public.nw_einsatz where user_id = p_student;
  delete from public.nw_zeugnis where user_id = p_student;
  delete from public.nw_log where user_id = p_student;
  perform set_config('fp.nw_internal', '', true);
  insert into public.nw_log (user_id, aktion, rolle, actor, detail) values (null, 'nachweis_geloescht', 'lehrkraft', auth.uid(), jsonb_build_object('eintraege', n, 'at', now()));
  return jsonb_build_object('geloescht', n);
end $$;

-- abgelaufene Einmal-Links aufräumen (wird bei jeder neuen Erstellung mit erledigt)
create or replace function public.nw_token_cleanup()
returns void language sql security definer set search_path = public as $$ delete from public.nw_token where expires_at < now() - interval '2 days'; $$;

-- ---------- Rechte ----------
revoke all on function public.nw_confirm(uuid[], uuid, jsonb, text, text, text, boolean, jsonb) from public, anon, authenticated;
revoke all on function public.nw_resolve_pa(text, uuid, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.nw_needs_haupt(public.nw_eintrag) from public, anon, authenticated;
revoke all on function public.nw_allowed_roles(public.nw_eintrag) from public, anon, authenticated;
revoke all on function public.nw_vorlage_for(uuid) from public, anon, authenticated;
revoke all on function public.nw_pa_list() from public;
revoke all on function public.nw_vorlage_get() from public;
revoke all on function public.nw_sign_onsite(uuid[], uuid, text, text, text, text, boolean, text, jsonb, text) from public;
revoke all on function public.nw_sign_azubi(uuid, text) from public;
revoke all on function public.nw_token_create(uuid[], int, text) from public;
revoke all on function public.nw_token_get(text) from public;
revoke all on function public.nw_whoami(text) from public;
revoke all on function public.nw_token_sign(text, text, text, text, text, text, boolean, text, jsonb, text) from public;
revoke all on function public.nw_device_forget(text) from public;
revoke all on function public.nw_pa_info(text) from public;
revoke all on function public.nw_pa_bind(text, text, text) from public;
revoke all on function public.nw_korrektur(uuid, text) from public;
revoke all on function public.nw_lehrer_eintrag(uuid, text, date, numeric, jsonb, uuid, text) from public;
grant execute on function public.nw_pa_list() to authenticated;
grant execute on function public.nw_vorlage_get() to authenticated;
grant execute on function public.nw_sign_onsite(uuid[], uuid, text, text, text, text, boolean, text, jsonb, text) to authenticated;
grant execute on function public.nw_sign_azubi(uuid, text) to authenticated;
grant execute on function public.nw_token_create(uuid[], int, text) to authenticated;
grant execute on function public.nw_token_get(text) to anon, authenticated;
grant execute on function public.nw_whoami(text) to anon, authenticated;
grant execute on function public.nw_token_sign(text, text, text, text, text, text, boolean, text, jsonb, text) to anon, authenticated;
grant execute on function public.nw_device_forget(text) to anon, authenticated;
grant execute on function public.nw_pa_info(text) to anon, authenticated;
grant execute on function public.nw_pa_bind(text, text, text) to anon, authenticated;
grant execute on function public.nw_korrektur(uuid, text) to authenticated;
grant execute on function public.nw_lehrer_eintrag(uuid, text, date, numeric, jsonb, uuid, text) to authenticated;

grant select, insert, update, delete on public.nw_einsatz, public.nw_eintrag, public.nw_aufgabe, public.nw_pa, public.nw_vorlage, public.nw_zeugnis to authenticated;
grant select, delete on public.nw_pa_device to authenticated;
grant select on public.nw_signatur, public.nw_log to authenticated;
revoke all on public.nw_token from anon, authenticated;
revoke all on function public.nw_loeschen(uuid, text) from public;
revoke all on function public.nw_token_cleanup() from public, anon, authenticated;
grant execute on function public.nw_loeschen(uuid, text) to authenticated;
