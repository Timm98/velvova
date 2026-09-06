import type { ScoreFactor } from "./scoring.ts";

/**
 * Was für eine Stelle spricht, was dagegen, und was offen ist.
 *
 * ── Warum drei Listen und nicht eine Zahl ─────────────────────
 *
 * „86 % passend" beantwortet keine Frage, die jemand hat. Wer vor
 * einer Entscheidung steht, will wissen, WORAN es liegt — und vor
 * allem, was er noch nicht weiss.
 *
 * Bisher standen genau zwei Sätze da: der stärkste Grund und der
 * grösste Vorbehalt. Alles dazwischen war zwar gerechnet, aber
 * unsichtbar.
 *
 * ── Warum „ungeklärt" eine eigene Liste ist ───────────────────
 *
 * Eine Achse ohne Daten ist nicht schlecht — sie ist unbekannt. Beides
 * in einen Topf zu werfen wäre der Fehler, den die Gewichtung schon
 * vermeidet: Unbekanntes zieht den Wert nicht herunter, es senkt die
 * Sicherheit.
 *
 * In der Liste steht es trotzdem, und zwar ausdrücklich. „Keine Angabe
 * zu Überstunden" heisst nicht „keine Überstunden" — das ist die
 * häufigste stille Fehlannahme beim Lesen einer Stellenanzeige.
 *
 * ── Warum die Sätze nicht von einem Modell kommen ─────────────
 *
 * Jeder Faktor trägt seine Begründung als Text mit. Ein Sprachmodell
 * könnte sie flüssiger formulieren und würde dabei Dinge behaupten,
 * die im Wert nicht stehen. Hier wird sortiert, nicht geschrieben.
 */

/** Ab wann eine Achse ausdrücklich für die Stelle spricht. */
export const SCHWELLE_DAFUER = 0.65;

/** Ab wann sie ausdrücklich dagegen spricht. */
export const SCHWELLE_DAGEGEN = 0.35;

export interface Passungsgrund {
  key: string;
  label: string;
  satz: string;
  /** Wie schwer die Achse im Gesamtwert wiegt. Für die Reihenfolge. */
  gewicht: number;
}

export interface Passungsgruende {
  dafuer: Passungsgrund[];
  dagegen: Passungsgrund[];
  offen: Passungsgrund[];
}

/**
 * Die Faktoren auf drei Listen verteilen.
 *
 * Der Mittelbereich zwischen den Schwellen taucht nirgends auf: Eine
 * Achse, die weder deutlich dafür noch deutlich dagegen spricht, ist
 * keine Auskunft. Sie steht in den Teilwerten, aber nicht in einer
 * Liste, die behauptet, etwas zu bedeuten.
 *
 * Sortiert wird nach Gewicht, nicht nach Wert: Die wichtigste Achse
 * gehört nach oben, auch wenn eine unwichtigere extremer ausschlägt.
 */
export function passungsgruende(factors: readonly ScoreFactor[]): Passungsgruende {
  const dafuer: Passungsgrund[] = [];
  const dagegen: Passungsgrund[] = [];
  const offen: Passungsgrund[] = [];

  for (const f of factors) {
    const g: Passungsgrund = {
      key: f.key,
      label: f.label,
      satz: f.explanation,
      gewicht: f.weight,
    };
    if (f.raw === null) offen.push(g);
    else if (f.raw >= SCHWELLE_DAFUER) dafuer.push(g);
    else if (f.raw <= SCHWELLE_DAGEGEN) dagegen.push(g);
  }

  const nachGewicht = (a: Passungsgrund, b: Passungsgrund) => b.gewicht - a.gewicht;
  return {
    dafuer: dafuer.sort(nachGewicht),
    dagegen: dagegen.sort(nachGewicht),
    offen: offen.sort(nachGewicht),
  };
}

/**
 * Der Satz über die Belastbarkeit der ganzen Einschätzung.
 *
 * ── Warum die Zahl der offenen Achsen genannt wird ────────────
 *
 * „Datensicherheit: mittel" ist eine Einstufung, mit der niemand etwas
 * anfangen kann. „Für eine belastbare Einschätzung fehlen noch drei
 * Angaben" sagt, was zu tun wäre.
 *
 * Gibt `null` zurück, wenn nichts fehlt — dann gibt es auch nichts zu
 * sagen, und ein beruhigender Satz wäre Füllmaterial.
 */
export function vorlaeufigkeit(g: Passungsgruende): string | null {
  const n = g.offen.length;
  if (n === 0) return null;
  if (n === 1) {
    return "Vorläufige Einschätzung — für eine belastbare Bewertung fehlt noch eine Angabe.";
  }
  return `Vorläufige Einschätzung — für eine belastbare Bewertung fehlen noch ${ausgeschrieben(n)} Angaben.`;
}

/*
 * Kleine Zahlen ausgeschrieben.
 *
 * „fehlen noch 3 Angaben" liest sich wie eine Fehlermeldung,
 * „fehlen noch drei Angaben" wie ein Satz. Ab dreizehn wird die Ziffer
 * wieder lesbarer als das Wort.
 */
const ZAHLWORT = [
  "null", "eine", "zwei", "drei", "vier", "fünf", "sechs",
  "sieben", "acht", "neun", "zehn", "elf", "zwölf",
];

function ausgeschrieben(n: number): string {
  return ZAHLWORT[n] ?? String(n);
}
