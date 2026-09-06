/**
 * Welche Treffer in eine Zusammenfassung kommen — und welche nicht.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum Auswahl und Bewertung getrennt sind
 * ══════════════════════════════════════════════════════════════
 *
 * Die Bewertung sagt, wie gut eine Stelle passt. Die Auswahl sagt,
 * wofür wir jemanden am Morgen ansprechen. Das ist nicht dasselbe:
 * Fünf gute Stellen beim selben Arbeitgeber sind fünf gute Stellen
 * und eine schlechte Mail.
 *
 * ══════════════════════════════════════════════════════════════
 * Die Regel gegen das Auffüllen
 * ══════════════════════════════════════════════════════════════
 *
 * Es gibt keine Mindestzahl. Ein guter Treffer ist eine Mail wert,
 * und wenn nur einer da ist, steht einer drin.
 *
 * Der umgekehrte Reflex — „drei sollten es schon sein" — führt
 * zuverlässig dazu, dass Platz drei und vier mit etwas gefüllt werden,
 * das niemand empfohlen hätte. Nach zwei Wochen hat die Person
 * gelernt, dass die Mail nichts bedeutet.
 */

export interface Auswahlkandidat {
  trefferId: string;
  jobId: string;
  /** Dieselbe Stelle über mehrere Portale zeigt auf dieselbe Kennung. */
  kanonischeJobId: string;
  arbeitgeberId: string;
  auftragId: string;
  fitScore: number | null;
  /** Fingerabdruck der Angaben, die eine erneute Meldung rechtfertigen. */
  materielleFassung: string;
  berechnetAm: Date;
  grund: string | null;
  caveat: string | null;
}

export interface Auswahllage {
  /** Was dieser Person zu welcher Stelle schon gemeldet wurde. */
  bereitsGemeldet: Map<string, string>;
  /** Stellen, die sie gespeichert hat — bekannt, also keine Entdeckung. */
  gespeichert: Set<string>;
  /** Stellen, die sie abgelehnt hat. */
  abgelehnt: Set<string>;
  /** Stellen, auf die sie sich beworben hat. */
  beworben: Set<string>;
  /** Stellen, deren Anzeige geschlossen oder überaltert ist. */
  geschlossen: Set<string>;
}

export interface Auswahlregeln {
  /** Höchstens so viele Stellen je Mail. */
  hoechstens: number;
  /** Höchstens so viele je Arbeitgeber. */
  jeArbeitgeber: number;
}

export const AUSWAHL_V1: Auswahlregeln = { hoechstens: 5, jeArbeitgeber: 2 };

export type Postenart = "neu" | "aktualisierung";

export interface Auswahlposten extends Auswahlkandidat {
  art: Postenart;
  position: number;
}

export interface Auswahlergebnis {
  posten: Auswahlposten[];
  /**
   * Was weggefallen ist, und warum — gezählt, nicht geschätzt.
   *
   * Ohne diese Zahlen sieht eine kurze Liste aus wie ein leerer
   * Arbeitsmarkt. Sie ist aber oft das Gegenteil: viel gefunden, das
   * meiste schon bekannt.
   */
  verworfen: Record<string, number>;
}

export function leereLage(): Auswahllage {
  return {
    bereitsGemeldet: new Map(),
    gespeichert: new Set(),
    abgelehnt: new Set(),
    beworben: new Set(),
    geschlossen: new Set(),
  };
}

/**
 * Die Reihenfolge bei Gleichstand.
 *
 * Erst der Fit, dann die jüngere Berechnung, dann die Kennung. Der
 * letzte Schritt ist kein Schmuck: Ohne ihn hängt die Reihenfolge
 * zweier gleichwertiger Stellen an der Laune der Datenbank, und ein
 * wiederholter Lauf erzeugt eine andere Mail als der erste. Ein Test
 * darauf wäre dann nicht schreibbar.
 */
function reihenfolge(a: Auswahlkandidat, b: Auswahlkandidat): number {
  const fa = a.fitScore ?? -1;
  const fb = b.fitScore ?? -1;
  if (fa !== fb) return fb - fa;
  const za = a.berechnetAm.getTime();
  const zb = b.berechnetAm.getTime();
  if (za !== zb) return zb - za;
  return a.kanonischeJobId.localeCompare(b.kanonischeJobId);
}

export function auswaehlen(
  kandidaten: Auswahlkandidat[],
  lage: Auswahllage,
  regeln: Auswahlregeln = AUSWAHL_V1,
): Auswahlergebnis {
  const verworfen: Record<string, number> = {};
  const zaehle = (grund: string) => {
    verworfen[grund] = (verworfen[grund] ?? 0) + 1;
  };

  /*
   * Erst über Portale hinweg entdoppeln.
   *
   * Dieselbe Stelle bei zwei Anbietern ist eine Stelle. Behalten wird
   * die bestbewertete Fassung — nicht die zuerst gefundene.
   */
  const jeKanonisch = new Map<string, Auswahlkandidat>();
  for (const k of [...kandidaten].sort(reihenfolge)) {
    if (jeKanonisch.has(k.kanonischeJobId)) {
      zaehle("dublette_portal");
      continue;
    }
    jeKanonisch.set(k.kanonischeJobId, k);
  }

  const bewertet: Auswahlposten[] = [];
  for (const k of jeKanonisch.values()) {
    if (lage.geschlossen.has(k.kanonischeJobId)) {
      zaehle("anzeige_geschlossen");
      continue;
    }
    if (lage.abgelehnt.has(k.kanonischeJobId)) {
      zaehle("abgelehnt");
      continue;
    }
    if (lage.beworben.has(k.kanonischeJobId)) {
      zaehle("bereits_beworben");
      continue;
    }

    const gemeldet = lage.bereitsGemeldet.get(k.kanonischeJobId);
    if (gemeldet !== undefined) {
      /*
       * Schon gemeldet. Eine zweite Mail nur, wenn sich etwas geändert
       * hat, das die Entscheidung berührt — Gehalt, Vertrag,
       * Arbeitszeit, Ort.
       *
       * Ein neuer Analysezeitstempel reicht ausdrücklich nicht. Sonst
       * käme dieselbe Stelle jedes Mal wieder, wenn der Worker sie
       * anfasst.
       */
      if (gemeldet === k.materielleFassung) {
        zaehle("bereits_gemeldet");
        continue;
      }
      bewertet.push({ ...k, art: "aktualisierung", position: 0 });
      continue;
    }

    if (lage.gespeichert.has(k.kanonischeJobId)) {
      /*
       * Gespeichert heisst: Die Person kennt sie. Sie als „neu für
       * dich gefunden" zu verkaufen wäre eine kleine Lüge, und kleine
       * Lügen sind die, die auffallen.
       */
      zaehle("bereits_bekannt");
      continue;
    }

    bewertet.push({ ...k, art: "neu", position: 0 });
  }

  bewertet.sort(reihenfolge);

  const proArbeitgeber = new Map<string, number>();
  const posten: Auswahlposten[] = [];
  for (const p of bewertet) {
    if (posten.length >= regeln.hoechstens) {
      zaehle("obergrenze_mail");
      continue;
    }
    const bisher = proArbeitgeber.get(p.arbeitgeberId) ?? 0;
    if (bisher >= regeln.jeArbeitgeber) {
      zaehle("obergrenze_arbeitgeber");
      continue;
    }
    proArbeitgeber.set(p.arbeitgeberId, bisher + 1);
    posten.push({ ...p, position: posten.length });
  }

  return { posten, verworfen };
}
