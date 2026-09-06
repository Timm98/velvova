import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const [g] = (await db.execute(sql`
  select c.id, c.summary, c.summarised_through_index d, count(m.id)::int n, max(m.index)::int hoechster
  from nina_conversations c left join nina_messages m on m.conversation_id = c.id
  where c.title = 'Prüfgespräch' group by 1,2,3 order by n desc limit 1`)).rows;
console.log("Gespräch:", g.id, "| Nachrichten:", g.n, "| höchster Index:", g.hoechster, "| verdichtet bis:", g.d);
const { needsSummary, SUMMARISE_AFTER, VERBATIM_TURNS } = await import("../apps/web/src/lib/nina/conversations.ts");
console.log("SUMMARISE_AFTER:", SUMMARISE_AFTER, "VERBATIM_TURNS:", VERBATIM_TURNS);
console.log("needsSummary(", g.hoechster, ",", g.d, ") =", needsSummary(Number(g.hoechster), Number(g.d)));
console.log("bisIndex würde sein:", Number(g.hoechster) - VERBATIM_TURNS);
