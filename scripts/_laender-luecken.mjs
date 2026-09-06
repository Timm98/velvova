import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts"); const db = await getDb();
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");

const jooble = "ae ar at au az ba be bg bh br by ca ch ci cl co cr cu cz de dk do ec eg es fi fr gr hk hr hu id ie il in it jp kr kw kz ma mx my ng nl no nz pe ph pk pl pt qa ro rs ru sa se sg sk sv th tr tw ua us uy uz ve za".split(" ").map(c=>c.toUpperCase());

const rows = (await db.execute(sql`
  select country, count(*)::int as n from jobs where country is not null group by country
`)).rows;
const bestand = new Map(rows.map(r => [r.country, r.n]));

const mit = jooble.filter(c => bestand.has(c)).sort((a,b)=>bestand.get(b)-bestand.get(a));
const ohne = jooble.filter(c => !bestand.has(c));

console.log(`Jooble-Märkte gesamt: ${jooble.length}`);
console.log(`\nDavon haben wir schon Bestand (${mit.length}) — Jooble verdichtet:`);
console.log("  " + mit.map(c=>`${c} ${bestand.get(c).toLocaleString("de")}`).join(" · "));
console.log(`\nDavon haben wir noch nichts (${ohne.length}) — Jooble erschließt neu:`);
console.log("  " + ohne.join(" "));
console.log(`\nUnsere Länder ohne Jooble-Markt:`);
console.log("  " + [...bestand.keys()].filter(c=>!jooble.includes(c)).sort().join(" "));
process.exit(0);
