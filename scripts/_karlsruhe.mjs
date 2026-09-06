import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

/**
 * Gibt es in unserem Bestand überhaupt Christchurch-Stellen, die auf
 * „Karlsruhe" passen könnten — und wie sieht die Ortsspalte aus?
 */
const [a] = (await db.execute(sql`
  select count(*)::int n from jobs where location ilike '%karlsruhe%'`)).rows;
console.log("Stellen mit Karlsruhe im Ort:", a.n);
const r = (await db.execute(sql`
  select country, count(*)::int n from jobs where location ilike '%karlsruhe%' group by 1 order by n desc`)).rows;
for (const z of r) console.log(`  ${z.country}: ${z.n}`);
const [c] = (await db.execute(sql`
  select count(*)::int n from jobs where location ilike '%christchurch%'`)).rows;
console.log("\nChristchurch-Stellen im Bestand:", c.n);
const s2 = (await db.execute(sql`
  select location, country from jobs where location ilike '%christchurch%' limit 3`)).rows;
for (const z of s2) console.log(`  ${z.location} (${z.country})`);
