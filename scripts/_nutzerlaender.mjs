import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
for (const [titel, q] of [
  ["Nutzer nach Land", sql`select country, count(*)::int n from user_settings where country is not null group by country order by n desc limit 15`],
  ["Zielländer der Nutzer", sql`select unnest(target_countries) c, count(*)::int n from user_settings where target_countries is not null group by c order by n desc limit 20`],
]) {
  try {
    const r = (await db.execute(q)).rows;
    console.log(`\n${titel}: ` + (r.length ? r.map(x => `${x.country ?? x.c} ${x.n}`).join(" · ") : "keine Daten"));
  } catch (e) { console.log(`\n${titel}: ${e.message.slice(0,90)}`); }
}
process.exit(0);
