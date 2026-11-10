-- Fallpfad: Sicherheits-Audit November 2026 – Mandantentrennung bei Kursen
-- STATUS: ENTWURF, NOCH NICHT AUF DER PRODUKTIVDATENBANK AUSGEFÜHRT.
-- Erst in einer Kopie/Branch testen, dann nach ausdrücklicher Freigabe ausführen.
-- Reihenfolge: zuerst pflegeplanung_sicherheit.sql, danach diese Datei.
--
-- Befund (AUDIT_REPORT.md, S-01):
--   1. Die Policy "courses_select" erlaubt allen angemeldeten Konten das Lesen aller Kurse (using true).
--      Die einschränkende Schul-Policy lässt Konten ohne Schule (z. B. frisch selbst registrierte) durch
--      ("my_school() IS NULL"). Ein neues Konto sieht dadurch alle Kurse aller Schulen samt Kurscode.
--      Geprüft am 10.11.2026 mit simuliertem, nicht existierendem Konto (nur SELECT, Transaktion zurückgerollt).
--   2. Ein Schülerkonto kann profiles.course_id direkt auf jede Kurs-ID setzen; die Schule wird daraus
--      übernommen (Trigger fp_profile_school). Mit 1. zusammen: Beitritt zu fremden Schulen ohne Code.
--
-- Lösung:
--   a) Kurse sehen nur Lehrkräfte/Admins der eigenen Schule und Lernende ihren eigenen Kurs.
--   b) Kurssuche per Code nur noch über die Funktion fp_kurs_per_code (gibt id und name zurück, nicht den Code)
--      und legt ein kurzes "Beitrittsticket" an.
--   c) Lernende können course_id nur auf einen Kurs ändern, für den sie in den letzten 30 Minuten den Code
--      eingegeben haben (oder auf leer). Lehrkräfte und Admins sind nicht betroffen.
--   Die Schüler-App nutzt fp_kurs_per_code bereits und fällt auf die alte Abfrage zurück, solange die Funktion fehlt.

begin;

-- a) Lesen von Kursen
drop policy if exists courses_select on public.courses;
create policy courses_select on public.courses for select to authenticated
  using (public.is_teacher() or id = (select p.course_id from public.profiles p where p.id = auth.uid()));

drop policy if exists fp_school_gate_sel on public.courses;
create policy fp_school_gate_sel on public.courses as restrictive for select to authenticated
  using (public.fp_school_ok(school_id) or public.is_admin());

-- b) Beitrittstickets (nur Server)
create table if not exists public.fp_kurs_ticket (
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  erstellt timestamptz not null default now(),
  primary key (user_id, course_id)
);
alter table public.fp_kurs_ticket enable row level security;
drop policy if exists kein_zugriff on public.fp_kurs_ticket;
create policy kein_zugriff on public.fp_kurs_ticket for all to anon, authenticated using (false) with check (false);
revoke all on public.fp_kurs_ticket from anon, authenticated;

-- Fehlversuche je Konto begrenzen (gegen Durchprobieren von 6-stelligen Codes)
create table if not exists public.fp_kurs_versuch (
  user_id uuid not null references auth.users (id) on delete cascade,
  tag date not null default current_date,
  anzahl int not null default 0,
  primary key (user_id, tag)
);
alter table public.fp_kurs_versuch enable row level security;
drop policy if exists kein_zugriff on public.fp_kurs_versuch;
create policy kein_zugriff on public.fp_kurs_versuch for all to anon, authenticated using (false) with check (false);
revoke all on public.fp_kurs_versuch from anon, authenticated;

create or replace function public.fp_kurs_per_code(p_code text)
returns table (id uuid, name text)
language plpgsql security definer set search_path = public as $$
declare v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')); v_n int;
begin
  if auth.uid() is null then raise exception 'Bitte anmelden.'; end if;
  insert into public.fp_kurs_versuch (user_id) values (auth.uid())
    on conflict (user_id, tag) do update set anzahl = public.fp_kurs_versuch.anzahl + 1
    returning anzahl into v_n;
  if v_n > 20 then raise exception 'Zu viele Versuche. Bitte morgen erneut versuchen oder die Lehrkraft fragen.'; end if;
  delete from public.fp_kurs_ticket where erstellt < now() - interval '1 day';
  delete from public.fp_kurs_versuch where tag < current_date - 7;
  return query
    with k as (
      select c.id, c.name from public.courses c
      join public.schools s on s.id = c.school_id and s.aktiv
      where c.code = v_code limit 1
    ), t as (
      insert into public.fp_kurs_ticket (user_id, course_id) select auth.uid(), k.id from k
      on conflict (user_id, course_id) do update set erstellt = now()
    )
    select k.id, k.name from k;
end $$;
revoke all on function public.fp_kurs_per_code(text) from public, anon;
grant execute on function public.fp_kurs_per_code(text) to authenticated;

-- c) Kurswechsel von Lernenden nur mit Ticket
create or replace function public.fp_kurs_wechsel_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') in ('authenticated', 'anon')
     and not public.is_teacher()
     and new.course_id is not null
     and (tg_op = 'INSERT' or new.course_id is distinct from old.course_id)
     and not exists (select 1 from public.fp_kurs_ticket t
                     where t.user_id = auth.uid() and t.course_id = new.course_id and t.erstellt > now() - interval '30 minutes') then
    raise exception 'Bitte den Kurscode deiner Lehrkraft eingeben.';
  end if;
  return new;
end $$;
drop trigger if exists a_fp_kurs_wechsel_guard on public.profiles;
-- Name beginnt mit "a", damit der Trigger vor fp_profile_school läuft (Trigger laufen alphabetisch)
create trigger a_fp_kurs_wechsel_guard before insert or update of course_id on public.profiles
  for each row execute function public.fp_kurs_wechsel_guard();

-- d) Kurseinstellungen nur für Angemeldete (Stundenplan wird in pflegeplanung_sicherheit.sql bereits eingeschränkt)
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('course_settings')
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;

commit;

-- Prüfung danach (als simuliertes neues Konto, nur lesend):
--   begin; set local role authenticated;
--   select set_config('request.jwt.claims', '{"sub":"11111111-2222-3333-4444-555555555555","role":"authenticated"}', true);
--   select count(*) from public.courses;  -- erwartet: 0
--   rollback;
