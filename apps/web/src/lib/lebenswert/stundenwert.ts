import { WOCHEN_JE_MONAT } from "./pendelzeit.ts";

/**
 * Was eine Stelle je tatsächlich aufgewendeter Stunde wert ist.
 *
 * ── Die Zahl, die zwei Stellen wirklich vergleicht ────────────
 *
 * Ein Jahresgehalt vergleicht zwei Stellen nur dann fair, wenn beide
 * gleich viel Zeit kosten. Das tun sie fast nie:
 *
 *   70.000 € bei 40 Stunden und einer Stunde Weg an fünf Tagen
 *   63.000 € bei 35 Stunden und zehn Minuten Weg an zwei Tagen
 *
 * Die erste zahlt mehr und ist je Stunde die schlechtere. Man sieht es
 * erst, wenn die Zeit danebensteht — und niemand rechnet das im Kopf,
 * weil die Umrechnung vier Zwischenschritte hat.
 *
 * ── Warum zwei Zahlen und nicht eine ──────────────────────────
 *
 * `proArbeitsstunde` ist die vertraute Grösse: Netto durch
 * Arbeitsstunden. `proAufgewendeterStunde` zählt den Arbeitsweg dazu,
 * denn diese Zeit ist genauso weg — nur unbezahlt.
 *
 * Beide zu zeigen ist wichtiger, als sich für eine zu entscheiden. Die
 * Differenz zwischen ihnen IST die Auskunft: Sie zeigt, was der Weg
 * kostet, ausgedrückt in der Einheit, in der man das Gehalt liest.
 *
 * ── Was hier NICHT passiert ───────────────────────────────────
 *
 * Keine Vierzig-Stunden-Annahme. Die Wochenstunden fehlen in vielen
 * Anzeigen, und bei einer Teilzeitstelle verfehlt „40" das Ergebnis um
 * die Hälfte — nach oben, also in die Richtung, die besser klingt.
 * Ohne Angabe gibt es hier keine Zahl, sondern einen Grund.
 */

export interface Stundenwert {
  /** Netto je bezahlter Arbeitsstunde. */
  proArbeitsstunde: number;
  /** Netto je Stunde, die die Stelle insgesamt kostet — Weg eingerechnet. */
  proAufgewendeterStunde: number | null;
  arbeitsstundenJeMonat: number;
  pendelstundenJeMonat: number | null;
  /**
   * Was der Weg je Stunde kostet, in Euro.
   *
   * Die Differenz der beiden Sätze — und die Zahl, die den Arbeitsweg
   * in der Einheit ausdrückt, in der man über Gehalt spricht.
   */
  wegkostenJeStunde: number | null;
}

export interface Stundenbefund {
  wert: Stundenwert | null;
  /** Warum es keine Zahl gibt. `null`, wenn es eine gibt. */
  grund: string | null;
}

export function stundenwert(
  nettoMonat: number | null,
  wochenstunden: number | null,
  pendelstundenJeMonat: number | null = null,
): Stundenbefund {
  if (nettoMonat === null || nettoMonat <= 0) {
    return { wert: null, grund: "Ohne Nettobetrag lässt sich kein Stundenwert rechnen." };
  }
  if (wochenstunden === null || wochenstunden <= 0) {
    /*
     * Der häufigste Fall, und deshalb ein eigener Satz.
     *
     * „Keine Angabe" wäre richtig und nutzlos. Der Satz sagt, woran es
     * liegt und was er wert wäre — dann weiss die Person, ob sie im
     * Gespräch danach fragt.
     */
    return {
      wert: null,
      grund:
        "Die Anzeige nennt keine Wochenstunden. Ohne sie ist ein Stundenwert nicht zu rechnen — " +
        "und mit 40 zu rechnen läge bei einer Teilzeitstelle um die Hälfte daneben.",
    };
  }

  const arbeitsstunden = wochenstunden * WOCHEN_JE_MONAT;
  const proArbeit = nettoMonat / arbeitsstunden;

  const gesamt =
    pendelstundenJeMonat !== null && pendelstundenJeMonat >= 0
      ? arbeitsstunden + pendelstundenJeMonat
      : null;
  const proGesamt = gesamt === null ? null : nettoMonat / gesamt;

  return {
    wert: {
      proArbeitsstunde: runde(proArbeit),
      proAufgewendeterStunde: proGesamt === null ? null : runde(proGesamt),
      arbeitsstundenJeMonat: Math.round(arbeitsstunden),
      pendelstundenJeMonat: pendelstundenJeMonat,
      wegkostenJeStunde: proGesamt === null ? null : runde(proArbeit - proGesamt),
    },
    grund: null,
  };
}

/**
 * Zwei Stellen je Stunde nebeneinander.
 *
 * Gibt zurück, welche je aufgewendeter Stunde mehr einbringt — und um
 * wie viel. `null`, sobald eine Seite keine Zahl hat: Ein Vergleich
 * gegen eine Lücke ist kein Vergleich.
 */
export function stundenvergleich(
  neu: Stundenwert | null,
  aktuell: Stundenwert | null,
): { unterschied: number; besser: "neu" | "aktuell" | "gleich" } | null {
  const a = neu?.proAufgewendeterStunde ?? neu?.proArbeitsstunde ?? null;
  const b = aktuell?.proAufgewendeterStunde ?? aktuell?.proArbeitsstunde ?? null;
  if (a === null || b === null) return null;

  /*
   * Nur vergleichen, was gleich gemessen ist.
   *
   * Wenn für die eine Seite der Weg mitgerechnet ist und für die andere
   * nicht, ist die Differenz keine Aussage über die Stellen, sondern
   * über unsere Datenlage — und sie fiele systematisch zugunsten der
   * Seite aus, über die wir weniger wissen.
   */
  const gleichGemessen =
    (neu?.proAufgewendeterStunde === null) === (aktuell?.proAufgewendeterStunde === null);
  if (!gleichGemessen) return null;

  const d = runde(a - b);
  return { unterschied: d, besser: d > 0 ? "neu" : d < 0 ? "aktuell" : "gleich" };
}

function runde(n: number): number {
  return Math.round(n * 100) / 100;
}
