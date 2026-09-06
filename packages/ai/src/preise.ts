/**
 * Was ein Modellaufruf gekostet hat.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum die Preise Konfiguration sind und keine Tabelle im Code
 * ══════════════════════════════════════════════════════════════
 *
 * Weil sie sich ändern, und weil eine falsche Zahl hier schlimmer ist
 * als keine: Ein Budget, das mit veralteten Preisen rechnet, hält
 * nicht, was es verspricht — und zwar in beide Richtungen. Zu hoch
 * angesetzt bremst es einen Dienst aus, der gar nichts kostet; zu
 * niedrig lässt es ihn laufen, bis die Rechnung kommt.
 *
 * Also: zwei Zahlen aus der Umgebung, ein bewusst hoch angesetzter
 * Vorgabewert, und ein Vermerk, wenn geschätzt wurde.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum die Vorgabe hoch liegt
 * ══════════════════════════════════════════════════════════════
 *
 * Ein Budget soll im Zweifel zu früh bremsen, nicht zu spät. Wer die
 * echten Preise seines Anbieters einträgt, bekommt die genaue Zahl;
 * wer es nicht tut, bekommt eine vorsichtige — und niemand bekommt
 * eine überraschende Rechnung, weil eine Tabelle im Code alt war.
 */

/** Cent je eine Million Tokens. Bewusst hoch als Vorgabe. */
export const PREIS_VORGABE = {
  inputCentProMillion: 1500,
  outputCentProMillion: 6000,
} as const;

export interface Kostenbefund {
  /** Gerundet auf ganze Cent, mindestens 1 bei tatsächlichem Verbrauch. */
  cent: number;
  /** Ob mit dem Vorgabewert gerechnet wurde statt mit hinterlegten Preisen. */
  geschaetzt: boolean;
}

export interface Preistafel {
  inputCentProMillion: number;
  outputCentProMillion: number;
}

/**
 * Preise aus der Umgebung lesen.
 *
 * `AI_PREIS_INPUT_CENT_PRO_MTOKEN` und
 * `AI_PREIS_OUTPUT_CENT_PRO_MTOKEN`. Fehlt eine, gilt für beide die
 * Vorgabe — eine halb hinterlegte Tafel wäre eine Mischung aus echtem
 * und geschätztem Preis, und die liesse sich hinterher nicht deuten.
 */
export function preistafel(env: Record<string, string | undefined> = process.env): {
  tafel: Preistafel;
  hinterlegt: boolean;
} {
  const ein = Number(env.AI_PREIS_INPUT_CENT_PRO_MTOKEN);
  const aus = Number(env.AI_PREIS_OUTPUT_CENT_PRO_MTOKEN);
  if (Number.isFinite(ein) && Number.isFinite(aus) && ein >= 0 && aus >= 0) {
    return { tafel: { inputCentProMillion: ein, outputCentProMillion: aus }, hinterlegt: true };
  }
  return { tafel: { ...PREIS_VORGABE }, hinterlegt: false };
}

export function kostenCent(
  inputTokens: number | null,
  outputTokens: number | null,
  tafel: Preistafel = PREIS_VORGABE,
  hinterlegt = false,
): Kostenbefund {
  const ein = inputTokens ?? 0;
  const aus = outputTokens ?? 0;

  /*
   * Ohne Tokenzahlen keine Kosten — aber auch keine Null.
   *
   * Ein Anbieter, der nichts meldet, ist der Fall, in dem ein Budget
   * lautlos aufhört zu wirken: Jeder Aufruf kostet 0, die Summe
   * bleibt 0, die Grenze greift nie. Ein Mindestbetrag hält den
   * Zähler in Bewegung.
   */
  if (ein === 0 && aus === 0) return { cent: 1, geschaetzt: true };

  const roh =
    (ein * tafel.inputCentProMillion + aus * tafel.outputCentProMillion) / 1_000_000;

  /* Aufrunden: Ein Aufruf, der 0,3 Cent kostet, darf nicht als
     kostenlos gezählt werden — tausend davon sind drei Euro. */
  return { cent: Math.max(1, Math.ceil(roh)), geschaetzt: !hinterlegt };
}
