import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const [n] = (await db.execute(sql`select count(*)::int n from job_uebersetzungen`)).rows;
console.log("Übersetzungen im Speicher:", n.n);
const [j] = (await db.execute(sql`
  select id, title, original_language, length(description) laenge from jobs
  where country='DE' and original_language='en' and length(description) between 400 and 6000
  order by id limit 1`)).rows;
console.log("Prüfstelle:", String(j.title).slice(0,40), "· Sprache", j.original_language, "· Länge", j.laenge);
const r = (await db.execute(sql`select task_type, status, created_at from ai_runs order by created_at desc limit 4`)).rows;
console.log("\nletzte KI-Läufe:");
for (const z of r) console.log(`  ${String(z.task_type).padEnd(22)} ${z.status} ${new Date(z.created_at).toLocaleTimeString("de-DE")}`);
