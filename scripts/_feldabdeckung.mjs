import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const [a] = (await db.execute(sql`
  select count(*)::int n,
    count(weekly_hours)::int stunden,
    count(shift_work)::int schicht,
    count(*) filter (where shift_work)::int schicht_ja,
    count(latitude)::int koordinate
  from jobs tablesample system (3) where country='DE'`)).rows;
const p = (x) => `${((x/a.n)*100).toFixed(1)} %`;
console.log(`Stichprobe ${a.n.toLocaleString("de-DE")}`);
console.log(`  Wochenstunden bekannt  ${String(a.stunden).padStart(6)}  ${p(a.stunden)}`);
console.log(`  Schicht bekannt        ${String(a.schicht).padStart(6)}  ${p(a.schicht)}  (davon ja: ${a.schicht_ja})`);
console.log(`  Koordinate             ${String(a.koordinate).padStart(6)}  ${p(a.koordinate)}`);
