// Fallpfad: Konto löschen (Supabase Edge Function "konto-loeschen")
// Auszubildende löschen ihr Konto selbst in der App. Gelöscht wird der Nutzer in auth.users; alle Tabellen mit
// "references auth.users on delete cascade" (Profil, Fortschritt, Ergebnisse, Abgaben, Ausbildungsnachweis,
// Feedback, Lesestatus, Live-Stimmen mit Nutzerbezug) werden dadurch automatisch mitgelöscht.
// Lehrkräfte und Admins löschen ihr Konto nicht hier, sondern über die Schulverwaltung (Schutz vor Datenverlust der Schule).
// Protokoll: nur Zeitpunkt und Rolle, keine Inhalte, keine Kennung (Nachweis der Löschung nach Art. 5 Abs. 2 DSGVO).
import { createClient } from "npm:@supabase/supabase-js@2";
import { antworten, vorpruefung } from "../_shared/sicherheit.ts";


Deno.serve(async (req) => {
  const vor = vorpruefung(req, 4_000);
  if (vor) return vor;
  const json = antworten(req);
  const url = Deno.env.get("SUPABASE_URL")!;
  const user = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const { data: u } = await user.auth.getUser();
  if (!u?.user) return json({ error: "Bitte melde dich erneut an und versuche es dann noch einmal." }, 401);
  let b: any = {};
  try { b = await req.json(); } catch { /* leer */ }
  if (b.bestaetigt !== true) return json({ error: "Bitte bestätige das Löschen." }, 400);

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: prof } = await admin.from("profiles").select("role").eq("id", u.user.id).maybeSingle();
  const role = prof?.role ?? "student";
  if (role !== "student") return json({ error: "Konten von Lehrkräften löscht die Schulverwaltung im Lehrer-Portal." }, 403);

  const { error } = await admin.auth.admin.deleteUser(u.user.id);
  if (error) { console.error("deleteUser", error.status ?? ""); return json({ error: "Das Löschen hat nicht geklappt. Bitte später erneut versuchen." }, 500); }
  console.log("konto-geloescht", role, new Date().toISOString());
  return json({ ok: true });
});
