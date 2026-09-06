import { chromium } from "@playwright/test";
const BASIS = "http://localhost:3000";
const b = await chromium.launch();
const s = await b.newPage({ baseURL: BASIS });
const fehler = [];
s.on("console", (m) => { if (m.type() === "error") fehler.push(m.text()); });
s.on("pageerror", (e) => fehler.push(String(e)));
await s.goto(`${BASIS}/register`);
await s.getByLabel("E-Mail-Adresse").fill(`e2e-hyd-${Date.now()}@example.invalid`);
await s.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await s.getByRole("button", { name: /Konto anlegen/i }).click();
await s.waitForURL(/\/(app|setup)/, { timeout: 45000 });
/*
 * Eine Seite zu pruefen und "keine Hydrationsfehler" zu melden, ist
 * geraten. Der zuletzt gefundene Fehler steckte in der Kopfzeile und
 * damit auf jeder angemeldeten Seite — eine einzige Stichprobe haette
 * ihn ebenso gut verfehlt wie gefunden. Deshalb die Rundreise.
 */
const SEITEN = [
  "/app",
  "/app/applications",
  "/app/beitraege",
  "/app/belege",
  "/app/bilanz",
  "/app/career",
  "/app/check-ins",
  "/app/documents",
  "/app/jobs",
  "/app/jobs/import",
  "/app/jobs/vergleich",
  "/app/nina",
  "/app/notifications",
  "/app/offers",
  "/app/opportunities",
  "/app/proben",
  "/app/profile",
  "/app/roles",
  "/app/settings",
  "/app/settings/abo",
  "/app/settings/appearance",
  "/app/settings/gehalt",
  "/app/settings/integrations",
  "/app/settings/language-region",
  "/app/settings/lebenshaltung",
  "/app/settings/matching",
  "/app/settings/notifications",
  "/app/settings/privacy",
  "/app/settings/voice",
  "/app/tools/gehalt",
  "/app/tools/route",
  "/app/zusagen",
];

let gesamt = 0;
const fehlende = [];
for (const pfad of SEITEN) {
  fehler.length = 0;
  const antwort = await s.goto(`${BASIS}${pfad}`, { waitUntil: "domcontentloaded" }).catch(() => null);
  await s.waitForTimeout(3500);
  const status = antwort ? antwort.status() : "kein Aufruf";
  if (status !== 200) fehlende.push(`${pfad} (${status})`);
  const hydration = fehler.filter((f) => /hydrat|didn't match|did not match/i.test(f));
  gesamt += hydration.length;
  console.log(`${String(status).padEnd(12)} ${pfad.padEnd(22)} Hydration ${hydration.length} · sonstige Fehler ${fehler.length - hydration.length}`);
  for (const f of hydration) {
    const i = f.search(/didn't match|did not match/);
    console.log("   ---");
    console.log("   " + f.slice(Math.max(0, i - 100), i + 900).replace(/\n/g, "\n   "));
  }
}
console.log(`\nHydrationsfehler gesamt: ${gesamt}`);
if (fehlende.length > 0) {
  console.log(`Nicht erreichbare Seiten (${fehlende.length}): ${fehlende.join(", ")}`);
  console.log("Eine Pruefliste, die auf 404 zeigt, prueft nichts.");
}
process.exit(gesamt > 0 || fehlende.length > 0 ? 1 : 0);
await b.close();
