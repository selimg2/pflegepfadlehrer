-- Fallpfad – Nachtrag 12.11.2026
-- Einmal im Supabase-Dashboard unter "SQL Editor" ausführen. Kann gefahrlos mehrfach ausgeführt werden.

-- 1) Kurswechsel-Sperre korrigieren
--    Bisher blockierte die Sperre auch das normale Speichern des eigenen Profils (Name, Ausbildungsjahr),
--    weil die App das Profil per "upsert" speichert und der INSERT-Trigger dabei immer auslöst.
--    Fehler in den Logs: "Bitte den Kurscode deiner Lehrkraft eingeben." (POST /rest/v1/profiles 400).
create or replace function public.fp_kurs_wechsel_guard()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if coalesce(auth.role(), '') in ('authenticated', 'anon')
     and not public.is_teacher()
     and new.course_id is not null
     and (
       (tg_op = 'INSERT' and not exists (select 1 from public.profiles p where p.id = new.id and p.course_id is not distinct from new.course_id))
       or (tg_op = 'UPDATE' and new.course_id is distinct from old.course_id)
     )
     and not exists (select 1 from public.fp_kurs_ticket t
                     where t.user_id = auth.uid() and t.course_id = new.course_id and t.erstellt > now() - interval '30 minutes') then
    raise exception 'Bitte den Kurscode deiner Lehrkraft eingeben.';
  end if;
  return new;
end $function$;

-- 2) Tabelle für Kontakt- und Rechtstexte der App
--    Die Schüler-App liest sie beim Öffnen der Einstellungen. Sie fehlte bisher (404 in den Logs).
create table if not exists public.fp_einstellungen (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);
alter table public.fp_einstellungen enable row level security;
drop policy if exists fp_einstellungen_lesen on public.fp_einstellungen;
create policy fp_einstellungen_lesen on public.fp_einstellungen for select to anon, authenticated using (true);
drop policy if exists fp_einstellungen_admin on public.fp_einstellungen;
create policy fp_einstellungen_admin on public.fp_einstellungen for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.fp_einstellungen to anon, authenticated;
grant insert, update, delete on public.fp_einstellungen to authenticated;
