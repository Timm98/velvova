import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const t0 = Date.now();
try {
  const r = (await db.execute(sql`
    select id, title from jobs
    where is_demo = false and title ilike ${'%Pflegefachkraft%'}
    order by published_at desc nulls last limit 20`)).rows;
  console.log(`ILIKE ohne Index: ${((Date.now()-t0)/1000).toFixed(1)} s · ${r.length} Treffer`);
} catch (e) { console.log(`ILIKE ohne Index: abgebrochen nach ${((Date.now()-t0)/1000).toFixed(1)} s — ${e.message.slice(0,80)}`); }
process.exit(0);
