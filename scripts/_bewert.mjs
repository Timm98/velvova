import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb, schema } = await import("../packages/db/src/index.ts");
const { eq } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const m = await import("../apps/web/src/lib/matching.ts");
const db = await getDb();
// Ein echtes Nutzerprofil nehmen, damit die Messung dem Seitenaufruf entspricht.
const [u] = await db.select({ id: schema.users.id }).from(schema.users).limit(1);
const ctx = await m.loadProfileContext(u.id);
for (const runde of [1, 2]) {
  const t = Date.now();
  const r = await m.scoreAllJobs(u.id, ctx);
  console.log(`  Runde ${runde}: ${Date.now() - t} ms für ${r.length} Stellen`);
}
process.exit(0);
