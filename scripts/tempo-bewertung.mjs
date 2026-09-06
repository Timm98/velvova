import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Welcher Teil des Bewertens die Zeit kostet.
 *
 * Der erste Aufruf von /app/jobs dauerte mit 5.097 Stellen 8,6
 * Sekunden, die Datenbank davon 0,6. Der Rest ist Rechnen in
 * JavaScript — aber welches?
 *
 * Die Unterscheidung entscheidet die Reparatur: Was nicht vom Profil
 * abhängt, lässt sich einmal je Stelle vorberechnen. Was davon abhängt,
 * nicht.
 */
const { getDb, schema } = await import("../packages/db/src/index.ts");
const { eq } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const M = await import("../packages/matching/src/index.ts");
const db = await getDb();

const rows = await db
  .select({ job: schema.jobs, companyName: schema.companies.name })
  .from(schema.jobs)
  .innerJoin(schema.companies, eq(schema.companies.id, schema.jobs.companyId))
  .where(eq(schema.jobs.isDemo, false));
console.log(`${rows.length} Stellen geladen.\n`);

const now = new Date();
const jobs = rows.map(({ job, companyName }) => ({
  ...job,
  companyName,
  salary: {
    min: job.salaryMin, max: job.salaryMax, currency: job.salaryCurrency ?? "EUR",
    period: job.salaryPeriod ?? "year", disclosed: job.salaryDisclosed ?? false,
    provenance: job.salaryProvenance ?? null, evidence: job.salaryEvidence ?? null,
  },
  benefits: job.benefits ?? [], coreTasks: job.coreTasks ?? [],
  requiredLicenses: job.requiredLicenses ?? [], languageRequirements: job.languageRequirements ?? {},
  publishedAt: job.publishedAt, fetchedAt: job.fetchedAt,
}));

function messen(name, fn) {
  const t = Date.now();
  let n = 0;
  for (const j of jobs) { try { fn(j); n++; } catch { /* Feld fehlt — zählt nicht als Zeit */ } }
  const ms = Date.now() - t;
  console.log(`  ${name.padEnd(26)} ${String(ms).padStart(6)} ms   ${(ms / jobs.length).toFixed(3)} ms/Stelle   (${n} ok)`);
  return ms;
}

console.log("Profilunabhängig — einmal je Stelle vorberechenbar:");
const a = messen("computeJobQuality", (j) => M.computeJobQuality({ job: j, reviews: [], themes: [] }));
const b = messen("computeAiTransition", (j) => M.computeAiTransition({ job: j, dataAsOf: null }));
const c = messen("computeListingConfidence", (j) =>
  M.computeListingConfidence({ job: j, source: null, earlierDuplicateCount: 0, now }));

console.log("\nProfilabhängig — muss je Aufruf laufen:");
const leer = { minSalaryPerYear: null, baseLocation: null, maxCommuteMinutes: null,
  weeklyHoursMin: null, weeklyHoursMax: null, maxTravelPercent: null, hardNoGos: [],
  acceptedWorkModels: ["remote","hybrid","on_site"], acceptedContractTypes: [], acceptsShiftWork: null };
const d = messen("checkConstraints", (j) => M.checkConstraints(j, leer, null));
const e = messen("computeFit", (j) => M.computeFit({ job: j, requirements: [], evidence: [],
  constraints: leer, energisingTasks: [], drainingTasks: [], workStylePreferences: {},
  rankedValues: [], statedInterests: [] }));

console.log(`\nVorberechenbar: ${a + b + c} ms · profilabhängig: ${d + e} ms`);
process.exit(0);
