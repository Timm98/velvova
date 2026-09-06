import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const [g] = (await db.execute(sql`
  select c.id, count(m.id)::int n, max(m.index)::int hoechster
  from nina_conversations c left join nina_messages m on m.conversation_id = c.id
  where c.title = 'Prüfgespräch' group by 1 order by n desc limit 1`)).rows;
console.log("Nachrichten jetzt:", g.n, "| höchster Index:", g.hoechster);
const r = (await db.execute(sql`
  select purpose, task_type, tier, status, created_at from ai_runs order by created_at desc limit 6`)).rows;
console.log("\nletzte KI-Läufe:");
for (const z of r) console.log(" ", String(z.purpose)+" "+String(z.task_type??"").padEnd(24), z.tier, z.status, new Date(z.created_at).toLocaleTimeString("de-DE"));
