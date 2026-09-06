import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb, withUser, withSystem } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const [u] = (await db.execute(sql`select id from users limit 1`)).rows;

const messen = async (name, f, n = 10) => {
  await f();
  const t0 = Date.now();
  for (let i = 0; i < n; i++) await f();
  console.log(`  ${name.padEnd(38)} ${((Date.now()-t0)/n).toFixed(1)} ms`);
};
console.log("Vorgang                                  je Aufruf");
await messen("select 1 (eine Runde)", () => db.execute(sql`select 1`));
await messen("withSystem + select 1", () => withSystem(db, (tx) => tx.execute(sql`select 1`)));
if (u) await messen("withUser + select 1", () => withUser(db, u.id, (tx) => tx.execute(sql`select 1`)));
await messen("drei Abfragen nacheinander", async () => {
  await db.execute(sql`select 1`); await db.execute(sql`select 2`); await db.execute(sql`select 3`);
});
await messen("drei Abfragen parallel", () =>
  Promise.all([db.execute(sql`select 1`), db.execute(sql`select 2`), db.execute(sql`select 3`)]));
process.exit(0);
