import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const messe = async (name, q) => { await db.execute(q); const t=Date.now(); await db.execute(q); console.log(`${name.padEnd(34)}: ${Date.now()-t} ms`); };
for (const land of ["NL","SG","US"]) {
  await messe(`${land} direkt`, sql`
    select id from jobs where is_demo=false and country=${land}
    order by published_at desc nulls last limit 25`);
  await messe(`${land} materialisiert`, sql`
    with t as materialized (select id, published_at from jobs where is_demo=false and country=${land})
    select id from t order by published_at desc nulls last limit 25`);
}
process.exit(0);
