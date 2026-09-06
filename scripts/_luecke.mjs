import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { berufsgruppe } = await import("../apps/web/src/lib/jobs/visuals.ts");
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const rows = (await db.execute(sql`
  select j.title, j.core_tasks, j.salary_min, j.salary_max, j.salary_period,
         j.weekly_hours, c.name as firma
  from jobs j join companies c on c.id = j.company_id`)).rows;

const NICHT_VOLLZEIT = /\b(werkstudent|praktik|internship|ausbildung|azubi|dual|trainee|aushilfe|minijob|bachelor|master|thesis|schüler|ferienjob|volont)/i;

// Wie viele Gehälter gewinnen wir, wenn Monat und Stunde mitzählen?
let jahr = 0, monat = 0, stunde = 0, stundeMitStd = 0;
for (const r of rows) {
  if (r.salary_min === null && r.salary_max === null) continue;
  if (r.salary_period === "year") jahr++;
  else if (r.salary_period === "month") monat++;
  else if (r.salary_period === "hour") { stunde++; if (r.weekly_hours) stundeMitStd++; }
}
console.log(`Gehälter: Jahr ${jahr} · Monat ${monat} (×12 rechenbar) · Stunde ${stunde} (davon ${stundeMitStd} mit Wochenstunden)\n`);

// Wer bleibt ohne Vergleich, und warum?
const gruppen = new Map();
for (const r of rows) {
  const g = berufsgruppe(r.title, Array.isArray(r.core_tasks) ? r.core_tasks : []);
  const s = gruppen.get(g ?? "—") ?? { stellen: 0, werte: [], firmen: new Map() };
  s.stellen++;
  let mitte = null;
  if (r.salary_min !== null || r.salary_max !== null) {
    const m = r.salary_min !== null && r.salary_max !== null ? (r.salary_min + r.salary_max) / 2 : (r.salary_min ?? r.salary_max);
    if (r.salary_period === "year") mitte = m;
    else if (r.salary_period === "month") mitte = m * 12;
    else if (r.salary_period === "hour" && r.weekly_hours) mitte = m * r.weekly_hours * 47;
  }
  if (mitte !== null && mitte >= 15000 && mitte <= 250000 && !NICHT_VOLLZEIT.test(r.title)) {
    const f = (r.firma ?? "?").toLowerCase();
    const n = s.firmen.get(f) ?? 0;
    if (n < 2) { s.werte.push(Math.round(mitte)); s.firmen.set(f, n + 1); }
  }
  gruppen.set(g ?? "—", s);
}
console.log("Gruppe               Stellen  Werte(neu)");
let ok = 0, duenn = 0, ohne = 0;
for (const [k, s] of [...gruppen].sort((a,b)=>b[1].stellen-a[1].stellen)) {
  console.log(`${String(k).padEnd(20)} ${String(s.stellen).padStart(6)}  ${String(s.werte.length).padStart(6)}`);
  if (k === "—") ohne += s.stellen;
  else if (s.werte.length >= 5) ok += s.stellen; else duenn += s.stellen;
}
const gesamt = rows.length;
console.log(`\nTragfähig: ${ok} (${((ok/gesamt)*100).toFixed(1)}%) · zu dünn: ${duenn} · ohne Gruppe: ${ohne}`);
// Wie viele der "zu dünn"/"ohne Gruppe" sind Nicht-Vollzeit?
const nichtVollzeit = rows.filter((r) => NICHT_VOLLZEIT.test(r.title)).length;
console.log(`Nicht-Vollzeit (Werkstudium, Praktikum, Ausbildung …): ${nichtVollzeit}`);
process.exit(0);
