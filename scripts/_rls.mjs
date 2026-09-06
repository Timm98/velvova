import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const r = await db.execute(sql`
  SELECT c.relname AS tabelle, c.relrowsecurity AS rls, c.relforcerowsecurity AS erzwungen,
         (SELECT count(*) FROM pg_policies p WHERE p.tablename = c.relname)::int AS richtlinien
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname IN ('living_costs','current_employment','user_constraints')`);
for (const z of (r.rows ?? r)) console.log(`  ${String(z.tabelle).padEnd(22)} rls=${z.rls} erzwungen=${z.erzwungen} richtlinien=${z.richtlinien}`);
process.exit(0);
