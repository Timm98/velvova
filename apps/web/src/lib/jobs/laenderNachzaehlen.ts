import { sql } from "drizzle-orm";
import { getDb } from "@paycheck/db";

/**
 * Was `db.execute` zurückgibt, soweit es hier gebraucht wird.
 *
 * Der Rückgabetyp hängt am Treiber und ist im Zusammenspiel mit
 * Drizzle `unknown`. Statt an jeder Stelle zu casten steht die Form
 * einmal hier — mit dem einzigen Feld, das gelesen wird.
 */
type Ergebnis<T> = { rows: T[] };

/**
 * Stellen je Land nachzählen — im Pflegelauf, ein Stück pro Durchgang.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das hier steht und nicht mehr nur im Skript
 * ══════════════════════════════════════════════════════════════
 *
 * `scripts/laender-zaehlen.mjs` gab es schon, und darüber stand, es
 * laufe „im stündlichen Pflegelauf". Es lief dort nie: Der Zeitplan
 * ruft `/api/jobs/refresh`, und diese Route kannte das Skript nicht.
 *
 * Zwei Fehler übereinander. Das Skript schrieb sein Ergebnis gar nicht
 * erst weg, und selbst als es das tat, hätte es niemand aufgerufen.
 * Der Fuss zeigte am 8. September 2026 2.498.075 Stellen, während der
 * Bestand bei 3.486.049 lag.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum nicht alle Länder auf einmal
 * ══════════════════════════════════════════════════════════════
 *
 * Gemessen an der Produktionsdatenbank: eine Zählung für die Schweiz
 * mit 77.393 Stellen braucht 16,6 Sekunden, für Deutschland mit 1,2
 * Millionen entsprechend länger. Zweiundzwanzig Länder am Stück
 * überschreiten das, was neben dem Abruf im selben Aufruf Platz hat.
 *
 * Deshalb dieselbe Lösung wie bei den Quellen: Der Takt ist der
 * Zeiger. Jeder Lauf nimmt ein paar Länder, beginnend dort, wo der
 * vorige aufgehört hätte. Nach ein paar Stunden ist jedes einmal dran
 * gewesen, ohne dass irgendwo ein Zustand gespeichert werden muss.
 *
 * ══════════════════════════════════════════════════════════════
 * Und warum hier nichts gelöscht wird
 * ══════════════════════════════════════════════════════════════
 *
 * Das Skript entfernt Länder ohne Stellen — richtig, weil es alle
 * zählt. Ein rotierender Lauf sieht immer nur einen Ausschnitt. Würde
 * er löschen, was er gerade nicht gezählt hat, bliebe im Fuss nach
 * jedem Durchgang genau eine Handvoll Länder stehen.
 *
 * Aufräumen bleibt deshalb Sache des vollständigen Laufs.
 */

export interface Zaehlergebnis {
  /** Die Länder, die dieser Lauf angefasst hat. */
  gezaehlt: { land: string; stellen: number }[];
  /** Länder, deren Zählung fehlschlug — mit Grund. */
  fehler: { land: string; grund: string }[];
  /** Wurde wegen der Zeit abgebrochen? */
  abgebrochen: boolean;
  dauerMs: number;
}

/** So viele Länder höchstens je Lauf. */
export const LAENDER_JE_LAUF = 4;

export async function laenderNachzaehlen(opt: {
  /** Der Rotationszeiger des Laufs — dieselbe Zahl wie bei den Quellen. */
  takt: number;
  /** Was an Zeit übrig ist. Darunter wird gar nicht erst begonnen. */
  budgetMs: number;
}): Promise<Zaehlergebnis> {
  const beginn = Date.now();
  const gezaehlt: Zaehlergebnis["gezaehlt"] = [];
  const fehler: Zaehlergebnis["fehler"] = [];
  let abgebrochen = false;

  const db = await getDb();

  /*
   * Welche Länder es gibt, kommt aus dem Bestand — nicht aus einer
   * Liste im Code und nicht nur aus der Tabelle, die gefüllt werden
   * soll. Sonst kann ein Land, das über eine Quelle hereinkommt, nie
   * hinzukommen: Es steht ja noch nicht drin.
   *
   * `distinct country` läuft über den Index und ist billig.
   */
  const vorhanden = await db
    .execute(sql`select distinct country from jobs where country is not null`)
    .then((r) => (r as Ergebnis<{ country: string }>).rows.map((z) => z.country).sort())
    .catch((e: unknown) => {
      fehler.push({ land: "*", grund: e instanceof Error ? e.message : String(e) });
      return [] as string[];
    });

  if (vorhanden.length === 0) {
    return { gezaehlt, fehler, abgebrochen: false, dauerMs: Date.now() - beginn };
  }

  const versatz = takterVersatz(opt.takt, vorhanden.length);

  for (let n = 0; n < Math.min(LAENDER_JE_LAUF, vorhanden.length); n++) {
    if (Date.now() - beginn > opt.budgetMs) {
      abgebrochen = true;
      break;
    }
    const land = vorhanden[(versatz + n) % vorhanden.length]!;
    try {
      /*
       * Der Ablauf-Filter steht mit im `where`, und das ist kein
       * Beiwerk: Gemessen war die Zählung damit 16,6 statt 91,1
       * Sekunden — er schränkt früher ein. Inhaltlich gehört er ohnehin
       * dazu, weil der Fuss zu einer Trefferliste führt.
       */
      const antwort = (await db.execute(sql`
        select count(*)::bigint n from jobs
        where is_demo = false and country = ${land}
          and (expires_at is null or expires_at > now())`)) as Ergebnis<{ n: string | number }>;
      const stellen = Number(antwort.rows[0]?.n ?? 0);

      if (stellen > 0) {
        await db.execute(sql`
          insert into laenderbestand (land, stellen, berechnet_am)
          values (${land}, ${stellen}, now())
          on conflict (land) do update
            set stellen = excluded.stellen, berechnet_am = excluded.berechnet_am`);
        gezaehlt.push({ land, stellen });
      } else {
        /* Ein Land, das leer geworden ist, verschwindet — aber nur
           dieses eine, das gerade gezählt wurde. Siehe oben. */
        await db.execute(sql`delete from laenderbestand where land = ${land}`);
      }
    } catch (e) {
      fehler.push({ land, grund: e instanceof Error ? e.message : String(e) });
    }
  }

  return { gezaehlt, fehler, abgebrochen, dauerMs: Date.now() - beginn };
}

/**
 * Wo dieser Lauf zu zählen beginnt.
 *
 * Der Zeiger springt um die Zahl der Länder je Lauf weiter, nicht um
 * eins: Sonst überschnitten sich aufeinanderfolgende Läufe zu drei
 * Vierteln und ein Land käme erst nach vier Stunden wieder dran, statt
 * nach der Runde.
 */
export function takterVersatz(takt: number, anzahl: number): number {
  if (anzahl <= 0) return 0;
  return ((takt * LAENDER_JE_LAUF) % anzahl + anzahl) % anzahl;
}
