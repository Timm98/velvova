import type { Bedingungsurteil } from "./bedingungen.ts";

/**
 * Ein Check gehört zu genau einer Stelle in genau einer Fassung.
 *
 * ══════════════════════════════════════════════════════════════
 * Zwei Fehler, ein Grund
 * ══════════════════════════════════════════════════════════════
 *
 * **Der eine (B08).** Die Person fragt zu Stelle A, wechselt während
 * der Antwort zu B, und die Antwort erscheint unter B. Sie ist inhaltlich
 * richtig und steht am falschen Ort — und niemand merkt es, weil beide
 * Stellen plausibel klingen. Das ist der gefährlichste Fehler dieses
 * Produkts: Er sieht wie ein Ergebnis aus.
 *
 * **Der andere.** Der Arbeitgeber ändert die Anzeige. Der gespeicherte
 * Check bezieht sich weiter auf den alten Text, sagt das aber nicht.
 *
 * Beide entstehen daraus, dass ein Check nur „zu einer Stelle" gehörte
 * und nicht zu einer bestimmten Fassung von ihr. Deshalb trägt jeder
 * Prüfstand hier beides: `stelleId` und `fassung`.
 *
 * ══════════════════════════════════════════════════════════════
 * Und was passiert, wenn eine neue Antwort kommt (B07)
 * ══════════════════════════════════════════════════════════════
 *
 * „Zwei Samstagsdienste monatlich gehören zur Stelle" — telefonisch,
 * vom Arbeitgeber. Was daraus folgen muss:
 *
 *   Die betroffene Bedingung ändert sich.
 *   Alles andere bleibt, wie es war.
 *   Der Vorteil verschwindet nicht — er gleicht nur nichts aus.
 *   Woher die Information kam und wann, bleibt sichtbar.
 *
 * Eine allgemeine neue Zusammenfassung wäre die bequeme Antwort und
 * die falsche: Sie zwingt die Person, das Ergebnis noch einmal ganz zu
 * lesen, um herauszufinden, was sich geändert hat.
 */

export interface Pruefstand {
  id: string;
  stelleId: string;
  /**
   * Die Fassung der Anzeige, auf die sich dieser Check bezieht.
   *
   * Ein Kennzeichen des Textes, kein Datum: Ein Datum sagt, wann
   * gelesen wurde, nicht, ob dasselbe dastand.
   */
  fassung: string;
  erstelltAm: Date;
}

/**
 * Darf eine Antwort zu `gehoertZu` unter `sichtbar` gezeigt werden?
 *
 * Nur wenn Stelle und Fassung übereinstimmen. Die Prüfung ist so
 * einfach, dass sie sich lohnt: Der Fehler, den sie verhindert, ist
 * teuer und unsichtbar.
 */
export function bezugStimmt(gehoertZu: Pruefstand, sichtbar: Pruefstand): boolean {
  return gehoertZu.stelleId === sichtbar.stelleId && gehoertZu.fassung === sichtbar.fassung;
}

export const AUSKUNFTSHERKUENFTE = [
  "gespraech",
  "telefonat",
  "mail",
  "anzeige_neu",
  "eigene_recherche",
] as const;
export type Auskunftsherkunft = (typeof AUSKUNFTSHERKUENFTE)[number];

export const AUSKUNFTSTEXT: Record<Auskunftsherkunft, string> = {
  gespraech: "aus einem Gespräch",
  telefonat: "aus einem Telefonat",
  mail: "aus einer Mail",
  anzeige_neu: "aus der geänderten Anzeige",
  eigene_recherche: "selbst herausgefunden",
};

export interface Neuinformation {
  inhalt: string;
  herkunft: Auskunftsherkunft;
  am: Date;
  /** Die Bedingungen, die sie betrifft — nicht mehr. */
  betrifftSchluessel: readonly string[];
}

export interface Entscheidungsaenderung {
  vorherId: string;
  nachherId: string;
  /** Die Bedingungen, deren Befund sich geändert hat. */
  geaenderteSchluessel: readonly string[];
  /** Neue Ausschlüsse, die vorher keine waren. */
  neueAusschluesse: readonly string[];
  /**
   * Was unverändert gilt — auch das Gute.
   *
   * Ein kürzerer Arbeitsweg bleibt ein kürzerer Arbeitsweg. Ihn beim
   * Auftauchen eines Ausschlusses aus dem Ergebnis zu nehmen, wäre
   * dieselbe Verrechnung wie umgekehrt, nur in die andere Richtung.
   */
  unveraendert: readonly string[];
  herkunft: Auskunftsherkunft;
  am: Date;
  satz: string;
}

/**
 * Was eine neue Auskunft am gespeicherten Check ändert.
 *
 * Die Funktion vergleicht zwei Urteilslisten und beschreibt den
 * Unterschied. Sie erzeugt die Urteile nicht selbst — das bleibt bei
 * `bedingungBewerten`, damit es genau eine Stelle gibt, an der aus
 * einem Befund ein Ausschluss wird.
 */
export function entscheidungsaenderung(
  vorher: Pruefstand,
  nachher: Pruefstand,
  urteileVorher: readonly Bedingungsurteil[],
  urteileNachher: readonly Bedingungsurteil[],
  information: Neuinformation,
): Entscheidungsaenderung {
  const vorherNach = new Map(urteileVorher.map((u) => [u.bedingung.schluessel, u]));

  const geaenderteSchluessel: string[] = [];
  const neueAusschluesse: string[] = [];
  const unveraendert: string[] = [];

  for (const jetzt of urteileNachher) {
    const davor = vorherNach.get(jetzt.bedingung.schluessel);
    if (davor && davor.befund === jetzt.befund && davor.schliesstAus === jetzt.schliesstAus) {
      unveraendert.push(jetzt.bedingung.schluessel);
      continue;
    }
    geaenderteSchluessel.push(jetzt.bedingung.schluessel);
    if (jetzt.schliesstAus && !davor?.schliesstAus) neueAusschluesse.push(jetzt.bedingung.schluessel);
  }

  const satz =
    neueAusschluesse.length > 0
      ? `Nach deiner Rückmeldung ist eine Bedingung nicht erfüllt, die du als unverzichtbar bestätigt hast. ` +
        `Was sonst für die Stelle sprach, bleibt bestehen — es gleicht diesen Punkt aber nicht aus.`
      : geaenderteSchluessel.length > 0
        ? `Deine Rückmeldung ändert ${geaenderteSchluessel.length === 1 ? "einen Punkt" : `${geaenderteSchluessel.length} Punkte`}. Der Rest bleibt, wie er war.`
        : "Deine Rückmeldung ändert an der Einschätzung nichts.";

  return {
    vorherId: vorher.id,
    nachherId: nachher.id,
    geaenderteSchluessel,
    neueAusschluesse,
    unveraendert,
    herkunft: information.herkunft,
    am: information.am,
    satz,
  };
}
