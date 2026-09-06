import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const r = (await db.execute(sql`
  select kldb_hauptgruppe, count(*)::int n, min(titel) beispiel
  from aufgabenproben where aktiv group by 1 order by 1`)).rows;
for (const z of r) console.log(`  ${String(z.kldb_hauptgruppe ?? "allgemein").padEnd(12)} ${String(z.n).padStart(3)}  ${String(z.beispiel).slice(0, 40)}`);
console.log(`\n${r.length} Gruppen mit Proben`);
