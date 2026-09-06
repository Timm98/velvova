import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const r = (await db.execute(sql`
  select gemessen_am, stellen from bestandsverlauf order by gemessen_am desc limit 48`)).rows;
console.log(`${r.length} Messpunkte`);
if (r.length >= 2) {
  const neu = r[0], alt = r[r.length - 1];
  const sek = (new Date(neu.gemessen_am) - new Date(alt.gemessen_am)) / 1000;
  const diff = Number(neu.stellen) - Number(alt.stellen);
  console.log(`von ${new Date(alt.gemessen_am).toLocaleString("de")} bis ${new Date(neu.gemessen_am).toLocaleString("de")}`);
  console.log(`${diff.toLocaleString("de")} Stellen in ${(sek/3600).toFixed(1)} h = ${(diff/sek).toFixed(2)} je Sekunde`);
}
process.exit(0);
