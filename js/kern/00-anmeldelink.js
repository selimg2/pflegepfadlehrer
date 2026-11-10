/* Fallpfad: Links aus Anmelde-E-Mails direkt in der App einlösen (Schüler-App und Lehrer-Portal).
   Unterstützt zwei Link-Arten:
   1. ?token_hash=…&type=signup|recovery|email_change|magiclink  (eigene Fallpfad-E-Mail-Vorlagen, geräteunabhängig)
   2. #access_token=…&refresh_token=…&type=…                      (Standard-Link von Supabase)
   Danach wird die Adresse bereinigt, damit die App ihre eigenen Anker (#start, #home …) normal liest.
   Bei type=recovery fragt ein Dialog sofort das neue Passwort ab.
   Einbinden direkt nach config.js: <script src="js/kern/00-anmeldelink.js" data-storage="…"></script>
   data-storage = storageKey des Supabase-Clients der jeweiligen App (leer = Standard). */
(function () {
  var me = document.currentScript;
  var storageKey = (me && me.getAttribute("data-storage")) || undefined;
  var cfg = window.FALLPFAD_CONFIG || {};
  var url = cfg.supabaseUrl, key = cfg.supabaseAnonKey;
  if (!url || !key || !/^https?:/.test(location.protocol)) return;

  var q = new URLSearchParams(location.search), hh = new URLSearchParams(location.hash.replace(/^#/, ""));
  var th = q.get("token_hash"), typ = q.get("type") || hh.get("type") || "";
  var at = hh.get("access_token"), rt = hh.get("refresh_token");
  var fehler = hh.get("error_description") || q.get("error_description");
  var fehlerCode = hh.get("error_code") || q.get("error_code") || "";
  if (!th && !at && !fehler) return;

  // Adresse sofort bereinigen (vor dem Start der App), Token bleiben nur in dieser Funktion
  var rest = new URLSearchParams(location.search);
  ["token_hash", "type", "code", "error", "error_code", "error_description", "redirect_to"].forEach(function (k) { rest.delete(k); });
  var sauber = location.pathname + (rest.toString() ? "?" + rest.toString() : "");
  try { history.replaceState(null, "", sauber); } catch (e) {}

  var istLehrer = window.FP_APP_KIND === "lehrer" || storageKey === "fallpfad-lehrer-auth";
  var appName = istLehrer ? "Fallpfad Lehrer-Portal" : "Fallpfad";

  function box(inhalt) {
    var alt = document.getElementById("fp-anmeldelink");
    if (alt) alt.remove();
    var o = document.createElement("div");
    o.id = "fp-anmeldelink";
    o.setAttribute("role", "dialog");
    o.setAttribute("aria-modal", "true");
    o.style.cssText = "position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(15,23,42,.55);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";
    var k = document.createElement("div");
    k.style.cssText = "background:#fff;color:#0f172a;max-width:420px;width:100%;border-radius:18px;padding:26px 24px;box-shadow:0 20px 60px rgba(0,0,0,.25);line-height:1.5";
    k.innerHTML = inhalt;
    o.appendChild(k);
    (document.body || document.documentElement).appendChild(o);
    return k;
  }
  var knopf = "display:inline-block;margin-top:14px;padding:11px 18px;border:0;border-radius:12px;background:#0062FF;color:#fff;font-size:15px;font-weight:600;cursor:pointer";
  var feld = "display:block;width:100%;box-sizing:border-box;margin-top:6px;padding:11px 12px;border:1px solid #cbd5e1;border-radius:10px;font-size:15px";
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function weiter() { location.replace(sauber + (istLehrer ? "#start" : "")); }
  function meldung(titel, text, nochmal) {
    var k = box("<h2 style='margin:0 0 8px;font-size:20px'>" + esc(titel) + "</h2><p style='margin:0;color:#475569'>" + esc(text) + "</p><button type='button' style='" + knopf + "'>" + (nochmal ? "Zur Anmeldung" : "Weiter zu " + esc(appName)) + "</button>");
    k.querySelector("button").onclick = weiter;
  }
  function warten() { box("<p style='margin:0'>Einen Moment, dein Link wird geprüft …</p>"); }

  if (fehler && !th && !at) {
    var abgelaufen = /expired|otp_expired/i.test(fehlerCode + " " + fehler);
    var zeigen = function () {
      meldung(abgelaufen ? "Der Link ist abgelaufen" : "Der Link hat nicht funktioniert",
        abgelaufen ? "Bestätigungslinks gelten nur eine begrenzte Zeit und nur einmal. Melde dich an; ist die E-Mail noch nicht bestätigt, kannst du dir dort einen neuen Link schicken lassen." : "Bitte melde dich an oder fordere einen neuen Link an.", true);
    };
    if (document.body) zeigen(); else document.addEventListener("DOMContentLoaded", zeigen);
    return;
  }

  function lib() {
    if (window.supabase && window.supabase.createClient) return Promise.resolve();
    return new Promise(function (ok, nein) {
      var s = document.createElement("script");
      s.src = "vendor/supabase.js";
      s.onload = ok;
      s.onerror = function () { nein(new Error("Die Datenbank-Bibliothek konnte nicht geladen werden.")); };
      document.head.appendChild(s);
    });
  }

  function passwortDialog(c) {
    var k = box("<h2 style='margin:0 0 6px;font-size:20px'>Neues Passwort festlegen</h2><p style='margin:0 0 12px;color:#475569'>Wähle ein neues Passwort für " + esc(appName) + ".</p>" +
      "<form><label style='font-size:14px;font-weight:600'>Neues Passwort<input type='password' name='p1' autocomplete='new-password' minlength='8' required style='" + feld + "'></label>" +
      "<label style='display:block;margin-top:10px;font-size:14px;font-weight:600'>Wiederholen<input type='password' name='p2' autocomplete='new-password' minlength='8' required style='" + feld + "'></label>" +
      "<p class='f' role='alert' style='margin:10px 0 0;color:#b91c1c;font-size:14px'></p><button type='submit' style='" + knopf + "'>Passwort speichern</button></form>");
    var f = k.querySelector("form"), out = k.querySelector(".f");
    setTimeout(function () { try { f.p1.focus(); } catch (e) {} }, 30);
    f.onsubmit = function (ev) {
      ev.preventDefault();
      out.textContent = "";
      if (f.p1.value.length < 8) { out.textContent = "Bitte mindestens 8 Zeichen."; return; }
      if (f.p1.value !== f.p2.value) { out.textContent = "Die beiden Passwörter stimmen nicht überein."; return; }
      f.querySelector("button").disabled = true;
      c.auth.updateUser({ password: f.p1.value }).then(function (r) {
        if (r.error) { out.textContent = /same|different/i.test(r.error.message) ? "Das neue Passwort muss sich vom alten unterscheiden." : "Das hat nicht geklappt: " + r.error.message; f.querySelector("button").disabled = false; return; }
        meldung("Passwort geändert", "Du bist jetzt angemeldet.");
      });
    };
  }

  function start() {
    warten();
    lib().then(function () {
      var c = window.supabase.createClient(url, key, { auth: { persistSession: true, autoRefreshToken: false, detectSessionInUrl: false, storageKey: storageKey } });
      var p = th
        ? c.auth.verifyOtp({ token_hash: th, type: typ === "magiclink" ? "magiclink" : (typ || "email") })
        : c.auth.setSession({ access_token: at, refresh_token: rt });
      return p.then(function (r) {
        if (r.error) {
          var abg = /expired|invalid|not found/i.test(r.error.message || "");
          meldung(abg ? "Der Link ist abgelaufen oder wurde schon benutzt" : "Der Link hat nicht funktioniert",
            abg ? "Wenn du deine E-Mail schon bestätigt hast, melde dich einfach an. Sonst fordere bei der Anmeldung einen neuen Link an." : (r.error.message || "Bitte erneut versuchen."), true);
          return;
        }
        if (typ === "recovery") return passwortDialog(c);
        if (typ === "email_change") return meldung("E-Mail-Adresse geändert", "Deine neue E-Mail-Adresse ist bestätigt.");
        if (typ === "signup" || typ === "email" || typ === "invite") {
          return meldung("E-Mail bestätigt", istLehrer
            ? "Dein Konto ist aktiv. Im nächsten Schritt schaltest du mit deinem Einladungscode den Zugang zu deiner Schule frei."
            : "Dein Konto ist aktiv. Tritt mit dem Kurscode deiner Lehrkraft deinem Kurs bei, um alle Funktionen zu nutzen.");
        }
        weiter();
      });
    }).catch(function (e) { meldung("Der Link hat nicht funktioniert", e.message || "Bitte erneut versuchen.", true); });
  }
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
})();
