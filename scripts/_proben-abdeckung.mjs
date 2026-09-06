import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/** Welche Berufshauptgruppen haben eine Arbeitsprobe — und wie viele Stellen hängen daran? */
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

const proben = new Set((await db.execute(sql`
  select distinct kldb_hauptgruppe from aufgabenproben where aktiv and kldb_hauptgruppe is not null`))
  .rows.map((r) => String(r.kldb_hauptgruppe)));

const zeilen = (await db.execute(sql`
  select left(j.kldb,2) as hg, count(*)::int as n
  from jobs j
  where j.is_demo = false and j.kldb is not null
  group by 1 order by n desc`)).rows;

const gesamt = zeilen.reduce((a, z) => a + Number(z.n), 0);
let gedeckt = 0;
const offen = [];
for (const z of zeilen) {
  if (proben.has(String(z.hg))) gedeckt += Number(z.n);
  else offen.push(z);
}
console.log(`${proben.size} Berufshauptgruppen mit Probe`);
console.log(`Stellen mit Kennung: ${gesamt.toLocaleString("de-DE")}`);
console.log(`davon mit Probe:     ${gedeckt.toLocaleString("de-DE")} (${(100*gedeckt/gesamt).toFixed(1)} %)\n`);
if (offen.length) {
  console.log("Ohne Probe, nach Stellen:");
  for (const z of offen.slice(0, 10)) console.log(`  ${z.hg}  ${Number(z.n).toLocaleString("de-DE").padStart(8)}`);
}
process.exit(0);
