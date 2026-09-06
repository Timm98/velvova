import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const r = await db.execute(sql`
  SELECT
    count(*)::int AS gesamt,
    count(*) FILTER (WHERE work_model = 'remote')::int AS remote,
    count(*) FILTER (WHERE work_model = 'hybrid')::int AS hybrid,
    count(*) FILTER (WHERE published_at < now() - interval '60 days')::int AS alt,
    count(*) FILTER (WHERE length(coalesce(description,'')) < 400)::int AS kurz
  FROM jobs`);
const z = (r.rows ?? r)[0];
for (const [k, v] of Object.entries(z)) console.log(`  ${k.padEnd(10)} ${v}`);
process.exit(0);
