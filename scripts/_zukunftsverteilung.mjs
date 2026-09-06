import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const r = (await db.execute(sql`
  select zukunftssicherheit s, count(*)::int n from isco_berufe
  where zukunftssicherheit is not null group by 1 order by 1`)).rows;
const g = r.reduce((a,x)=>a+x.n,0);
console.log(`${g} Berufsgruppen mit Zukunftsbewertung`);
for (const x of r) console.log(`  Stufe ${x.s}: ${x.n} (${((x.n/g)*100).toFixed(0)} %)`);
const [q] = (await db.execute(sql`select distinct quelle, stand from isco_berufe limit 1`)).rows;
console.log("Quelle:", q?.quelle, "· Stand:", q?.stand);
process.exit(0);
