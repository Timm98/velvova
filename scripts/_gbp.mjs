import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb, schema } = await import("../packages/db/src/index.ts");
const { sql, eq } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const [j] = await db.select().from(schema.jobs).where(sql`salary_currency = 'GBP'`).limit(1);
for (const k of ["id","title","companyName","location","country","salaryMin","salaryMax","salaryCurrency","salaryPeriod","salaryDisclosed","salaryProvenance","salaryEvidence","sourceId","originalUrl"]) {
  if (j[k] !== undefined) console.log(`  ${k.padEnd(18)} ${String(j[k]).slice(0, 80)}`);
}
const [q] = await db.select().from(schema.jobSources).where(eq(schema.jobSources.id, j.sourceId)).limit(1);
console.log(`  quelle             ${q?.key ?? "?"} (${q?.displayName ?? "?"})`);
process.exit(0);
