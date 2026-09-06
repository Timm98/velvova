import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const [a] = (await db.execute(sql`
  select count(*)::int gesamt, count(summary)::int mit_zusammenfassung,
         max(nachrichten) laengste
  from (select c.id, c.summary, count(m.id) nachrichten
        from nina_conversations c left join nina_messages m on m.conversation_id = c.id
        group by 1,2) x`)).rows;
console.log("Gespräche:", a.gesamt, "| mit Zusammenfassung:", a.mit_zusammenfassung, "| längstes:", a.laengste, "Nachrichten");
const [b] = (await db.execute(sql`select count(*)::int n from arbeitgeber_boards`)).rows;
console.log("arbeitgeber_boards:", b.n);
