/**
 * ══════════════════════════════════════════════════════════════════
 * Wann aus einer Auffälligkeit ein Befund wird — und wann nicht
 * ══════════════════════════════════════════════════════════════════
 *
 * Die Kette aus der Diagnose:
 *
 *   Quellen prüfen → Beobachtungen erfassen → Auffälligkeiten
 *   erkennen → alternative Erklärungen entwickeln → Gegenbelege
 *   suchen → gezielt nachfragen → Befund bestätigen oder verwerfen
 *
 * Diese Datei hält den vorletzten Schritt. Sie entscheidet nichts über
 * Ursachen; sie entscheidet, ob überhaupt genug dasteht, um von einem
 * Befund zu sprechen.
 *
 * ── Der Fehler, gegen den sie gebaut ist ────────────────────────
 *
 * Ein Signal ist keine Ursache. Lange Bearbeitungszeiten können an
 * schwierigeren Fällen liegen, an fehlenden Informationen, an
 * Kapazität — oder daran, dass die Zeitstempel nichts taugen. Wer
 * daraus „mehr Personal“ macht, hat nicht gemessen, sondern geraten.
 *
 * ── Und gegen den zweiten ───────────────────────────────────────
 *
 * „Kein belastbarer Befund“ ist ein gültiges Ergebnis. Ein Bericht,
 * der jeden Monat etwas finden muss, findet jeden Monat etwas.
 */

/** Woher eine Angabe stammt. Steht an jeder Zahl im Bericht. */
export const ANGABEARTEN = ["gemessen", "berichtet", "geschaetzt", "zu_pruefen"] as const;
export type Angabeart = (typeof ANGABEARTEN)[number];

export const ANGABETEXT: Record<Angabeart, string> = {
  gemessen: "gemessen",
  berichtet: "vom Unternehmen berichtet",
  geschaetzt: "geschätzt",
  zu_pruefen: "noch zu prüfen",
};

/** Eine Quelle, auf die sich ein Befund stützt. */
export interface Quellenbezug {
  /** Der Eintrag in der Quellenverwaltung. */
  id: string;
  /**
   * Wer die Quelle geliefert hat und was sie ist — zusammen der
   * Schlüssel, an dem Unabhängigkeit gemessen wird.
   */
  eigentuemer: string;
  art: string;
  /** Der Erhebungszeitraum, als Text wie im Bericht. */
  zeitraum: string;
  /** Welcher Anteil des Betrachteten abgedeckt ist, 0–1. `null` heisst unbekannt. */
  abdeckung: number | null;
}

/**
 * Wie viele voneinander unabhängige Quellen dahinterstehen.
 *
 * ── Warum nicht einfach `quellen.length` ────────────────────────
 *
 * Weil derselbe Export aus demselben System in drei Dateien dreimal
 * hochgeladen werden kann, und dann sähe ein Befund dreifach belegt
 * aus. Gezählt wird das Paar aus Eigentümer und Art: Dieselbe Person,
 * dieselbe Unterlagenart — eine Quelle.
 */
export function unabhaengigeQuellen(quellen: readonly Quellenbezug[]): number {
  const gesehen = new Set(
    quellen.map((q) => `${q.eigentuemer.trim().toLowerCase()}|${q.art.trim().toLowerCase()}`),
  );
  return gesehen.size;
}

/** Ohne mindestens eine festgehaltene Gegenerklärung kein Befund. */
export const MINDEST_ALTERNATIVEN = 1;

export interface Befundentwurf {
  /** Was beobachtet wurde — keine Ursache, kein Urteil. */
  beobachtung: string;
  quellen: readonly Quellenbezug[];
  /** Andere Erklärungen, die geprüft wurden. */
  alternativen: readonly string[];
  /** Was dagegen spricht. Leer ist erlaubt, `gegenbelegeGeprueft` nicht. */
  gegenbelege: readonly string[];
  /** Ob nach Gegenbelegen überhaupt gesucht wurde. */
  gegenbelegeGeprueft: boolean;
  /** Ob ein zuständiger Mensch im Betrieb zugestimmt hat. */
  vomUnternehmenBestaetigt: boolean;
}

export type Befundlage =
  | { stand: "bestaetigt"; unabhaengig: number }
  | { stand: "hypothese"; fehlt: string }
  | { stand: "verworfen"; grund: string }
  | { stand: "kein_befund" };

/**
 * Was aus einem Entwurf geworden ist.
 *
 * ── Warum die Gegenbelege zuerst geprüft werden ─────────────────
 *
 * Weil eine widerlegte Beobachtung nicht dadurch zum Befund wird,
 * dass jemand sie bestätigt. Wer im Betrieb zustimmt, kennt die
 * Gegenbelege oft nicht — die Reihenfolge schützt ihn davor, etwas
 * zu bestätigen, das schon widerlegt ist.
 */
export function befundPruefen(e: Befundentwurf): Befundlage {
  if (e.beobachtung.trim().length === 0 || e.quellen.length === 0) {
    return { stand: "kein_befund" };
  }

  if (e.gegenbelege.length > 0) {
    return { stand: "verworfen", grund: e.gegenbelege[0]! };
  }

  if (e.alternativen.length < MINDEST_ALTERNATIVEN) {
    return { stand: "hypothese", fehlt: "eine geprüfte alternative Erklärung" };
  }
  if (!e.gegenbelegeGeprueft) {
    return { stand: "hypothese", fehlt: "die Suche nach Gegenbelegen" };
  }

  const unabhaengig = unabhaengigeQuellen(e.quellen);
  if (unabhaengig < 2) {
    return { stand: "hypothese", fehlt: "eine zweite, unabhängige Quelle" };
  }
  if (!e.vomUnternehmenBestaetigt) {
    return { stand: "hypothese", fehlt: "die Bestätigung im Betrieb" };
  }

  return { stand: "bestaetigt", unabhaengig };
}

/**
 * Ob ein Satz eine Wahrscheinlichkeit behauptet.
 *
 * Es gibt keine Prozentangabe für die Wahrscheinlichkeit einer
 * Ursache. Sie entsteht in einem Modell aus nichts, liest sich aber
 * wie eine Messung — und genau deshalb glaubt man sie.
 *
 * Zahlen an sich sind erlaubt: „80 Vorgänge im Monat“ ist eine
 * Auskunft. Nur die Verbindung von Zahl und Sicherheitsbehauptung
 * geht nicht durch.
 */
export function istWahrscheinlichkeitsangabe(satz: string): boolean {
  const t = satz.toLowerCase();
  const muster: RegExp[] = [
    /\d{1,3}\s*(%|prozent)[^.]{0,40}(wahrschein|sicher|vermut|ursach|zutreff|konfidenz)/i,
    /(wahrschein|sicher|vermut|konfidenz)[^.]{0,40}\d{1,3}\s*(%|prozent)/i,
    /\d{1,3}\s*[-–]?\s*prozentig/i,
  ];
  return muster.some((m) => m.test(t));
}

export interface Zeitschaetzung {
  stunden: number;
  art: Angabeart;
  satz: string;
}

/**
 * Aus Vorgängen und Minuten wird Zeit — und nichts anderes.
 *
 * ── Warum kein Geldbetrag ───────────────────────────────────────
 *
 * Weil frei werdende Zeit kein eingespartes Geld ist. Acht Stunden
 * weniger Nacharbeit im Monat werden erst dann zu einer Zahl auf
 * einer Rechnung, wenn jemand weniger arbeitet oder mehr schafft, und
 * beides entscheidet der Betrieb, nicht die Formel.
 *
 * Beide Eingaben sind Schätzungen des Betriebs. Das Ergebnis ist
 * deshalb `geschaetzt`, auch wenn die Multiplikation exakt ist.
 */
export function zeitschaetzung(vorgaengeJeMonat: number, minutenJeVorgang: number): Zeitschaetzung | null {
  if (!Number.isFinite(vorgaengeJeMonat) || !Number.isFinite(minutenJeVorgang)) return null;
  if (vorgaengeJeMonat <= 0 || minutenJeVorgang <= 0) return null;

  const stunden = Math.round(((vorgaengeJeMonat * minutenJeVorgang) / 60) * 10) / 10;
  return {
    stunden,
    art: "geschaetzt",
    satz: `Rechnerisch rund ${stunden.toLocaleString("de-DE")} Stunden im Monat — geschätzter Zeitaufwand aus Ihren Angaben, kein nachgewiesener Geldbetrag.`,
  };
}

/**
 * Dieselbe Zeit, in zwei Befunden gezählt.
 *
 * Zwei Befunde, die sich auf dieselbe Quelle und denselben Zeitraum
 * stützen, dürfen ihre Stunden nicht addieren — sonst summiert sich
 * ein Bericht in eine Zahl, die es im Betrieb nie gab. Gibt die
 * Schlüssel zurück, die mehr als einmal vorkommen.
 */
export function doppelzaehlungen(
  befunde: readonly { quellen: readonly Quellenbezug[] }[],
): string[] {
  const zaehler = new Map<string, number>();
  for (const b of befunde) {
    const eigene = new Set(
      b.quellen.map((q) => `${q.id}|${q.zeitraum.trim().toLowerCase()}`),
    );
    for (const s of eigene) zaehler.set(s, (zaehler.get(s) ?? 0) + 1);
  }
  return [...zaehler.entries()].filter(([, n]) => n > 1).map(([s]) => s);
}
