/**
 * ══════════════════════════════════════════════════════════════════
 * Was eine Quelle mitbringen muss, bevor sie gelesen wird
 * ══════════════════════════════════════════════════════════════════
 *
 * ── Die drei Dinge, die gern verwechselt werden ─────────────────
 *
 *   Technische Verbindung   Das Konto ist verbunden, der Zugriff
 *                           funktioniert.
 *   Betriebliche Berechtigung  Jemand im Betrieb, der es darf, hat
 *                           für DIESEN Zweck zugestimmt.
 *   Rechtsgrundlage         Für diesen Zweck gibt es eine.
 *
 * Alle drei müssen einzeln dastehen. Die verbundene Gmail-Adresse für
 * den Bewerbungsversand ist genau der Fall, an dem das schiefgeht:
 * Die Verbindung besteht, also liest man das Postfach auch für die
 * Unternehmensanalyse aus. Das ist ein anderer Zweck, und der
 * Zugriffstoken weiss davon nichts.
 *
 * ── Zweckbindung, Datenminimierung, Speicherbegrenzung ──────────
 *
 * Art. 5 DSGVO. Hier bedeutet das: Eine Freigabe gilt für einen
 * Zweck und läuft ab. Zwecke vererben sich nicht, und ein zweiter
 * Zweck braucht eine zweite Zustimmung.
 */

/** Wofür eine Quelle freigegeben sein kann. Kein Zweck deckt einen anderen. */
export const ZWECKE = [
  "bewerbungsversand",
  "unternehmensanalyse",
  "faehigkeitsnachweis",
  "abrechnung",
] as const;
export type Zweck = (typeof ZWECKE)[number];

/**
 * Quellenarten, die nie im Ganzen ausgewertet werden.
 *
 * Nicht „nur mit Zustimmung“ — gar nicht. Ein Postfach vollständig zu
 * lesen, um einen Ablauf zu verstehen, ist eine Überwachung der
 * Menschen, die darin schreiben, auch wenn der Chef zustimmt. Was
 * gebraucht wird, sind Kennzahlen über Vorgänge, und die lassen sich
 * einzeln freigeben.
 */
export const NIE_IM_GANZEN = [
  "postfach",
  "mitarbeiterkommunikation",
  "kundendaten",
  "personalakte",
] as const;
export type Gesperrteart = (typeof NIE_IM_GANZEN)[number];

export function imGanzenGesperrt(art: string): boolean {
  return (NIE_IM_GANZEN as readonly string[]).includes(art.trim().toLowerCase());
}

export interface Quellenangabe {
  art: string;
  /** Wem die Quelle gehört — eine Person oder eine Stelle im Betrieb. */
  eigentuemer: string;
  /** Der Zweck, für den sie freigegeben wurde. */
  zweck: Zweck | null;
  /** Der Erhebungszeitraum. Ohne ihn ist keine Zahl daraus einzuordnen. */
  zeitraum: string | null;
  /** Wie alt der Stand ist, in Tagen. `null` heisst unbekannt. */
  alterTage: number | null;
  /** Wer die Ergebnisse sehen darf. */
  sichtbarFuer: readonly string[];
  /** Die drei getrennten Voraussetzungen. */
  technischVerbunden: boolean;
  betrieblichBerechtigt: boolean;
  rechtsgrundlage: string | null;
  /** Ob die Quelle auf Vorgangsebene liegt statt auf Personenebene. */
  aufVorgangsebene: boolean;
}

export type Quellenpruefung =
  | { erlaubt: true; hinweise: readonly string[] }
  | { erlaubt: false; grund: string };

/**
 * Darf diese Quelle für diesen Zweck gelesen werden?
 *
 * ── Warum die Reihenfolge festliegt ─────────────────────────────
 *
 * Erst die Sperre, dann der Zweck, dann die Berechtigung, dann die
 * Vollständigkeit der Angaben. Eine gesperrte Quellenart darf gar
 * nicht erst mit „aber es fehlt nur noch der Zeitraum“ beantwortet
 * werden — das wäre eine Anleitung, den Riegel zu öffnen.
 */
export function quellePruefen(q: Quellenangabe, zweck: Zweck): Quellenpruefung {
  if (imGanzenGesperrt(q.art)) {
    return {
      erlaubt: false,
      grund: `„${q.art}“ wird nicht im Ganzen ausgewertet. Einzelne Kennzahlen über Vorgänge können Sie freigeben.`,
    };
  }

  if (q.zweck === null) {
    return { erlaubt: false, grund: "Für diese Quelle ist kein Zweck hinterlegt." };
  }
  if (q.zweck !== zweck) {
    return {
      erlaubt: false,
      grund: `Diese Quelle ist für „${q.zweck}“ freigegeben, nicht für „${zweck}“. Ein Zweck deckt keinen anderen.`,
    };
  }

  if (!q.technischVerbunden) {
    return { erlaubt: false, grund: "Die Quelle ist technisch nicht verbunden." };
  }
  if (!q.betrieblichBerechtigt) {
    return {
      erlaubt: false,
      grund: "Es hat niemand im Betrieb bestätigt, dass diese Quelle dafür verwendet werden darf.",
    };
  }
  if (q.rechtsgrundlage === null || q.rechtsgrundlage.trim().length === 0) {
    return { erlaubt: false, grund: "Es ist keine Rechtsgrundlage angegeben." };
  }

  const hinweise: string[] = [];
  if (q.zeitraum === null) {
    hinweise.push("Der Erhebungszeitraum fehlt — Zahlen daraus bleiben ohne Bezug.");
  }
  if (q.alterTage !== null && q.alterTage > 365) {
    hinweise.push("Der Stand ist über ein Jahr alt.");
  }
  if (!q.aufVorgangsebene) {
    hinweise.push(
      "Diese Quelle liegt auf Personenebene. Wo es geht, wird auf Vorgangsebene ausgewertet.",
    );
  }
  if (q.sichtbarFuer.length === 0) {
    hinweise.push("Es ist nicht festgelegt, wer die Ergebnisse sehen darf.");
  }

  return { erlaubt: true, hinweise };
}

/**
 * Der Text, der vor einem Import steht.
 *
 * Vier Fragen, in dieser Reihenfolge — weil sie in dieser Reihenfolge
 * gestellt werden, wenn jemand später fragt, was mit seinen Daten
 * passiert ist.
 */
export function vorschauText(q: Quellenangabe, zweck: Zweck, aufbewahrungTage: number): string[] {
  return [
    `Verarbeitet wird: ${q.art} (${q.eigentuemer})${q.zeitraum ? `, Zeitraum ${q.zeitraum}` : ""}.`,
    `Wofür: ${zweck}.`,
    `Sichtbar für: ${q.sichtbarFuer.length > 0 ? q.sichtbarFuer.join(", ") : "noch nicht festgelegt"}.`,
    `Aufbewahrt: ${aufbewahrungTage} Tage, danach gelöscht.`,
  ];
}
