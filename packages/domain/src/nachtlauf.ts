/**
 * ══════════════════════════════════════════════════════════════════
 * Der Nachtlauf — als Sache, die man ansehen kann
 * ══════════════════════════════════════════════════════════════════
 *
 * Velvova sucht bereits nachts. `durchlaufAusfuehren` zieht
 * Einbettungen nach, holt die fälligen Aufträge, prüft harte
 * Kriterien, rechnet die semantische Runde, lässt die Belege
 * schreiben und legt Treffer ab.
 *
 * Was fehlt, ist nicht die Arbeit — es ist der Beleg darüber.
 *
 * Die Zahlen dieses Laufs (`Durchlaufbericht`) gehen an den
 * Zeitplan-Aufruf zurück und sterben dort. Der Mensch, für den
 * gesucht wurde, kann morgens nicht erfahren, wie viele Stellen
 * angesehen wurden, wie viele an seiner Gehaltsgrenze scheiterten und
 * ob überhaupt alle Quellen erreichbar waren. Genau diese Sätze sind
 * aber der Moment, um den es geht:
 *
 *   „Ich habe heute Nacht 143 Stellen geprüft. 61 erfüllten deine
 *    Mindestanforderungen. Diese fünf würde ich mir zuerst ansehen."
 *
 * Ohne festgehaltene Zahlen ist dieser Satz eine Erfindung. Deshalb
 * steht hier, was ein Nachtlauf ist, welche Phasen er kennt und —
 * wichtiger — welche Sätze er über sich sagen darf.
 *
 * ── Die Regel, aus der alles andere folgt ───────────────────────
 *
 * Eine Zahl darf nur genannt werden, wenn sie gemessen wurde. Kein
 * „ungefähr", kein Auffüllen auf eine runde Zahl, kein Fortschritt,
 * der schön aussieht. Wenn zwei Quellen ausgefallen sind, steht das
 * im Bericht — auch wenn es den Lauf kleiner aussehen lässt.
 *
 * `bilanzPruefen()` macht daraus eine Prüfung statt eines Vorsatzes:
 * Zahlen, die einander widersprechen, erzeugen keinen schönen Satz,
 * sondern einen Befund.
 */

/**
 * Die Phasen eines Nachtlaufs.
 *
 * Sie sind das, was der Ring anzeigt — und der Ring darf nur
 * anzeigen, was wirklich läuft.
 */
export const PHASEN = [
  /** Kein Lauf. */
  "ruhe",
  /** Die Absicht wird zu Kriterien. */
  "verstehen",
  /** Anzeigen aus den Quellen holen. */
  "sammeln",
  /** Dieselbe Stelle über mehrere Portale zusammenführen. */
  "entdoppeln",
  /** Harte Kriterien: Gehalt, Ort, Zeit, Sperrliste. */
  "pruefen",
  /** Passung rechnen. */
  "bewerten",
  /** Die besten genauer ansehen. */
  "tiefenanalyse",
  /** Arbeitgeber ohne passende Anzeige. */
  "stiller_markt",
  /** Den Morgenbericht schreiben. */
  "bericht",
  /** Fertig, der Mensch hat ihn noch nicht gesehen. */
  "bereit",
  /** Es liegt eine Frage beim Menschen. */
  "wartet_auf_nutzer",
  /** Es liegt eine Frage bei einem Arbeitgeber. */
  "wartet_auf_unternehmen",
  /** Eine Bewerbung wird vorbereitet. */
  "bewerbung",
  /** Abgeschlossen. */
  "erfolg",
  /** Abgebrochen. */
  "fehler",
] as const;

export type Phase = (typeof PHASEN)[number];

/**
 * Die Phasen, die ein Lauf der Reihe nach durchläuft.
 *
 * Die übrigen (`wartet_auf_*`, `bewerbung`, `erfolg`, `fehler`)
 * stehen daneben, nicht darin: Sie sind keine Stufen einer Nacht,
 * sondern Zustände danach.
 */
export const NACHTFOLGE = [
  "verstehen",
  "sammeln",
  "entdoppeln",
  "pruefen",
  "bewerten",
  "tiefenanalyse",
  "stiller_markt",
  "bericht",
  "bereit",
] as const satisfies readonly Phase[];

/** Wie weit der Lauf ist — 0 bis 1. `null`, wenn die Phase nicht in der Folge steht. */
export function fortschritt(phase: Phase): number | null {
  const i = (NACHTFOLGE as readonly Phase[]).indexOf(phase);
  if (i < 0) return null;
  return (i + 1) / NACHTFOLGE.length;
}

/**
 * Was der Ring dabei tut.
 *
 * ── Warum nur sechs Bilder für fünfzehn Phasen ──────────────────
 *
 * Weil es sechs Animationen gibt. Für jede Phase eine eigene zu
 * erfinden hiesse, Bewegungen zu zeigen, die das Modell nicht hat —
 * und der Ring würde etwas anderes behaupten als das, was läuft. Die
 * Genauigkeit steht in der Zeile darunter, nicht in der Animation.
 */
export function ringbild(
  phase: Phase,
): "idle" | "thinking" | "speaking" | "listening" | "success" | "error" {
  switch (phase) {
    case "ruhe":
      return "idle";
    case "verstehen":
      return "listening";
    case "bereit":
    case "bericht":
      return "speaking";
    case "erfolg":
      return "success";
    case "fehler":
      return "error";
    case "wartet_auf_nutzer":
    case "wartet_auf_unternehmen":
      return "idle";
    default:
      return "thinking";
  }
}

/**
 * Die Zeile unter dem Ring.
 *
 * Sie nennt eine Zahl nur dort, wo eine gemessen wurde. „43 Stellen
 * geprüft" ist ein Beleg; „Stellen werden geprüft …" ist eine
 * Beschreibung. Beides ist ehrlich, eine erfundene Zahl wäre es
 * nicht.
 */
export function phasentext(phase: Phase, bilanz?: Partial<Nachtbilanz>): string {
  switch (phase) {
    case "ruhe":
      return "Monday schläft";
    case "verstehen":
      return "Deine Angaben werden zu Suchkriterien";
    case "sammeln":
      return bilanz?.gefunden
        ? `${bilanz.gefunden} Anzeigen gesammelt`
        : "Anzeigen werden gesammelt";
    case "entdoppeln":
      return "Doppelte Anzeigen werden zusammengeführt";
    case "pruefen":
      return bilanz?.nachFiltern
        ? `${bilanz.nachFiltern} erfüllen deine Muss-Kriterien`
        : "Muss-Kriterien werden geprüft";
    case "bewerten":
      return bilanz?.geprueft ? `${bilanz.geprueft} Stellen bewertet` : "Passung wird gerechnet";
    case "tiefenanalyse":
      return "Die besten werden genauer angesehen";
    case "stiller_markt":
      return "Arbeitgeber ohne passende Anzeige werden geprüft";
    case "bericht":
      return "Der Morgenbericht entsteht";
    case "bereit":
      return "Dein Morgenbericht liegt bereit";
    case "wartet_auf_nutzer":
      return "Wartet auf deine Entscheidung";
    case "wartet_auf_unternehmen":
      return "Wartet auf Antwort des Arbeitgebers";
    case "bewerbung":
      return "Deine Bewerbung wird vorbereitet";
    case "erfolg":
      return "Abgeschlossen";
    case "fehler":
      return "Der Lauf ist abgebrochen";
  }
}

/**
 * Was in einer Nacht gezählt wurde.
 *
 * Jedes Feld ist eine Messung, keine Schätzung. `quellenFehler` nennt
 * Quellen, die nicht erreichbar waren — ein Lauf mit ausgefallenen
 * Quellen ist kein gescheiterter Lauf, aber auch kein vollständiger,
 * und der Unterschied gehört in den Bericht.
 */
export interface Nachtbilanz {
  /** Anzeigen, die aus den Quellen kamen. */
  gefunden: number;
  /** Davon nach harten Kriterien und Sperrliste übrig. */
  nachFiltern: number;
  /** Davon tatsächlich bewertet. */
  geprueft: number;
  /** Davon empfohlen. */
  empfohlen: number;
  /** Zurückgestellt: passt, aber eine Muss-Angabe fehlt. */
  zurueckgestellt: number;
  /** Ausgeschlossen: ein Muss-Kriterium ist verletzt. */
  ausgeschlossen: number;
  /** Arbeitgeber ohne passende Anzeige. */
  stilleChancen: number;
  /** Namen der Quellen, die nicht antworteten. */
  quellenFehler: readonly string[];
}

export const LEERE_BILANZ: Nachtbilanz = {
  gefunden: 0,
  nachFiltern: 0,
  geprueft: 0,
  empfohlen: 0,
  zurueckgestellt: 0,
  ausgeschlossen: 0,
  stilleChancen: 0,
  quellenFehler: [],
};

/**
 * Widersprüche in den Zahlen.
 *
 * Eine Bilanz, in der mehr Stellen empfohlen als geprüft wurden, ist
 * kein kleiner Rundungsfehler — sie bedeutet, dass irgendwo gezählt
 * wird, was nicht gemessen wurde. Daraus einen schönen Morgensatz zu
 * bauen wäre genau der Fehler, den dieses Produkt nicht machen darf.
 *
 * Leere Liste heisst: die Zahlen tragen.
 */
export function bilanzPruefen(b: Nachtbilanz): string[] {
  const befunde: string[] = [];
  const negativ = (
    [
      ["gefunden", b.gefunden],
      ["nachFiltern", b.nachFiltern],
      ["geprueft", b.geprueft],
      ["empfohlen", b.empfohlen],
      ["zurueckgestellt", b.zurueckgestellt],
      ["ausgeschlossen", b.ausgeschlossen],
      ["stilleChancen", b.stilleChancen],
    ] as const
  ).filter(([, wert]) => wert < 0 || !Number.isInteger(wert));
  for (const [name] of negativ) befunde.push(`${name} ist keine gezählte Menge`);

  if (b.nachFiltern > b.gefunden) befunde.push("mehr nach Filtern als gefunden");
  if (b.geprueft > b.gefunden) befunde.push("mehr geprüft als gefunden");
  if (b.empfohlen > b.geprueft) befunde.push("mehr empfohlen als geprüft");
  if (b.empfohlen + b.zurueckgestellt + b.ausgeschlossen > b.geprueft) {
    befunde.push("die Ausgänge übersteigen die geprüften Stellen");
  }
  return befunde;
}

/**
 * Der Satz, mit dem der Morgen beginnt.
 *
 * ── Warum das eine Funktion ist und kein Modellaufruf ───────────
 *
 * Weil er nichts formuliert, was nicht in den Zahlen steht. Ein
 * Modell, das diesen Satz schreibt, kann „viele" sagen, wo 4 stehen,
 * oder „über Nacht durchsucht" behaupten, wenn drei Quellen
 * ausgefallen sind. Diese eine Aussage muss stimmen, und deshalb
 * kommt sie aus der Bilanz.
 *
 * Wirft nicht bei widersprüchlichen Zahlen, sondern sagt es: Ein
 * Fehler im Zähler darf den Morgenbericht nicht verhindern, aber er
 * darf auch nicht als Erfolg auftreten.
 */
export function bilanzSatz(b: Nachtbilanz): string {
  const befunde = bilanzPruefen(b);
  if (befunde.length > 0) {
    return "Die Zahlen dieses Laufs sind nicht schlüssig — ich zeige dir die Stellen, aber keine Bilanz.";
  }

  if (b.gefunden === 0) {
    return b.quellenFehler.length > 0
      ? `Heute Nacht kam nichts herein: ${quellenSatz(b.quellenFehler)}`
      : "Heute Nacht kam aus deinen Quellen keine neue Anzeige.";
  }

  const teile = [`Ich habe heute Nacht ${zahl(b.geprueft, "Stelle", "Stellen")} geprüft`];
  if (b.nachFiltern > 0) {
    teile.push(`${b.nachFiltern} erfüllten deine Muss-Kriterien`);
  }
  if (b.empfohlen > 0) {
    teile.push(`${zahl(b.empfohlen, "kann ich dir empfehlen", "kann ich dir empfehlen")}`);
  }

  let satz = teile.join(", ") + ".";
  if (b.zurueckgestellt > 0) {
    satz += ` Bei ${b.zurueckgestellt} fehlt eine Muss-Angabe — die habe ich nicht empfohlen, aber auch nicht weggeworfen.`;
  }
  if (b.quellenFehler.length > 0) {
    satz += ` ${grossAnfang(quellenSatz(b.quellenFehler))}`;
  }
  return satz;
}

/**
 * Warum heute wenig dabei ist.
 *
 * Der Bericht soll den Grund zuerst nennen, nicht die magere
 * Ausbeute. Wer liest „nur zwei Vorschläge", denkt, das Produkt taugt
 * nichts; wer liest „deine Gehaltsgrenze schliesst 84 von 91 aus",
 * hat eine Entscheidung vor sich.
 *
 * `null` heisst: Es gibt keinen solchen Grund, die Nacht war normal.
 */
export function magerkeitsgrund(b: Nachtbilanz): string | null {
  if (bilanzPruefen(b).length > 0) return null;
  if (b.empfohlen >= 3) return null;

  if (b.gefunden === 0) return null;
  if (b.quellenFehler.length > 0) {
    return `Heute waren nicht alle Quellen erreichbar — ${quellenSatz(b.quellenFehler)}`;
  }
  if (b.gefunden > 0 && b.nachFiltern === 0) {
    return "Keine einzige der heute Nacht gefundenen Anzeigen erfüllt alle deine Muss-Kriterien.";
  }
  if (b.ausgeschlossen > b.nachFiltern) {
    return `${b.ausgeschlossen} Stellen sind an einem deiner Muss-Kriterien gescheitert. Wenn du eines lockerst, wird die Auswahl grösser.`;
  }
  if (b.zurueckgestellt > b.empfohlen) {
    return `Bei ${b.zurueckgestellt} Stellen fehlt eine Angabe, ohne die ich nicht beurteilen kann, ob sie zu dir passt.`;
  }
  return null;
}

/**
 * Ob eine Zahl über den stillen Markt genannt werden darf.
 *
 * Unter dieser Grenze steht „wenige" statt der Zahl. Bei zwei
 * versiegelten Angeboten in einer Region und einem Beruf ist die Zahl
 * selbst schon ein Hinweis darauf, wer sie hinterlegt hat.
 */
export const MINDESTZAHL_STILL = 5;

export function stillerMarktSatz(anzahl: number): string {
  if (anzahl <= 0) return "Über deiner Linie liegt derzeit kein Angebot.";
  if (anzahl < MINDESTZAHL_STILL) return "Über deiner Linie liegen wenige Angebote.";
  return `Über deiner Linie liegen ${anzahl} Angebote.`;
}

/* ── Kleinkram, damit die Sätze oben lesbar bleiben ── */

function zahl(n: number, eins: string, viele: string): string {
  return `${n} ${n === 1 ? eins : viele}`;
}

function quellenSatz(quellen: readonly string[]): string {
  const n = quellen.length;
  return n === 1
    ? `eine Quelle war nicht erreichbar (${quellen[0]}).`
    : `${n} Quellen waren nicht erreichbar (${quellen.join(", ")}).`;
}

function grossAnfang(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
