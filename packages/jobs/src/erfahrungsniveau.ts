/**
 * Das Erfahrungsniveau aus dem Text der Anzeige.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das nötig ist
 * ══════════════════════════════════════════════════════════════
 *
 * Die Bewertung hat einen Faktor `growth` mit 15 % Gewicht, der auf
 * `jobs.experience_level` beruht. Gemessen an den 5.000 neuesten
 * deutschen Anzeigen füllen ihn **67** — also 1,3 %.
 *
 * Der Faktor ist damit praktisch immer unbekannt. Das zieht die Zahl
 * zwar nicht nach unten (`weightedScore` verteilt unbekannte Gewichte
 * um), senkt aber die Deckung — und eine niedrige Deckung ist genau
 * der Grund, aus dem gar keine Passung berechnet wird.
 *
 * Das Niveau steht fast immer im Text. Es zu lesen ist billiger als
 * darauf zu warten, dass Quellen ein Feld füllen, das sie seit Jahren
 * nicht füllen.
 *
 * ══════════════════════════════════════════════════════════════
 * Was diese Datei NICHT tut
 * ══════════════════════════════════════════════════════════════
 *
 * Raten. Findet sie kein Signal, gibt sie `null` zurück — und dann
 * bleibt der Faktor unbekannt wie bisher. Ein geratenes „mid" wäre
 * schlimmer als gar nichts: Es sähe aus wie eine Angabe des
 * Arbeitgebers und wäre eine Vermutung von uns.
 */

export type Erfahrungsniveau = "entry" | "junior" | "mid" | "senior" | "lead";

/**
 * Die Muster, von spezifisch nach allgemein.
 *
 * Die Reihenfolge entscheidet: „Senior Teamleiter" enthält beides,
 * und `lead` ist die stärkere Aussage. Wer die Reihenfolge ändert,
 * ändert die Einstufung solcher Titel.
 */
const MUSTER: readonly [Erfahrungsniveau, RegExp][] = [
  [
    "lead",
    /\b(teamleit|abteilungsleit|bereichsleit|führungskraft|fuehrungskraft|head of|leitung|leiter(in)?\b|principal|staff engineer|führungsverantwortung|fuehrungsverantwortung)/i,
  ],
  [
    "senior",
    /\b(senior|sr\.|erfahrene[rn]?\b|mehrjährige|mehrjaehrige|langjährige|langjaehrige|expert|spezialist)/i,
  ],
  [
    "entry",
    /\b(berufseinsteiger|einsteiger|absolvent|trainee|quereinsteiger|ohne (vorkenntnisse|berufserfahrung)|keine (vorkenntnisse|berufserfahrung)|erste berufserfahrung nicht)/i,
  ],
  ["junior", /\b(junior|jr\.|nachwuchs|einstiegsposition)/i],
];

/**
 * Geforderte Berufsjahre — der verlässlichste Hinweis.
 *
 * Eine Zahl im Text schlägt jedes Schlagwort: „Junior" ist eine
 * Rollenbezeichnung und sagt je nach Haus etwas anderes, „mindestens
 * 5 Jahre Berufserfahrung" ist eine Bedingung.
 */
const JAHRE =
  /(?:mind(?:estens)?\.?\s*|ab\s+|)(\d{1,2})\s*(?:\+\s*)?(?:jahre?n?)\s+(?:einschlägige[rn]?\s+|relevante[rn]?\s+|)(?:berufs)?erfahrung/i;

/**
 * Das Niveau aus Titel und Beschreibung lesen.
 *
 * Der Titel wiegt schwerer: Er ist die Bezeichnung, auf die sich der
 * Arbeitgeber festgelegt hat. Im Fliesstext kann „Senior" auch das
 * Team beschreiben, in das man kommt.
 */
export function erfahrungsniveauAusText(
  titel: string,
  beschreibung: string | null,
): Erfahrungsniveau | null {
  for (const [niveau, muster] of MUSTER) {
    if (muster.test(titel)) return niveau;
  }

  if (!beschreibung) return null;

  /*
   * Berufsjahre vor Schlagworten.
   *
   * Die Schwellen folgen dem, was die Wörter üblicherweise meinen:
   * bis zwei Jahre Einstieg, bis fünf Mitte, darüber Senior. Sie sind
   * eine Konvention, keine Messung — deshalb stehen sie hier sichtbar
   * und nicht verstreut in Bedingungen.
   */
  const jahre = JAHRE.exec(beschreibung);
  if (jahre) {
    const n = Number(jahre[1]);
    if (n >= 5) return "senior";
    if (n >= 3) return "mid";
    if (n >= 1) return "junior";
    return "entry";
  }

  for (const [niveau, muster] of MUSTER) {
    if (muster.test(beschreibung)) return niveau;
  }

  return null;
}
