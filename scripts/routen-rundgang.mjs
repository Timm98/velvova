import { chromium } from "@playwright/test";

/**
 * Jede erreichbare Seite einmal öffnen.
 *
 * Der Grund: Ein Audit, das Dateien zählt, rät. Zweimal habe ich beim
 * Aufbau dieser Prüfung Pfade geraten und Bereiche als „fehlt" gemeldet,
 * die es gab — der Gehaltsrechner und die Abrechnung lagen nur woanders,
 * als ich gesucht hatte.
 *
 * Routen raten nicht. Was 200 liefert und Text zeigt, existiert; was
 * 404 liefert oder eine Fehlerseite zeigt, ist kaputt. Das ist die
 * einzige Aussage, die ohne Annahmen auskommt.
 *
 *   node scripts/routen-rundgang.mjs
 */
const B = "http://localhost:3000";
const ROUTEN = process.argv.slice(2);

/*
 * Routen, für die 404 die RICHTIGE Antwort ist.
 *
 * Der Betriebsbereich ist rollengebunden. Für ein gewöhnliches Konto
 * darf es ihn nicht geben — und zwar als 404, nicht als 403: Ein 403
 * bestätigt, dass die Seite existiert.
 *
 * Ohne diese Liste meldete der Rundgang vier „kaputte" Routen und
 * beschrieb damit ausgerechnet die Sicherheitskorrektur als Fehler.
 * Ein Prüfwerkzeug, das richtiges Verhalten anklagt, wird ignoriert —
 * und dann übersieht man auch die echten Treffer daneben.
 */
const ERWARTET_404 = (r) => r === "/admin" || r.startsWith("/admin/");

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, locale: "de-DE" });
const p = await ctx.newPage();
const jsFehler = new Map();
p.on("pageerror", (e) => {
  const k = new URL(p.url()).pathname;
  jsFehler.set(k, (jsFehler.get(k) ?? []).concat(e.message.slice(0, 90)));
});

await p.goto(`${B}/register`, { waitUntil: "domcontentloaded" });
await p.getByLabel("E-Mail-Adresse").fill(`rund-${Date.now()}@example.invalid`);
await p.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await p.getByRole("button", { name: /Konto anlegen/i }).click();
await p.waitForURL(/\/(app|setup)/, { timeout: 60000 });

let kaputt = 0, duenn = 0;
for (const r of ROUTEN) {
  let status = 0, laenge = 0, hinweis = "";
  try {
    const resp = await p.goto(`${B}${r}`, { waitUntil: "networkidle", timeout: 45000 });
    status = resp?.status() ?? 0;
    await p.waitForTimeout(700);
    const t = (await p.locator("body").innerText()).replace(/\s+/g, " ");
    laenge = t.length;
    if (ERWARTET_404(r) && status === 404) { console.log(`  ok  404 ${String(laenge).padStart(6)}  ${r.padEnd(34)} (Betrieb — für dieses Konto korrekt gesperrt)`); continue; }
    if (ERWARTET_404(r)) {
      hinweis = status === 404 ? "" : "SOLLTE 404 SEIN";
    } else if (/schiefgegangen|Etwas ist schief/i.test(t)) hinweis = "FEHLERSEITE";
    else if (status >= 400) hinweis = "HTTP";
    else if (laenge < 260) hinweis = "sehr wenig Inhalt";
  } catch (e) {
    hinweis = "TIMEOUT/ABBRUCH";
  }
  const je = jsFehler.get(r);
  if (["FEHLERSEITE", "HTTP", "TIMEOUT/ABBRUCH", "SOLLTE 404 SEIN"].includes(hinweis)) kaputt++;
  else if (hinweis) duenn++;
  const flagge = hinweis ? "!!" : "ok";
  console.log(`  ${flagge}  ${String(status).padEnd(3)} ${String(laenge).padStart(6)}  ${r.padEnd(34)} ${hinweis}${je ? " · JS: " + je[0] : ""}`);
}
console.log(`\n  ${ROUTEN.length} Routen · ${kaputt} kaputt · ${duenn} auffällig dünn`);
await b.close();
process.exit(kaputt > 0 ? 1 : 0);
