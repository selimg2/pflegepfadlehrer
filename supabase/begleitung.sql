-- =====================================================================
-- Fallpfad: Begleitung im Einsatz, Feedback, Unterrichtspuls und Prüfungsbögen
-- Voraussetzung: lehrer_schema.sql und nachweis.sql wurden ausgeführt.
-- Ausführen: Supabase-Dashboard > SQL Editor > New query > Inhalt einfügen > Run. Wiederholbar.
-- Inhalt:
--   fp_bezug             Bezugslehrkraft je Azubi (wählt die Person selbst)
--   fp_einsatz_feedback  Bewertung eines Praxiseinsatzes durch die Azubis (Kriterien 1 bis 5 und kurzer Text)
--   fp_meldung           wichtige Nachricht aus dem Einsatz an die Bezugslehrkraft
--   fp_puls              kurzes Wochenfeedback zum Unterricht
--   fp_pruefung          Erwartungshorizonte und OSCE-Prüfungsbögen, teilbar mit Lehrkräften und Kursen
-- Datensparsam: keine Diagnosen, keine Patientendaten. Freitexte sind in der Länge begrenzt.
-- =====================================================================

-- ---------- Bezugslehrkraft ----------
create table if not exists public.fp_bezug (
  user_id     uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  teacher_id  uuid references public.profiles (id) on delete set null,
  updated_at  timestamptz not null default now()
);

create or replace function public.fp_bezug_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_teacher() then new.user_id := auth.uid(); end if;
  if new.teacher_id is not null and not exists (select 1 from public.profiles where id = new.teacher_id and role = 'teacher') then
    raise exception 'Diese Person ist keine Lehrkraft.';
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists fp_bezug_guard on public.fp_bezug;
create trigger fp_bezug_guard before insert or update on public.fp_bezug for each row execute function public.fp_bezug_guard();

-- Liste der Lehrkräfte für die Auswahl in der App: nur Name und Kennung, keine E-Mail
create or replace function public.fp_lehrkraefte() returns table (id uuid, name text)
language sql stable security definer set search_path = public as $$
  select p.id, coalesce(nullif(trim(p.display_name), ''), split_part(p.email, '@', 1)) as name
  from public.profiles p where p.role = 'teacher' and auth.uid() is not null order by 2;
$$;

-- ---------- Feedback zum Praxiseinsatz ----------
create table if not exists public.fp_einsatz_feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  einsatz_id  uuid not null references public.nw_einsatz (id) on delete cascade,
  art         text,
  einrichtung text,
  bereich     text,
  bewertung   jsonb not null default '{}'::jsonb,
  empfehlung  text check (empfehlung is null or empfehlung in ('ja','eher_ja','eher_nein','nein')),
  gut         text check (gut is null or char_length(gut) <= 800),
  besser      text check (besser is null or char_length(besser) <= 800),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (einsatz_id)
);
create index if not exists fp_fb_einr on public.fp_einsatz_feedback (einrichtung);

create or replace function public.fp_feedback_guard() returns trigger language plpgsql security definer set search_path = public as $$
declare e public.nw_einsatz; k text; v jsonb;
begin
  if public.is_teacher() then raise exception 'Feedback geben nur die Auszubildenden selbst.'; end if;
  new.user_id := auth.uid();
  select * into e from public.nw_einsatz where id = new.einsatz_id;
  if e.id is null or e.user_id <> auth.uid() then raise exception 'Dieser Einsatz gehört nicht zu deinem Nachweis.'; end if;
  if (now() at time zone 'Europe/Berlin')::date < e.ende - 21 then raise exception 'Das Feedback öffnet drei Wochen vor dem Ende des Einsatzes.'; end if;
  if jsonb_typeof(new.bewertung) <> 'object' then raise exception 'Bewertung ungültig.'; end if;
  for k, v in select * from jsonb_each(new.bewertung) loop
    if k !~ '^[a-z_]{2,24}$' or jsonb_typeof(v) <> 'number' or (v::text)::numeric not in (1,2,3,4,5) then raise exception 'Bewertung ungültig: %', k; end if;
  end loop;
  if (select count(*) from jsonb_object_keys(new.bewertung)) < 3 then raise exception 'Bitte mindestens drei Kriterien bewerten.'; end if;
  new.art := e.art; new.einrichtung := e.einrichtung; new.bereich := e.bereich;
  new.gut := nullif(trim(new.gut), ''); new.besser := nullif(trim(new.besser), '');
  new.updated_at := now();
  if tg_op = 'UPDATE' then new.created_at := old.created_at; new.einsatz_id := old.einsatz_id; end if;
  return new;
end $$;
drop trigger if exists fp_feedback_guard on public.fp_einsatz_feedback;
create trigger fp_feedback_guard before insert or update on public.fp_einsatz_feedback for each row execute function public.fp_feedback_guard();

-- ---------- Wichtige Nachricht aus dem Einsatz ----------
create table if not exists public.fp_meldung (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  teacher_id  uuid references public.profiles (id) on delete set null,
  einsatz_id  uuid references public.nw_einsatz (id) on delete set null,
  kategorie   text not null check (kategorie in ('vorfall','unwohl','anleitung','organisation','sonstiges')),
  text        text not null check (char_length(trim(text)) between 3 and 2000),
  rueckruf    boolean not null default false,
  created_at  timestamptz not null default now(),
  gelesen_at  timestamptz,
  antwort     text check (antwort is null or char_length(antwort) <= 2000),
  antwort_von text,
  antwort_at  timestamptz
);
create index if not exists fp_meldung_t on public.fp_meldung (teacher_id, created_at desc);

create or replace function public.fp_meldung_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if public.is_teacher() then raise exception 'Nachrichten aus dem Einsatz senden nur Auszubildende.'; end if;
    new.user_id := auth.uid(); new.created_at := now(); new.gelesen_at := null; new.antwort := null; new.antwort_von := null; new.antwort_at := null;
    new.teacher_id := (select teacher_id from public.fp_bezug where user_id = auth.uid());
    if new.einsatz_id is not null and not exists (select 1 from public.nw_einsatz where id = new.einsatz_id and user_id = auth.uid()) then new.einsatz_id := null; end if;
    if (select count(*) from public.fp_meldung where user_id = auth.uid() and created_at > now() - interval '1 hour') >= 5 then raise exception 'Bitte warte kurz, bevor du weitere Nachrichten sendest. In einem Notfall wähle 112.'; end if;
    return new;
  end if;
  -- Änderungen nur durch Lehrkräfte und nur an Lesestatus und Antwort
  if not public.is_teacher() then raise exception 'Gesendete Nachrichten lassen sich nicht ändern.'; end if;
  new.user_id := old.user_id; new.teacher_id := old.teacher_id; new.einsatz_id := old.einsatz_id; new.kategorie := old.kategorie; new.text := old.text; new.rueckruf := old.rueckruf; new.created_at := old.created_at;
  if new.antwort is distinct from old.antwort then new.antwort_at := now(); new.antwort_von := (select coalesce(nullif(trim(display_name), ''), split_part(email, '@', 1)) from public.profiles where id = auth.uid()); end if;
  return new;
end $$;
drop trigger if exists fp_meldung_guard on public.fp_meldung;
create trigger fp_meldung_guard before insert or update on public.fp_meldung for each row execute function public.fp_meldung_guard();

-- ---------- Unterrichtspuls (einmal je Woche) ----------
create table if not exists public.fp_puls (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  course_id   uuid references public.courses (id) on delete set null,
  woche       date not null,
  verstanden  smallint not null check (verstanden between 1 and 5),
  zufrieden   smallint not null check (zufrieden between 1 and 3),
  tags        text[] not null default '{}',
  kommentar   text check (kommentar is null or char_length(kommentar) <= 300),
  created_at  timestamptz not null default now(),
  unique (user_id, woche)
);
create index if not exists fp_puls_course on public.fp_puls (course_id, woche);

create or replace function public.fp_puls_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_teacher() then raise exception 'Den Unterrichtspuls geben nur Auszubildende.'; end if;
  new.user_id := auth.uid();
  new.course_id := (select course_id from public.profiles where id = auth.uid());
  new.woche := date_trunc('week', (now() at time zone 'Europe/Berlin'))::date;
  if tg_op = 'UPDATE' and old.woche <> new.woche then raise exception 'Vergangene Wochen lassen sich nicht mehr ändern.'; end if;
  new.tags := array(select t from unnest(coalesce(new.tags, '{}')) t where t in ('zu_schnell','zu_langsam','unsicher','mehr_uebung','gut_erklaert','spannend','zu_viel','beispiele') limit 8);
  new.kommentar := nullif(trim(new.kommentar), '');
  return new;
end $$;
drop trigger if exists fp_puls_guard on public.fp_puls;
create trigger fp_puls_guard before insert or update on public.fp_puls for each row execute function public.fp_puls_guard();

-- ---------- Prüfungen: Erwartungshorizont und OSCE-Bogen ----------
create table if not exists public.fp_pruefung (
  id                   uuid primary key default gen_random_uuid(),
  owner                uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  owner_name           text,
  titel                text not null check (char_length(trim(titel)) between 2 and 160),
  data                 jsonb not null default '{}'::jsonb,
  geteilt_lehrkraefte  uuid[] not null default '{}',
  geteilt_kurse        uuid[] not null default '{}',
  sichtbar_ab          timestamptz,
  punkte_zeigen        boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create or replace function public.fp_pruefung_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_teacher() then raise exception 'Nur Lehrkräfte.'; end if;
  if tg_op = 'INSERT' then new.owner := auth.uid(); new.created_at := now();
  else new.owner := old.owner; new.created_at := old.created_at; end if;
  new.owner_name := (select coalesce(nullif(trim(display_name), ''), split_part(email, '@', 1)) from public.profiles where id = new.owner);
  new.geteilt_lehrkraefte := array(select distinct x from unnest(new.geteilt_lehrkraefte) x where x <> new.owner and exists (select 1 from public.profiles p where p.id = x and p.role = 'teacher'));
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists fp_pruefung_guard on public.fp_pruefung;
create trigger fp_pruefung_guard before insert or update on public.fp_pruefung for each row execute function public.fp_pruefung_guard();

-- Für Azubis: nur freigegebene Bögen des eigenen Kurses, Punkte nur wenn freigegeben
create or replace function public.fp_pruefungen_azubi() returns table (id uuid, titel text, data jsonb, sichtbar_ab timestamptz, owner_name text, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select q.id, q.titel,
    case when q.punkte_zeigen then q.data - 'notizen'
      else (q.data - 'notizen') || jsonb_build_object('punkte_aus', true, 'kriterien', coalesce((select jsonb_agg(k - 'punkte') from jsonb_array_elements(case when jsonb_typeof(q.data->'kriterien') = 'array' then q.data->'kriterien' else '[]'::jsonb end) k), '[]'::jsonb)) end,
    q.sichtbar_ab, q.owner_name, q.updated_at
  from public.fp_pruefung q, public.profiles p
  where p.id = auth.uid() and p.course_id is not null and p.course_id = any(q.geteilt_kurse)
    and q.sichtbar_ab is not null and q.sichtbar_ab <= now()
  order by q.sichtbar_ab desc;
$$;

-- ---------- Row Level Security ----------
alter table public.fp_bezug            enable row level security;
alter table public.fp_einsatz_feedback enable row level security;
alter table public.fp_meldung          enable row level security;
alter table public.fp_puls             enable row level security;
alter table public.fp_pruefung         enable row level security;

drop policy if exists fp_bezug_sel on public.fp_bezug;
create policy fp_bezug_sel on public.fp_bezug for select to authenticated using (user_id = auth.uid() or public.is_teacher());
drop policy if exists fp_bezug_ins on public.fp_bezug;
create policy fp_bezug_ins on public.fp_bezug for insert to authenticated with check (user_id = auth.uid());
drop policy if exists fp_bezug_upd on public.fp_bezug;
create policy fp_bezug_upd on public.fp_bezug for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists fp_fb_sel on public.fp_einsatz_feedback;
create policy fp_fb_sel on public.fp_einsatz_feedback for select to authenticated using (user_id = auth.uid() or public.is_teacher());
drop policy if exists fp_fb_ins on public.fp_einsatz_feedback;
create policy fp_fb_ins on public.fp_einsatz_feedback for insert to authenticated with check (user_id = auth.uid());
drop policy if exists fp_fb_upd on public.fp_einsatz_feedback;
create policy fp_fb_upd on public.fp_einsatz_feedback for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Nachrichten sieht nur die gewählte Bezugslehrkraft; ohne Bezugslehrkraft alle Lehrkräfte
drop policy if exists fp_m_sel on public.fp_meldung;
create policy fp_m_sel on public.fp_meldung for select to authenticated using (user_id = auth.uid() or (public.is_teacher() and (teacher_id is null or teacher_id = auth.uid())));
drop policy if exists fp_m_ins on public.fp_meldung;
create policy fp_m_ins on public.fp_meldung for insert to authenticated with check (user_id = auth.uid());
drop policy if exists fp_m_upd on public.fp_meldung;
create policy fp_m_upd on public.fp_meldung for update to authenticated using (public.is_teacher() and (teacher_id is null or teacher_id = auth.uid()));

drop policy if exists fp_p_sel on public.fp_puls;
create policy fp_p_sel on public.fp_puls for select to authenticated using (user_id = auth.uid() or public.is_teacher());
drop policy if exists fp_p_ins on public.fp_puls;
create policy fp_p_ins on public.fp_puls for insert to authenticated with check (user_id = auth.uid());
drop policy if exists fp_p_upd on public.fp_puls;
create policy fp_p_upd on public.fp_puls for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists fp_q_sel on public.fp_pruefung;
create policy fp_q_sel on public.fp_pruefung for select to authenticated using (public.is_teacher() and (owner = auth.uid() or auth.uid() = any(geteilt_lehrkraefte)));
drop policy if exists fp_q_ins on public.fp_pruefung;
create policy fp_q_ins on public.fp_pruefung for insert to authenticated with check (public.is_teacher());
drop policy if exists fp_q_upd on public.fp_pruefung;
create policy fp_q_upd on public.fp_pruefung for update to authenticated using (public.is_teacher() and owner = auth.uid());
drop policy if exists fp_q_del on public.fp_pruefung;
create policy fp_q_del on public.fp_pruefung for delete to authenticated using (public.is_teacher() and owner = auth.uid());

grant select, insert, update on public.fp_bezug, public.fp_einsatz_feedback, public.fp_puls to authenticated;
grant select, insert, update on public.fp_meldung to authenticated;
grant select, insert, update, delete on public.fp_pruefung to authenticated;
revoke all on function public.fp_lehrkraefte() from public, anon;
revoke all on function public.fp_pruefungen_azubi() from public, anon;
grant execute on function public.fp_lehrkraefte(), public.fp_pruefungen_azubi() to authenticated;

-- Löschung einer Person (Art. 17 DSGVO) erfasst auch diese Daten: nw_loeschen ergänzen
create or replace function public.fp_loeschen_begleitung(p_student uuid) returns int language plpgsql security definer set search_path = public as $$
declare n int := 0; m int;
begin
  if not public.is_teacher() then raise exception 'Nur Lehrkräfte.'; end if;
  delete from public.fp_einsatz_feedback where user_id = p_student; get diagnostics m = row_count; n := n + m;
  delete from public.fp_meldung where user_id = p_student; get diagnostics m = row_count; n := n + m;
  delete from public.fp_puls where user_id = p_student; get diagnostics m = row_count; n := n + m;
  delete from public.fp_bezug where user_id = p_student; get diagnostics m = row_count; n := n + m;
  return n;
end $$;
revoke all on function public.fp_loeschen_begleitung(uuid) from public, anon;
grant execute on function public.fp_loeschen_begleitung(uuid) to authenticated;
