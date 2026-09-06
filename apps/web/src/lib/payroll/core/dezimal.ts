/**
 * Geld rechnen, ohne Geld zu verlieren.
 *
 * `0.1 + 0.2` ist in JavaScript `0.30000000000000004`. Für eine
 * Fortschrittsanzeige ist das gleichgültig, für eine Lohnabrechnung
 * nicht: die deutsche Steuerberechnung rechnet in Cent, rundet an
 * vorgeschriebenen Stellen und multipliziert Zwischenergebnisse
 * weiter. Ein Fliesskommafehler im dritten Schritt steht am Ende als
 * falscher Euro-Betrag da.
 *
 * Deshalb hier ganze Zahlen: intern wird alles in **Hundertstel-Cent**
 * geführt — also mit vier Nachkommastellen zum Euro. Das reicht für
 * jede Zwischenrechnung des Programmablaufplans und passt bei jedem
 * realistischen Gehalt bequem in `Number.MAX_SAFE_INTEGER`.
 *
 * Warum nicht `BigInt`? Weil die grösste vorkommende Zahl — ein
 * Jahresbrutto von einer Million Euro in Hundertstel-Cent — bei 10¹⁰
 * liegt und damit sechs Grössenordnungen unter der Grenze für exakte
 * Ganzzahlen in `Number`. `BigInt` wäre langsamer und würde jede Zeile
 * mit `n`-Suffixen zupflastern, ohne einen einzigen Fehler zu
 * verhindern.
 *
 * Warum keine Bibliothek? Weil das hier drei Rechenarten sind und die
 * Rundungsregeln ohnehin von Hand geschrieben werden müssten — der
 * Programmablaufplan schreibt vor, WO gerundet wird, und keine
 * Bibliothek kennt das.
 */

/** Ein Betrag in Hundertstel-Cent. */
export type Betrag = number;

/** Wie viele Hundertstel-Cent ein Euro hat. */
const SKALA = 10_000;

export function ausEuro(euro: number): Betrag {
  return Math.round(euro * SKALA);
}

export function ausCent(cent: number): Betrag {
  return Math.round(cent * 100);
}

export function zuEuro(b: Betrag): number {
  return b / SKALA;
}

/** Auf volle Euro ABGERUNDET — die häufigste Vorschrift im PAP. */
export function abgerundetAufEuro(b: Betrag): Betrag {
  return Math.floor(b / SKALA) * SKALA;
}

/** Auf volle Cent, kaufmännisch gerundet. Für die Ausgabe. */
export function aufCent(b: Betrag): Betrag {
  return Math.round(b / 100) * 100;
}

export function plus(...werte: Betrag[]): Betrag {
  return werte.reduce((a, b) => a + b, 0);
}

export function minus(a: Betrag, b: Betrag): Betrag {
  return a - b;
}

/**
 * Mit einem Satz multiplizieren — etwa 0,186 für 18,6 Prozent.
 *
 * Der Satz kommt als gewöhnliche Zahl herein, weil Beitragssätze so in
 * den Gesetzen stehen. Das Ergebnis wird sofort auf eine ganze Zahl
 * zurückgeholt, damit der Fliesskommafehler nicht in die nächste
 * Rechnung wandert.
 */
export function mal(b: Betrag, satz: number): Betrag {
  return Math.round(b * satz);
}

/** Durch eine ganze Zahl teilen — etwa zwölf Monate. */
export function geteilt(b: Betrag, teiler: number): Betrag {
  return Math.round(b / teiler);
}

/** Nie unter null. Abzüge dürfen kein negatives Einkommen ergeben. */
export function nichtNegativ(b: Betrag): Betrag {
  return b < 0 ? 0 : b;
}

/** Der kleinere von zwei Beträgen — für Beitragsbemessungsgrenzen. */
export function hoechstens(b: Betrag, grenze: Betrag): Betrag {
  return b < grenze ? b : grenze;
}

/** Für die Anzeige. */
export function alsGeld(b: Betrag, waehrung = "EUR"): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: waehrung,
    maximumFractionDigits: 0,
  }).format(zuEuro(b));
}

export function alsGeldGenau(b: Betrag, waehrung = "EUR"): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: waehrung,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(zuEuro(b));
}
