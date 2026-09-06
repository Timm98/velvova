/**
 * Falsch gespeicherte Gehaltswährungen finden und richtigstellen.
 *
 * Die Korrektur am Adapter wirkt nur auf neu eingelesene Stellen. Was
 * schon in der Datenbank steht, bleibt falsch — im konkreten Fall eine
 * Stelle in Frankfurt mit „60.000–80.000 GBP", geliefert von
 * TheirStack und ungeprüft übernommen.
 *
 * Der Lauf ist standardmässig ein TROCKENLAUF: Er zeigt, was er ändern
 * würde, und ändert nichts. Erst `--anwenden` schreibt.
 *
 *   node scripts/waehrung-reparieren.mjs
 *   node scripts/waehrung-reparieren.mjs --anwenden
 */
import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb, schema } = await import("../packages/db/src/index.ts");
const { sql, eq } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const { waehrungBestimmen } = await import("../packages/jobs/src/waehrung.ts");

const anwenden = process.argv.includes("--anwenden");
const db = await getDb();

const alle = await db
  .select({
    id: schema.jobs.id, titel: schema.jobs.title, ort: schema.jobs.location,
    land: schema.jobs.country, waehrung: schema.jobs.salaryCurrency,
    min: schema.jobs.salaryMin, max: schema.jobs.salaryMax,
    beschreibung: schema.jobs.description,
  })
  .from(schema.jobs);

const aenderungen = [];
for (const j of alle) {
  /*
   * Ohne Betrag keine Reparatur.
   *
   * Bei einer Stelle ohne Gehaltsangabe steht die Währung nur da, weil
   * das Feld nicht leer sein darf. Sie zu ändern hätte keine Wirkung
   * und würde nur den Zeitstempel bewegen.
   */
  if (j.min == null && j.max == null) continue;

  const b = waehrungBestimmen({
    /*
     * Die gespeicherte Währung gilt hier als Anbieterangabe.
     *
     * Genau das war sie ja: durchgereicht und ungeprüft. Sie behält
     * damit ihren Vorrang, verliert aber ihr Vetorecht gegenüber dem
     * Land — dieselbe Regel wie beim Einlesen.
     */
    providerWaehrung: j.waehrung,
    rohtext: j.beschreibung,
    land: j.land,
  });

  if (b.waehrung && b.waehrung !== j.waehrung) {
    aenderungen.push({ ...j, neu: b.waehrung, grund: b.begruendung });
  }
}

console.log(`  ${alle.length} Stellen geprüft · ${aenderungen.length} mit abweichender Währung\n`);
for (const a of aenderungen.slice(0, 20)) {
  console.log(`    ${a.waehrung} → ${a.neu}   ${String(a.min ?? "–")}–${String(a.max ?? "–")}  ${String(a.ort).slice(0, 30)}`);
  console.log(`        ${a.titel.slice(0, 66)}`);
  console.log(`        ${a.grund}`);
}

if (aenderungen.length === 0) {
  console.log("  Nichts zu tun.");
} else if (!anwenden) {
  console.log(`\n  TROCKENLAUF — nichts geändert. Mit --anwenden schreiben.`);
} else {
  for (const a of aenderungen) {
    await db.update(schema.jobs).set({ salaryCurrency: a.neu }).where(eq(schema.jobs.id, a.id));
  }
  console.log(`\n  ${aenderungen.length} Stellen richtiggestellt.`);
}
process.exit(0);
