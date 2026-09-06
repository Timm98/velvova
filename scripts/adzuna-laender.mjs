import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Adzuna für Deutschland, Österreich und die Schweiz.
 *
 * ── Warum getrennt vom Hauptlauf ──────────────────────────────
 *
 * Der reguläre Abruf gibt allen Quellen dasselbe Limit. Adzuna ist
 * aber die einzige Quelle, die Österreich und die Schweiz abdeckt —
 * dort brauchen wir Tiefe, während in Deutschland die Bundesagentur
 * ohnehin die bessere Quelle ist.
 *
 * ── Was an diesen Daten schwächer ist ─────────────────────────
 *
 * Adzuna kürzt jede Beschreibung auf 500 Zeichen. Gemessen an 793
 * bestehenden Anzeigen: alle 793 enden mit „…". Das ist kein Fehler
 * des Abrufs, sondern die Schnittstelle — die Volltexte gibt es nur
 * beim Arbeitgeber.
 *
 * Für die Passung heisst das: schwächer als eine BA-Anzeige mit 2.877
 * Zeichen im Schnitt. Es ist trotzdem besser als nichts, denn für
 * Österreich und die Schweiz haben wir sonst gar keine Abdeckung — und
 * der Verweis auf die Originalanzeige steht dabei.
 */
const { AdzunaAdapter, ADZUNA_LAENDER } = await import("../packages/jobs/src/sources/adzuna.ts");
const { berufsabfragen } = await import("../packages/jobs/src/berufsabfragen.ts");
const { ingestFromAdapter } = await import("../packages/jobs/src/ingest.ts");
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

const jeLand = Number(process.argv[2] ?? 1000);
const laender = (process.argv[3] ?? ADZUNA_LAENDER.join(",")).split(",");

/*
 * Eine Stückzahl, die keine ist, hält den Lauf nicht auf — sie macht ihn
 * still wirkungslos.
 *
 * Ein Aufruf mit `adzuna-laender.mjs de,at,ch` setzte `jeLand` auf NaN.
 * Jede Grenzprüfung gegen NaN ist falsch, also holte der Lauf null
 * Anzeigen — und meldete für alle 19 Länder „0 geholt · 0 fehlerhaft".
 * Nach Fehlern sah das nicht aus, nach Erfolg schon.
 */
if (!Number.isFinite(jeLand) || jeLand <= 0) {
  console.error(
    `Stückzahl je Land ist keine positive Zahl: ${JSON.stringify(process.argv[2])}\n` +
    `Aufruf: adzuna-laender.mjs [jeLand] [laender] [begriffe]  —  z. B. 40000 de,at,ch`,
  );
  process.exit(1);
}
const unbekannt = laender.filter((l) => !ADZUNA_LAENDER.includes(l));
if (unbekannt.length > 0) {
  console.error(`Unbekannte Länder: ${unbekannt.join(", ")}\nErlaubt: ${ADZUNA_LAENDER.join(", ")}`);
  process.exit(1);
}

/* Schätzwert: count(*) über 1,58 Mio. Zeilen bricht unter Importlast in die Zeitgrenze. */
const vorher = Number((await db.execute(sql`select reltuples::bigint n from pg_class where relname = 'jobs'`)).rows[0].n);

/*
 * Derselbe Wortschatz wie bei der Bundesagentur.
 *
 * Ohne Suchbegriff endet Adzuna nach hundert Seiten — 5.000 Anzeigen,
 * und dann wiederholt es sich. Mit Begriff beginnt die Zählung von
 * vorn. Erst damit sind die 81.550 Schweizer und 33.078
 * österreichischen Anzeigen überhaupt erreichbar.
 */
/*
 * Wie viele Suchbegriffe.
 *
 * Ohne Begriff endet Adzuna nach hundert Seiten — 5.000 Anzeigen. Mit
 * Begriff beginnt die Zählung von vorn. Vierhundert Begriffe waren
 * für die Schweiz genug (81.500 Anzeigen), für Deutschland mit
 * 1.162.938 nicht: Der erste Lauf war nach 7.612 Stellen durch.
 */
const berufe = await berufsabfragen(Number(process.argv[4] ?? 400)).catch(() => []);
console.log(`Bestand vorher: ${vorher} · je Land bis zu ${jeLand} Anzeigen`);
console.log(`Suchwortschatz: ${berufe.length} Berufsbezeichnungen\n`);

for (const land of laender) {
  const t0 = Date.now();
  try {
    /*
     * ── In Abschnitten, nicht in einem Zug ────────────────────
     *
     * Ein erster Versuch übergab das ganze Ziel als Limit. Der Adapter
     * sammelt dann erst alles im Speicher und gibt es am Ende zurück —
     * bei 200.000 Anzeigen sind das viele Minuten, in denen nichts
     * geschrieben wird und nichts zu sehen ist. Ein Abbruch dazwischen
     * kostet alles.
     *
     * Abschnitte zu 3.000 schreiben früh und oft. Der Wortschatz wird
     * dabei mitgedreht, damit ein zweiter Abschnitt nicht dieselben
     * Begriffe holt wie der erste.
     */
    let geholt = 0;
    let neu = 0;
    let unveraendert = 0;
    let fehler = 0;
    const SCHRITT = 3000;
    const proAbschnitt = Math.max(40, Math.ceil(berufe.length / Math.ceil(jeLand / SCHRITT)));

    for (let ab = 0; ab < berufe.length && geholt < jeLand; ab += proAbschnitt) {
      const teil = berufe.slice(ab, ab + proAbschnitt);
      if (teil.length === 0) break;
      const abschnitt = await ingestFromAdapter(
        new AdzunaAdapter({ country: land, abfragen: teil }),
        { limit: Math.min(SCHRITT, jeLand - geholt) },
      );
      geholt += abschnitt.fetched;
      neu += abschnitt.inserted;
      unveraendert += abschnitt.unchanged;
      fehler += abschnitt.failed;
      if (abschnitt.fetched === 0) break;
    }
    const r = { fetched: geholt, inserted: neu, unchanged: unveraendert, failed: fehler, errors: [] };
    console.log(
      `  ${land.toUpperCase()} · geholt ${String(r.fetched).padStart(5)} · neu ${String(r.inserted).padStart(5)} · ` +
        `unverändert ${String(r.unchanged).padStart(5)} · fehlerhaft ${r.failed} · ${((Date.now() - t0) / 1000).toFixed(0)} s`,
    );
    for (const e of r.errors.slice(0, 2)) console.log(`      ! ${e}`);
  } catch (e) {
    console.log(`  ${land.toUpperCase()} · Abbruch: ${String(e instanceof Error ? e.message : e).slice(0, 120)}`);
  }
}

const nachher = Number((await db.execute(sql`select reltuples::bigint n from pg_class where relname = 'jobs'`)).rows[0].n);
console.log(`\nBestand: ${vorher} → ${nachher} (+${nachher - vorher}).`);
process.exit(0);
