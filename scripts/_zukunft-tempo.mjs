import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const messen = async (name, f) => {
  const t = Date.now();
  try { await f(); console.log(`${name.padEnd(38)} ${String(Date.now()-t).padStart(6)} ms`); }
  catch (e) { console.log(`${name.padEnd(38)} FEHLER ${String(e.cause?.message ?? e.message).slice(0,44)}`); }
};
await messen("isco_berufe gruppiert", () => db.execute(sql`
  select count(*)::int, avg(zukunftssicherheit)::float from isco_berufe where hauptgruppe_nummer = 2`));
await messen("entgelt_kldb Nachschlag", () => db.execute(sql`
  select * from entgelt_kldb where kldb = '43104'`));
await messen("entgelt_kldb Sammelabfrage", () => db.execute(sql`
  select * from entgelt_kldb where kldb in ('43104','81102','62102','71304','24102')`));
await messen("standzeit_referenz", () => db.execute(sql`select * from standzeit_referenz where gruppe = '43'`));
await messen("eine Stelle nach id", () => db.execute(sql`
  select id, title from jobs where id = '000004ef-14d9-4590-9c08-4d135f9cc5ba'`));
