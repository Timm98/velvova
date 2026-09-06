import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const r = (await db.execute(sql`
  select column_name from information_schema.columns
  where table_name='user_settings' and column_name in ('avatar_pfad','voice_autoplay')`)).rows;
console.log("vorhanden:", r.map(x=>x.column_name).join(", ") || "keine");
try {
  await db.execute(sql`select avatar_pfad from user_settings limit 1`);
  console.log("Auswahl auf avatar_pfad: OK");
} catch (e) { console.log("Auswahl scheitert:", e.message?.slice(0,100)); }
process.exit(0);
