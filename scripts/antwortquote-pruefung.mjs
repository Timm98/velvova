import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Die Antwortquote je Arbeitgeber.
 *
 * Geprüft wird vor allem, was NICHT gezählt wird: frische
 * Bewerbungen, nie abgeschickte, und alles unterhalb der Schwelle.
 * Eine Quote neben einem Arbeitgebernamen ist eine Aussage über ihn —
 * sie darf nicht aus fünf Fällen stammen.
 */
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const { antwortquoteFuerFirma, MIN_BEWERBUNGEN } = await import("../apps/web/src/lib/antwortquote.ts");
const db = await getDb();
let fehler = 0;
const zeile = (ok, m) => { console.log(`  ${ok ? "ok  " : "!!  "} ${m}`); if (!ok) fehler++; };

/* Eine eigene Firma mit einer eigenen Stelle — sonst mischt sich echter Bestand hinein. */
const [c] = (await db.execute(sql`
  insert into companies (name) values (${`Prüffirma ${Date.now()}`}) returning id`)).rows;
const [q] = (await db.execute(sql`select id from job_sources limit 1`)).rows;
const [j] = (await db.execute(sql`
  insert into jobs (title, company_id, location, work_model, description, description_tokens,
                    description_length, content_hash, source_id)
  values ('Prüfstelle', ${c.id}, 'Berlin', 'on_site', 'Text', 'text', 4,
          ${`hash-${Date.now()}`}, ${q.id}) returning id`)).rows;

const bewerbung = async (tageAlt, beantwortetNachTagen) => {
  const [u] = (await db.execute(sql`
    insert into users (email) values (${`aq-${Date.now()}-${Math.random()}@example.invalid`}) returning id`)).rows;
  const [a] = (await db.execute(sql`
    insert into applications (user_id, job_id, stage) values (${u.id}, ${j.id}, 'sent') returning id`)).rows;
  await db.execute(sql`
    insert into application_events (user_id, application_id, job_id, type, occurred_at)
    values (${u.id}, ${a.id}, ${j.id}, 'application_sent', now() - ${sql.raw(`interval '${tageAlt} days'`)})`);
  if (beantwortetNachTagen !== null) {
    await db.execute(sql`
      insert into application_events (user_id, application_id, job_id, type, occurred_at)
      values (${u.id}, ${a.id}, ${j.id}, 'acknowledged',
              now() - ${sql.raw(`interval '${tageAlt - beantwortetNachTagen} days'`)})`);
  }
  return u.id;
};

const nutzer = [];
/* Neun alte Bewerbungen — unter der Schwelle. */
for (let i = 0; i < 9; i++) nutzer.push(await bewerbung(40, i < 6 ? 5 : null));
let r = await antwortquoteFuerFirma(c.id);
zeile(r.beurteilt === 9, `Neun alte Bewerbungen gezählt (${r.beurteilt})`);
zeile(r.quote === null, `Unter ${MIN_BEWERBUNGEN} keine Quote`);
zeile(r.beantwortet === 6, "Die Zählung steht trotzdem da");

/* Die zehnte macht die Quote möglich. */
nutzer.push(await bewerbung(40, 5));
r = await antwortquoteFuerFirma(c.id);
zeile(r.quote !== null, `Ab ${MIN_BEWERBUNGEN} gibt es eine (${Math.round(r.quote*100)} %)`);
zeile(Math.round(r.quote * 100) === 70, `Sieben von zehn beantwortet (${Math.round(r.quote*100)} %)`);
zeile(r.medianTage === 5, `Mediane Antwortzeit fünf Tage (${r.medianTage})`);

/* Eine frische Bewerbung darf die Quote nicht verschlechtern. */
nutzer.push(await bewerbung(3, null));
const frisch = await antwortquoteFuerFirma(c.id);
zeile(frisch.beurteilt === 10, `Eine Bewerbung von gestern zählt nicht mit (${frisch.beurteilt})`);
zeile(Math.round(frisch.quote * 100) === 70, "Und verschlechtert die Quote nicht");

/* Eine nie abgeschickte Bewerbung sagt über den Arbeitgeber nichts. */
const [u2] = (await db.execute(sql`
  insert into users (email) values (${`aq-nie-${Date.now()}@example.invalid`}) returning id`)).rows;
const [a2] = (await db.execute(sql`
  insert into applications (user_id, job_id, stage) values (${u2.id}, ${j.id}, 'preparing') returning id`)).rows;
await db.execute(sql`
  insert into application_events (user_id, application_id, job_id, type, occurred_at)
  values (${u2.id}, ${a2.id}, ${j.id}, 'application_started', now() - interval '40 days')`);
nutzer.push(u2.id);
const nie = await antwortquoteFuerFirma(c.id);
zeile(nie.beurteilt === 10, `Eine nie abgeschickte zählt nicht (${nie.beurteilt})`);

/* Eine Absage ist eine Antwort. */
const [u3] = (await db.execute(sql`
  insert into users (email) values (${`aq-abs-${Date.now()}@example.invalid`}) returning id`)).rows;
const [a3] = (await db.execute(sql`
  insert into applications (user_id, job_id, stage) values (${u3.id}, ${j.id}, 'rejected') returning id`)).rows;
await db.execute(sql`
  insert into application_events (user_id, application_id, job_id, type, occurred_at)
  values (${u3.id}, ${a3.id}, ${j.id}, 'application_sent', now() - interval '40 days'),
         (${u3.id}, ${a3.id}, ${j.id}, 'rejected', now() - interval '30 days')`);
nutzer.push(u3.id);
const mitAbsage = await antwortquoteFuerFirma(c.id);
zeile(mitAbsage.beantwortet === 8, `Eine Absage zählt als Antwort (${mitAbsage.beantwortet} von ${mitAbsage.beurteilt})`);

for (const id of nutzer) await db.execute(sql`delete from users where id=${id}`);
await db.execute(sql`delete from companies where id=${c.id}`);
console.log(fehler ? `\n${fehler} Prüfung(en) fehlgeschlagen.` : "\nAlle Prüfungen bestanden.");
process.exit(fehler ? 1 : 0);
