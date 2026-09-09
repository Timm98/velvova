import type { Lagebild, Stand } from "./lagebild.ts";

/**
 * ══════════════════════════════════════════════════════════════════
 * Die Synthese — und was daran nicht dem Modell überlassen wird
 * ══════════════════════════════════════════════════════════════════
 *
 * Am Ende steht eine Antwort in Sätzen, und die schreibt ein Modell.
 * Das ist die einzige Aufgabe hier, für die es eines braucht.
 *
 * Alles davor ist bereits entschieden: was gilt, was strittig ist,
 * was verworfen wurde. Diese Datei bringt es in eine Form, in der es
 * sich nicht mehr umdrehen lässt.
 *
 * ── Warum die Reihenfolge fest ist ──────────────────────────────
 *
 * Bekäme das Modell eine unsortierte Liste, würde es selbst gewichten
 * — und es gewichtet nach Häufigkeit, weil dreimal Gesagtes in einem
 * Text wichtiger wirkt. Damit käme die Mehrheitsregel durch die
 * Hintertür zurück, nachdem zwei Runden lang verhindert wurde, dass
 * sie durch die Vordertür kommt.
 *
 * ── Warum Verworfenes gar nicht erst mitkommt ───────────────────
 *
 * Weil ein Modell, das eine widerlegte Behauptung im Material sieht,
 * sie erwähnt — und sei es als „manche meinen". Der Satz steht dann
 * im Text, der Leser nimmt ihn mit, und die Widerlegung war umsonst.
 * Was verworfen ist, gehört ins Protokoll, nicht in die Antwort.
 */

export interface Syntheseabschnitt {
  stand: Stand;
  ueberschrift: string;
  aussagen: string[];
}

export interface Synthesevorlage {
  abschnitte: Syntheseabschnitt[];
  /**
   * Was der Text über seine eigene Herkunft sagen muss.
   *
   * Ohne diesen Satz liest sich das Ergebnis eines ausgefallenen
   * Prüflaufs genauso wie das eines vollständigen. Das ist der
   * gefakte Fortschritt, der ausgeschlossen ist — deshalb wird der
   * Hinweis hier erzeugt und nicht vom Modell erhofft.
   */
  hinweis: string;
  /** Wie viele Aussagen aussortiert wurden. Nur fürs Protokoll. */
  verworfen: number;
}

const UEBERSCHRIFT: Record<Stand, string> = {
  gesichert: "Belegt und gegengeprüft",
  gestuetzt: "Geprüft, aber ohne Beleg",
  strittig: "Offen — die Modelle sind sich uneinig",
  ungeprueft: "Nicht gegengeprüft",
  verworfen: "",
};

/** Die Reihenfolge, in der die Abschnitte in den Prompt gehen. */
const FOLGE: Stand[] = ["gesichert", "gestuetzt", "strittig", "ungeprueft"];

export function syntheseVorlage(bild: Lagebild): Synthesevorlage {
  const abschnitte: Syntheseabschnitt[] = [];

  for (const stand of FOLGE) {
    const aussagen = bild.staende.filter((s) => s.stand === stand).map((s) => s.aussage);
    if (aussagen.length > 0) {
      abschnitte.push({ stand, ueberschrift: UEBERSCHRIFT[stand], aussagen });
    }
  }

  const offen = bild.staende.filter((s) => s.stand === "strittig").length;

  const hinweis = !bild.gegengeprueft
    ? "Diese Antwort wurde nicht gegengeprüft — die zweite Runde ist ausgefallen."
    : offen > 0
      ? `${offen} Punkt${offen === 1 ? "" : "e"} ${offen === 1 ? "blieb" : "blieben"} offen und ${offen === 1 ? "ist" : "sind"} als offen zu benennen.`
      : "Alle Aussagen wurden gegengeprüft.";

  return {
    abschnitte,
    hinweis,
    verworfen: bild.staende.filter((s) => s.stand === "verworfen").length,
  };
}
