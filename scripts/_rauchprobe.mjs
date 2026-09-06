import { chromium } from "@playwright/test";
import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

/**
 * Alle geänderten Seiten einmal aufrufen.
 *
 * Geprüft wird nicht das Aussehen, sondern: kommt die Seite, und
 * schreibt sie keinen Fehler in die Konsole.
 */
const [stelle] = (await db.execute(sql`
  select id from jobs where country='DE' and description is not null order by id limit 1`)).rows;

const BASIS = "http://localhost:3000";
const b = await chromium.launch();
const s = await b.newPage({ baseURL: BASIS });
const fehler = [];
s.on("pageerror", (e) => fehler.push(String(e).slice(0, 120)));
s.on("console", (m) => { if (m.type() === "error" && !/favicon|404 \(Not Found\)/.test(m.text())) fehler.push(m.text().slice(0, 120)); });

await s.goto(`${BASIS}/register`);
await s.getByLabel("E-Mail-Adresse").fill(`e2e-rauch-${Date.now()}@example.invalid`);
await s.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await s.getByRole("button", { name: /Konto anlegen/i }).click();
await s.waitForURL(/\/(app|setup)/, { timeout: 45000 });

const SEITEN = [
  ["/app", /Heute|Nächster|Willkommen|Nina/i],
  ["/app/jobs", /Stellen|Jobs|Suche/i],
  [`/app/jobs/${stelle.id}`, /Arbeitsalltag|Quelle/i],
  ["/app/belege", /Was du belegen kannst/i],
  ["/app/tools/gehalt", /Was bleibt wirklich übrig/i],
  ["/app/tools/route", /Pendelrechner/i],
  ["/app/proben", /Ausprobieren/i],
  ["/app/career", /Karriereprofil|Profil/i],
  ["/app/applications", /Bewerbungen/i],
  ["/app/beitraege", /Was gerade passiert|Beiträge/i],
  ["/app/zusagen", /Zusagen|Versprechen/i],
  ["/app/bilanz", /Empfehlungen|Bilanz/i],
  ["/app/settings", /Einstellungen/i],
  ["/login", /Anmelden/i],
  ["/login?fehler=link_abgelaufen", /gilt nicht mehr/i],
];

/* Erst einmal alles anfahren — der Entwicklungsserver übersetzt jede
   Route beim ersten Aufruf. Gemessen wird der zweite. */
for (const [pfad] of SEITEN) await s.goto(`${BASIS}${pfad}`, { timeout: 120000 }).catch(() => {});
console.log("— aufgewärmt, jetzt die Messung —\n");

for (const [pfad, muster] of SEITEN) {
  const vorher = fehler.length;
  const t0 = Date.now();
  const a = await s.goto(`${BASIS}${pfad}`, { waitUntil: "domcontentloaded", timeout: 120000 })
    .catch(() => null);
  await s.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
  const dauer = ((Date.now() - t0) / 1000).toFixed(1);
  const text = await s.locator("body").innerText().catch(() => "");
  const passt = muster.test(text);
  const neueFehler = fehler.length - vorher;
  console.log(
    `${String(a?.status() ?? "—").padEnd(4)} ${passt ? "ok " : "?? "} ${String(dauer).padStart(6)}s ${neueFehler ? `${neueFehler} Fehler` : "        "} ${pfad}`,
  );
}
console.log("\nFehler gesamt:", fehler.length);
for (const f of [...new Set(fehler)].slice(0, 5)) console.log("  ·", f);
await b.close();
