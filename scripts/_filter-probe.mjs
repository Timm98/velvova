import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { deuteSuchintention } = await import("../apps/web/src/lib/jobs/suchintention.ts");

/**
 * Die Beispiele aus dem Auftrag, durch den bestehenden Parser.
 *
 * Erst messen, was er kann, dann bauen, was fehlt.
 */
const FAELLE = [
  "Nur Karlsruhe",
  "Rund um Karlsruhe",
  "Maximal zwei Bürotage rund um Karlsruhe",
  "Nur Stellen ab 45.000 Euro, wenn das Gehalt angegeben ist",
  "Ab 45.000 Euro, Schätzungen sind okay",
  "Jobs mit Kundenkontakt, aber ohne Kaltakquise",
  "Unbefristet, Vollzeit und keine Nachtschicht",
  "Mach den Gehaltsfilter wieder weg",
  "Doch lieber 25 Kilometer",
];
for (const f of FAELLE) {
  const r = deuteSuchintention(f);
  console.log(`\n„${f}"`);
  console.log(`  Filter:   ${JSON.stringify(r.filter)}`);
  console.log(`  erkannt:  ${(r.erkannt ?? []).join(" · ") || "—"}`);
  if ((r.entfernen ?? []).length) console.log(`  entfernt: ${r.entfernen.join(", ")}`);
  if (r.rest !== undefined) console.log(`  Rest:     „${String(r.rest).trim()}"`);
  if (r.q !== undefined) console.log(`  Suchwort: „${r.q ?? ""}"`);
}
