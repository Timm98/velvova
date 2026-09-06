import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
for (const t of ["job_postings", "organizations", "organization_members", "rollen_aussagen"]) {
  try {
    const [r] = (await db.execute(sql.raw(`select count(*)::int n from ${t}`))).rows;
    console.log(t.padEnd(24), r.n);
  } catch (e) { console.log(t.padEnd(24), "—"); }
}
