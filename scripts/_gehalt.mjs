import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const r = await db.execute(sql`
  SELECT
    count(*)::int AS gesamt,
    count(*) FILTER (WHERE salary_min IS NOT NULL OR salary_max IS NOT NULL)::int AS mit_betrag,
    count(*) FILTER (WHERE salary_disclosed)::int AS offengelegt,
    count(*) FILTER (WHERE salary_provenance = 'text')::int AS aus_text,
    count(*) FILTER (WHERE salary_provenance = 'provider')::int AS vom_anbieter,
    count(*) FILTER (WHERE salary_provenance IS NULL)::int AS ohne_herkunft
  FROM jobs`);
const z = (r.rows ?? r)[0];
for (const [k, v] of Object.entries(z)) console.log(`  ${k.padEnd(16)} ${v}`);
process.exit(0);
