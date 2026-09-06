import { FIT_GEWICHTE, fitGesamt } from "@paycheck/matching";
/**
 * Vier Zustände — und nur einer davon ist rot.
 *
 * ── Der Fehler, den das behebt ────────────────────────────────
 *
 * Die Oberfläche kannte bisher nur eine Achse: gut bis schlecht. Alles,
 * was nicht gut war, wurde rot — auch das, was schlicht unbekannt ist.
 *
 * Auf einer Trefferliste sah das so aus: Bei fast jeder Stelle drei rote
 * Balken, weil das Profil noch leer ist. Rot heisst für jeden Menschen
 * „hier stimmt etwas nicht" — und die Aussage war „wir wissen noch zu
 * wenig über DICH". Das Produkt beschuldigte die Stellen für eine Lücke
 * auf der eigenen Seite.
 *
 * ── Die vier Zustände ─────────────────────────────────────────
 *
 *   POSITIV    belegt erfüllt          grün
 *   TEILWEISE  teilweise erfüllt       violett
 *   OFFEN      unbekannt, ungeprüft    neutral, warm
 *   KONFLIKT   belegt verletzt         rot
 *
 * Rot NUR bei belegtem Konflikt. „Du willst remote, die Anzeige sagt
 * ausdrücklich vor Ort" ist rot. „Die Anzeige nennt kein Gehalt" ist
 * offen — daran ist nichts falsch, es ist nur nichts bekannt.
 *
 * ── Warum das hier steht und nicht in jeder Komponente ────────
 *
 * Weil es sonst wieder auseinanderläuft. Die Zuordnung stand an fünf
 * Stellen, in vier davon war „niedrig" gleich rot, und niemand hat es
 * bemerkt, weil jede für sich plausibel aussah.
 */

export type Befund = "positiv" | "teilweise" | "offen" | "konflikt";

export interface Befundton {
  /** Textfarbe. */
  text: string;
  /** Flächenfarbe für Pillen und Karten. */
  flaeche: string;
  /** Balken- und Punktfarbe. */
  fuellung: string;
  /** Ein Zeichen für Screenreader UND Auge — nie nur Farbe. */
  zeichen: string;
  /** Das Wort dafür, in der Sprache des Nutzers. */
  wort: string;
}

export const BEFUNDTON: Record<Befund, Befundton> = {
  positiv: {
    text: "text-positive",
    flaeche: "bg-positive-soft",
    fuellung: "bg-positive",
    zeichen: "✓",
    wort: "erfüllt",
  },
  teilweise: {
    text: "text-accent-text",
    flaeche: "bg-accent-soft",
    fuellung: "bg-accent",
    zeichen: "~",
    wort: "teilweise",
  },
  /*
   * Offen ist neutral, nicht warnend.
   *
   * Bewusst `ink-3` und `inset` statt Bernstein: Bernstein ist auf einer
   * Liste, auf der die Hälfte offen ist, immer noch ein Farbteppich —
   * nur ein freundlicherer. Was fehlt, soll leise sein.
   */
  offen: {
    text: "text-ink-3",
    flaeche: "bg-inset",
    fuellung: "bg-line-2",
    zeichen: "?",
    wort: "offen",
  },
  konflikt: {
    text: "text-critical",
    flaeche: "bg-critical-soft",
    fuellung: "bg-critical",
    zeichen: "✕",
    wort: "widerspricht",
  },
};

/**
 * Aus dem Prüfergebnis einer Bedingung wird ein Zustand.
 *
 * `blocked` ist der einzige Weg zu Rot. Es entsteht, wenn eine Angabe
 * der Anzeige einer Bedingung der Person ausdrücklich widerspricht —
 * nicht, wenn die Angabe fehlt.
 */
export function befundAusPruefung(verdict: string): Befund {
  if (verdict === "eligible") return "positiv";
  if (verdict === "blocked") return "konflikt";
  return "offen";
}

/**
 * Aus der Sicherheit wird ein Zustand — und nie ein Konflikt.
 *
 * Niedrige Sicherheit heisst „wir wissen zu wenig", nicht „die Stelle
 * ist schlecht". Deshalb endet diese Funktion bei `offen`; `konflikt`
 * ist von hier aus nicht erreichbar.
 */
export function befundAusSicherheit(level: "high" | "medium" | "low"): Befund {
  return level === "high" ? "positiv" : level === "medium" ? "teilweise" : "offen";
}

/**
 * Aus der Passung wird ein Band — mit Worten, die ein Mensch benutzt.
 *
 * `null` heisst nicht „null Punkte", sondern „nicht berechenbar". Das
 * ist der häufigste Zustand bei einem frischen Konto und darf sich
 * nicht wie ein schlechtes Ergebnis lesen.
 */
export function bandAusScore(score: number | null): { befund: Befund; wort: string } {
  if (score === null) return { befund: "offen", wort: "Passung noch offen" };
  if (score >= 70) return { befund: "positiv", wort: "Sehr passend" };
  if (score >= 45) return { befund: "teilweise", wort: "Interessant" };
  return { befund: "offen", wort: "Noch zu prüfen" };
}

/**
 * Der eine Satz unter einer Stelle, wenn die Grundlage fehlt.
 *
 * Vorher stand hier „Noch keine belegte Passung — dafür fehlen
 * bestätigte Angaben." Wahr, aber in der Sprache des Systems: „belegte
 * Passung" und „bestätigte Angaben" sind unsere Begriffe, nicht seine.
 * Und er stand unter JEDER Stelle, also fünfundzwanzigmal
 * untereinander.
 */
export const OFFEN_SATZ =
  "Sieht interessant aus — für eine belastbare Einschätzung kennt Nina dich noch nicht gut genug.";

/**
 * Die Ampel für Passung und Anzeigenqualität.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum feste Schwellen und nicht `bandAusScore`
 * ══════════════════════════════════════════════════════════════
 *
 * `bandAusScore` teilt feiner ein und wählt seine Grenzen nach dem,
 * was fachlich gemeint ist. Für die Farbe braucht es das Gegenteil:
 * drei Stufen, die jeder ohne Erklärung liest.
 *
 *   unter 50   rot     — hier stimmt etwas nicht
 *   50 bis 74  gelb    — brauchbar, mit Vorbehalt
 *   ab 75      grün    — passt
 *
 * Dieselben Schwellen für Passung UND Anzeigenqualität. Zwei
 * verschiedene Skalen mit denselben Farben wären der sichere Weg zu
 * einer Fehldeutung: Man vergleicht, was nebeneinander gleich aussieht.
 */
export type Ampelstufe = "rot" | "gelb" | "gruen";

export function ampelstufe(wert: number): Ampelstufe {
  if (wert < 50) return "rot";
  if (wert < 75) return "gelb";
  return "gruen";
}

export const AMPELTON: Record<Ampelstufe, { text: string; fuellung: string }> = {
  rot: { text: "text-critical", fuellung: "bg-critical" },
  gelb: { text: "text-caution", fuellung: "bg-caution" },
  gruen: { text: "text-positive", fuellung: "bg-positive" },
};

/**
 * Die Farbe einer Zeile in der Trefferliste.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum zwei Werte zusammen
 * ══════════════════════════════════════════════════════════════
 *
 * Die Zeile trug bisher Akzentblau, wenn sie gewählt war, und sonst
 * gar keine Farbe. Sie sagte damit über die Stelle nichts.
 *
 * Zwei Zahlen stehen für jede Stelle bereit und beantworten
 * verschiedene Fragen:
 *
 *   Passung   — passt die Stelle zu DIESER Person?
 *   Qualität  — ist die ANZEIGE vollständig und nachvollziehbar?
 *
 * Beide gehören in die Farbe, aber nicht zu gleichen Teilen. Die
 * Passung wiegt schwerer: Eine tadellos geschriebene Anzeige für einen
 * Beruf, der nicht passt, ist keine gute Stelle. Eine lückenhafte
 * Anzeige für die richtige Stelle dagegen ist eine gute Stelle mit
 * offenen Fragen — und offene Fragen kann man stellen.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum eine Sperre statt einer reinen Rechnung
 * ══════════════════════════════════════════════════════════════
 *
 * Der gewichtete Mittelwert allein liesse eine Stelle grün werden,
 * deren Anzeige kaum etwas hergibt — 90 Passung und 40 Qualität ergibt
 * 70, und 70 sähe fast grün aus. Das wäre eine Empfehlung für etwas,
 * das man noch gar nicht beurteilen kann.
 *
 * Deshalb: Liegt EINER der beiden Werte unter 50, kann die Zeile
 * höchstens gelb werden. Grün heisst „beides stimmt", nicht „im
 * Mittel stimmt es".
 */
/**
 * Die Gewichte der drei Werte.
 *
 * Die Passung wiegt am schwersten: Eine tadellos geschriebene Anzeige
 * für einen Beruf, der nicht passt, ist keine gute Stelle. Die
 * Sicherheit wiegt am leichtesten — sie sagt nichts über die Stelle,
 * sondern über unseren Kenntnisstand, und ein dünnes Profil darf eine
 * gute Stelle nicht rot färben.
 */
export const GEWICHTE = FIT_GEWICHTE;

export function zeilenampel(
  passung: number | null,
  qualitaet: number | null,
  sicherheit: number | null = null,
): { stufe: Ampelstufe | null; gesamt: number | null } {
  /*
   * Gerechnet wird mit dem, was da ist.
   *
   * Früher gab es ohne Passung gar keinen Wert — mit dem Argument, eine
   * Zeile wäre sonst grün, weil die Anzeige gut ist, während über die
   * Passung nichts bekannt ist.
   *
   * Das Argument war zu streng: Es machte aus einer teilweise
   * bekannten Lage eine unbekannte. Wer noch kein Profil hat, sah
   * überhaupt keine Einstufung, obwohl über die Anzeige und ihre
   * Vollständigkeit sehr wohl etwas bekannt ist.
   *
   * Jetzt gehen alle vorhandenen Werte ein, und ihre Gewichte werden
   * auf das verteilt, was fehlt. Erst wenn gar nichts vorliegt, gibt
   * es keine Zahl.
   */
  const teile: [number, number][] = [];
  if (passung !== null) teile.push([passung, GEWICHTE.passung]);
  if (qualitaet !== null) teile.push([qualitaet, GEWICHTE.qualitaet]);
  if (sicherheit !== null) teile.push([sicherheit, GEWICHTE.sicherheit]);

  if (teile.length === 0) return { stufe: null, gesamt: null };

  /* Die Formel steht in `@paycheck/matching` — dieselbe, nach der die
     Liste sortiert. Sie hier zu wiederholen hiesse, dass Reihenfolge
     und Anzeige auseinanderlaufen können. */
  const gesamt = fitGesamt(passung, qualitaet, sicherheit)!;
  /*
   * ══════════════════════════════════════════════════════════════
   * Die Farbe kommt aus der Zahl, die danebensteht — aus nichts sonst
   * ══════════════════════════════════════════════════════════════
   *
   * Hier stand eine Sperre: Grün nur, wenn KEIN Einzelwert unter 50
   * liegt. Das Argument war gut — „95 Passung und 49 Anzeigenqualität
   * ergibt im Mittel 78, aber grün heisst nicht ‚im Mittel stimmt es‘".
   *
   * In der Liste war es trotzdem falsch. Dort steht neben der Farbe
   * die Zahl, und eine 78 mit gelbem Rand ist für den, der die Liste
   * überfliegt, schlicht ein Widerspruch. Er sieht die Bestandteile
   * nicht; er sieht 78 und Gelb, und daneben eine 76 mit Grün.
   *
   * Eine Farbe, die man nur mit Zusatzwissen versteht, erklärt nichts
   * — sie verunsichert. Die Bestandteile stehen weiterhin im Kopf der
   * Anzeige, und dort erklären sie die Zahl.
   *
   *   unter 50   rot
   *   50 bis 74  gelb
   *   ab 75      grün
   */
  return { stufe: ampelstufe(gesamt), gesamt };
}
