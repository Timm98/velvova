import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const r = (await db.execute(sql`select tablename, policyname, cmd from pg_policies
  where tablename in ('organizations','memberships','organization_invitations','job_postings','posting_candidates','organization_events')
  order by tablename, policyname`)).rows;
for (const x of r) console.log(`  ${x.tablename.padEnd(26)} ${x.policyname.padEnd(34)} ${x.cmd}`);
const f = (await db.execute(sql`select proname, prosecdef from pg_proc where proname in ('app_is_org_member','app_is_org_admin')`)).rows;
for (const x of f) console.log(`  Funktion ${x.proname} security_definer=${x.prosecdef}`);
const rls = (await db.execute(sql`select relname, relrowsecurity, relforcerowsecurity from pg_class
  where relname in ('organizations','memberships','organization_invitations','job_postings','posting_candidates','organization_events')`)).rows;
for (const x of rls) console.log(`  RLS ${x.relname.padEnd(26)} enabled=${x.relrowsecurity} forced=${x.relforcerowsecurity}`);
process.exit(0);
