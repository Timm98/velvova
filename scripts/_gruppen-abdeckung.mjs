import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { berufsgruppe } = await import("../apps/web/src/lib/jobs/visuals.ts");
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const stellen = (await db.execute(sql`
  select title, core_tasks from jobs where is_demo = false order by fetched_at desc limit 20000`)).rows;
const zaehler = new Map();
let ohne = 0;
for (const s of stellen) {
  const g = berufsgruppe(String(s.title), Array.isArray(s.core_tasks) ? s.core_tasks : []);
  if (!g) { ohne++; continue; }
  zaehler.set(g, (zaehler.get(g) ?? 0) + 1);
}
const n = stellen.length;
console.log(`Stichprobe ${n.toLocaleString("de-DE")} Stellen`);
console.log(`ohne erkanntes Feld: ${ohne.toLocaleString("de-DE")} (${(100*ohne/n).toFixed(1)} %)\n`);
for (const [g, c] of [...zaehler].sort((a,b) => b[1]-a[1]))
  console.log(`  ${g.padEnd(18)} ${String(c).padStart(6)}  ${(100*c/n).toFixed(1)} %`);
const bsp = [];
for (const s of stellen) {
  if (!berufsgruppe(String(s.title), [])) bsp.push(String(s.title));
  if (bsp.length >= 8) break;
}
console.log("\nBeispiele ohne Feld:"); for (const b of bsp) console.log("  ·", b.slice(0, 62));
process.exit(0);
