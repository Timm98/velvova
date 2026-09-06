import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const q = async (s) => (await db.execute(s)).rows ?? [];

const BEGRIFFE = [
  ["Homeoffice/Remote", "homeoffice|home-office|mobiles arbeiten|remote"],
  ["Jobticket/ÖPNV", "jobticket|job-ticket|deutschlandticket|fahrtkostenzuschuss|jobrad|dienstrad"],
  ["Firmenwagen", "firmenwagen|dienstwagen|firmen-pkw"],
  ["Altersvorsorge", "altersvorsorge|betriebsrente|bav\\b|vermögenswirksame"],
  ["Urlaubstage", "urlaubstage|tage urlaub|30 tage|30 urlaubstage"],
  ["Weiterbildung", "weiterbildung|fortbildung|schulungen|entwicklungsmöglichkeiten"],
  ["Essenszuschuss", "essenszuschuss|kantine|verpflegung|essensgeld"],
  ["Gesundheit/Sport", "urban sports|egym|wellpass|fitnessstudio|gesundheitsförderung|betriebliche gesundheit"],
  ["Kinderbetreuung", "kinderbetreuung|kita-zuschuss|betriebskindergarten"],
  ["Flexible Arbeitszeit", "gleitzeit|flexible arbeitszeit|vertrauensarbeitszeit|arbeitszeitkonto"],
  ["Sonderzahlung", "weihnachtsgeld|urlaubsgeld|13\\. gehalt|bonus|erfolgsbeteiligung|prämie"],
  ["Mitarbeiterrabatte", "mitarbeiterrabatt|corporate benefits|mitarbeitervorteile"],
];

const [{ n: gesamt }] = await q(sql`select count(*)::int as n from jobs`);
const [{ n: lang }] = await q(sql`select count(*)::int as n from jobs where length(description) > 200`);
console.log(`Stellen: ${gesamt}, davon mit Beschreibung > 200 Zeichen: ${lang}`);

for (const [name, muster] of BEGRIFFE) {
  const [{ n }] = await q(sql`select count(*)::int as n from jobs where description ~* ${muster}`);
  console.log(`  ${String(n).padStart(5)}  ${((n / gesamt) * 100).toFixed(1).padStart(5)} %  ${name}`);
}
const [{ n: mind }] = await q(sql`select count(*)::int as n from jobs
  where description ~* 'homeoffice|mobiles arbeiten|jobticket|jobrad|firmenwagen|altersvorsorge|weiterbildung|gleitzeit|weihnachtsgeld|urlaubsgeld|kinderbetreuung|kantine'`);
console.log(`\nMindestens eine Leistung im Text: ${mind} (${((mind / gesamt) * 100).toFixed(1)} %)`);
process.exit(0);
