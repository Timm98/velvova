/**
 * Was ergäbe die neue Zuordnung für die Belege, die schon da sind?
 *
 * Der Browsertest prüft einen Nutzer. Diese Rechnung prüft alle — gegen
 * die tatsächlichen `source_ref`-Werte in der Datenbank, ohne Klicks und
 * ohne Wartezeit.
 *
 * Sie beantwortet die Frage, die den Fehler überhaupt sichtbar gemacht
 * hat: Wie viele Bereiche WÜRDEN die vorhandenen Belege abdecken, wenn
 * sie bestätigt wären — vorher und nachher?
 */
import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb, schema } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");

/* Die Bereiche VOR der Korrektur — inklusive des nie gefüllten. */
const ALT = [
  "experience_episodes", "tasks_and_energy", "hard_constraints",
  "location_and_logistics", "work_style_and_environment",
  "values_and_motives", "background",
];
const altTrifft = (ref) => (ref ? ALT.find((a) => ref.includes(a)) ?? null : null);

/* Die Bereiche NACH der Korrektur. */
const NEU = [
  "experience_episodes", "tasks_and_energy", "hard_constraints",
  "work_style_and_environment", "values_and_motives", "background",
];
const V3 = {
  career_evidence: "experience_episodes", constraints: "hard_constraints",
  preferred_tasks: "tasks_and_energy", disliked_tasks: "tasks_and_energy",
  values: "values_and_motives", work_style_preferences: "work_style_and_environment",
  skills: "background",
};
const neuTrifft = (ref) => {
  if (!ref) return null;
  if (ref.startsWith("nina:v3:")) return V3[ref.split(":")[2] ?? ""] ?? null;
  return NEU.find((a) => ref.includes(a)) ?? null;
};

const db = await getDb();
const zeilen = await db
  .select({ userId: schema.evidenceItems.userId, ref: schema.evidenceItems.sourceRef })
  .from(schema.evidenceItems)
  .where(sql`deleted_at is null`);

const proNutzer = new Map();
for (const z of zeilen) {
  if (!proNutzer.has(z.userId)) proNutzer.set(z.userId, []);
  proNutzer.get(z.userId).push(z.ref);
}

let besser = 0, gleich = 0;
const verteilung = { alt: 0, neu: 0 };
for (const [, refs] of proNutzer) {
  const a = new Set(refs.map(altTrifft).filter(Boolean)).size / ALT.length;
  const n = new Set(refs.map(neuTrifft).filter(Boolean)).size / NEU.length;
  verteilung.alt += a;
  verteilung.neu += n;
  if (n > a) besser++; else gleich++;
}
const k = proNutzer.size;
console.log(`  ${k} Konten mit Belegen\n`);
console.log(`  Mögliche Abdeckung im Schnitt`);
console.log(`    vorher: ${((verteilung.alt / k) * 100).toFixed(1)} %`);
console.log(`    nachher:${((verteilung.neu / k) * 100).toFixed(1)} %`);
console.log(`\n  ${besser} Konten profitieren, ${gleich} unverändert`);

const nie = zeilen.filter((z) => neuTrifft(z.ref) === null).length;
console.log(`  ${nie} von ${zeilen.length} Belegen zählen weiterhin keinem Bereich zu`);
process.exit(0);
