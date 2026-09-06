import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Der Outcome Loop von Anfang bis Ende — mit einem Wegwerfkonto.
 *
 * Geprüft wird vor allem das Einfrieren: Eine spätere Neuberechnung
 * darf die festgehaltene Vorhersage NICHT verändern. Genau daran hängt,
 * ob sich Monate später überhaupt etwas auswerten lässt.
 */
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
let fehler = 0;
const zeile = (ok, m) => { console.log(`  ${ok ? "ok  " : "!!  "} ${m}`); if (!ok) fehler++; };

const [nutzer] = (await db.execute(sql`
  insert into users (email) values (${`loop-${Date.now()}@example.invalid`}) returning id`)).rows;
const [stelle] = (await db.execute(sql`select id from jobs where is_demo=false limit 1`)).rows;

/* Eine Bewertung, wie sie die Anwendung schreibt. */
await db.execute(sql`
  insert into job_matches (user_id, job_id, fit_score, fit_band, fit_coverage, confidence_score,
                           constraint_verdict, overall_score, top_reason, top_reservation,
                           scoring_version, computed_at)
  values (${nutzer.id}, ${stelle.id}, 82, 'high', 0.7, 55, 'eligible', 80,
          'Deine belegten Fähigkeiten decken den Kern', 'Zum Gehalt sagt die Anzeige nichts',
          'v1', now() - interval '10 days')`);

const { vorhersageFesthalten, ergebnisVermerken, zufriedenheitVermerken, bilanz } =
  await import("../apps/web/src/lib/ergebnisse.ts");

await vorhersageFesthalten(nutzer.id, stelle.id);
let e = (await db.execute(sql`
  select * from empfehlungs_ergebnisse where user_id=${nutzer.id} and job_id=${stelle.id}`)).rows[0];
zeile(Boolean(e), "Die Vorhersage wird festgehalten");
zeile(e?.fit_score === 82 && e?.fit_band === "high", `Mit dem gezeigten Wert (${e?.fit_score}, ${e?.fit_band})`);
zeile(String(e?.scoring_version) === "v1", "Mitsamt der Fassung der Bewertungslogik");
const alterZeitpunkt = String(e?.vorhergesagt_am);

/* Die Neuberechnung: der Wert ändert sich, die Aufzeichnung darf es nicht. */
await db.execute(sql`
  update job_matches set fit_score = 41, fit_band = 'exploratory', computed_at = now()
  where user_id=${nutzer.id} and job_id=${stelle.id}`);
await vorhersageFesthalten(nutzer.id, stelle.id);
e = (await db.execute(sql`
  select * from empfehlungs_ergebnisse where user_id=${nutzer.id} and job_id=${stelle.id}`)).rows[0];
zeile(e?.fit_score === 82, `Eine Neuberechnung überschreibt sie NICHT (steht: ${e?.fit_score})`);
zeile(String(e?.vorhergesagt_am) === alterZeitpunkt, "Auch der Zeitpunkt bleibt der alte");

/* Ergebnisse treffen ein. */
await ergebnisVermerken(nutzer.id, stelle.id, "application_sent");
await ergebnisVermerken(nutzer.id, stelle.id, "interview_scheduled");
const ersterTermin = (await db.execute(sql`
  select interview_am from empfehlungs_ergebnisse where user_id=${nutzer.id}`)).rows[0].interview_am;
await new Promise((r) => setTimeout(r, 60));
await ergebnisVermerken(nutzer.id, stelle.id, "interview_held");
e = (await db.execute(sql`select * from empfehlungs_ergebnisse where user_id=${nutzer.id}`)).rows[0];
zeile(Boolean(e?.beworben_am), "Die Bewerbung wird vermerkt");
zeile(String(e?.interview_am) === String(ersterTermin), "Das ZWEITE Gespräch verschiebt das Datum nicht");

await zufriedenheitVermerken(nutzer.id, stelle.id, 90, 4);
e = (await db.execute(sql`select * from empfehlungs_ergebnisse where user_id=${nutzer.id}`)).rows[0];
zeile(e?.zufriedenheit_90 === 4, "Die Zufriedenheit landet an der richtigen Marke");
zeile(e?.zufriedenheit_30 === null, "Und nicht an den anderen");

const b = await bilanz();
zeile(b.gesamt >= 1, `Die Bilanz sieht den Fall (${b.gesamt})`);
zeile(b.baender.every((x) => x.beworben >= 20 || x.interviewQuote === null),
  "Unter 20 Bewerbungen steht keine Quote — das Schweigen hält");
zeile(b.grenzen.includes("nicht, dass die Empfehlung es bewirkt"),
  "Die Grenzen der Aussage stehen dabei");

await db.execute(sql`delete from users where id=${nutzer.id}`);
console.log(fehler ? `\n${fehler} Prüfung(en) fehlgeschlagen.` : "\nAlle Prüfungen bestanden.");
process.exit(fehler ? 1 : 0);
