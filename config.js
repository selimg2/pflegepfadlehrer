// Fallpfad Lehrer-Portal – Verbindung zur Datenbank
// Trage hier GENAU DIESELBEN zwei Werte ein wie in der config.js der Schüler-App
// (Supabase > Project Settings > API Keys bzw. Data API). Dazu die Adresse der Schüler-App für die QR-Codes.
// Den geheimen Schlüssel (service_role bzw. sb_secret_…) NIEMALS hier eintragen.
window.FALLPFAD_CONFIG = {
  supabaseUrl: "",      // z. B. "https://abcdefghijklmno.supabase.co"
  supabaseAnonKey: "",  // z. B. "sb_publishable_..."
  appUrl: "https://pflegepfad.vercel.app/"  // Adresse der Schüler-App
};
