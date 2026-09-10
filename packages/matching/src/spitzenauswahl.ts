/**
 * ══════════════════════════════════════════════════════════════════
 * Von hundert auf fünf
 * ══════════════════════════════════════════════════════════════════
 *
 * Der Nachtlauf prüft rund hundert Stellen. Was davon morgens
 * dasteht, sind fünf. Zwischen beidem liegt eine Entscheidung, die
 * bisher allein am Passungswert hing — und der beantwortet die Frage
 * „passt die Arbeit zu mir", nicht „welche dieser fünf nehme ich".
 *
 * Diese Datei beantwortet die zweite Frage.
 *
 * ── Warum der Passungswert in Bänder fällt ──────────────────────
 *
 * Sortiert man streng nach Fit, entscheidet ein Unterschied von einem
 * Punkt über eine Gehaltsdifferenz von zwölftausend Euro im Jahr. Das
 * ist keine Entscheidung, das ist ein Rundungsfehler mit Folgen: Der
 * Fit ist auf fünf Punkte genau ehrlich, nicht auf einen.
 *
 * Innerhalb eines Bandes darf deshalb etwas anderes entscheiden — und
 * das Erste, was jeder Mensch fragt, ist das Gehalt.
 *
 * ── Die Regel, die alles andere trägt ───────────────────────────
 *
 * Ein Kriterium entscheidet nur, wenn es auf BEIDEN Seiten bekannt
 * ist. Sonst geht es weiter zum nächsten.
 *
 * Der Grund ist gemessen: 77 Prozent der deutschen Anzeigen nennen
 * kein Gehalt. Eine Sortierung, die Unbekanntes wie „null Euro"
 * behandelt, stellt genau diese 77 Prozent nach hinten — und der
 * Mensch bekommt morgens die fünf Stellen, deren Arbeitgeber am
 * gesprächigsten war, nicht die fünf besten.
 *
 * ── Was heute nicht mitentscheiden kann ─────────────────────────
 *
 * Arbeitgeberbewertungen. `review_aggregates` hat am 10.09.2026 null
 * Zeilen bei 421.515 Firmen. Das Feld steht hier trotzdem — aber es
 * bleibt wirkungslos, solange nichts darin steht, und `grundlage()`
 * sagt das offen, statt eine Sortierung zu behaupten, die es nicht
 * gibt.
 */

/** Wie fein der Passungswert wirklich ist. Feiner zu sortieren wäre Schein. */
export const FITBAND = 5;

export type Rangkriterium = "passung" | "gehalt" | "anzeigenqualitaet" | "arbeitgeberurteil";

export interface Spitzenkandidat {
  trefferId: string;
  arbeitgeberId: string;
  /** `null` heisst: die Datenlage trug keine Zahl. */
  fitScore: number | null;
  /** Jahresbrutto in Euro. `null` heisst: die Anzeige nennt keines. */
  gehaltJahr: number | null;
  /** 0–100 aus `anzeigenqualitaet()`. */
  anzeigenqualitaet: number | null;
  /** 0–1, aus `review_aggregates`. Heute überall `null`. */
  arbeitgeberurteil: number | null;
}

export interface Spitzenregeln {
  anzahl: number;
  /** Fünf gute Stellen beim selben Arbeitgeber sind eine schlechte Mail. */
  jeArbeitgeber: number;
}

export const SPITZE_V1: Spitzenregeln = { anzahl: 5, jeArbeitgeber: 2 };

function band(fit: number | null): number {
  if (fit === null) return -1;
  return Math.floor(fit / FITBAND);
}

/**
 * Die Reihenfolge.
 *
 * Vier Stufen, und jede greift nur, wenn beide Seiten sie hergeben.
 * Die letzte Stufe ist die Kennung — ohne sie hinge die Reihenfolge
 * zweier gleichwertiger Stellen an der Laune der Datenbank, und ein
 * zweiter Lauf erzeugte eine andere Liste als der erste.
 */
export function spitzenreihenfolge(a: Spitzenkandidat, b: Spitzenkandidat): number {
  const ba = band(a.fitScore);
  const bb = band(b.fitScore);
  if (ba !== bb) return bb - ba;

  if (a.gehaltJahr !== null && b.gehaltJahr !== null && a.gehaltJahr !== b.gehaltJahr) {
    return b.gehaltJahr - a.gehaltJahr;
  }

  if (
    a.anzeigenqualitaet !== null &&
    b.anzeigenqualitaet !== null &&
    a.anzeigenqualitaet !== b.anzeigenqualitaet
  ) {
    return b.anzeigenqualitaet - a.anzeigenqualitaet;
  }

  if (
    a.arbeitgeberurteil !== null &&
    b.arbeitgeberurteil !== null &&
    a.arbeitgeberurteil !== b.arbeitgeberurteil
  ) {
    return b.arbeitgeberurteil - a.arbeitgeberurteil;
  }

  /* Innerhalb des Bandes und ohne entscheidbares Kriterium: der genaue Fit. */
  const fa = a.fitScore ?? -1;
  const fb = b.fitScore ?? -1;
  if (fa !== fb) return fb - fa;

  return a.trefferId.localeCompare(b.trefferId);
}

export interface Spitzenergebnis {
  gewaehlt: Spitzenkandidat[];
  /** Welche Kriterien tatsächlich mitentschieden haben. */
  grundlage: Rangkriterium[];
  /** Welche fehlten — gehört in den Bericht, nicht ins Schweigen. */
  fehlend: Rangkriterium[];
}

/**
 * Welche Kriterien überhaupt tragen.
 *
 * Ein Kriterium trägt, wenn mindestens zwei Kandidaten es haben —
 * eines allein kann nichts entscheiden. Das ist keine Feinheit: Wer
 * morgens liest „sortiert nach Passung und Gehalt", während genau
 * eine Anzeige ein Gehalt nennt, ist belogen worden.
 */
export function grundlage(kandidaten: readonly Spitzenkandidat[]): {
  grundlage: Rangkriterium[];
  fehlend: Rangkriterium[];
} {
  const zaehle = (f: (k: Spitzenkandidat) => number | null) =>
    kandidaten.filter((k) => f(k) !== null).length;

  const paare: [Rangkriterium, number][] = [
    ["passung", zaehle((k) => k.fitScore)],
    ["gehalt", zaehle((k) => k.gehaltJahr)],
    ["anzeigenqualitaet", zaehle((k) => k.anzeigenqualitaet)],
    ["arbeitgeberurteil", zaehle((k) => k.arbeitgeberurteil)],
  ];

  return {
    grundlage: paare.filter(([, n]) => n >= 2).map(([k]) => k),
    fehlend: paare.filter(([, n]) => n < 2).map(([k]) => k),
  };
}

/**
 * Die besten `anzahl` aus der geprüften Menge.
 *
 * Keine Mindestzahl: Sind nur drei da, stehen drei dort. Der
 * umgekehrte Reflex — „fünf sollten es schon sein" — füllt Platz vier
 * und fünf mit etwas, das niemand empfohlen hätte, und nach zwei
 * Wochen hat die Person gelernt, dass die Liste nichts bedeutet.
 */
export function spitzenauswahl(
  kandidaten: readonly Spitzenkandidat[],
  regeln: Spitzenregeln = SPITZE_V1,
): Spitzenergebnis {
  const sortiert = [...kandidaten].sort(spitzenreihenfolge);
  const jeArbeitgeber = new Map<string, number>();
  const gewaehlt: Spitzenkandidat[] = [];

  for (const k of sortiert) {
    if (gewaehlt.length >= regeln.anzahl) break;
    const bisher = jeArbeitgeber.get(k.arbeitgeberId) ?? 0;
    if (bisher >= regeln.jeArbeitgeber) continue;
    jeArbeitgeber.set(k.arbeitgeberId, bisher + 1);
    gewaehlt.push(k);
  }

  return { gewaehlt, ...grundlage(kandidaten) };
}

/**
 * Der Satz, der die Reihenfolge erklärt.
 *
 * Er nennt nur, was wirklich entschieden hat. „Sortiert nach Passung"
 * ist kürzer als „sortiert nach Passung, Gehalt, Anzeigenqualität und
 * Arbeitgeberbewertungen" — und wenn nur der Fit da war, ist es das
 * einzige, was stimmt.
 */
export function grundlagenSatz(e: Spitzenergebnis): string {
  const wort: Record<Rangkriterium, string> = {
    passung: "Passung",
    gehalt: "Gehalt",
    anzeigenqualitaet: "Klarheit der Anzeige",
    arbeitgeberurteil: "Bewertungen der Arbeitgeber",
  };
  if (e.grundlage.length === 0) return "Für eine Reihenfolge reichte die Datenlage nicht.";

  const genannt = e.grundlage.map((k) => wort[k]);
  const satz =
    genannt.length === 1
      ? `Sortiert nach ${genannt[0]}.`
      : `Sortiert nach ${genannt.slice(0, -1).join(", ")} und ${genannt.at(-1)}.`;

  if (e.fehlend.includes("gehalt")) {
    return `${satz} Zum Gehalt schweigen zu viele dieser Anzeigen, als dass es mitentscheiden könnte.`;
  }
  if (e.fehlend.includes("arbeitgeberurteil")) {
    return `${satz} Bewertungen der Arbeitgeber liegen dazu nicht vor.`;
  }
  return satz;
}
