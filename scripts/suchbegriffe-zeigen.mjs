/**
 * Welche Suchbegriffe ergäben die Profile im System?
 *
 * Die Bundesagentur wurde bisher mit fünf fest eingetragenen Begriffen
 * befragt. Diese Rechnung zeigt, was stattdessen gefragt würde — und
 * ob das überhaupt breiter ist.
 *
 *   node scripts/suchbegriffe-zeigen.mjs
 */
import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb, schema } = await import("../packages/db/src/index.ts");
const { sql, isNull } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const { suchrichtungen } = await import("../packages/matching/src/index.ts");
const { UserConstraintsSchema } = await import("../packages/domain/src/index.ts");

const STANDARD = ["Sachbearbeitung", "Kundenbetreuung", "Disposition", "Büromanagement", "Vertriebsinnendienst"];
const MINDESTSTAERKE = 0.35;
const HOECHSTENS = 12;

const db = await getDb();
const zeilen = await db
  .select({
    userId: schema.evidenceItems.userId,
    statement: schema.evidenceItems.statement,
    confidence: schema.evidenceItems.confidence,
    userConfirmed: schema.evidenceItems.userConfirmed,
    userRejected: schema.evidenceItems.userRejected,
  })
  .from(schema.evidenceItems)
  .where(isNull(schema.evidenceItems.deletedAt));

const proKonto = new Map();
for (const z of zeilen) {
  if (z.userRejected) continue;
  if (!proKonto.has(z.userId)) proKonto.set(z.userId, []);
  proKonto.get(z.userId).push(z);
}

const leer = UserConstraintsSchema.parse({
  minSalaryPerYear: null, baseLocation: null, maxCommuteMinutes: null,
  weeklyHoursMin: null, weeklyHoursMax: null, maxTravelPercent: null,
});

const gesammelt = new Map();
for (const [, evidence] of proKonto) {
  for (const r of suchrichtungen({ evidence, energisingTasks: [], drainingTasks: [], statedInterests: [], constraints: leer })) {
    if (r.staerke < MINDESTSTAERKE) continue;
    const b = gesammelt.get(r.begriff) ?? { begriff: r.begriff, konten: 0, gewicht: 0 };
    b.konten++; b.gewicht += r.staerke;
    gesammelt.set(r.begriff, b);
  }
}

const top = [...gesammelt.values()].sort((a, b) => b.gewicht - a.gewicht).slice(0, HOECHSTENS);
console.log(`  ${proKonto.size} Konten mit Belegen · ${gesammelt.size} Richtungen über der Schwelle\n`);
console.log("  Begriffe für den nächsten Abruf:");
for (const t of top) {
  const neu = STANDARD.includes(t.begriff) ? "" : "  ← neu";
  console.log(`    ${t.begriff.padEnd(30)} ${String(t.konten).padStart(3)} Konten · Gewicht ${t.gewicht.toFixed(1)}${neu}`);
}
const neue = top.filter((t) => !STANDARD.includes(t.begriff)).length;
const verloren = STANDARD.filter((s) => !top.some((t) => t.begriff === s));
console.log(`\n  ${neue} von ${top.length} Begriffen sind neu gegenüber der Standardliste.`);
if (verloren.length) console.log(`  Nicht mehr dabei: ${verloren.join(", ")}`);
process.exit(0);
