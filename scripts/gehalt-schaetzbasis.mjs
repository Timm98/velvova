import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { berufsgruppe } = await import("../apps/web/src/lib/jobs/visuals.ts");
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

/**
 * Trägt unsere eigene Datenbasis eine Gehaltsschätzung?
 *
 * Gemessen, bevor gebaut wird. Eine Schätzung aus zu wenigen
 * Vergleichsstellen sieht genauso aus wie eine gute — sie ist nur
 * falsch, und niemand kann es sehen.
 */
const rows = (await db.execute(sql`
  select j.title, j.core_tasks, j.country, j.salary_min, j.salary_max, j.salary_period,
         c.name as firma
  from jobs j join companies c on c.id = j.company_id`)).rows;

const gruppen = new Map();
let gesamt = 0;
for (const r of rows) {
  gesamt++;
  const g = berufsgruppe(r.title, Array.isArray(r.core_tasks) ? r.core_tasks : []);
  if (!g) continue;
  const s = gruppen.get(g) ?? { stellen: 0, gehaelter: [], firmen: new Map() };
  s.stellen++;
  if (r.salary_period === "year" && (r.salary_min !== null || r.salary_max !== null)) {
    const mitte = r.salary_min !== null && r.salary_max !== null
      ? (r.salary_min + r.salary_max) / 2 : (r.salary_min ?? r.salary_max);
    /*
     * Höchstens zwei Werte je Arbeitgeber und Gruppe.
     *
     * Ohne diese Grenze bestimmt ein einziger Personalvermittler eine
     * ganze Berufsgruppe: 48 gleichlautende „Steuerberater … mindestens
     * 90.000 €" ergaben für `finance` einen Median von 110.000 € und
     * eine Quartilsspanne von exakt null. Jeder Buchhalter hätte damit
     * eine Schätzung von 110.000 € bekommen — plausibel formatiert und
     * grob falsch.
     */
    const firma = (r.firma ?? "?").toLowerCase().trim();
    const bisher = s.firmen.get(firma) ?? 0;
    if (mitte >= 15000 && mitte <= 250000 && bisher < 2) {
      s.gehaelter.push(Math.round(mitte));
      s.firmen.set(firma, bisher + 1);
    }
  }
  gruppen.set(g, s);
}

const MIN = 5;
let abgedeckt = 0, ohneGruppe = 0, zuDuenn = 0;
console.log(`Stellen: ${gesamt}\n`);
console.log("Gruppe               Stellen  Gehälter  Median   Spanne");
for (const [k, s] of [...gruppen].sort((a, b) => b[1].stellen - a[1].stellen)) {
  s.gehaelter.sort((a, b) => a - b);
  const n = s.gehaelter.length;
  const med = n ? s.gehaelter[Math.floor(n / 2)] : null;
  const q1 = n ? s.gehaelter[Math.floor(n * 0.25)] : null;
  const q3 = n ? s.gehaelter[Math.floor(n * 0.75)] : null;
  if (n >= MIN) abgedeckt += s.stellen; else zuDuenn += s.stellen;
  console.log(
    `${k.padEnd(20)} ${String(s.stellen).padStart(6)}  ${String(n).padStart(7)}  ` +
    `${med ? String(med).padStart(6) : "     —"}   ${q1 && q3 ? `${q1}–${q3}` : ""}`,
  );
}
ohneGruppe = gesamt - [...gruppen.values()].reduce((a, s) => a + s.stellen, 0);
console.log(`\nMit tragfähiger Basis (n≥${MIN}): ${abgedeckt} (${((abgedeckt / gesamt) * 100).toFixed(1)} %)`);
console.log(`Gruppe erkannt, aber zu dünn:     ${zuDuenn}`);
console.log(`Keine Gruppe erkannt:             ${ohneGruppe}`);
process.exit(0);
