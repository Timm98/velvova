import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const { beschaeftigungsart } = await import("../apps/web/src/lib/jobs/beschaeftigungsart.ts");
const db = await getDb();

console.log("Was das bestehende Feld contract_type hergibt:");
for (const r of (await db.execute(sql`
  select coalesce(contract_type::text, '(leer)') a, count(*)::int n
  from jobs where is_demo = false group by 1 order by 2 desc`)).rows)
  console.log(`  ${String(r.n).padStart(6)}  ${r.a}`);

console.log("\nWas die Einteilung nach dem Titel findet:");
const zaehl = new Map();
for (const r of (await db.execute(sql`select title from jobs where is_demo = false`)).rows) {
  const a = beschaeftigungsart(String(r.title ?? ""));
  zaehl.set(a, (zaehl.get(a) ?? 0) + 1);
}
for (const [a, n] of [...zaehl].sort((x, y) => y[1] - x[1]))
  console.log(`  ${String(n).padStart(6)}  ${a}`);
process.exit(0);
