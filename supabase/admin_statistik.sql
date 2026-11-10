-- Fallpfad: Admin-Statistik und Feedback (10.11.2026)
--
-- Datenschutz-Grundsatz: Nutzungsdaten werden nur als Zähler je Tag, Schule und Ereignis gespeichert,
-- ohne Nutzerkennung, ohne Inhalte, ohne IP. Kein Rückschluss auf einzelne Personen möglich.
-- Feedback speichert die Person nur, wenn sie ausdrücklich „Rückmeldung erwünscht“ ankreuzt.
-- Rohzähler werden nach 400 Tagen gelöscht, Feedback nach 2 Jahren.

create table if not exists public.fp_nutzung (
  tag date not null default current_date,
  school_id uuid,
  app text not null default 'schueler',      -- 'schueler' | 'lehrer'
  ereignis text not null,                    -- z. B. modul_start, modul_fertig, training, bildbefund
  schluessel text not null default '',       -- z. B. Modul-ID oder Trainingsname, nie personenbezogen
  anzahl int not null default 0
);
create unique index if not exists fp_nutzung_uq on public.fp_nutzung (tag, coalesce(school_id, '00000000-0000-0000-0000-000000000000'::uuid), app, ereignis, schluessel);
alter table public.fp_nutzung enable row level security;
revoke all on public.fp_nutzung from anon, authenticated;
comment on table public.fp_nutzung is 'Anonyme Nutzungszähler je Tag, Schule und Ereignis. Keine Nutzerkennung, keine Inhalte. Löschung nach 400 Tagen.';

create or replace function public.fp_zaehle(p_ereignis text, p_schluessel text default '', p_app text default 'schueler')
returns void language plpgsql security definer set search_path = public as $$
declare v_s uuid; v_e text := left(regexp_replace(coalesce(p_ereignis, ''), '[^a-z0-9_]', '', 'g'), 40);
        v_k text := left(regexp_replace(coalesce(p_schluessel, ''), '[^A-Za-z0-9_:.\-]', '', 'g'), 60);
        v_a text := case when p_app = 'lehrer' then 'lehrer' else 'schueler' end;
begin
  if auth.uid() is null or v_e = '' then return; end if;
  select school_id into v_s from public.profiles where id = auth.uid();
  insert into public.fp_nutzung (tag, school_id, app, ereignis, schluessel, anzahl) values (current_date, v_s, v_a, v_e, v_k, 1)
    on conflict (tag, coalesce(school_id, '00000000-0000-0000-0000-000000000000'::uuid), app, ereignis, schluessel)
    do update set anzahl = public.fp_nutzung.anzahl + 1;
  if random() < 0.01 then delete from public.fp_nutzung where tag < current_date - 400; end if;
end $$;
revoke all on function public.fp_zaehle(text, text, text) from public, anon;
grant execute on function public.fp_zaehle(text, text, text) to authenticated;

-- ---------------------------------------------------------------- Feedback
create table if not exists public.fp_feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  app text not null default 'schueler',
  rolle text,
  school_id uuid,
  bewertung int check (bewertung between 1 and 5),
  kategorie text,
  text text,
  seite text,
  kontakt_user uuid references auth.users (id) on delete set null,  -- nur bei ausdrücklichem Wunsch nach Rückmeldung
  status text not null default 'neu' check (status in ('neu', 'in_arbeit', 'erledigt')),
  notiz text
);
alter table public.fp_feedback enable row level security;
revoke all on public.fp_feedback from anon, authenticated;
comment on table public.fp_feedback is 'Feedback aus den Apps. Person nur gespeichert, wenn Rückmeldung erwünscht. Löschung nach 2 Jahren.';

create or replace function public.fp_feedback_senden(p_app text, p_bewertung int, p_kategorie text, p_text text, p_seite text, p_kontakt boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v record; v_n int;
begin
  if auth.uid() is null then raise exception 'Bitte anmelden.'; end if;
  select count(*) into v_n from public.fp_feedback where kontakt_user = auth.uid() and created_at > now() - interval '1 day';
  select role, school_id into v from public.profiles where id = auth.uid();
  if (select count(*) from public.fp_feedback where created_at > now() - interval '1 minute') > 30 then raise exception 'Gerade sind sehr viele Rückmeldungen eingegangen. Bitte gleich noch einmal.'; end if;
  insert into public.fp_feedback (app, rolle, school_id, bewertung, kategorie, text, seite, kontakt_user)
  values (case when p_app = 'lehrer' then 'lehrer' else 'schueler' end, v.role, v.school_id,
          case when p_bewertung between 1 and 5 then p_bewertung end, left(coalesce(p_kategorie, ''), 40),
          nullif(left(trim(coalesce(p_text, '')), 2000), ''), left(coalesce(p_seite, ''), 60),
          case when p_kontakt then auth.uid() end);
  delete from public.fp_feedback where created_at < now() - interval '2 years';
end $$;
revoke all on function public.fp_feedback_senden(text, int, text, text, text, boolean) from public, anon;
grant execute on function public.fp_feedback_senden(text, int, text, text, text, boolean) to authenticated;

create or replace function public.fp_admin_feedback(p_status text default null)
returns table (id uuid, created_at timestamptz, app text, rolle text, schule text, bewertung int, kategorie text, text text, seite text, kontakt text, status text, notiz text)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.fp_admin_check();
  return query select f.id, f.created_at, f.app, f.rolle, s.name, f.bewertung, f.kategorie, f.text, f.seite,
                      (select u.email::text from auth.users u where u.id = f.kontakt_user), f.status, f.notiz
    from public.fp_feedback f left join public.schools s on s.id = f.school_id
   where p_status is null or f.status = p_status
   order by f.created_at desc limit 500;
end $$;

create or replace function public.fp_admin_feedback_status(p_id uuid, p_status text, p_notiz text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.fp_admin_check();
  update public.fp_feedback set status = coalesce(p_status, status), notiz = coalesce(p_notiz, notiz) where id = p_id;
end $$;

-- ---------------------------------------------------------------- Dashboard
create or replace function public.fp_admin_dashboard(p_tage int default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_t int := greatest(7, least(coalesce(p_tage, 30), 365)); v_ab date := current_date - (greatest(7, least(coalesce(p_tage, 30), 365)) - 1); r jsonb;
begin
  perform public.fp_admin_check();
  select jsonb_build_object(
    'zeitraum', v_t,
    'kpi', jsonb_build_object(
      'schulen', (select count(*) from schools),
      'schulen_aktiv', (select count(*) from schools where aktiv),
      'lehrkraefte', (select count(*) from profiles where role = 'teacher'),
      'lernende', (select count(*) from profiles where role = 'student'),
      'lernende_mit_kurs', (select count(*) from profiles where role = 'student' and course_id is not null),
      'kurse', (select count(*) from courses),
      'eigene_module', (select count(*) from modules),
      'aktiv_7', (select count(*) from auth.users where last_sign_in_at > now() - interval '7 days'),
      'aktiv_30', (select count(*) from auth.users where last_sign_in_at > now() - interval '30 days'),
      'neu_zeitraum', (select count(*) from auth.users where created_at >= v_ab),
      'unbestaetigt', (select count(*) from auth.users where email_confirmed_at is null),
      'anfragen', (select count(*) from auth.users u join profiles p on p.id = u.id where p.role = 'student' and u.raw_user_meta_data ->> 'app' = 'lehrer' and coalesce(u.raw_user_meta_data ->> 'lehrer_abgelehnt', '') <> 'true'),
      'feedback_neu', (select count(*) from fp_feedback where status = 'neu'),
      'feedback_schnitt', (select round(avg(bewertung)::numeric, 1) from fp_feedback where bewertung is not null and created_at >= v_ab),
      'aufgaben', (select count(*) from assignments),
      'abgaben', (select count(*) from submissions where submitted_at >= v_ab),
      'live_stunden', (select count(*) from live_sessions where created_at >= v_ab),
      'pruefungen', (select count(*) from exam_results where created_at >= v_ab),
      'nachweis_eintraege', (select count(*) from nw_eintrag where created_at >= v_ab)
    ),
    'tage', (select coalesce(jsonb_agg(x order by x.tag), '[]'::jsonb) from (
      select d::date as tag,
        (select count(*) from auth.users where created_at::date = d::date) as neu,
        (select coalesce(sum(anzahl), 0) from fp_nutzung where tag = d::date and ereignis in ('sitzung')) as sitzungen,
        (select coalesce(sum(anzahl), 0) from fp_nutzung where tag = d::date and ereignis like 'modul%') as modul,
        (select coalesce(sum(anzahl), 0) from fp_nutzung where tag = d::date and ereignis in ('training', 'bildbefund', 'akutsim')) as training,
        (select coalesce(sum(nachrichten), 0) from fp_assistent_nutzung where tag = d::date) as ki_assistent,
        (select coalesce(sum(gespraeche + auswertungen), 0) from fp_gespraech_nutzung where tag = d::date) as ki_gespraech,
        (select coalesce(sum(anzahl), 0) from fp_pp_nutzung where tag = d::date) as ki_pflegeplanung
      from generate_series(v_ab, current_date, interval '1 day') d) x),
    'ereignisse', (select coalesce(jsonb_agg(x order by x.anzahl desc), '[]'::jsonb) from (
      select ereignis, schluessel, app, sum(anzahl) anzahl from fp_nutzung where tag >= v_ab group by 1, 2, 3 order by 4 desc limit 60) x),
    'module', (select coalesce(jsonb_agg(x order by x.lernende desc), '[]'::jsonb) from (
      select split_part(k, '.', 1) as modul, count(distinct p.user_id) as lernende, count(*) as bloecke
        from progress p, jsonb_object_keys(case when jsonb_typeof(p.data -> 'done') = 'object' then p.data -> 'done' else '{}'::jsonb end) k
       group by 1 order by 2 desc limit 80) x),
    'schulen', (select coalesce(jsonb_agg(x order by x.lernende desc), '[]'::jsonb) from (
      select s.id, s.name, s.ort, s.aktiv, s.max_lernende,
        (select count(*) from profiles p where p.school_id = s.id and p.role = 'teacher') lehrkraefte,
        (select count(*) from profiles p where p.school_id = s.id and p.role = 'student') lernende,
        (select count(*) from courses c where c.school_id = s.id) kurse,
        (select count(*) from modules m where m.school_id = s.id) module,
        (select count(*) from assignments a where a.school_id = s.id) aufgaben,
        (select count(*) from live_sessions l where l.school_id = s.id and l.created_at >= v_ab) live,
        (select count(*) from profiles p join auth.users u on u.id = p.id where p.school_id = s.id and u.last_sign_in_at > now() - interval '7 days') aktiv_7,
        (select coalesce(sum(anzahl), 0) from fp_nutzung n where n.school_id = s.id and n.tag >= v_ab) aktionen,
        (select max(u.last_sign_in_at) from profiles p join auth.users u on u.id = p.id where p.school_id = s.id) zuletzt
      from schools s) x),
    'ki', jsonb_build_object(
      'assistent', (select coalesce(sum(nachrichten), 0) from fp_assistent_nutzung where tag >= v_ab),
      'gespraeche', (select coalesce(sum(gespraeche), 0) from fp_gespraech_nutzung where tag >= v_ab),
      'auswertungen', (select coalesce(sum(auswertungen), 0) from fp_gespraech_nutzung where tag >= v_ab),
      'pflegeplanung', (select coalesce(sum(anzahl), 0) from fp_pp_nutzung where tag >= v_ab),
      'uebersetzung_zeichen', (select coalesce(sum(zeichen), 0) from fp_ls_nutzung where tag >= v_ab)),
    'konten', (select coalesce(jsonb_agg(x order by x.registriert desc), '[]'::jsonb) from (
      select u.id, u.email::text as email, coalesce(nullif(p.display_name, ''), split_part(u.email, '@', 1)) as name, p.role as rolle,
             s.name as schule, u.created_at as registriert, u.last_sign_in_at as zuletzt, u.email_confirmed_at is not null as bestaetigt
        from auth.users u join profiles p on p.id = u.id left join schools s on s.id = p.school_id
       where p.role in ('teacher', 'admin') order by u.created_at desc limit 300) x)
  ) into r;
  return r;
end $$;

revoke all on function public.fp_admin_feedback(text) from public, anon;
revoke all on function public.fp_admin_feedback_status(uuid, text, text) from public, anon;
revoke all on function public.fp_admin_dashboard(int) from public, anon;
grant execute on function public.fp_admin_feedback(text) to authenticated;
grant execute on function public.fp_admin_feedback_status(uuid, text, text) to authenticated;
grant execute on function public.fp_admin_dashboard(int) to authenticated;
