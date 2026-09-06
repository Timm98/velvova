/**
 * Der Analyse-Worker.
 *
 * ══════════════════════════════════════════════════════════════
 * Was er tut
 * ══════════════════════════════════════════════════════════════
 *
 * Liest Aufträge aus `pgmq`, prüft anhand von Eingabeschlüssel und
 * Fassung, ob überhaupt gearbeitet werden muss, rechnet die
 * deterministischen Teile und schreibt eine versionierte Analyse.
 *
 * KEIN Modellaufruf. Die Mechanik muss stehen, bevor jeder
 * Fehlversuch Geld kostet.
 *
 * ══════════════════════════════════════════════════════════════
 * Die vier Zusagen
 * ══════════════════════════════════════════════════════════════
 *
 * Idempotent  — derselbe Auftrag zweimal ergibt eine Zeile, nicht zwei.
 *               Der eindeutige Index über (job_id, schluessel, fassung)
 *               erzwingt es; `on conflict do nothing` macht daraus
 *               keinen Fehler.
 *
 * Lease       — `pgmq.read` macht den Auftrag für 120 Sekunden
 *               unsichtbar. Stirbt der Worker, taucht er wieder auf.
 *
 * Wiederholung— `read_ct` zählt die Versuche. Nach fünf wird
 *               archiviert statt endlos wiederholt.
 *
 * Bestätigung — `pgmq.delete` erst NACH dem Commit. Wer beim Lesen
 *               löscht, verliert den Auftrag, sobald der Schreibvorgang
 *               scheitert.
 */
import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const {
  analyseschluessel,
  analysePruefen,
  fassungsstand,
  anzeigenqualitaet,
  gehaltsbefund,
  erfahrungsniveauAusText,
  WARTESCHLANGE,
  SICHTBARKEIT_SEKUNDEN,
  MAX_VERSUCHE,
  darfVersuchen,
} = { ...(await import("../packages/jobs/src/index.ts")), ...(await import("../packages/matching/src/index.ts")) };

const db = await getDb();
const HOECHSTENS = Number(process.env.ANALYSE_BATCH ?? 25);

const [{ n: offen }] = (await db.execute(
  sql`select count(*)::int as n from pgmq.q_job_analyse`,
)).rows;
console.log(`Warteschlange: ${offen} Aufträge`);

let verarbeitet = 0, uebersprungen = 0, gescheitert = 0, aufgegeben = 0;

for (;;) {
  const gelesen = (await db.execute(
    sql`select msg_id, read_ct, message from pgmq.read(${WARTESCHLANGE}, ${SICHTBARKEIT_SEKUNDEN}, 1)`,
  )).rows;
  if (gelesen.length === 0) break;
  if (verarbeitet + uebersprungen + gescheitert >= HOECHSTENS) break;

  const { msg_id: msgId, read_ct: versuche, message } = gelesen[0];
  const jobId = message?.jobId;

  try {
    if (!darfVersuchen(versuche)) {
      await db.execute(sql`select pgmq.archive(${WARTESCHLANGE}, ${msgId}::bigint)`);
      aufgegeben++;
      continue;
    }

    const [job] = (await db.execute(sql`
      select id, title, description, salary_min, salary_max, salary_currency, salary_period,
             salary_disclosed, location, country, work_model, contract_type, weekly_hours,
             experience_level, core_tasks, remote_percent, apply_method, apply_target, original_url
      from jobs where id = ${jobId}::uuid`)).rows;

    if (!job) {
      /* Die Stelle ist verschwunden — kein Fehler, nur nichts zu tun.
         Archivieren statt wiederholen. */
      await db.execute(sql`select pgmq.archive(${WARTESCHLANGE}, ${msgId}::bigint)`);
      uebersprungen++;
      continue;
    }

    const schluessel = analyseschluessel({
      title: job.title, description: job.description,
      salaryMin: job.salary_min, salaryMax: job.salary_max,
      salaryCurrency: job.salary_currency, salaryPeriod: job.salary_period,
      location: job.location, country: job.country, workModel: job.work_model,
      contractType: job.contract_type, weeklyHours: job.weekly_hours,
      experienceLevel: job.experience_level,
    });

    const [vorhanden] = (await db.execute(sql`
      select eingabe_schluessel as schluessel, fassung
      from job_analysen where job_id = ${job.id}::uuid
      order by begonnen_am desc limit 1`)).rows;

    const pruefung = analysePruefen(
      vorhanden ? { schluessel: vorhanden.schluessel, fassung: vorhanden.fassung } : null,
      schluessel,
    );

    if (pruefung.gueltig) {
      await db.execute(sql`select pgmq.delete(${WARTESCHLANGE}, ${msgId}::bigint)`);
      uebersprungen++;
      continue;
    }

    const alsJob = {
      salary: { min: job.salary_min, max: job.salary_max, currency: job.salary_currency ?? "EUR",
                period: job.salary_period ?? "year", disclosed: job.salary_disclosed ?? false,
                provenance: null, evidence: null },
      coreTasks: job.core_tasks ?? [], contractType: job.contract_type,
      weeklyHours: job.weekly_hours, workModel: job.work_model, location: job.location,
      remotePercent: job.remote_percent, applyMethod: job.apply_method,
      applyTarget: job.apply_target, originalUrl: job.original_url,
      description: job.description,
    };

    const transparenz = anzeigenqualitaet(alsJob);
    const gehalt = gehaltsbefund(job.description ?? "");
    const niveau = job.experience_level ?? erfahrungsniveauAusText(job.title, job.description);

    /*
     * Der Status trennt Technik von Datenlage.
     *
     * Ein Lauf ohne Anzeigentext ist erfolgreich gelaufen und hat
     * nichts zu berichten. Das als Fehler zu führen hiesse, jeden
     * Morgen eine Fehlerliste aus Anzeigen zu bekommen, die einfach
     * dünn sind.
     */
    const status = transparenz.eingabeUnvollstaendig ? "unzureichende_daten" : "fertig";

    await db.execute(sql`
      insert into job_analysen
        (job_id, eingabe_schluessel, fassung, status, extraktion, bewertung, gruende,
         modellkonfiguration, beendet_am)
      values (${job.id}::uuid, ${schluessel}, ${fassungsstand()}, ${status},
              ${JSON.stringify({ erfahrungsniveau: niveau, gehaltsangaben: gehalt.angaben })}::jsonb,
              ${JSON.stringify({ transparenz: transparenz.score, punkte: transparenz.punkte })}::jsonb,
              ${JSON.stringify({ gehalt: gehalt.hinweise, textUnvollstaendig: transparenz.eingabeUnvollstaendig })}::jsonb,
              ${"deterministisch-v1"}, now())
      on conflict (job_id, eingabe_schluessel, fassung) do nothing`);

    /* Erst nach dem Commit bestätigen. Wer beim Lesen löscht, verliert
       den Auftrag, sobald der Schreibvorgang scheitert. */
    await db.execute(sql`select pgmq.delete(${WARTESCHLANGE}, ${msgId}::bigint)`);
    verarbeitet++;
  } catch (fehler) {
    console.warn(`Auftrag ${msgId} (Versuch ${versuche}):`, String(fehler).slice(0, 140));
    gescheitert++;
    /* Nicht löschen: Die Lease läuft ab und der Auftrag kommt wieder. */
  }
}

console.log(
  `Fertig — analysiert: ${verarbeitet}, übersprungen: ${uebersprungen}, ` +
  `gescheitert: ${gescheitert}, aufgegeben: ${aufgegeben}`,
);
process.exit(0);
