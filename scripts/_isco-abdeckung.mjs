import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const { iscoAusKldb } = await import("../packages/domain/src/kldb-isco.ts");
const db = await getDb();
const r = (await db.execute(sql`
  select kldb, count(*)::int n from jobs tablesample system (4)
  where country = 'DE' group by 1`)).rows;
let mit = 0, ohne = 0, ohneKldb = 0;
const gruppen = new Map();
for (const z of r) {
  const n = Number(z.n);
  if (!z.kldb) { ohneKldb += n; continue; }
  const i = iscoAusKldb(z.kldb);
  if (!i) { ohne += n; continue; }
  mit += n;
  gruppen.set(i.hauptgruppe, (gruppen.get(i.hauptgruppe) ?? 0) + n);
}
const gesamt = mit + ohne + ohneKldb;
console.log(`Stichprobe ${gesamt.toLocaleString("de-DE")} deutsche Stellen`);
console.log(`  ISCO zugeordnet      ${String(mit).padStart(7)}  ${(100*mit/gesamt).toFixed(1)} %`);
console.log(`  KldB da, kein ISCO   ${String(ohne).padStart(7)}  ${(100*ohne/gesamt).toFixed(1)} %`);
console.log(`  ohne KldB            ${String(ohneKldb).padStart(7)}  ${(100*ohneKldb/gesamt).toFixed(1)} %`);
console.log("\nverteilung auf ISCO-Hauptgruppen:");
for (const [g, n] of [...gruppen].sort((a,b) => b[1]-a[1])) console.log(`  ${g}: ${String(n).padStart(6)}`);
