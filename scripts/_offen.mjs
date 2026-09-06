import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const r = (await db.execute(sql`
  select titel, gesamt from beruf_zuordnung where beruf is null order by gesamt desc`)).rows;
console.log(`Nicht zugeordnet: ${r.length}`);
const keineTreffer = r.filter(x => x.gesamt === 0).length;
const wenige = r.filter(x => x.gesamt > 0 && x.gesamt < 10).length;
const vieleAberUneins = r.filter(x => x.gesamt >= 10).length;
console.log(`  0 Treffer (Suche fand nichts):        ${keineTreffer}`);
console.log(`  1–9 Treffer (zu speziell):            ${wenige}`);
console.log(`  ≥10 Treffer, aber kein klarer Beruf:  ${vieleAberUneins}`);
console.log("\nMit vielen Treffern, aber uneins:");
for (const x of r.slice(0, 8)) console.log(`   ${String(x.gesamt).padStart(3)}  ${x.titel.slice(0, 62)}`);
console.log("\nOhne jeden Treffer:");
for (const x of r.filter(x => x.gesamt === 0).slice(0, 8)) console.log(`        ${x.titel.slice(0, 62)}`);
process.exit(0);
