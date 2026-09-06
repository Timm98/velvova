import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb, schema } = await import("../packages/db/src/index.ts");
const { eq } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const messen = async (name, fn) => { const t = Date.now(); const r = await fn(); console.log(`  ${name.padEnd(28)} ${Date.now() - t} ms  (${Array.isArray(r) ? r.length : "-"} Zeilen)`); return r; };
await messen("jobs (ohne Text)", () => db.select({ id: schema.jobs.id, title: schema.jobs.title }).from(schema.jobs).where(eq(schema.jobs.isDemo, false)));
await messen("job_requirements", () => db.select().from(schema.jobRequirements));
await messen("job_source_links", () => db.select().from(schema.jobSourceLinks));
// company_reviews ausgelassen — Tabellenname prüfen
process.exit(0);
