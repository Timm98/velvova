import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { berufsgruppe } = await import("../apps/web/src/lib/jobs/visuals.ts");
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
/* Über die amtliche Bezeichnung, nicht den Anzeigentitel: die ist normiert. */
const zeilen = (await db.execute(sql`
  select z.beruf, count(*)::int as n
  from jobs j
  join beruf_zuordnung z on z.titel = lower(btrim(regexp_replace(j.title,
    '\\s*\\(m/w/d\\)|\\s*\\(w/m/d\\)|\\s*m/w/d', '', 'gi')))
  where j.is_demo = false
  group by z.beruf order by n desc limit 400`)).rows;
const offen = [];
let gedeckt = 0, offenN = 0;
for (const z of zeilen) {
  if (berufsgruppe(String(z.beruf), [])) gedeckt += Number(z.n);
  else { offen.push(z); offenN += Number(z.n); }
}
console.log(`Top-400 amtliche Bezeichnungen · gedeckt ${gedeckt.toLocaleString("de-DE")} Stellen · offen ${offenN.toLocaleString("de-DE")}\n`);
console.log("Häufigste ohne Feld:");
for (const z of offen.slice(0, 40)) console.log(`  ${String(z.n).padStart(6)}  ${z.beruf}`);
process.exit(0);
