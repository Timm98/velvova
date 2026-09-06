import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const [a] = (await db.execute(sql`
  select
    count(*) filter (where title like '%**%' or title like '%<%>%')::int titel,
    count(*) filter (where core_tasks::text like '%**%')::int aufgaben,
    count(*) filter (where benefits::text like '%**%')::int benefits,
    count(*)::int n
  from jobs tablesample system (3)`)).rows;
console.log(`Stichprobe ${a.n.toLocaleString("de-DE")} · Titel mit Markup ${a.titel} · Aufgaben ${a.aufgaben} · Benefits ${a.benefits}`);
const r = (await db.execute(sql`
  select core_tasks from jobs tablesample system (2)
  where core_tasks::text like '%**%' limit 3`)).rows;
for (const z of r) console.log("  ", JSON.stringify(z.core_tasks).slice(0, 150));
