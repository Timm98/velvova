import type { Aufgabenlast, RoutingDecision } from "./router.ts";
import { eskalieren } from "./router.ts";

/**
 * Eine zweite, unabhängige Analyse — und was sie wert ist.
 *
 * ══════════════════════════════════════════════════════════════
 * Wofür das gut ist
 * ══════════════════════════════════════════════════════════════
 *
 * Manche Fragen haben keine sichere Antwort. „Soll ich die Branche
 * wechseln" ist so eine: Zwei gute Analysten kommen zu verschiedenen
 * Schlüssen, und beide haben Gründe.
 *
 * Ein einzelnes Modell verbirgt das. Es antwortet in einem Ton, der
 * nach Gewissheit klingt, weil Modelle immer so antworten. Zwei
 * unabhängige Läufe machen sichtbar, ob die Sache klar ist — oder ob
 * die Klarheit nur in der Formulierung lag.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum die zweite Analyse die erste nicht sieht
 * ══════════════════════════════════════════════════════════════
 *
 * Das ist der ganze Punkt. Bekäme Astra Sols Schlussfolgerung
 * mitgeliefert, hätte man keine zweite Meinung, sondern eine
 * Bestätigung — Modelle stimmen dem zu, was im Kontext steht.
 *
 * Beide bekommen dieselben Fakten und dieselbe Frage. Was
 * herauskommt, wird danach verglichen.
 *
 * ══════════════════════════════════════════════════════════════
 * Und warum die zweite nicht gewinnt
 * ══════════════════════════════════════════════════════════════
 *
 * „Das teurere Modell hat recht" wäre keine Prüfung, sondern eine
 * Rangordnung. Wenn zwei Analysen auseinandergehen, ist das eine
 * Auskunft über die Frage, nicht über die Modelle: Sie ist offen.
 *
 * Monday soll das sagen dürfen — oder gezielt nachfragen, statt sich
 * für eine Seite zu entscheiden, die sie nicht begründen kann.
 */

export interface Abweichung {
  feld: string;
  erst: unknown;
  zweit: unknown;
  /** Wie weit sie auseinanderliegen — nur bei Zahlen. */
  abstand: number | null;
}

export interface Vergleichsbefund<T> {
  erst: T;
  zweit: T | null;
  /** Ob eine zweite Analyse überhaupt lief. */
  zweitLief: boolean;
  /** Warum sie lief — oder warum nicht. */
  grund: string;
  einig: boolean;
  abweichungen: Abweichung[];
  /** Was die Person erfahren soll, wenn sie auseinandergehen. */
  hinweis: string | null;
}

/**
 * Ab welchem Abstand zwei Zahlen als verschieden gelten.
 *
 * Bei Bewertungen von 0 bis 100 sind fünf Punkte Rauschen und
 * fünfzehn eine andere Meinung. Der Wert ist eine
 * Produktentscheidung, kein Messwert.
 */
export const ABWEICHUNG_AB = 15;

/**
 * Zwei strukturierte Ergebnisse vergleichen.
 *
 * ── Warum nur die oberste Ebene ───────────────────────────────
 *
 * Tiefer zu vergleichen ergäbe eine Liste von Unterschieden in
 * Formulierungen — zwei Analysen schreiben denselben Gedanken nie
 * gleich auf. Was zählt, sind die Zahlen und die Entscheidung, und
 * die stehen oben.
 */
export function vergleichen(erst: unknown, zweit: unknown): Abweichung[] {
  if (typeof erst !== "object" || erst === null || typeof zweit !== "object" || zweit === null) {
    return [];
  }

  const raus: Abweichung[] = [];
  const a = erst as Record<string, unknown>;
  const b = zweit as Record<string, unknown>;

  for (const feld of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[feld];
    const y = b[feld];

    if (typeof x === "number" && typeof y === "number") {
      const abstand = Math.abs(x - y);
      if (abstand >= ABWEICHUNG_AB) raus.push({ feld, erst: x, zweit: y, abstand });
      continue;
    }

    /*
     * Bei Text zählt nur eine kurze Entscheidung — „empfehlen",
     * „abraten". Ganze Absätze zu vergleichen ergäbe immer eine
     * Abweichung und damit nie eine Aussage.
     */
    if (typeof x === "string" && typeof y === "string") {
      if (x.length <= 40 && y.length <= 40 && x.trim() !== y.trim()) {
        raus.push({ feld, erst: x, zweit: y, abstand: null });
      }
      continue;
    }

    if (typeof x === "boolean" && typeof y === "boolean" && x !== y) {
      raus.push({ feld, erst: x, zweit: y, abstand: null });
    }
  }

  return raus;
}

export interface Zweitmeinungsauftrag<T> {
  /** Die Fakten — für beide Läufe dieselben. */
  fakten: string;
  /** Das Ergebnis der ersten Analyse. */
  erst: T;
  /** Wie sicher die erste war, 0 bis 1. */
  konfidenz?: number;
  /** Die Merkmale, die über eine Eskalation entscheiden. */
  last?: Aufgabenlast;
  /** Die Entscheidung des Routers zur ersten Analyse. */
  entscheidung: RoutingDecision;
  /**
   * Die zweite Analyse — bekommt NUR die Fakten.
   *
   * Der Aufrufer baut sie, damit dieses Modul kein Modell kennt und
   * ohne Anbieter prüfbar bleibt.
   */
  zweitlauf: (fakten: string) => Promise<T>;
  /** Ob die höchste Stufe überhaupt eingerichtet ist. */
  ultraVerfuegbar: boolean;
}

/**
 * Eine zweite Meinung einholen — wenn sie etwas beiträgt.
 *
 * ── Warum sie meistens ausbleibt ──────────────────────────────
 *
 * Sie kostet einen zweiten Lauf des teuersten Modells. Bei einer
 * klaren Lage ist das Geld für eine Bestätigung, die niemand
 * gebraucht hat.
 */
export async function zweiteMeinung<T>(
  auftrag: Zweitmeinungsauftrag<T>,
): Promise<Vergleichsbefund<T>> {
  const ohne = (grund: string): Vergleichsbefund<T> => ({
    erst: auftrag.erst,
    zweit: null,
    zweitLief: false,
    grund,
    einig: true,
    abweichungen: [],
    hinweis: null,
  });

  if (!auftrag.ultraVerfuegbar) return ohne("Keine höchste Stufe eingerichtet.");

  const befund = eskalieren(auftrag.entscheidung, {
    ...auftrag.last,
    konfidenz: auftrag.konfidenz ?? auftrag.last?.konfidenz,
  });
  if (!befund.eskaliert) return ohne(befund.grund);

  let zweit: T;
  try {
    zweit = await auftrag.zweitlauf(auftrag.fakten);
  } catch (fehler) {
    /*
     * Eine gescheiterte zweite Meinung ist kein gescheiterter
     * Vorgang. Die erste Analyse steht, und sie war nie von der
     * zweiten abhängig — das wäre auch der falsche Aufbau.
     */
    return ohne(
      `Zweite Analyse nicht möglich: ${fehler instanceof Error ? fehler.message.slice(0, 120) : "unbekannt"}`,
    );
  }

  const abweichungen = vergleichen(auftrag.erst, zweit);
  const einig = abweichungen.length === 0;

  return {
    erst: auftrag.erst,
    zweit,
    zweitLief: true,
    grund: befund.grund,
    einig,
    abweichungen,
    /*
     * Der Hinweis nennt das Thema, nicht die Modelle.
     *
     * „Sol und Astra sind sich uneinig" wäre für die Person keine
     * Auskunft, sondern ein Blick in unsere Maschine. Was sie wissen
     * muss: An dieser Stelle ist die Sache nicht eindeutig.
     */
    hinweis: einig
      ? null
      : `Bei ${abweichungen.map((a) => a.feld).join(" und ")} bin ich mir nicht sicher — ` +
        `zwei Durchgänge kommen zu verschiedenen Einschätzungen.`,
  };
}
