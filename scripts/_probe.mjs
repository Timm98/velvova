import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { gehaltAusText } = await import("../packages/jobs/src/gehalt-aus-text.ts");
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const r = await db.execute(sql`select title, description from jobs where description is not null limit 1000`);
const rows = r.rows ?? r;
let treffer = 0;
const beispiele = [];
for (const z of rows) {
  const g = gehaltAusText(z.description);
  if (g) { treffer++; if (beispiele.length < 8) beispiele.push({ t: z.title, g }); }
}
console.log(`${treffer} von ${rows.length} Stellen nennen im Text ein Gehalt (${(treffer/rows.length*100).toFixed(1)} %)\n`);
for (const b of beispiele) {
  const s = b.g.max ? `${b.g.min}–${b.g.max}` : `${b.g.min}`;
  console.log(`  ${s} ${b.g.currency}/${b.g.period}  ${String(b.t).slice(0,40)}`);
  console.log(`      „${b.g.beleg.slice(0, 110)}"`);
}
process.exit(0);
