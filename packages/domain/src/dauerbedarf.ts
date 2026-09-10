/**
 * ══════════════════════════════════════════════════════════════════
 * Wann eine Anzeigenreihe echten Bedarf bedeutet
 * ══════════════════════════════════════════════════════════════════
 *
 * Die naheliegende Rechnung — „wer oft ausschreibt, braucht dauerhaft
 * jemanden" — ist gemessen falsch. Am 10.09.2026 ergab die Auszählung
 * über 928.242 deutsche Anzeigen mit Berufskennung an der Spitze:
 *
 *   Netto Marken-Discount   9.140 Anzeigen   Verkauf
 *   Lidl Dienstleistung     7.317            Verkauf
 *   Randstad Deutschland    3.840            Lager
 *   TimePartner             3.174            Lager
 *
 * In jeder Zeile war die Zahl der Anzeigen gleich der Zahl der
 * Stellen: getrennte Anzeigen je Filiale, keine Wiederausschreibung.
 * Zwei Filialnetze und zwei Zeitarbeitsfirmen — und nicht ein einziger
 * Betrieb, den anzusprechen sich gelohnt hätte.
 *
 * Diese Datei ist der Filter, der das trennt. Sie steht im
 * Domänenpaket und nicht in einem Prompt, weil ein Modell, das 9.140
 * Anzeigen sieht, „offensichtlich hoher Bedarf" antworten wird.
 *
 * ── Die drei Unterscheidungen ───────────────────────────────────
 *
 *   Der Ort      Ein Filialnetz schreibt dieselbe Rolle an hundert
 *                Orten aus. Echter Bedarf entsteht an EINEM Ort,
 *                immer wieder.
 *   Die Lücke    Eine Stelle, die verschwindet und wiederkommt, wurde
 *                besetzt und wurde wieder frei. Das ist Fluktuation —
 *                auch ein Bedarf, aber ein anderer.
 *   Die Dauer    Eine Stelle, die nie verschwindet, wird nicht
 *                besetzt. Gemessen gegen die übliche Standzeit ihres
 *                Berufs, nicht gegen eine feste Zahl: In der
 *                Informatik sind 25 Tage der Median, im Hoch- und
 *                Tiefbau 108.
 *
 * ── Warum die Zeit die härteste Grenze ist ──────────────────────
 *
 * Nichts davon lässt sich aus einer Momentaufnahme lesen. Unter
 * `MINDESTBEOBACHTUNG_TAGE` gibt es genau eine erlaubte Antwort, und
 * die lautet „zu früh" — nicht „unklar", nicht „vermutlich". Am
 * 10.09.2026 reichte die eigene Beobachtung elf Tage zurück.
 */

/** Darunter wird nichts eingestuft. Drei Monate sind eine Probezeit. */
export const MINDESTBEOBACHTUNG_TAGE = 90;

/**
 * Ab so vielen Orten ist es ein Filialnetz.
 *
 * Zehn, weil ein Handwerksbetrieb mit drei Standorten kein Filialnetz
 * ist und ein Discounter mit zehn Filialen in einer Region schon.
 */
export const FILIALGRENZE = 10;

/**
 * Firmen, deren Geschäft das Ausschreiben ist.
 *
 * Zeitarbeit und Personalvermittlung schreiben dauerhaft aus, ohne
 * dauerhaften eigenen Bedarf zu haben — sie besetzen für andere. Eine
 * Ansprache „Sie suchen oft Lagerkräfte" wäre bei ihnen keine
 * Beobachtung, sondern eine Beschreibung ihres Geschäftsmodells.
 *
 * Namensmuster sind ein grobes Werkzeug und fangen nicht alles. Sie
 * fangen aber die vier grössten Fälle im Bestand, und ein Fehler in
 * dieser Richtung kostet eine Ansprache, kein Vertrauen.
 */
export const ZEITARBEIT_MUSTER: readonly RegExp[] = [
  /\bzeitarbeit\b/i,
  /\bpersonaldienst/i,
  /\bpersonalservice\b/i,
  /\bpersonalmanagement\b/i,
  /\bpersonalvermittlung\b/i,
  /\barbeitnehmer[üu]berlassung\b/i,
  /\bleiharbeit\b/i,
  /\brandstad\b/i,
  /\badecco\b/i,
  /\bmanpower\b/i,
  /\bhays\b/i,
  /\btimepartner\b/i,
  /\bpiening\b/i,
  /\borizon\b/i,
  /\bakkodis\b/i,
  /\bgulp\b/i,
  /\btempton\b/i,
];

export function istZeitarbeit(name: string): boolean {
  return ZEITARBEIT_MUSTER.some((m) => m.test(name));
}

/**
 * Was der Schnappschuss über ein Paar aus Arbeitgeber, Beruf und Ort
 * hergibt.
 *
 * Heisst `Anzeigenreihe` und nicht `Beobachtung`: Der kürzere Name ist
 * im Domänenpaket schon vergeben (`verfuegbarkeit.ts`), und zwei
 * gleichnamige Typen nebeneinander wären genau die Art Mehrdeutigkeit,
 * die man beim Lesen nicht bemerkt.
 */
export interface Anzeigenreihe {
  arbeitgeber: string;
  /** Wie viele Tage lang überhaupt beobachtet wurde. */
  beobachtungTage: number;
  /** An wie vielen davon mindestens eine Stelle offen stand. */
  tageMitAnzeige: number;
  /**
   * Wie oft die Reihe abriss und wieder begann.
   *
   * Eine Lücke heisst: besetzt, und danach wieder frei.
   */
  luecken: number;
  /** An wie vielen Orten dieser Arbeitgeber diesen Beruf ausschreibt. */
  orteDesArbeitgebers: number;
  /** Die übliche Standzeit dieses Berufs (P90), aus `standzeit_referenz`. */
  ueblichP90Tage: number | null;
}

export type Einstufung =
  /** Zu wenig Beobachtung. Die einzige erlaubte Antwort am Anfang. */
  | "zu_frueh"
  /** Das Geschäftsmodell ist das Ausschreiben. */
  | "zeitarbeit"
  /** Dieselbe Rolle an vielen Orten — kein Bedarf an einem. */
  | "filialnetz"
  /** Wurde besetzt und wurde wieder frei. */
  | "wiederkehrer"
  /** Steht länger offen als üblich — wird nicht besetzt. */
  | "dauerlaeufer"
  /** Einmal ausgeschrieben, normal besetzt. Kein Anlass. */
  | "einmalig";

export interface Bedarfsbefund {
  einstufung: Einstufung;
  /** Woran es liegt. Immer aus Zahlen, nie aus Eindruck. */
  belege: string[];
  /** Ob eine Ansprache überhaupt sinnvoll wäre. */
  ansprechbar: boolean;
}

/**
 * Die Einstufung.
 *
 * ── Die Reihenfolge ist die Rangfolge ───────────────────────────
 *
 * Zeit vor allem: Ohne Beobachtung gibt es nichts zu sagen. Dann das
 * Geschäftsmodell, dann der Ort — beides schliesst aus, egal wie hoch
 * die Zahlen sind. Erst danach die eigentliche Frage.
 */
export function einstufen(b: Anzeigenreihe): Bedarfsbefund {
  if (b.beobachtungTage < MINDESTBEOBACHTUNG_TAGE) {
    return {
      einstufung: "zu_frueh",
      belege: [
        `Erst ${b.beobachtungTage} von ${MINDESTBEOBACHTUNG_TAGE} Tagen beobachtet`,
      ],
      ansprechbar: false,
    };
  }

  if (istZeitarbeit(b.arbeitgeber)) {
    return {
      einstufung: "zeitarbeit",
      belege: ["Der Name weist auf Personaldienstleistung hin"],
      ansprechbar: false,
    };
  }

  if (b.orteDesArbeitgebers >= FILIALGRENZE) {
    return {
      einstufung: "filialnetz",
      belege: [
        `Dieselbe Rolle an ${b.orteDesArbeitgebers} Orten — kein Bedarf an einem einzelnen`,
      ],
      ansprechbar: false,
    };
  }

  if (b.luecken > 0) {
    return {
      einstufung: "wiederkehrer",
      belege: [
        `${b.luecken}× besetzt und wieder frei geworden`,
        `An ${b.tageMitAnzeige} von ${b.beobachtungTage} beobachteten Tagen ausgeschrieben`,
      ],
      ansprechbar: true,
    };
  }

  /*
   * Gegen die übliche Standzeit des Berufs, nicht gegen eine feste
   * Zahl. Eine absolute Grenze würde jede Baustelle melden und jede
   * IT-Stelle durchlassen — dieselbe Überlegung wie in
   * `standzeit_referenz`.
   *
   * Ohne Referenz wird nichts behauptet.
   */
  if (b.ueblichP90Tage !== null && b.tageMitAnzeige > b.ueblichP90Tage) {
    return {
      einstufung: "dauerlaeufer",
      belege: [
        `Seit ${b.tageMitAnzeige} Tagen durchgehend offen`,
        `Üblich für diesen Beruf sind höchstens ${Math.round(b.ueblichP90Tage)} Tage`,
      ],
      ansprechbar: true,
    };
  }

  return { einstufung: "einmalig", belege: [], ansprechbar: false };
}

/**
 * Wie eine Ansprache klingen müsste.
 *
 * Der Unterschied ist nicht kosmetisch. Wer eine Stelle nicht besetzt
 * bekommt, hat ein Angebotsproblem. Wer sie dreimal besetzt hat und
 * dreimal verloren, hat ein Bindungsproblem — und einem Betrieb mit
 * Bindungsproblem „wir haben viele Kandidaten" zu schreiben, geht an
 * seiner Lage vorbei.
 */
export function ton(einstufung: Einstufung): "angebot" | "bindung" | null {
  if (einstufung === "dauerlaeufer") return "angebot";
  if (einstufung === "wiederkehrer") return "bindung";
  return null;
}
