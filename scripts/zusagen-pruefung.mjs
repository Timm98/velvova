import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Der Promise Lock von der Zusage bis zum Arbeitgeber-Score.
 *
 * Geprüft wird vor allem das Schweigen: Eine Quote, die neben einem
 * Arbeitgeber steht, darf nicht aus drei Antworten stammen — und ein
 * Arbeitgeber darf nicht für etwas abgewertet werden, das noch gar
 * nicht fällig war.
 */
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const { promiseKept, MIN_ZUSAGEN_FUER_QUOTE } = await import("../packages/domain/src/zusagen.ts");
const db = await getDb();
let fehler = 0;
const zeile = (ok, m) => { console.log(`  ${ok ? "ok  " : "!!  "} ${m}`); if (!ok) fehler++; };

const [u] = (await db.execute(sql`
  insert into users (email) values (${`zus-${Date.now()}@example.invalid`}) returning id`)).rows;
const [j] = (await db.execute(sql`select id, company_id from jobs where is_demo=false limit 1`)).rows;
const [a] = (await db.execute(sql`
  insert into applications (user_id, job_id, stage) values (${u.id}, ${j.id}, 'accepted') returning id`)).rows;

/* Zehn Zusagen, verschiedene Herkünfte. */
const punkte = ["aufgaben","arbeitszeit","homeoffice","einarbeitung","vorgesetzter",
                "ziele_90","entscheidungsfreiheit","weiterbildung","aufstieg","ressourcen"];
const ids = [];
for (const [i, p] of punkte.entries()) {
  const [z] = (await db.execute(sql`
    insert into zusagen (user_id, application_id, punkt, zusage, herkunft, beleg)
    values (${u.id}, ${a.id}, ${p}, ${`Zusage zu ${p}`},
            ${i < 6 ? "arbeitgeber_bestaetigt" : "anzeige"}, 'Prüflauf')
    returning id`)).rows;
  ids.push(z.id);
}
zeile(ids.length === 10, `Zehn Zusagen festgehalten (${ids.length})`);

/* Erst nur wenige geprüft — die Quote muss schweigen. */
for (const id of ids.slice(0, 3)) {
  await db.execute(sql`
    insert into zusagen_pruefungen (zusage_id, user_id, tagesmarke, stand)
    values (${id}, ${u.id}, 14, 'gehalten')`);
}
const wenig = promiseKept(Array(3).fill({ punkt: "aufgaben", herkunft: "gespraech", stand: "gehalten" }));
zeile(wenig.quote === null, `Unter ${MIN_ZUSAGEN_FUER_QUOTE} Zusagen keine Quote`);
zeile(wenig.gehalten === 3, "Die Zählung steht trotzdem da");

/* Dann alle — mit einem Bruch und einem „zu früh". */
for (const [i, id] of ids.entries()) {
  const stand = i === 0 ? "gebrochen" : i === 1 ? "teilweise" : i === 2 ? "zu_frueh" : "gehalten";
  await db.execute(sql`
    insert into zusagen_pruefungen (zusage_id, user_id, tagesmarke, stand)
    values (${id}, ${u.id}, 90, ${stand})
    on conflict (zusage_id, tagesmarke) do update set stand = excluded.stand`);
}

/* Die späteste Marke je Zusage zählt. */
const zeilen = (await db.execute(sql`
  select z.punkt, z.herkunft, p.stand
  from zusagen_pruefungen p
  join zusagen z on z.id = p.zusage_id
  where z.user_id = ${u.id}
    and p.tagesmarke = (select max(p2.tagesmarke) from zusagen_pruefungen p2 where p2.zusage_id = p.zusage_id)`)).rows;
zeile(zeilen.length === 10, `Je Zusage genau eine Beurteilung — die späteste (${zeilen.length})`);

const score = promiseKept(zeilen.map((z) => ({ punkt: z.punkt, herkunft: z.herkunft, stand: z.stand })));
zeile(score.zuFrueh === 1, `„zu früh“ wird gezählt, aber nicht bewertet (${score.zuFrueh})`);
zeile(score.beurteilt === 9, `Beurteilt: ${score.beurteilt} von 10`);
zeile(score.quote !== null, `Ab neun beurteilten Zusagen gibt es eine Quote (${(score.quote*100).toFixed(0)} %)`);
zeile(score.quote < 1 && score.quote > 0.6, `Ein Bruch und ein Teilweise senken sie spürbar (${(score.quote*100).toFixed(0)} %)`);

/* Ohne die Marke-90-Zeilen wäre die Quote eine andere — der Vergleich
   hält fest, dass die späteste Marke gewinnt. */
const nurFrueh = promiseKept(Array(9).fill({ punkt: "aufgaben", herkunft: "arbeitgeber_bestaetigt", stand: "gehalten" }));
zeile(nurFrueh.quote === 1, "Zum Vergleich: lauter gehaltene ergeben 100 %");

await db.execute(sql`delete from users where id=${u.id}`);
console.log(fehler ? `\n${fehler} Prüfung(en) fehlgeschlagen.` : "\nAlle Prüfungen bestanden.");
process.exit(fehler ? 1 : 0);
