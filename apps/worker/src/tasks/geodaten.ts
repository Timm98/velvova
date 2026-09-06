import { getDb } from "@paycheck/db";
import { geodatenNachziehen, geoAbdeckung, type Nachziehbefund } from "@paycheck/jobs";

/**
 * Koordinaten für neu importierte Stellen.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das gefehlt hat
 * ══════════════════════════════════════════════════════════════
 *
 * `geodatenNachziehen` gibt es seit dem Geodaten-Block. Aufgerufen
 * hat es nur ein Skript von Hand — einmal, für den damaligen Bestand.
 *
 * Was danach importiert wurde, kam ohne Koordinaten an. Gemessen am
 * 7. September 2026:
 *
 *   neueste 3.000 deutsche Anzeigen   330 mit Koordinaten  (11 %)
 *   beliebige 5.000                 3.182 mit Koordinaten  (64 %)
 *
 * Die Liste zeigt die NEUESTEN. Alles, was an Koordinaten hängt —
 * Umkreissuche, Fahrzeit, Entfernungsangabe — war damit für neun von
 * zehn sichtbaren Stellen blind.
 *
 * Das ist der Fehler, der in diesem Projekt am häufigsten vorkommt:
 * gebaut, dokumentiert, nie aufgerufen.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum es nichts kostet
 * ══════════════════════════════════════════════════════════════
 *
 * Kein Modell, kein fremder Dienst, keine Adresse verlässt das Haus.
 * Aufgelöst wird gegen `geo_referenz` — eine Tabelle im eigenen
 * Bestand, gefüllt aus offenen Ortsdaten. Es ist reine Rechenzeit.
 */

export interface Geolauf extends Nachziehbefund {
  abdeckung: number | null;
}

/**
 * Wie viele Stellen je Durchgang.
 *
 * Fünfhundert, weil die Auflösung gegen `geo_referenz` läuft und
 * deren Abfrage mit der Stapelgrösse wächst. Bei einem Lauf alle
 * fünfzehn Minuten sind das 48.000 am Tag — mehr, als in derselben
 * Zeit importiert wird.
 */
const STAPEL = 500;

export async function runGeodaten(): Promise<Geolauf> {
  const db = await getDb();

  /*
   * `nurAnalysierte: false`.
   *
   * Das Skript nahm nur analysierte Stellen — sinnvoll für einen
   * einmaligen Lauf über den Altbestand, weil dort die Abfrage über
   * die volle Tabelle ins Zeitlimit lief.
   *
   * Hier ist es falsch: Eine frisch importierte Stelle ist noch nicht
   * analysiert und braucht ihre Koordinaten trotzdem — sie steht ganz
   * oben in der Liste. `geo_fassung is null` trifft genau die neuen
   * und ist über den Index bezahlbar.
   */
  const befund = await geodatenNachziehen(db, { stapel: STAPEL, nurAnalysierte: false });

  /*
   * Die Abdeckung nur als Auskunft.
   *
   * Sie kostet eine eigene Abfrage über den ganzen Bestand — deshalb
   * darf sie scheitern, ohne den Lauf zu behelligen. Wer wissen will,
   * ob die Lücke kleiner wird, liest sie im Protokoll.
   */
  const abdeckung = await geoAbdeckung(db)
    .then((a) => a.anteilAufgeloest)
    .catch(() => null);

  return { ...befund, abdeckung };
}
