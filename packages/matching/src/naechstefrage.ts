import { traegtEntscheidung, wirksameKonfidenz, type Beleg } from "./erkenntnis.ts";

/**
 * Die eine Frage, die am meisten bringt.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum nicht alle Lücken auf einmal
 * ══════════════════════════════════════════════════════════════
 *
 * Fünfzehn Fragen sind ein Formular, und Formulare werden
 * abgebrochen. Eine Frage ist ein Gespräch.
 *
 * Und sie muss die richtige sein: Wer nach der Lieblingsfarbe des
 * Büros fragt, während unbekannt ist, ob jemand pendeln kann, hat
 * eine Frage verbraucht und nichts gewonnen.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das ohne Modell geht
 * ══════════════════════════════════════════════════════════════
 *
 * Weil die Frage nicht lautet „was wäre interessant zu wissen",
 * sondern „welche Angabe fehlt, die eine Entscheidung trägt". Das
 * ist eine Rechnung: Welche Felder sind für den Abgleich nötig,
 * welche davon sind belegt, und welches der unbelegten wiegt am
 * schwersten.
 */

/**
 * Was Monday über einen Menschen wissen muss, um etwas Nützliches zu
 * sagen — und wie schwer jede Lücke wiegt.
 *
 * ── Warum diese Reihenfolge ───────────────────────────────────
 *
 * Nach dem, was eine Suche unbrauchbar macht, wenn es fehlt. Ohne
 * Ort und Gehaltsuntergrenze ist jede Trefferliste Zufall. Ohne
 * Führungsinteresse ist sie ungenau. Der Unterschied ist gross
 * genug, um die Reihenfolge zu bestimmen.
 */
export const WISSENSFELDER = [
  {
    schluessel: "arbeitsort",
    gewicht: 10,
    frage: "Wo soll die Arbeit sein — und wie weit würdest du fahren?",
    erkennt: /\b(ort|stadt|umkreis|pendeln|arbeitsweg|wohn|umzug|remote|homeoffice)\b/i,
  },
  {
    schluessel: "gehalt",
    gewicht: 9,
    frage: "Was musst du mindestens verdienen, damit es sich für dich rechnet?",
    erkennt: /\b(gehalt|verdien|euro|brutto|netto|lohn|bezahl)\b/i,
  },
  {
    schluessel: "taetigkeit",
    gewicht: 9,
    frage: "Was möchtest du eigentlich tun — welche Art von Arbeit?",
    /*
     * Die Beugung mitfassen.
     *
     * Die erste Fassung stand bei „arbeiten als". „Ich möchte im
     * Lager arbeiten" fiel durch — und Monday hätte nach der Tätigkeit
     * gefragt, die gerade genannt worden war.
     */
    erkennt: /\b(tätigkeit|beruf|branche|bereich|arbeiten (als|in|im|bei)|(stelle|job) als|möchte[^.]{0,40}arbeiten)\b/i,
  },
  {
    schluessel: "erfahrung",
    gewicht: 8,
    frage: "Was hast du bisher gemacht? Erzähl mir von deiner letzten Stelle.",
    erkennt: /\b(erfahrung|jahre|gearbeitet|tätig|beschäftigt|ausbildung|studium|gelernt)\b/i,
  },
  {
    schluessel: "arbeitszeit",
    gewicht: 6,
    frage: "Wie soll deine Arbeitszeit aussehen — Vollzeit, Teilzeit, feste Zeiten?",
    erkennt: /\b(vollzeit|teilzeit|stunden|schicht|arbeitszeit|wochenende|nacht)\b/i,
  },
  {
    schluessel: "fuehrung",
    gewicht: 5,
    frage: "Möchtest du Verantwortung für ein Team, oder lieber nicht?",
    /* Auch die Verneinung ist eine Antwort: „keine Führungsverantwortung"
       beantwortet die Frage nach dem Führungsinteresse. */
    erkennt: /\b(führung|führungs\w*|leitung|team|verantwortung|vorgesetzt|mitarbeiter führen)\b/i,
  },
  {
    schluessel: "belastung",
    gewicht: 5,
    frage: "Wie viel Druck verträgst du gut — und wo wird es dir zu viel?",
    erkennt: /\b(stress|druck|belastung|ruhig|hektisch|tempo|work.?life)\b/i,
  },
  {
    schluessel: "entwicklung",
    gewicht: 4,
    frage: "Wo möchtest du in ein paar Jahren stehen?",
    erkennt: /\b(entwickl\w*|zukunft|weiterbild\w*|lernen|aufstieg|karriere\w*|in \w+ jahren)\b/i,
  },
] as const;

export type Wissensschluessel = (typeof WISSENSFELDER)[number]["schluessel"];

export interface Wissenslage {
  schluessel: Wissensschluessel;
  /** Ob es dazu einen Beleg gibt, der eine Entscheidung tragen darf. */
  belegt: boolean;
  /** Die stärkste Konfidenz, die dazu vorliegt. */
  staerke: number;
  gewicht: number;
}

export interface Belegtext extends Beleg {
  text: string;
}

/**
 * Welche Felder belegt sind und welche nicht.
 *
 * ── Warum ein schwacher Beleg nicht als belegt zählt ──────────
 *
 * „Vermutlich möchte sie in die Nähe" ist keine Antwort auf die
 * Frage nach dem Arbeitsort. Wer sie als Antwort zählt, fragt nie
 * nach — und rechnet dauerhaft mit einer Vermutung.
 */
export function wissenslage(belege: readonly Belegtext[]): Wissenslage[] {
  return WISSENSFELDER.map((feld) => {
    const passend = belege.filter((b) => feld.erkennt.test(b.text));
    const staerke = passend.reduce((m, b) => Math.max(m, wirksameKonfidenz(b)), 0);
    return {
      schluessel: feld.schluessel,
      belegt: passend.some((b) => traegtEntscheidung(b)),
      staerke,
      gewicht: feld.gewicht,
    };
  });
}

export interface Naechstefrage {
  schluessel: Wissensschluessel;
  frage: string;
  /** Warum gerade diese — für das Protokoll. */
  grund: string;
}

/**
 * Die nächste Frage — oder keine.
 *
 * `null` heisst: Es ist genug bekannt. Das ist ein gültiges Ergebnis;
 * eine Assistentin, die immer noch eine Frage hat, ist ein Formular
 * mit Gesprächsanstrich.
 */
export function naechsteFrage(
  belege: readonly Belegtext[],
  /** Felder, die schon gefragt wurden und unbeantwortet blieben. */
  bereitsGefragt: readonly string[] = [],
): Naechstefrage | null {
  const lage = wissenslage(belege);

  const offen = lage
    .filter((l) => !l.belegt && !bereitsGefragt.includes(l.schluessel))
    /*
     * Nach Gewicht, bei Gleichstand nach vorhandener Stärke: Ein Feld,
     * zu dem es eine schwache Vermutung gibt, ist näher an einer
     * Antwort als eines, zu dem gar nichts vorliegt — dort genügt oft
     * eine Rückfrage statt einer offenen Frage.
     */
    .sort((a, b) => b.gewicht - a.gewicht || b.staerke - a.staerke);

  const erste = offen[0];
  if (!erste) return null;

  const feld = WISSENSFELDER.find((f) => f.schluessel === erste.schluessel)!;
  return {
    schluessel: erste.schluessel,
    frage: feld.frage,
    grund:
      erste.staerke > 0
        ? `nur eine Vermutung (${erste.staerke.toFixed(2)}), Gewicht ${erste.gewicht}`
        : `nichts bekannt, Gewicht ${erste.gewicht}`,
  };
}
