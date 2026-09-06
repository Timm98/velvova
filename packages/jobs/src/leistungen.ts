/**
 * Welche Leistungen eine Anzeige tatsächlich nennt.
 *
 * ── Warum aus dem Text und nicht aus einem Feld ───────────────
 *
 * Das Feld `benefits` gibt es seit Beginn. Gemessen am 1.9.2026: **0 von
 * 1.500 Stellen** hatten einen Eintrag. Genau ein Anbieter liefert
 * überhaupt ein Benefits-Feld, und der deutsche Markt — Bundesagentur,
 * Arbeitnow, TheirStack — nennt Leistungen im Fliesstext.
 *
 * Im Text stehen sie sehr wohl: 40,4 % der Anzeigen nennen mindestens
 * eine. Homeoffice in 32,9 %, Weiterbildung in 28,9 %, betriebliche
 * Altersvorsorge in 16,9 %. Diese Angaben lagen also die ganze Zeit vor
 * und wurden weggeworfen.
 *
 * ── Warum Muster und kein Modell ──────────────────────────────
 *
 * Ob „Jobticket" im Text steht, ist eine Tatsache. Ein Modell würde
 * gelegentlich eine Leistung erkennen, die dort nicht steht — und eine
 * erfundene Leistung ist schlimmer als eine übersehene: Sie fliesst in
 * einen Vergleich ein, und im Gespräch stellt sich heraus, dass es sie
 * nie gab.
 *
 * ── Der Beleg gehört dazu ─────────────────────────────────────
 *
 * Zu jeder erkannten Leistung wird die Textstelle mitgeliefert, aus der
 * sie stammt. Ohne Beleg ist „Altersvorsorge" eine Behauptung des
 * Produkts über den Arbeitgeber; mit Beleg ist es ein Zitat.
 *
 * ── Verneinungen ──────────────────────────────────────────────
 *
 * „Kein Homeoffice möglich" enthält das Wort und meint das Gegenteil.
 * Der Satz um den Treffer herum wird deshalb auf Verneinungen geprüft.
 * Das fängt nicht jede Formulierung, aber die häufigen — und im
 * Zweifel wird NICHT erkannt.
 */

export type Leistungsart =
  | "homeoffice"
  | "mobilitaet"
  | "firmenwagen"
  | "altersvorsorge"
  | "urlaub"
  | "weiterbildung"
  | "verpflegung"
  | "gesundheit"
  | "kinderbetreuung"
  | "arbeitszeit"
  | "sonderzahlung"
  | "rabatte";

export interface Leistung {
  art: Leistungsart;
  /** Der Name, wie er in der Oberfläche steht. */
  label: string;
  /** Die Textstelle, aus der die Leistung stammt. */
  beleg: string;
  /**
   * Die konkrete Zahl, wenn der Text eine nennt — etwa 30 Urlaubstage.
   *
   * `null` heisst: Die Leistung ist genannt, aber nicht beziffert. Das
   * ist der Normalfall und keine Lücke im Sinne eines Fehlers.
   */
  wert: number | null;
}

const MUSTER: { art: Leistungsart; label: string; muster: RegExp }[] = [
  {
    art: "homeoffice",
    label: "Homeoffice",
    muster: /\b(home[\s-]?office|mobiles?\s+arbeiten|remote(?:\s*arbeit)?|telearbeit)\b/i,
  },
  {
    art: "mobilitaet",
    label: "Mobilität",
    muster:
      /\b(job[\s-]?ticket|deutschland[\s-]?ticket|job[\s-]?rad|dienst[\s-]?rad|fahrtkostenzuschuss|fahrkostenzuschuss|jobbike)\b/i,
  },
  { art: "firmenwagen", label: "Firmenwagen", muster: /\b(firmen(?:wagen|pkw)|dienstwagen)\b/i },
  {
    art: "altersvorsorge",
    label: "Altersvorsorge",
    muster:
      /\b(betriebliche\s+altersvorsorge|altersvorsorge|betriebsrente|vermögenswirksame\s+leistungen|\bbav\b)/i,
  },
  {
    art: "urlaub",
    label: "Urlaub",
    muster: /\b(\d{2})\s*(?:tage?n?\s+urlaub|urlaubstage)|urlaubstage|urlaubsanspruch/i,
  },
  {
    art: "weiterbildung",
    label: "Weiterbildung",
    /*
     * „Weiterentwicklung" nur mit Bezug auf die Person.
     *
     * Gemessen an den echten Anzeigen war das Wort allein zu weit: Es
     * traf „die Weiterentwicklung unserer Technologie-Sparte" — ein
     * Satz über das Produkt, der als Leistung für den Bewerber gezählt
     * wurde. Genau die Sorte Treffer, die eine Anzeige besser aussehen
     * lässt, als sie ist.
     */
    muster:
      /\b(weiterbildung|fortbildung|schulungen|entwicklungsmöglichkeiten|(?:deine[rn]?|ihre[rn]?|persönliche[rn]?|fachliche[rn]?|berufliche[rn]?)\s+weiterentwicklung)\b/i,
  },
  {
    art: "verpflegung",
    label: "Verpflegung",
    muster: /\b(essenszuschuss|kantine|essensgeld|verpflegungszuschuss|obst\s+und\s+getränke)\b/i,
  },
  {
    art: "gesundheit",
    label: "Gesundheit & Sport",
    muster:
      /\b(urban\s*sports|egym|wellpass|fitnessstudio|betriebliche\s+gesundheit|gesundheitsförderung|gesundheitsangebote)\b/i,
  },
  {
    art: "kinderbetreuung",
    label: "Kinderbetreuung",
    muster: /\b(kinderbetreuung|kita[\s-]?zuschuss|betriebskindergarten|betriebskita)\b/i,
  },
  {
    art: "arbeitszeit",
    label: "Flexible Arbeitszeit",
    muster: /\b(gleitzeit|flexible\s+arbeitszeit(?:en)?|vertrauensarbeitszeit|arbeitszeitkonto)\b/i,
  },
  {
    art: "sonderzahlung",
    label: "Sonderzahlung",
    muster:
      /\b(weihnachtsgeld|urlaubsgeld|13\.\s*(?:monats)?gehalt|erfolgsbeteiligung|gewinnbeteiligung|prämien?zahlung)\b/i,
  },
  {
    art: "rabatte",
    label: "Mitarbeiterrabatte",
    muster: /\b(mitarbeiter(?:rabatt|vorteil)e?|corporate\s+benefits|personalrabatt)\b/i,
  },
];

/*
 * Verneinungen im selben Satz.
 *
 * „Homeoffice ist leider nicht möglich" nennt das Wort und meint das
 * Gegenteil. Wer solche Sätze als Leistung zählt, schreibt einem
 * Arbeitgeber etwas gut, das er ausdrücklich ausgeschlossen hat.
 */
const VERNEINT =
  /\b(kein|keine|keinen|keinerlei|nicht\s+möglich|nicht\s+angeboten|ohne\s+(?:die\s+)?möglichkeit|leider\s+nicht|ausgeschlossen)\b/i;

/**
 * Die Leistungen einer Stellenbeschreibung, mit Beleg.
 *
 * Reihenfolge wie in `MUSTER` — also stabil und nicht abhängig davon,
 * wo im Text etwas steht. Zwei Anzeigen mit denselben Leistungen
 * ergeben dieselbe Liste.
 */
export function leistungenAusText(text: string | null | undefined): Leistung[] {
  if (!text || text.trim().length === 0) return [];
  const saetze = zerlegen(text);
  const raus: Leistung[] = [];

  for (const { art, label, muster } of MUSTER) {
    for (const satz of saetze) {
      const treffer = muster.exec(satz);
      if (!treffer) continue;
      if (VERNEINT.test(satz)) {
        /*
         * Im Zweifel nicht erkennen.
         *
         * Ein Satz wie „kein Firmenwagen, dafür ein Jobticket" verliert
         * hier auch das Jobticket. Das ist der gewollte Ausgang: Eine
         * übersehene Leistung kostet nichts, eine erfundene kostet
         * Vertrauen — und zwar im Gespräch, vor dem Arbeitgeber.
         */
        continue;
      }
      raus.push({ art, label, beleg: kuerzen(satz), wert: zahlAus(art, treffer) });
      break;
    }
  }
  return raus;
}

/** Nur die Namen — für das `benefits`-Feld der Stelle. */
export function leistungsnamen(text: string | null | undefined): string[] {
  return leistungenAusText(text).map((l) => l.label);
}

/*
 * Sätze statt des ganzen Textes.
 *
 * Eine Verneinung drei Absätze weiter hat mit dem Treffer nichts zu
 * tun. Der Satz ist die kleinste Einheit, in der „kein" und
 * „Homeoffice" tatsächlich zusammengehören.
 *
 * Aufzählungszeichen zählen als Satzgrenze: In Stellenanzeigen stehen
 * Leistungen fast immer als Liste, oft ganz ohne Punkt.
 */
function zerlegen(text: string): string[] {
  return text
    .split(/(?<=[.!?;:])\s+|\n+|•|•|▪|\s[-–—]\s/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/*
 * Der Beleg wird als Zitat gezeigt — also muss er wie eines aussehen.
 *
 * An echten Anzeigen gemessen kam heraus: „- Betriebliche
 * Altersvorsorge" und „✅ Lernen & Weiterbildung". Das Aufzählungszeichen
 * und das Emoji gehören zur Formatierung der Anzeige, nicht zur Aussage
 * — in Anführungszeichen gesetzt sehen sie nach einem Lesefehler aus
 * und beschädigen genau das Vertrauen, das der Beleg herstellen soll.
 *
 * Entfernt wird nur, was VORNE steht und kein Buchstabe, keine Ziffer
 * und keine öffnende Klammer ist. Innerhalb des Satzes bleibt alles
 * stehen: Ein Gedankenstrich mitten in einer Aussage trägt Bedeutung.
 */
function kuerzen(satz: string): string {
  const sauber = satz
    .replace(/\s+/g, " ")
    .replace(/^[^\p{L}\p{N}(„"']+/u, "")
    .trim();
  return sauber.length <= 160 ? sauber : `${sauber.slice(0, 157)}…`;
}

/**
 * Die Zahl im Treffer, sofern das Muster eine erfasst.
 *
 * Nur bei Urlaubstagen, und nur in einem plausiblen Bereich: „20 Tage
 * Urlaub" ist der gesetzliche Mindestanspruch bei Fünftagewoche, mehr
 * als 40 gibt es praktisch nicht. Ausserhalb wird die Zahl verworfen —
 * eine falsche Zahl wäre schlimmer als gar keine.
 */
function zahlAus(art: Leistungsart, treffer: RegExpExecArray): number | null {
  if (art !== "urlaub") return null;
  const n = Number(treffer[1]);
  if (!Number.isFinite(n) || n < 20 || n > 40) return null;
  return n;
}
