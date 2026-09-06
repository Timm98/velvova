import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const W = sql`is_demo = false and to_tsvector('german', title) @@ plainto_tsquery('german', 'Softwareentwickler')`;
const messe = async (name, q) => {
  await db.execute(q);                       // aufwaermen
  const t = Date.now(); await db.execute(q); // messen
  console.log(`${name.padEnd(34)}: ${Date.now()-t} ms`);
};
await messe("desc  (= nulls first)", sql`select id from jobs where ${W} order by published_at desc limit 25`);
await messe("desc nulls last", sql`select id from jobs where ${W} order by published_at desc nulls last limit 25`);
const [n] = (await db.execute(sql`select count(*)::int c from jobs where ${W} and published_at is null`)).rows;
const [g] = (await db.execute(sql`select count(*)::int c from jobs where ${W}`)).rows;
console.log(`Treffer gesamt ${g.c.toLocaleString("de")}, davon ohne Datum ${n.c.toLocaleString("de")}`);
process.exit(0);
