import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const t = Date.now();
try {
  const r = await db.execute(sql`
    select left(kldb, 2) g, count(*)::int n from jobs
    where country = 'DE' and kldb is not null group by 1 order by n desc limit 20`);
  console.log(`Gruppierung: ${Date.now() - t} ms · ${(r.rows ?? []).length} Gruppen`);
} catch (e) {
  console.log(`Gruppierung nach ${Date.now() - t} ms FEHLER: ${String(e.cause?.message ?? e.message).slice(0, 60)}`);
}
