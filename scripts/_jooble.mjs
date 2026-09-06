import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const r = (await db.execute(sql`
  select key, display_name, enabled, license_status from job_sources where key like 'jooble%' order by key`)).rows;
for (const z of r) console.log(`${String(z.key).padEnd(14)} ${z.enabled ? "aktiv" : "aus  "} ${z.license_status} · ${z.display_name}`);
if (!r.length) console.log("keine Jooble-Quelle in der Datenbank");
