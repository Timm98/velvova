import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const zaehl = async () => (await db.execute(sql`
  select country, count(*)::int n from jobs where is_demo=false group by 1`)).rows;
const a = await zaehl(); const t0 = Date.now();
await new Promise(r => setTimeout(r, 300_000));
const b = await zaehl(); const min = (Date.now() - t0) / 60000;

const m = new Map(a.map(r => [r.country, r.n]));
console.log(`Gemessen über ${min.toFixed(1)} Minuten:\n`);
let gesamt = 0;
for (const r of b) {
  const vor = m.get(r.country) ?? 0;
  const proStd = ((r.n - vor) / min) * 60;
  gesamt += proStd;
  console.log(`  ${r.country}  ${String(r.n).padStart(7)}  +${String(r.n - vor).padStart(5)}  → ${Math.round(proStd).toLocaleString("de-DE").padStart(7)}/Std.`);
}
console.log(`\n  zusammen ${Math.round(gesamt).toLocaleString("de-DE")}/Std. · ${Math.round(gesamt*24).toLocaleString("de-DE")}/Tag`);
process.exit(0);
