import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { berufsgruppe } = await import("../apps/web/src/lib/jobs/visuals.ts");
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const r = (await db.execute(sql`
  select title from jobs where is_demo=false order by md5(id::text) limit 40`)).rows;
for (const x of r) {
  const g = berufsgruppe(String(x.title), []);
  console.log(`  ${String(g ?? "—").padEnd(17)} ${String(x.title).slice(0, 58)}`);
}
process.exit(0);
