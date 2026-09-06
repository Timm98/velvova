import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
for (const r of (await db.execute(sql`select titel, beruf, treffer, gesamt from beruf_zuordnung order by beruf nulls last`)).rows)
  console.log(`${(r.beruf ?? "—").padEnd(38)} ${String(r.treffer).padStart(3)}/${String(r.gesamt).padEnd(4)} ← ${r.titel}`);
process.exit(0);
