import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
console.log("Arbeitgeber-Boards in unseren eigenen Links:\n");
for (const [name, muster] of [
  ["Personio", "%personio.de%"],
  ["Greenhouse", "%greenhouse.io%"],
  ["Lever", "%lever.co%"],
  ["Ashby", "%ashbyhq.com%"],
  ["SmartRecruiters", "%smartrecruiters.com%"],
  ["Workday", "%myworkdayjobs.com%"],
  ["Join.com", "%join.com%"],
  ["Softgarden", "%softgarden%"],
]) {
  const r = (await db.execute(sql`
    select count(*)::int n, count(distinct substring(original_url from 'https?://([^/.]+)'))::int firmen
    from jobs where is_demo=false and (original_url like ${muster} or apply_target like ${muster})`)).rows[0];
  if (r.n > 0) console.log(`  ${name.padEnd(18)} ${String(r.n).padStart(6)} Stellen · ${r.firmen} verschiedene Kennungen`);
  else console.log(`  ${name.padEnd(18)}      —`);
}
process.exit(0);
