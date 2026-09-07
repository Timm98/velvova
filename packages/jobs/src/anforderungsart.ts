/**
 * Wie ernst eine Zeile in einer Stellenanzeige gemeint ist.
 *
 * ══════════════════════════════════════════════════════════════
 * Das Problem, das diese Datei löst
 * ══════════════════════════════════════════════════════════════
 *
 * Eine Anforderungsliste liest sich wie eine Liste von Bedingungen,
 * ist aber keine. In derselben Aufzählung stehen nebeneinander:
 *
 *   „Abgeschlossenes Studium der Informatik ist Voraussetzung"
 *   „Erfahrung mit Kubernetes ist von Vorteil"
 *
 * Beides sind Aufzählungspunkte. Nur das erste entscheidet, ob eine
 * Bewerbung gelesen wird. Wer beides gleich behandelt, produziert die
 * Erfahrung, die Bewerbende von jeder Jobseite kennen: Man liest zwölf
 * Punkte, erfüllt neun, und weiss nicht, ob das reicht.
 *
 * ══════════════════════════════════════════════════════════════
 * Zwei Fragen, nicht eine
 * ══════════════════════════════════════════════════════════════
 *
 * `zwingend` — verlangt die Anzeige es?
 * `erlernbar` — könnte man es sich aneignen?
 *
 * Sie sind unabhängig, und gerade die Kombination trägt die Aussage:
 *
 *   zwingend + erlernbar    → „fehlt dir, aber holbar"     (Kurs, Monate)
 *   zwingend + nicht erlernbar → „das ist die Grenze"      (Approbation)
 *   nicht zwingend + erlernbar → „nice to have"            (ignorierbar)
 *
 * Nur mit beiden Feldern kann Monday den Satz sagen, auf den es ankommt:
 * „Dir fehlt eines von sieben Muss-Kriterien, und das ist ein Kurs."
 */

export type Anforderungsart = {
  /** Ob die Anzeige es verlangt statt wünscht. */
  zwingend: boolean;
  /** Ob es sich in überschaubarer Zeit aneignen lässt. */
  erlernbar: boolean;
  /** 1 Nebensache bis 3 tragend. */
  wichtigkeit: number;
  /** 0..100 — wie sicher der Text das hergibt. */
  konfidenz: number;
  /** Das Wort, an dem die Einstufung hängt. Leer, wenn geraten. */
  belegstelle: string | null;
};

/**
 * Formulierungen, mit denen deutsche Anzeigen Pflicht ausdrücken.
 *
 * Die Reihenfolge ist die Trefferreihenfolge: Was zuerst passt, wird
 * als Beleg genannt. Deshalb stehen die eindeutigen Wendungen oben —
 * „zwingend erforderlich" belegt besser als ein blosses „setzen voraus".
 */
const MUSS: readonly [RegExp, string][] = [
  [/zwingend\s+(erforderlich|notwendig|vorausgesetzt)/i, "zwingend erforderlich"],
  [/unabdingbar|unerlässlich|unerlaesslich/i, "unabdingbar"],
  [/(ist|sind)\s+Voraussetzung/i, "ist Voraussetzung"],
  [/setzen\s+wir\s+voraus|setzt\s+voraus/i, "setzen wir voraus"],
  [/\bmuss\b|\bmüssen\b|\bmuessen\b/i, "muss"],
  [/erforderlich|notwendig/i, "erforderlich"],
  [/verfügen\s+Sie\s+über|verfuegen\s+Sie\s+ueber/i, "verfügen Sie über"],
];

/**
 * Formulierungen, mit denen Anzeigen einen Wunsch als Pflicht tarnen.
 *
 * Diese schlagen MUSS, wenn beides im selben Satz steht. Grund: „Von
 * Vorteil ist Erfahrung mit SAP, erforderlich ist sie nicht" enthält
 * das Wort „erforderlich" — und meint das Gegenteil. Der Wunsch ist die
 * spezifischere Aussage und gewinnt.
 */
const WUNSCH: readonly [RegExp, string][] = [
  [/von\s+Vorteil/i, "von Vorteil"],
  [/wünschenswert|wuenschenswert/i, "wünschenswert"],
  [/idealerweise|im\s+Idealfall/i, "idealerweise"],
  [/nice\s*[-\s]?to\s*[-\s]?have/i, "nice to have"],
  [/gerne\s+auch|schön\s+wäre|bonus/i, "gerne auch"],
  [/erste\s+Erfahrung|Grundkenntnis/i, "erste Erfahrung"],
];

/**
 * Was sich nicht nebenbei aneignen lässt.
 *
 * Die Grenze ist bewusst zeitlich gezogen, nicht nach Schwierigkeit:
 * Ein Studium ist nicht schwerer als eine Sprache, aber es dauert
 * Jahre und beginnt zu festen Terminen. Was hier steht, ist für eine
 * konkrete Bewerbung eine Tatsache, kein Vorhaben.
 */
const NICHT_ERLERNBAR: readonly RegExp[] = [
  /abschluss|studium|bachelor|master|diplom|promotion|approbation/i,
  /ausbildung|lehre|geselle|meister/i,
  /berufserlaubnis|approbation|zulassung|kammer/i,
  /\b(muttersprach|verhandlungssicher|c2)\b/i,
  /sicherheitsüberprüfung|sicherheitsueberpruefung|führungszeugnis|fuehrungszeugnis/i,
  /\b\d+\s*(\+|plus)?\s*jahr\w*\s+(berufs)?erfahrung/i,
];

/**
 * Was tragend ist, auch wenn es beiläufig formuliert wird.
 *
 * Eine Anzeige schreibt „Deutschkenntnisse erforderlich" in denselben
 * Tonfall wie „Kenntnisse in Excel erforderlich". Für die Bewerbung
 * sind das verschiedene Dinge.
 */
const TRAGEND = /sprach|deutsch|englisch|abschluss|studium|approbation|führerschein|fuehrerschein|arbeitserlaubnis|visum/i;

/**
 * Eine Anforderungszeile einstufen.
 *
 * `nurWunschabschnitt` sagt, ob die Zeile unter einer Überschrift wie
 * „Was wir uns wünschen" stand. Diese Information ist wertvoll, weil
 * viele Anzeigen ihre Punkte gar nicht einzeln kennzeichnen, sondern
 * die Trennung nur über zwei Blöcke machen — die Zeile selbst enthält
 * dann kein einziges Signalwort.
 */
export function anforderungEinstufen(
  text: string,
  nurWunschabschnitt = false,
): Anforderungsart {
  const wunsch = WUNSCH.find(([r]) => r.test(text));
  const muss = MUSS.find(([r]) => r.test(text));

  /*
   * Konfidenz sagt, worauf die Einstufung beruht — nicht, wie sehr
   * sie stimmt.
   *
   * Ein wörtliches „zwingend erforderlich" ist eine Tatsache über den
   * Text (95). Ein Punkt unter „Was wir uns wünschen" ist eine solide
   * Ableitung (70). Eine Zeile ganz ohne Signal ist geraten (40) — und
   * Monday soll darauf keinen Satz bauen, der wie Gewissheit klingt.
   */
  let zwingend: boolean;
  let konfidenz: number;
  let belegstelle: string | null;

  if (wunsch) {
    zwingend = false;
    konfidenz = 90;
    belegstelle = wunsch[1];
  } else if (muss) {
    zwingend = true;
    konfidenz = 95;
    belegstelle = muss[1];
  } else if (nurWunschabschnitt) {
    zwingend = false;
    konfidenz = 70;
    belegstelle = "Abschnitt „Wünschenswert“";
  } else {
    /*
     * Ohne Signalwort im Pflichtblock: als Pflicht lesen.
     *
     * Die Alternative wäre, im Zweifel „nicht zwingend" anzunehmen. Das
     * wäre für die Bewerbenden freundlicher und für sie schlechter:
     * Monday schickt sie zu Stellen, deren Grundbedingung sie nicht
     * erfüllen. Die niedrige Konfidenz ist die ehrliche Hälfte davon.
     */
    zwingend = true;
    konfidenz = 40;
    belegstelle = null;
  }

  const erlernbar = !NICHT_ERLERNBAR.some((r) => r.test(text));

  /*
   * Wichtigkeit ist nicht dasselbe wie zwingend.
   *
   * „Führerschein B" kann in einer Anzeige als Wunsch stehen und ist
   * trotzdem tragend: Wer ihn nicht hat, kann den Aussendienst nicht
   * machen, egal wie höflich die Anzeige formuliert ist.
   */
  const wichtigkeit = TRAGEND.test(text) ? 3 : zwingend ? 2 : 1;

  return { zwingend, erlernbar, wichtigkeit, konfidenz, belegstelle };
}

/**
 * Erkennt, ob eine Überschrift einen Wunschblock einleitet.
 *
 * Getrennt exportiert, weil der Aufrufer die Zeilen durchläuft und
 * dabei mitführen muss, in welchem Block er gerade ist — diese Datei
 * sieht immer nur eine Zeile.
 */
export function istWunschUeberschrift(zeile: string): boolean {
  return /^(das\s+)?(wäre|waere|ist)?\s*(schön|schoen)?.{0,30}(wünschen|wuenschen|von\s+Vorteil|nice\s*to\s*have|darüber\s+hinaus|dar[üu]ber\s+hinaus|zusätzlich|zusaetzlich)/i.test(
    zeile.trim(),
  );
}
