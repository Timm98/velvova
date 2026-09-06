import { DIMENSIONSTEXT, type Arbeitsdimension } from "./arbeitsprofil.ts";

/**
 * Was jemand über Monate hinweg immer wieder gesagt hat.
 *
 * ── Warum Wiederholung etwas anderes ist als eine Aussage ─────
 *
 * Eine einzelne Selbstauskunft kostet nichts: Man sagt an einem
 * Dienstag, man arbeite gern allein, und niemand kann prüfen, ob das
 * an einem Donnerstag noch stimmt.
 *
 * Dieselbe Aussage über ein halbes Jahr, bei verschiedenen
 * Gelegenheiten, ohne dass jemand die frühere Antwort vorgelegt
 * bekommt — das ist etwas anderes. Nicht beobachtet, aber auch nicht
 * mehr bloss behauptet. Es ist die einzige Belegstufe, die durch
 * blosses Warten entsteht, und deshalb die einzige, die niemand für
 * ein Bewerbungsgespräch herstellen kann.
 *
 * ── Warum das ohne Sprachmodell geht ──────────────────────────
 *
 * Freitext auf Wiederholung zu prüfen hiesse, Sätze zu vergleichen.
 * Die Dimensionen sind bereits die Achse, auf der eine Aussage liegt —
 * `arbeitsprofil` hält sie mit Zeitpunkt und Herkunft. Wiederholung
 * ist damit eine Auszählung, keine Deutung.
 */

export interface Profilnennung {
  dimension: string;
  wert: number;
  herkunft: string;
  erfasstAm: Date;
}

/** Drei Nennungen. Zwei sind ein Zufall, drei sind ein Muster. */
export const MIN_NENNUNGEN = 3;

/**
 * Sechzig Tage.
 *
 * Kürzer wäre dieselbe Stimmung, nur dreimal aufgeschrieben. Die Frist
 * ist der eigentliche Beleg: Sie lässt sich nicht nachholen.
 */
export const MIN_SPANNE_TAGE = 60;

/**
 * Wie weit vom Mittelwert eine Nennung entfernt sein muss.
 *
 * Bei 0.5 sagt jemand nichts aus — „mal so, mal so" ist keine Aussage,
 * die man über Zeit bestätigen könnte.
 */
export const MIN_AUSSCHLAG = 0.15;

export interface BerichteteAussage {
  dimension: string;
  /** Der Mittelwert der Nennungen. */
  wert: number;
  nennungen: number;
  spanneTage: number;
  aussage: string;
}

const TAG = 24 * 60 * 60 * 1000;

/**
 * Aus dem Verlauf des Arbeitsprofils die Aussagen, die über Zeit tragen.
 *
 * Ausdrücklich NICHT gezählt werden Nennungen aus derselben Herkunft am
 * selben Tag: Wer in einem Gespräch dreimal dasselbe sagt, hat es
 * einmal gesagt.
 */
export function berichteteAussagen(nennungen: readonly Profilnennung[]): BerichteteAussage[] {
  const nachDimension = new Map<string, Profilnennung[]>();
  for (const n of nennungen) {
    const liste = nachDimension.get(n.dimension) ?? [];
    liste.push(n);
    nachDimension.set(n.dimension, liste);
  }

  const ergebnis: BerichteteAussage[] = [];
  for (const [dimension, liste] of nachDimension) {
    /* Eine Gelegenheit ist Herkunft + Tag, nicht jede Zeile. */
    const gelegenheiten = new Map<string, Profilnennung>();
    for (const n of liste) {
      const tag = Math.floor(n.erfasstAm.getTime() / TAG);
      const schluessel = `${n.herkunft}:${tag}`;
      if (!gelegenheiten.has(schluessel)) gelegenheiten.set(schluessel, n);
    }
    const eigene = [...gelegenheiten.values()].sort(
      (a, b) => a.erfasstAm.getTime() - b.erfasstAm.getTime(),
    );
    if (eigene.length < MIN_NENNUNGEN) continue;

    /*
     * Alle auf derselben Seite.
     *
     * Wer erst „lieber allein" und später „lieber im Team" sagt, hat
     * sich verändert — das ist eine wichtige Auskunft, aber kein Beleg
     * für eine gleichbleibende Eigenschaft. Solche Fälle fallen hier
     * still heraus, statt zum stärksten Beleg zu werden.
     */
    const seiten = new Set(eigene.map((n) => (n.wert >= 0.5 ? "hoch" : "tief")));
    if (seiten.size > 1) continue;
    if (!eigene.every((n) => Math.abs(n.wert - 0.5) >= MIN_AUSSCHLAG)) continue;

    const erste = eigene[0]!.erfasstAm.getTime();
    const letzte = eigene[eigene.length - 1]!.erfasstAm.getTime();
    const spanneTage = Math.round((letzte - erste) / TAG);
    if (spanneTage < MIN_SPANNE_TAGE) continue;

    const wert = eigene.reduce((a, n) => a + n.wert, 0) / eigene.length;
    const text = DIMENSIONSTEXT[dimension as Arbeitsdimension];
    if (!text) continue;
    const seite = wert >= 0.5 ? text.viel : text.wenig;

    ergebnis.push({
      dimension,
      wert,
      nennungen: eigene.length,
      spanneTage,
      aussage: `${seite} — über ${spanneTage} Tage ${eigene.length}-mal dasselbe gesagt, bei verschiedenen Gelegenheiten.`,
    });
  }

  /* Das längste Muster zuerst: Zeit ist hier das Gewicht. */
  return ergebnis.sort((a, b) => b.spanneTage - a.spanneTage);
}
