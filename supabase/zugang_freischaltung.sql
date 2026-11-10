-- Fallpfad: Zugang und Freischaltung (10.11.2026)
--
-- 1. Lehrkräfte: Einladungscode kann schon bei der Registrierung eingegeben werden. Er wird beim Bestätigen
--    der E-Mail automatisch eingelöst (Trigger auf auth.users). Ohne gültigen Code sieht das Konto im Portal
--    nur die Code-Eingabe.
-- 2. Plattform-Administration: Konten, die sich im Lehrer-Portal registriert haben, erscheinen als
--    Freischaltungs-Anfrage. Die Administration schaltet sie mit einem Klick für eine Schule frei oder lehnt ab.
--    Zusätzlich: Freischalten per E-Mail-Adresse.
-- 3. KI-Funktionen (Assistent, Sprachsimulation, Pflegeplanung, Übersetzen) nur für Lehrkräfte und für
--    Lernende, die in einem Kurs einer freigeschalteten Schule sind. Prüfung serverseitig in den Edge Functions.
--
-- Mehrfach ausführbar.

-- ---------------------------------------------------------------- Einladungscode einlösen (intern)
create or replace function public.fp_einladung_einloesen(p_user uuid, p_code text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v record;
begin
  if p_user is null or coalesce(trim(p_code), '') = '' then return false; end if;
  select i.code, i.school_id, coalesce(i.schulleitung, false) as sl into v from public.teacher_invites i
   where i.code = upper(regexp_replace(p_code, '[^A-Za-z0-9]', '', 'g')) and i.used_by is null for update;
  if v.code is null then return false; end if;
  if v.school_id is not null and not exists (select 1 from public.schools where id = v.school_id and aktiv) then
    raise exception 'Diese Schule ist derzeit nicht freigeschaltet.';
  end if;
  perform set_config('fallpfad.allow_role', 'on', true);
  perform set_config('fallpfad.allow_school', 'on', true);
  insert into public.profiles (id, role, school_id, schulleitung) values (p_user, 'teacher', v.school_id, v.sl)
    on conflict (id) do update set role = case when public.profiles.role = 'admin' then 'admin' else 'teacher' end,
                                   school_id = coalesce(v.school_id, public.profiles.school_id),
                                   schulleitung = v.sl or public.profiles.schulleitung;
  update public.teacher_invites set used_by = p_user, used_at = now() where code = v.code;
  return true;
end $$;
revoke all on function public.fp_einladung_einloesen(uuid, text) from public, anon, authenticated;

-- Öffentliche Variante für das Portal (eigenes Konto), mit Versuchsbegrenzung gegen Durchprobieren
create table if not exists public.fp_code_versuch (
  user_id uuid not null references auth.users (id) on delete cascade,
  tag date not null default current_date,
  anzahl int not null default 0,
  primary key (user_id, tag)
);
alter table public.fp_code_versuch enable row level security;
revoke all on public.fp_code_versuch from anon, authenticated;

create or replace function public.redeem_teacher_invite(p_code text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  if auth.uid() is null then raise exception 'Bitte zuerst anmelden.'; end if;
  insert into public.fp_code_versuch (user_id) values (auth.uid())
    on conflict (user_id, tag) do update set anzahl = public.fp_code_versuch.anzahl + 1
    returning anzahl into v_n;
  delete from public.fp_code_versuch where tag < current_date - 7;
  if v_n > 15 then raise exception 'Zu viele Versuche. Bitte morgen erneut versuchen oder die Fallpfad-Verwaltung fragen.'; end if;
  return public.fp_einladung_einloesen(auth.uid(), p_code);
end $$;
revoke all on function public.redeem_teacher_invite(text) from public, anon;
grant execute on function public.redeem_teacher_invite(text) to authenticated;

-- ---------------------------------------------------------------- Code aus der Registrierung beim Bestätigen einlösen
create or replace function public.fp_auth_bestaetigt()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email_confirmed_at is not null and old.email_confirmed_at is null
     and coalesce(new.raw_user_meta_data ->> 'einladungscode', '') <> '' then
    begin
      perform public.fp_einladung_einloesen(new.id, new.raw_user_meta_data ->> 'einladungscode');
    exception when others then
      null; -- Bestätigung darf nie an einem Code scheitern; das Portal fragt den Code dann erneut ab
    end;
  end if;
  return new;
end $$;
revoke all on function public.fp_auth_bestaetigt() from public, anon, authenticated;
drop trigger if exists fp_auth_bestaetigt on auth.users;
create trigger fp_auth_bestaetigt after update of email_confirmed_at on auth.users
  for each row execute function public.fp_auth_bestaetigt();

-- ---------------------------------------------------------------- Administration: Freischaltungs-Anfragen
create or replace function public.fp_admin_anfragen()
returns table (id uuid, email text, name text, registriert timestamptz, bestaetigt boolean, code text)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.fp_admin_check();
  return query
    select u.id, u.email::text, coalesce(nullif(trim(u.raw_user_meta_data ->> 'name'), ''), split_part(u.email, '@', 1)),
           u.created_at, u.email_confirmed_at is not null, nullif(u.raw_user_meta_data ->> 'einladungscode', '')
      from auth.users u join public.profiles p on p.id = u.id
     where p.role = 'student'
       and u.raw_user_meta_data ->> 'app' = 'lehrer'
       and coalesce(u.raw_user_meta_data ->> 'lehrer_abgelehnt', '') <> 'true'
     order by u.created_at desc;
end $$;

create or replace function public.fp_admin_freischalten(p_user uuid, p_school uuid, p_schulleitung boolean default false)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.fp_admin_check();
  if p_school is null or not exists (select 1 from public.schools where id = p_school) then raise exception 'Bitte eine Schule wählen.'; end if;
  if not exists (select 1 from public.profiles where id = p_user) then raise exception 'Konto nicht gefunden.'; end if;
  if exists (select 1 from public.profiles where id = p_user and role = 'admin') then raise exception 'Das ist ein Administrationskonto.'; end if;
  perform set_config('fallpfad.allow_role', 'on', true);
  perform set_config('fallpfad.allow_school', 'on', true);
  update public.profiles set role = 'teacher', school_id = p_school, schulleitung = coalesce(p_schulleitung, false) where id = p_user;
  update auth.users set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) - 'lehrer_abgelehnt' where id = p_user;
end $$;

create or replace function public.fp_admin_freischalten_email(p_email text, p_school uuid, p_schulleitung boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  perform public.fp_admin_check();
  select u.id into v from auth.users u where lower(u.email) = lower(trim(p_email)) limit 1;
  if v is null then raise exception 'Zu dieser E-Mail-Adresse gibt es noch kein Konto. Die Person muss sich zuerst im Lehrer-Portal registrieren.'; end if;
  perform public.fp_admin_freischalten(v, p_school, p_schulleitung);
  return v;
end $$;

create or replace function public.fp_admin_ablehnen(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.fp_admin_check();
  update auth.users set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || '{"lehrer_abgelehnt": "true"}'::jsonb
   where id = p_user and exists (select 1 from public.profiles p where p.id = p_user and p.role = 'student');
end $$;

revoke all on function public.fp_admin_anfragen() from public, anon;
revoke all on function public.fp_admin_freischalten(uuid, uuid, boolean) from public, anon;
revoke all on function public.fp_admin_freischalten_email(text, uuid, boolean) from public, anon;
revoke all on function public.fp_admin_ablehnen(uuid) from public, anon;
grant execute on function public.fp_admin_anfragen() to authenticated;
grant execute on function public.fp_admin_freischalten(uuid, uuid, boolean) to authenticated;
grant execute on function public.fp_admin_freischalten_email(text, uuid, boolean) to authenticated;
grant execute on function public.fp_admin_ablehnen(uuid) to authenticated;

-- ---------------------------------------------------------------- KI nur mit Kurs (Lernende) bzw. als Lehrkraft
create or replace function public.fp_ki_erlaubt(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
      left join public.courses c on c.id = p.course_id
      left join public.schools s on s.id = c.school_id
     where p.id = p_user
       and (p.role = 'admin'
            or (p.role = 'teacher' and (p.school_id is null or exists (select 1 from public.schools x where x.id = p.school_id and x.aktiv)))
            or (p.course_id is not null and c.id is not null and coalesce(s.aktiv, true)))
  );
$$;
revoke all on function public.fp_ki_erlaubt(uuid) from public, anon, authenticated;
grant execute on function public.fp_ki_erlaubt(uuid) to service_role;

-- Eigener Status im Portal: wurde eine Anfrage abgelehnt?
create or replace function public.fp_mein_zugang()
returns table (rolle text, schule text, kurs boolean, ki boolean, abgelehnt boolean)
language sql stable security definer set search_path = public as $$
  select p.role, s.name, p.course_id is not null, public.fp_ki_erlaubt(p.id),
         coalesce((select u.raw_user_meta_data ->> 'lehrer_abgelehnt' from auth.users u where u.id = p.id), '') = 'true'
    from public.profiles p left join public.schools s on s.id = p.school_id
   where p.id = auth.uid();
$$;

revoke all on function public.fp_mein_zugang() from public, anon;
grant execute on function public.fp_mein_zugang() to authenticated;
