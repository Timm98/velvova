import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Führt die Bundesagentur die Stellen, die wir bei Adzuna finden?
 *
 * Die Zählung im eigenen Bestand taugt dafür nicht: Wir haben von
 * beiden Quellen nur Stichproben, und zwei kleine Stichproben aus
 * grossen Mengen überschneiden sich auch dann kaum, wenn die Mengen
 * selbst deckungsgleich sind.
 *
 * Also direkt gefragt: Für jede Adzuna-Stelle bei der Jobbörse nach
 * Titel und Arbeitgeber suchen und sehen, ob sie dort steht.
 */
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const K = { "X-API-Key": "jobboerse-jobsuche", "User-Agent": "Paycheck/1.0" };
const B = "https://rest.arbeitsagentur.de/jobboerse/jobsuche-service";
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

const proben = (await db.execute(sql`
  select j.title, c.name firma from jobs j
  join job_sources s on s.id = j.source_id
  join companies c on c.id = j.company_id
  where s.display_name = 'Adzuna Deutschland' and j.is_demo = false
  order by random() limit 60`)).rows;

const norm = (x) => String(x).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
let gefunden = 0, gefragt = 0;
for (const p of proben) {
  const r = await fetch(`${B}/pc/v6/jobs?was=${encodeURIComponent(p.title)}&size=25&page=1`, {
    headers: K, signal: AbortSignal.timeout(20000) }).catch(() => null);
  await warte(160);
  if (!r?.ok) continue;
  gefragt++;
  const d = await r.json().catch(() => null);
  const firma = norm(p.firma);
  const treffer = (d?.ergebnisliste ?? []).some((s) => norm(s.firma ?? "").includes(firma) || firma.includes(norm(s.firma ?? "")));
  if (treffer) gefunden++;
}
console.log(`${gefragt} Adzuna-Stellen bei der Jobbörse gesucht.`);
console.log(`Beim selben Arbeitgeber gefunden: ${gefunden}  → ${gefragt ? (100*gefunden/gefragt).toFixed(0) : 0} %`);
console.log(gefunden / Math.max(1,gefragt) < 0.25
  ? "\nDie Quellen überschneiden sich wenig — sie addieren sich weitgehend."
  : "\nDeutliche Überschneidung — die Summe beider Quellen ist nicht die Summe der Stellen.");
process.exit(0);
