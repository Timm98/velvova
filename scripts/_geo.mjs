import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const r = await db.execute(sql`
  SELECT count(*)::int AS gesamt,
         count(*) FILTER (WHERE latitude IS NOT NULL AND longitude IS NOT NULL)::int AS mit_koordinaten,
         count(*) FILTER (WHERE location IS NOT NULL AND location <> 'Nicht angegeben')::int AS mit_ort
  FROM jobs`);
const z = (r.rows ?? r)[0];
for (const [k, v] of Object.entries(z)) console.log(`  ${k.padEnd(18)} ${v}`);
const orte = await db.execute(sql`
  SELECT location, count(*)::int AS n FROM jobs
  WHERE location IS NOT NULL GROUP BY location ORDER BY count(*) DESC LIMIT 6`);
console.log("\n  Häufigste Ortsangaben:");
for (const o of (orte.rows ?? orte)) console.log(`    ${String(o.n).padStart(4)}×  ${o.location}`);
process.exit(0);
