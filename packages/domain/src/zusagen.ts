import { z } from "zod";

/**
 * Der Promise Lock: die Punkte, über die Arbeitgeber Zusagen machen.
 *
 * ── Warum eine feste Liste und kein Freitext ──────────────────
 *
 * Freitext lässt sich nicht auszählen. „Der Job war anders als
 * beschrieben" ist keine Auskunft; „zwei Homeoffice-Tage wurden
 * zugesagt, es ist einer" ist eine. Nur einzeln festgehaltene Punkte
 * lassen sich einzeln prüfen — und nur daraus entsteht eine Quote, die
 * über Arbeitgeber hinweg vergleichbar ist.
 *
 * ── Warum genau diese zwölf ───────────────────────────────────
 *
 * Es sind die Punkte, an denen Zusagen im Bewerbungsprozess gemacht
 * werden und an denen sie nach drei Monaten auffallen. Gehalt steht
 * dabei nicht vorn: Es steht meistens im Vertrag und wird selten
 * gebrochen. Die Aufgabenverteilung steht nirgends und geht ständig
 * auseinander.
 */

export const ZUSAGEPUNKTE = [
  "aufgaben",
  "arbeitszeit",
  "homeoffice",
  "einarbeitung",
  "vorgesetzter",
  "ziele_90",
  "entscheidungsfreiheit",
  "weiterbildung",
  "aufstieg",
  "reise_schicht",
  "ressourcen",
  "gehalt",
] as const;

export const ZusagepunktSchema = z.enum(ZUSAGEPUNKTE);
export type Zusagepunkt = z.infer<typeof ZusagepunktSchema>;

/** Was der Punkt meint — und die Frage, mit der er später geprüft wird. */
export const PUNKTTEXT: Record<Zusagepunkt, { titel: string; beispiel: string; pruefung: string }> = {
  aufgaben: {
    titel: "Hauptaufgaben und Zeitanteile",
    beispiel: "etwa 60 % Kundenberatung, 20 % Verwaltung, 20 % Neukunden",
    pruefung: "Machst du tatsächlich das, was zugesagt war — in diesen Anteilen?",
  },
  arbeitszeit: {
    titel: "Arbeitszeit und Überstunden",
    beispiel: "38 Stunden, Überstunden die Ausnahme",
    pruefung: "Stimmt die Arbeitszeit? Werden regelmässig Überstunden erwartet?",
  },
  homeoffice: {
    titel: "Homeoffice",
    beispiel: "zwei Tage je Woche nach dem ersten Monat",
    pruefung: "Kannst du im zugesagten Umfang von zu Hause arbeiten?",
  },
  einarbeitung: {
    titel: "Einarbeitung",
    beispiel: "vier Wochen mit fester Ansprechperson",
    pruefung: "Findet die Einarbeitung so statt, wie sie beschrieben wurde?",
  },
  vorgesetzter: {
    titel: "Wer dein Vorgesetzter ist",
    beispiel: "direkt an die Teamleitung, nicht an die Bereichsleitung",
    pruefung: "Berichtest du an die Person, die genannt wurde?",
  },
  ziele_90: {
    titel: "Ziele der ersten 90 Tage",
    beispiel: "eigenständige Betreuung von zehn Bestandskunden",
    pruefung: "Sind die Ziele die, die genannt wurden — und sind sie erreichbar?",
  },
  entscheidungsfreiheit: {
    titel: "Was du selbst entscheiden darfst",
    beispiel: "Angebote bis 5.000 € ohne Rücksprache",
    pruefung: "Darfst du entscheiden, was dir zugesagt wurde?",
  },
  weiterbildung: {
    titel: "Weiterbildung",
    beispiel: "fünf Tage im Jahr, Budget 2.000 €",
    pruefung: "Steht die zugesagte Weiterbildung tatsächlich zur Verfügung?",
  },
  aufstieg: {
    titel: "Entwicklungsmöglichkeiten",
    beispiel: "Teamleitung nach zwei Jahren realistisch",
    pruefung: "Ist die genannte Entwicklung noch in Sicht?",
  },
  reise_schicht: {
    titel: "Reisen, Schicht, Wochenende",
    beispiel: "höchstens zwei Reisetage im Monat, keine Wochenenden",
    pruefung: "Stimmt der Umfang von Reisen, Schichten und Wochenendarbeit?",
  },
  ressourcen: {
    titel: "Ausstattung und Unterstützung",
    beispiel: "eigenes Gerät ab Tag eins, Werkstudent zur Unterstützung",
    pruefung: "Hast du bekommen, was zugesagt war?",
  },
  gehalt: {
    titel: "Gehalt und Entwicklung",
    beispiel: "54.000 € plus Bonus, Überprüfung nach zwölf Monaten",
    pruefung: "Wurde ausgezahlt und zugesagt, was vereinbart war?",
  },
};

export const ZusagenherkunftSchema = z.enum(["anzeige", "gespraech", "vertrag", "arbeitgeber_bestaetigt"]);
export type Zusagenherkunft = z.infer<typeof ZusagenherkunftSchema>;

/**
 * Wie schwer eine Herkunft wiegt.
 *
 * ── Warum die Anzeige am wenigsten zählt ──────────────────────
 *
 * Was in einer Stellenanzeige steht, ist eine Werbeaussage — verfasst,
 * bevor jemand den Bewerber kannte. Was der Arbeitgeber auf eine
 * konkrete Nachfrage bestätigt hat, ist eine Zusage an diese Person.
 *
 * Der Unterschied gehört in den Score: Ein Unternehmen, dessen Anzeige
 * übertreibt, ist etwas anderes als eines, das im Gespräch etwas
 * zusagt und es nicht hält.
 */
export const HERKUNFTSGEWICHT: Record<Zusagenherkunft, number> = {
  arbeitgeber_bestaetigt: 1.0,
  vertrag: 1.0,
  gespraech: 0.7,
  anzeige: 0.4,
};

export const ZusagenstandSchema = z.enum(["gehalten", "teilweise", "gebrochen", "zu_frueh"]);
export type Zusagenstand = z.infer<typeof ZusagenstandSchema>;

export const STANDTEXT: Record<Zusagenstand, string> = {
  gehalten: "stimmt",
  teilweise: "teilweise",
  gebrochen: "stimmt nicht",
  zu_frueh: "zu früh, um es zu sagen",
};

export interface Zusagenpruefung {
  punkt: Zusagepunkt;
  herkunft: Zusagenherkunft;
  stand: Zusagenstand;
}

export interface PromiseKept {
  /** 0 bis 1, gewichtet nach Herkunft. `null` unter der Schwelle. */
  quote: number | null;
  /** Wie viele Zusagen beurteilt wurden. `zu_frueh` zählt nicht mit. */
  beurteilt: number;
  gehalten: number;
  teilweise: number;
  gebrochen: number;
  /** Wie viele noch nicht beurteilbar waren. */
  zuFrueh: number;
}

/**
 * Ab wann eine Quote etwas sagt.
 *
 * Bei drei geprüften Zusagen springt sie um 33 Prozentpunkte, sobald
 * eine anders ausgeht. Acht ist die Grenze, ab der ein Einzelfall die
 * Aussage nicht mehr umwirft.
 */
export const MIN_ZUSAGEN_FUER_QUOTE = 8;

/**
 * Der Promise-Kept-Score.
 *
 * ── Warum `teilweise` halb zählt ──────────────────────────────
 *
 * „Zwei Homeoffice-Tage zugesagt, einer bekommen" ist kein Bruch und
 * keine Einhaltung. Es als Bruch zu zählen überzeichnete; es als
 * gehalten zu zählen verschwiege den Unterschied.
 *
 * ── Warum `zu_frueh` gar nicht zählt ──────────────────────────
 *
 * Es ist keine Beurteilung, sondern ihr Fehlen. Eine Zusage, die nach
 * vierzehn Tagen noch nicht fällig war, sagt über den Arbeitgeber
 * nichts — weder Gutes noch Schlechtes.
 */
export function promiseKept(pruefungen: readonly Zusagenpruefung[]): PromiseKept {
  const beurteilbar = pruefungen.filter((p) => p.stand !== "zu_frueh");
  const zaehle = (s: Zusagenstand) => pruefungen.filter((p) => p.stand === s).length;

  let summe = 0;
  let gewicht = 0;
  for (const p of beurteilbar) {
    const g = HERKUNFTSGEWICHT[p.herkunft];
    summe += (p.stand === "gehalten" ? 1 : p.stand === "teilweise" ? 0.5 : 0) * g;
    gewicht += g;
  }

  return {
    quote: beurteilbar.length >= MIN_ZUSAGEN_FUER_QUOTE && gewicht > 0 ? summe / gewicht : null,
    beurteilt: beurteilbar.length,
    gehalten: zaehle("gehalten"),
    teilweise: zaehle("teilweise"),
    gebrochen: zaehle("gebrochen"),
    zuFrueh: zaehle("zu_frueh"),
  };
}
