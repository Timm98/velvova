import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Wie oft trifft die Anreicherung — und was kostet ein Treffer?
 *
 * `passt()` verwirft Kandidaten, die nur ähnlich heissen. Das ist
 * richtig, kostet aber Guthaben: Jeder geprüfte Kandidat ist eine
 * Einheit, auch der verworfene. Vor 18.293 Firmen will ich wissen, wie
 * das Verhältnis wirklich ist.
 */
const { CoresignalEnrichment } = await import("../packages/jobs/src/sources/coresignal.ts");
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

const guthaben = async () => {
  const r = await fetch("https://api.coresignal.com/cdapi/v2/company_base/search/filter", {
    method: "POST",
    headers: { apikey: process.env.CORESIGNAL_API_KEY.trim(), "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Zzzz" }), signal: AbortSignal.timeout(20000),
  }).catch(() => null);
  return Number(r?.headers.get("x-credits-remaining") ?? NaN);
};

const firmen = (await db.execute(sql`
  select c.name, count(*)::int stellen from companies c
  join jobs j on j.company_id = c.id
  where j.is_demo = false group by c.name
  having count(*) >= 5 order by count(*) desc offset 50 limit 50`)).rows;

const vor = await guthaben();
const cs = new CoresignalEnrichment({ land: "Germany" });
let treffer = 0;
const beispiele = [];
for (const f of firmen) {
  const d = await cs.unternehmen(f.name).catch(() => null);
  if (d) {
    treffer++;
    if (beispiele.length < 6) beispiele.push(`${String(f.name).slice(0,26).padEnd(28)} ${d.groesse ?? "?"} · ${(d.branche ?? "?").slice(0,22)} · ${d.hauptsitz ?? "?"}`);
  }
}
const nach = await guthaben();

console.log(`${firmen.length} Firmen geprüft · ${treffer} zugeordnet (${(100*treffer/firmen.length).toFixed(0)} %)`);
console.log(`Guthaben ${vor} → ${nach} · verbraucht ${vor - nach} Einheiten`);
console.log(`Kosten je Treffer: ${treffer ? ((vor - nach) / treffer).toFixed(1) : "—"} Einheiten\n`);
for (const b of beispiele) console.log("  " + b);
process.exit(0);
