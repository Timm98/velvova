import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

// Wo steckt hauptberuf? Erst die Struktur ansehen.
const spalten = (await db.execute(sql`
  select table_name, column_name from information_schema.columns
  where table_name in ('jobs','job_snapshots') and column_name ~ 'raw|payload|beruf|occupation'`)).rows;
console.log("Spalten:", spalten.map(r => `${r.table_name}.${r.column_name}`).join(", "));

const g = (await db.execute(sql`select count(*)::int n from jobs`)).rows[0];
console.log("Stellen gesamt:", g.n);

const proQuelle = (await db.execute(sql`
  select s.display_name q, count(*)::int n from jobs j
  join job_sources s on s.id = j.source_id group by 1 order by 2 desc`)).rows;
console.log("Je Quelle:", proQuelle.map(r => `${r.q}=${r.n}`).join("  "));
process.exit(0);
