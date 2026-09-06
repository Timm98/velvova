import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Wie viele Stellen eine Gehaltsgrössenordnung tragen.
 *
 * Gemessen über die echte Kette — nicht über eine der drei Quellen
 * einzeln. Genau dort lag der Denkfehler der ersten Messung: sie zählte
 * nur die Referenz nach amtlichem Beruf und unterschlug den Rückfall
 * auf die eigene Berufsgruppe.
 */
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const { vergleichswert } = await import("../apps/web/src/lib/jobs/gehaltsvergleich.ts");
const { KEIN_VOLLZEITVERGLEICH } = await import("../apps/web/src/lib/jobs/beschaeftigungsform.ts");
const db = await getDb();

const jobs = (await db.execute(sql`select title, core_tasks, salary_min, salary_max from jobs`)).rows;

const zaehler = { eigen: 0, bundesagentur: 0, bestand: 0, entgeltatlas: 0, gesperrt: 0, ohne: 0 };
for (const j of jobs) {
  if (j.salary_min !== null || j.salary_max !== null) { zaehler.eigen++; continue; }
  const titel = String(j.title ?? "");
  if (KEIN_VOLLZEITVERGLEICH.test(titel)) { zaehler.gesperrt++; continue; }
  const aufgaben = Array.isArray(j.core_tasks) ? j.core_tasks : [];
  const v = await vergleichswert(titel, aufgaben);
  if (!v) zaehler.ohne++;
  else zaehler[v.quelle]++;
}

const n = jobs.length;
const p = (x) => `${String(x).padStart(5)}  ${(100 * x / n).toFixed(1).padStart(5)} %`;
console.log(`Stellen gesamt: ${n}\n`);
console.log(`  Gehalt in der Anzeige          ${p(zaehler.eigen)}`);
console.log(`  Referenz (Entgeltatlas)        ${p(zaehler.entgeltatlas)}`);
console.log(`  Referenz (amtlicher Beruf)     ${p(zaehler.bundesagentur)}`);
console.log(`  Vergleich (eigene Berufsgruppe)${p(zaehler.bestand)}`);
console.log(`  ─────────────────────────────────────────────`);
const mit = zaehler.eigen + zaehler.entgeltatlas + zaehler.bundesagentur + zaehler.bestand;
console.log(`  mit Grössenordnung             ${p(mit)}`);
console.log(`\n  studentisch — bewusst keine    ${p(zaehler.gesperrt)}`);
console.log(`  ohne Grundlage                 ${p(zaehler.ohne)}`);
console.log(`\nVon den nicht-studentischen Stellen: ${(100 * mit / (n - zaehler.gesperrt)).toFixed(1)} % mit Grössenordnung.`);
process.exit(0);
