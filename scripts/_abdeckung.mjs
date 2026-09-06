import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const { titelNormalisieren } = await import("../packages/jobs/src/berufsregeln.ts");
const { KEIN_VOLLZEITVERGLEICH } = await import("../apps/web/src/lib/jobs/beschaeftigungsform.ts");
const db = await getDb();

const jobs = (await db.execute(sql`select title, salary_min, salary_max from jobs`)).rows;
const zu = new Map((await db.execute(sql`select titel, beruf from beruf_zuordnung`)).rows.map(r => [r.titel, r.beruf]));
const ent = new Set((await db.execute(sql`select beruf from beruf_entgelt where anzahl >= 8`)).rows.map(r => r.beruf));

let eigen = 0, referenz = 0, gesperrt = 0, ohne = 0;
for (const j of jobs) {
  const t = String(j.title ?? "");
  if (j.salary_min !== null || j.salary_max !== null) { eigen++; continue; }
  if (KEIN_VOLLZEITVERGLEICH.test(t)) { gesperrt++; continue; }
  const b = zu.get(titelNormalisieren(t));
  if (b && ent.has(b)) referenz++; else ohne++;
}
const n = jobs.length;
const p = (x) => `${x} (${(100*x/n).toFixed(1)} %)`;
console.log(`Stellen gesamt: ${n}`);
console.log(`  eigene Gehaltsangabe:   ${p(eigen)}`);
console.log(`  Referenz nach Beruf:    ${p(referenz)}`);
console.log(`  studentisch (gesperrt): ${p(gesperrt)}`);
console.log(`  ohne Grössenordnung:    ${p(ohne)}`);
console.log(`\nMit einer Zahl oder Spanne: ${p(eigen + referenz)}`);
console.log(`Berufe mit Referenz: ${ent.size} von ${new Set([...zu.values()].filter(Boolean)).size}`);
process.exit(0);
