import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const r = (await db.execute(sql`
  select career_interview_status, current_workflow_step, count(*)::int n
  from workflow_states group by 1,2 order by n desc`)).rows;
for (const z of r) console.log(String(z.career_interview_status).padEnd(14), String(z.current_workflow_step).padEnd(20), z.n);
const [cp] = (await db.execute(sql`select count(*)::int n from career_profiles where confirmed_by_user`)).rows;
console.log("\nbestätigte Profile:", cp.n);
