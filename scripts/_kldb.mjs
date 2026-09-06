import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const r = (await db.execute(sql`
  select r.raw_payload from job_snapshots r
  join jobs j on j.id = r.job_id join job_sources s on s.id = j.source_id
  where s.display_name = 'Bundesagentur für Arbeit' and r.raw_payload ? 'rohantwort' limit 2`)).rows;
if (r.length === 0) { console.log("keine BA-Rohantworten mit vollem Inhalt"); process.exit(0); }
for (const x of r) {
  const p = typeof x.raw_payload === "string" ? JSON.parse(x.raw_payload) : x.raw_payload;
  const roh = p.rohantwort ?? {};
  const suche = roh.suche ?? {};
  console.log("Suche-Felder:", Object.keys(suche).join(", "));
  for (const k of Object.keys(suche)) {
    if (/beruf|kldb|klassif|schluessel|schlüssel/i.test(k)) console.log(`   ${k} = ${JSON.stringify(suche[k]).slice(0,120)}`);
  }
  const d = roh.detail ?? {};
  if (d && typeof d === "object") {
    console.log("Detail-Felder:", Object.keys(d).slice(0, 30).join(", "));
    for (const k of Object.keys(d)) {
      if (/beruf|kldb|klassif|schluessel/i.test(k)) console.log(`   ${k} = ${JSON.stringify(d[k]).slice(0,140)}`);
    }
  }
  console.log("---");
}
process.exit(0);
