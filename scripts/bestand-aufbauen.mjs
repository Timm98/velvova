import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Den Stellenbestand aus der Jobbörse der Bundesagentur aufbauen.
 *
 * ── Warum es dieses Skript neben `jobs:refresh` gibt ──────────
 *
 * Der reguläre Lauf fragt alle Quellen mit demselben Limit. Das ist
 * für einen täglichen Abgleich richtig und für den erstmaligen Aufbau
 * falsch: Arbeitnow ist nach 2.000 Anzeigen erschöpft, die
 * Bundesagentur führt 999.398.
 *
 * Dieses Skript holt deshalb nur dort, wo es etwas zu holen gibt, und
 * zwar in Abschnitten. Nach jedem Abschnitt steht der Zwischenstand
 * in der Datenbank; ein Abbruch kostet nichts ausser Zeit.
 *
 * Aufruf:
 *   node --experimental-strip-types scripts/bestand-aufbauen.mjs [ziel] [abschnitt]
 */

const { BundesagenturAdapter } = await import("../packages/jobs/src/sources/bundesagentur.ts");
const { ingestFromAdapter } = await import("../packages/jobs/src/ingest.ts");
const { berufsabfragen, abfragenVermerken } = await import("../packages/jobs/src/berufsabfragen.ts");
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

const ziel = Number(process.argv[2] ?? 20000);
const abschnitt = Number(process.argv[3] ?? 2000);

const vorher = (await db.execute(sql`select count(*)::int n from jobs`)).rows[0].n;
/*
 * Der geerntete Wortschatz, die ergiebigsten Begriffe zuerst.
 *
 * Vorher waren es 236 Bezeichnungen aus dem eigenen Bestand — ein
 * Zirkelschluss, der 573.662 von 999.398 Anzeigen erreichte. Jetzt
 * kommen sie aus `beruf_wortschatz`, geerntet aus den Anzeigen selbst.
 */
/*
 * ── Mehrere Läufe nebeneinander ───────────────────────────────
 *
 * Ein einzelner Lauf schafft gemessen rund 280 Anzeigen je Minute —
 * für den Bestand der Jobbörse von 999.398 wären das sechzig Stunden.
 * Der Engpass ist der Detailabruf: eine Anfrage je Stelle, und die
 * lässt sich nicht bündeln, weil jede Anzeige ihren eigenen Text hat.
 *
 * Also mehrere Prozesse — jeder mit einem eigenen, überschneidungsfreien
 * Teil des Wortschatzes. `teil` und `vonTeilen` schneiden ihn zu:
 * `... 1 3` nimmt jeden dritten Begriff ab dem ersten.
 *
 * Ohne diese Aufteilung würden zwei Läufe dieselben Begriffe abfragen
 * und dieselben Anzeigen holen — doppelte Last bei der Quelle, kein
 * zusätzlicher Ertrag.
 */
const teil = Number(process.argv[6] ?? 1);
const vonTeilen = Number(process.argv[7] ?? 1);
const alleBerufe = await berufsabfragen(Number(process.argv[4] ?? 1200));
const berufe = alleBerufe.filter((_, i) => i % vonTeilen === teil - 1);
console.log(`Bestand vorher: ${vorher} Stellen · Suchwortschatz: ${berufe.length} von ${alleBerufe.length} Berufen (Teil ${teil}/${vonTeilen})`);
console.log(`Ziel: ${ziel} geholte Anzeigen, in Abschnitten zu ${abschnitt}.\n`);

/*
 * ── Warum der Wortschatz aufgeteilt wird ──────────────────────
 *
 * Die erste Fassung übergab jedem Abschnitt alle 236 Berufe. Der
 * Adapter blättert reihum und hört auf, sobald sein Limit voll ist —
 * also nach Seite 1 der ersten zwanzig Berufe. Beim nächsten Abschnitt
 * fing er wieder von vorn an und holte dieselben 2.000 Anzeigen.
 *
 * Gemessen: Abschnitt 1 brachte 1.598 neue Stellen, Abschnitt 2 genau
 * drei, Abschnitt 3 genau zwei. Zwanzig Minuten für fünf Anzeigen —
 * und nichts daran sah nach einem Fehler aus, weil jeder Abschnitt
 * meldete, er habe 1.999 geholt.
 *
 * Jetzt bekommt jeder Abschnitt seine eigene Gruppe von Berufen. Der
 * Wortschatz wird einmal durchlaufen, nicht immer wieder von vorn.
 */
const GRUPPE = Number(process.argv[5] ?? 20);
const gruppen = [];
for (let i = 0; i < berufe.length; i += GRUPPE) gruppen.push(berufe.slice(i, i + GRUPPE));
console.log(`${gruppen.length} Gruppen zu je höchstens ${GRUPPE} Berufen.\n`);

let geholt = 0;
let neu = 0;
const t0 = Date.now();

for (const [nr, gruppe] of gruppen.entries()) {
  if (geholt >= ziel) break;
  const dieseRunde = Math.min(abschnitt, ziel - geholt);
  const r = await ingestFromAdapter(
    new BundesagenturAdapter({
      abfragen: gruppe,
      /*
       * Acht gleichzeitig statt vier, Pause von 100 auf 60 ms.
       *
       * Das ist kein Umgehen einer Taktgrenze: `holJson` staffelt bei
       * 429 und 5xx von selbst zurück und wiederholt gebremst. Wer zu
       * schnell ist, wird dadurch automatisch langsamer.
       *
       * Acht ist die Obergrenze des Adapters — eine Zahl, die jemand
       * versehentlich auf 200 setzt, wäre kein Tempogewinn, sondern
       * ein Angriff auf eine öffentliche Behördenschnittstelle.
       */
      pauseMs: 60,
      gleichzeitig: 8,
    }),
    { limit: dieseRunde },
  );
  geholt += r.fetched;
  neu += r.inserted;

  const jetzt = (await db.execute(sql`select count(*)::int n from jobs`)).rows[0].n;
  const min = ((Date.now() - t0) / 60000).toFixed(1);
  console.log(
    `  Gruppe ${String(nr + 1).padStart(2)}/${gruppen.length} · ` +
      `geholt ${String(r.fetched).padStart(5)} · neu ${String(r.inserted).padStart(5)} · ` +
      `unverändert ${String(r.unchanged).padStart(5)} · fehlerhaft ${r.failed} · ` +
      `Bestand ${jetzt} · ${min} min`,
  );
  for (const e of r.errors.slice(0, 2)) console.log(`      ! ${e}`);

  /*
   * Eine leere Gruppe ist kein Grund aufzuhören.
   *
   * Sie heisst nur, dass diese zwanzig Berufe nichts Neues hergeben.
   * Die nächsten zwanzig sind andere Berufe.
   */
}

const nachher = (await db.execute(sql`select count(*)::int n from jobs`)).rows[0].n;
console.log(`\nFertig: ${vorher} → ${nachher} Stellen (+${nachher - vorher}), ${((Date.now() - t0) / 60000).toFixed(1)} min.`);
process.exit(0);
