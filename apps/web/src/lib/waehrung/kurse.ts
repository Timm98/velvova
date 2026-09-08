import { sql } from "drizzle-orm";
import { ecbLesen } from "./umrechnen.ts";
import { getDb, schema } from "@paycheck/db";

/**
 * Wechselkurse — holen, halten, umrechnen.
 *
 * ══════════════════════════════════════════════════════════════
 * Die Quelle
 * ══════════════════════════════════════════════════════════════
 *
 * Die Referenzkurse der Europäischen Zentralbank. Sie sind kostenlos,
 * brauchen keinen Schlüssel, nennen ihr eigenes Datum und sind das,
 * worauf sich in Europa ohnehin alle beziehen.
 *
 * Geprüft am 8. September 2026: 29 Währungen, EUR als Basis, Stand
 * 2026-09-07. Enthalten sind USD, CHF, GBP, JPY, BRL, MXN, INR, PLN,
 * CAD, SEK, CZK, ZAR, AUD, SGD, TRY, HUF, RON, NOK, DKK, NZD und
 * neun weitere.
 *
 * ── Was fehlt ───────────────────────────────────────────────
 *
 * ARS (Argentinien) und UAH (Ukraine) veröffentlicht die EZB nicht.
 * Für Stellen aus diesen beiden Ländern wird deshalb NICHT
 * umgerechnet — der Betrag bleibt in seiner Währung stehen. Einen
 * Kurs von woanders dazuzumischen hiesse, zwei Quellen mit
 * verschiedenen Stichzeiten in einer Liste zu vermengen, ohne dass
 * jemand es sieht.
 *
 * ══════════════════════════════════════════════════════════════
 * Zweimal am Tag — ohne Zeitplan
 * ══════════════════════════════════════════════════════════════
 *
 * Die Kurse werden nicht von einem Cron geholt, sondern beim ersten
 * Zugriff, nachdem sie zwölf Stunden alt sind. Das ergibt zwei
 * Abrufe am Tag und hat gegenüber einem Zeitplan zwei Vorteile: Es
 * gibt nichts, was ausfallen kann, ohne dass es auffällt, und auf
 * einer Seite, die niemand aufruft, wird auch nichts geholt.
 *
 * ── Die EZB rechnet nur werktags ────────────────────────────
 *
 * Sie veröffentlicht an Werktagen gegen 16 Uhr MEZ. Zweimal täglich
 * zu fragen holt also am Wochenende zweimal denselben Kurs. Das ist
 * kein Fehler: `stand` sagt, von wann er ist, und am Sonntag ist der
 * frischeste Kurs zwei Tage alt.
 */

const ECB = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";

/**
 * Wie lange ein geholter Kurs gilt.
 *
 * Zwölf Stunden — daraus ergeben sich die zwei Abrufe am Tag. Kürzer
 * wäre sinnlos, weil die Quelle selbst nur einmal werktäglich neu
 * rechnet; länger hiesse, an einem bewegten Tag mit dem Kurs von
 * gestern zu rechnen, ohne es zu müssen.
 */
const GILT_MS = 12 * 60 * 60 * 1000;

export interface Kursstand {
  /** Währung → wie viele Einheiten ein Euro kostet. */
  kurse: Record<string, number>;
  /** Der Tag, für den die EZB die Kurse nennt. */
  stand: string | null;
  /** Wann wir sie geholt haben. */
  geholtAm: Date | null;
  /** Wann der nächste Abruf frühestens stattfindet. */
  naechsteAktualisierung: Date | null;
}

const LEER: Kursstand = { kurse: {}, stand: null, geholtAm: null, naechsteAktualisierung: null };

/**
 * Die gespeicherten Kurse, bei Bedarf vorher aufgefrischt.
 *
 * Fällt der Abruf aus, wird mit dem zurückgegeben, was dasteht —
 * auch wenn es alt ist. Ein alter Kurs mit sichtbarem Datum ist
 * brauchbar; gar kein Kurs heisst, dass jede fremde Währung
 * unlesbar bleibt.
 */
export async function kursstand(): Promise<Kursstand> {
  try {
    const db = await getDb();
    const gespeichert = await lesen(db);

    const alt =
      gespeichert.geholtAm === null || Date.now() - gespeichert.geholtAm.getTime() > GILT_MS;
    if (!alt) return gespeichert;

    const frisch = await holen();
    if (frisch === null) return gespeichert;

    await schreiben(db, frisch);
    return await lesen(db);
  } catch {
    return LEER;
  }
}

async function holen(): Promise<{ stand: string; kurse: Record<string, number> } | null> {
  try {
    /*
     * Ein eigener Abbruch nach acht Sekunden.
     *
     * Diese Kurse hängen an einer Seitenanfrage. Ohne Frist würde
     * eine hängende Verbindung zur EZB die Stellenliste mit
     * blockieren — für eine Zahl, die auch von gestern sein darf.
     */
    const abbruch = AbortSignal.timeout(8_000);
    const antwort = await fetch(ECB, { signal: abbruch, cache: "no-store" });
    if (!antwort.ok) return null;
    const { stand, kurse } = ecbLesen(await antwort.text());
    if (stand === null || Object.keys(kurse).length < 5) return null;
    return { stand, kurse };
  } catch {
    return null;
  }
}

async function lesen(db: Awaited<ReturnType<typeof getDb>>): Promise<Kursstand> {
  const zeilen = await db.select().from(schema.wechselkurse);
  if (zeilen.length === 0) return LEER;

  const kurse: Record<string, number> = {};
  let geholtAm: Date | null = null;
  let stand: string | null = null;
  for (const z of zeilen) {
    const wert = Number.parseFloat(String(z.kurs));
    if (Number.isFinite(wert) && wert > 0) kurse[z.waehrung] = wert;
    if (geholtAm === null || z.geholtAm > geholtAm) geholtAm = z.geholtAm;
    if (stand === null || String(z.stand) > stand) stand = String(z.stand);
  }

  return {
    kurse,
    stand,
    geholtAm,
    naechsteAktualisierung: geholtAm === null ? null : new Date(geholtAm.getTime() + GILT_MS),
  };
}

async function schreiben(
  db: Awaited<ReturnType<typeof getDb>>,
  frisch: { stand: string; kurse: Record<string, number> },
): Promise<void> {
  const werte = Object.entries(frisch.kurse).map(([waehrung, kurs]) => ({
    waehrung,
    kurs: String(kurs),
    stand: frisch.stand,
    quelle: "ecb",
    geholtAm: new Date(),
  }));
  if (werte.length === 0) return;

  /*
   * Ein Schreibvorgang für alle dreissig.
   *
   * `geholtAm` wird bei jedem Lauf mitgeschrieben, auch wenn der Kurs
   * derselbe ist — sonst gälte ein am Wochenende unveränderter Kurs
   * dauerhaft als abgelaufen, und wir fragten die EZB im Minutentakt
   * nach einer Zahl, die sie erst am Montag ändert.
   */
  await db
    .insert(schema.wechselkurse)
    .values(werte)
    .onConflictDoUpdate({
      target: schema.wechselkurse.waehrung,
      set: {
        kurs: sql`excluded.kurs`,
        stand: sql`excluded.stand`,
        quelle: sql`excluded.quelle`,
        geholtAm: sql`excluded.geholt_am`,
      },
    });
}

/*
 * Die reinen Teile stehen in `umrechnen.ts`.
 *
 * Diese Datei greift auf die Datenbank zu — und `gehaltsanzeige.ts`,
 * die umrechnet, läuft auch im Browser. Der Import von hier zog den
 * Postgres-Treiber ins Client-Bündel; der Bau brach mit sieben
 * Fehlern („Can't resolve 'dns'", 'fs', 'net', 'tls').
 *
 * `tsc --noEmit` sieht das nicht: Für den Typprüfer ist ein Import
 * ein Import. Erst `next build` weiss, was im Browser landet.
 *
 * Dieselbe Trennung wie bei `zweige.ts` und `filterschluessel.ts`.
 */
export { umrechnen } from "./umrechnen.ts";
export { ecbLesen };
