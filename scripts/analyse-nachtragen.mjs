/**
 * Nachtragslauf: bestehende Stellen in die Analysewarteschlange.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum in Stapeln und nicht auf einmal
 * ══════════════════════════════════════════════════════════════
 *
 * Der Bestand umfasst rund eine Million deutsche Anzeigen. Alle auf
 * einmal einzureihen hiesse: Eine Million Nachrichten in der
 * Warteschlange, und jede neu importierte Stelle wartet hinter ihnen.
 *
 * Der Auftrag verlangt das ausdrücklich: „Neue Jobs dürfen dadurch
 * nicht unbegrenzt auf ihre Analyse warten."
 *
 * Deshalb ein Stapel je Aufruf, mit Obergrenze. Wer den Bestand
 * aufholen will, ruft mehrmals auf — und kann jederzeit aufhören,
 * ohne etwas Halbfertiges zu hinterlassen.
 *
 * ══════════════════════════════════════════════════════════════
 * Welche Stellen zuerst
 * ══════════════════════════════════════════════════════════════
 *
 * Die neuesten. Sie werden am ehesten angesehen, und eine Analyse für
 * eine Anzeige, die niemand öffnet, ist Arbeit ohne Wirkung.
 *
 * Übersprungen wird, was bereits eine Analyse der aktuellen Fassung
 * hat — der Worker würde es ohnehin verwerfen, aber dann hätte die
 * Nachricht schon einen Platz belegt.
 */
import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const { analyseEinreihen, fassungsstand } = await import("../packages/jobs/src/index.ts");

const db = await getDb();
const STAPEL = Number(process.env.NACHTRAG_STAPEL ?? 500);
const LAND = process.env.NACHTRAG_LAND ?? "DE";

/*
 * Die Obergrenze für die Warteschlange.
 *
 * Ist schon viel offen, wird nichts nachgelegt. Sonst wächst sie bei
 * jedem Aufruf, während der Worker nicht hinterherkommt — und der
 * Nachtrag verdrängt genau die neuen Stellen, für die er Platz lassen
 * soll.
 */
const OBERGRENZE = Number(process.env.NACHTRAG_OBERGRENZE ?? 5000);

const [{ n: offen }] = (await db.execute(
  sql`select count(*)::int as n from pgmq.q_job_analyse`,
)).rows;

if (offen >= OBERGRENZE) {
  console.log(`Warteschlange bei ${offen} — Obergrenze ${OBERGRENZE}. Nichts nachgelegt.`);
  process.exit(0);
}

const kandidaten = (await db.execute(sql`
  select j.id
  from jobs j
  left join job_analysen a
    on a.job_id = j.id and a.fassung >= ${fassungsstand()}
  where j.is_demo = false
    and j.country = ${LAND}
    and a.id is null
  order by coalesce(j.published_at, j.fetched_at) desc
  limit ${STAPEL}`)).rows;

if (kandidaten.length === 0) {
  console.log("Nichts nachzutragen — der Bestand ist auf dem aktuellen Stand.");
  process.exit(0);
}

const eingereiht = await analyseEinreihen(db, kandidaten.map((k) => k.id));

const [{ n: gesamt }] = (await db.execute(
  sql`select count(*)::int as n from jobs j
      left join job_analysen a on a.job_id = j.id and a.fassung >= ${fassungsstand()}
      where j.is_demo = false and j.country = ${LAND} and a.id is null`,
)).rows;

console.log(
  `Eingereiht: ${eingereiht} · noch offen im Bestand: ${gesamt.toLocaleString("de-DE")}`,
);
process.exit(0);
