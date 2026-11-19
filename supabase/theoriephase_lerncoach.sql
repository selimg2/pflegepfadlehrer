-- =====================================================================
-- Fallpfad: Theoriephase (Bausteine statt starrem Jahresplan) und Lerncoach je Kurs
-- Voraussetzung: live_unterricht.sql und audit_mandantentrennung.sql wurden ausgeführt. Wiederholbar.
-- Ausführen: Supabase-Dashboard > SQL Editor > New query > Inhalt einfügen > Run.
--
-- courses.settings (jsonb) bekommt drei neue Schlüssel, die das Lehrer-Portal schreibt:
--   "focus": ["fm10","fm11"]   Module der aktuellen Theoriephase (werden in der Lernenden-App oben gezeigt)
--   "phase": "Theorieblock 3"  Bezeichnung des Blocks (optional)
--   "coach": {"name","rolle","email","telefon","zeiten"}   Ansprechperson bei Lernschwierigkeiten (optional)
-- Eine neue Tabelle oder Spalte ist nicht nötig.
-- =====================================================================

-- 1. course_settings liefert zusätzlich focus und phase (kein Personenbezug).
--    Bleibt, wie nach dem Audit festgelegt, nur für angemeldete Konten aufrufbar.
create or replace function public.course_settings(p_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('years',  coalesce(settings -> 'years',  '[]'::jsonb),
                            'hidden', coalesce(settings -> 'hidden', '[]'::jsonb),
                            'locked', coalesce(settings -> 'locked', '[]'::jsonb),
                            'focus',  coalesce(settings -> 'focus',  '[]'::jsonb),
                            'phase',  coalesce(settings -> 'phase',  'null'::jsonb))
    from public.courses where id = p_id;
$$;
revoke execute on function public.course_settings(uuid) from public, anon;
grant  execute on function public.course_settings(uuid) to authenticated;

-- 2. Kontaktdaten des Lerncoachs: nur für Lernende, die selbst in diesem Kurs sind.
--    (Lehrkräfte und Administration lesen den Kurs ohnehin über ihre Kurs-Policy.)
create or replace function public.fp_kurs_hilfe()
returns jsonb language sql stable security definer set search_path = public as $$
  select c.settings -> 'coach'
    from public.profiles p
    join public.courses c on c.id = p.course_id
   where p.id = auth.uid()
     and jsonb_typeof(c.settings -> 'coach') = 'object';
$$;
revoke all on function public.fp_kurs_hilfe() from public, anon;
grant execute on function public.fp_kurs_hilfe() to authenticated;

-- Prüfung danach (als Lernende oder Lernender, nur lesend):
--   select public.fp_kurs_hilfe();                       -- null, solange kein Lerncoach hinterlegt ist
--   select public.course_settings('<kurs-id>');          -- enthält jetzt "focus" und "phase"
