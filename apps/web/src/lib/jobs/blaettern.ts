/**
 * Welche Seite wird tatsächlich gezeigt?
 *
 * Ausgelagert, weil an dieser Rechnung ein Fehler hing, der wie ein
 * kaputter Knopf aussah. Wer auf Seite 4 blättert und danach „remote"
 * eingibt, hat `?seite=4&remote=remote` in der Adresse. Es gibt 14
 * solche Stellen, also eine Seite. Seite 4 war leer — und darunter
 * stand „Mit diesen Bedingungen finde ich aktuell keine bestätigte
 * Stelle."
 *
 * Diese Meldung war falsch, und das ist der eigentliche Schaden. Eine
 * leere Liste kann man erklären; eine leere Liste mit einer falschen
 * Begründung führt in die Irre — man ändert die Bedingungen, obwohl
 * die Bedingungen stimmten.
 *
 * Die Adresse entsteht an vielen Stellen: Suchfeld, Sortierung,
 * Lesezeichen, Zurück-Taste, von Hand getippt. Jede davon einzeln
 * zurückzusetzen hiesse, keine zu vergessen. Deshalb wird hier
 * geklammert — einmal, für alle.
 */

export interface Blätterstand {
  seite: number;
  seitenGesamt: number;
  von: number;
  bis: number;
}

export function blätterstand(
  anzahl: number,
  gewünschteSeite: unknown,
  proSeite: number,
): Blätterstand {
  const seitenGesamt = Math.max(1, Math.ceil(anzahl / proSeite));

  const roh = Number(gewünschteSeite ?? 1);
  // `Number("abc")` ist NaN, `Number("")` ist 0, `Number(null)` ist 0 —
  // alle drei landen über das `|| 1` auf der ersten Seite.
  const gewollt = Math.max(1, Math.floor(Number.isFinite(roh) ? roh : 1) || 1);
  const seite = Math.min(gewollt, seitenGesamt);

  return {
    seite,
    seitenGesamt,
    von: (seite - 1) * proSeite,
    bis: Math.min(seite * proSeite, anzahl),
  };
}
