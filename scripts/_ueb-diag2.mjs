import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const r = (await db.execute(sql`
  select u.job_id, u.sprache, j.title, j.original_language, length(u.beschreibung) laenge
  from job_uebersetzungen u join jobs j on j.id = u.job_id`)).rows;
for (const z of r) console.log(`${String(z.title).slice(0,44)} · ${z.original_language} → ${z.sprache} · ${z.laenge} Zeichen`);
