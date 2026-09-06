/**
 * Was aus Rückmeldungen folgen darf — und was nicht.
 *
 * ══════════════════════════════════════════════════════════════
 * Die Regel, die hier alles trägt
 * ══════════════════════════════════════════════════════════════
 *
 * Aus sieben Ablehnungen wegen Kundenkontakt wird kein Filter. Es
 * wird eine Frage.
 *
 * Der Unterschied ist nicht kosmetisch. Ein System, das aus
 * beobachtetem Verhalten stillschweigend Regeln macht, erklärt einen
 * Menschen für festgelegt — und er kann es nicht widerrufen, weil er
 * nie etwas gesagt hat. Er merkt nur, dass bestimmte Stellen nicht
 * mehr kommen, und weiss nicht, warum.
 *
 * ══════════════════════════════════════════════════════════════
 * Was ausdrücklich KEIN Signal ist
 * ══════════════════════════════════════════════════════════════
 *
 *   Ein fehlender Klick.        Vielleicht war keine Zeit.
 *   Ein nicht geöffnetes Mail.  Vorschaufenster zählen nicht mit,
 *                               Bildblocker melden nie ein Öffnen.
 *   Eine Ablehnung ohne Grund.  Sie sagt „diese nicht", nicht
 *                               „solche nicht".
 *
 * Deshalb zählen unten nur Ablehnungen MIT genanntem Grund. Alles
 * andere wäre eine Deutung von Schweigen.
 */

/** Nach wie vielen gleichartigen Ablehnungen nachgefragt wird. */
export const KLAERUNG_AB = 3;

/** Wie lange eine Ablehnung für diese Zählung mitzählt. */
export const KLAERUNG_FENSTER_TAGE = 60;

/**
 * Nach wie vielen Tagen ohne verlässliche Aktivität die
 * Benachrichtigungen ruhen.
 *
 * „Verlässlich" heisst: eine Handlung in der Anwendung oder eine
 * ausdrückliche Reaktion. Nicht: eine geöffnete Mail.
 */
export const RUHEND_NACH_TAGEN = 60;

export interface Ablehnung {
  /** gehalt · standort · remote · aufgaben · unternehmen · … */
  grund: string | null;
  erstelltAm: Date;
}

export interface Klaerungsfrage {
  grund: string;
  anzahl: number;
  /** Die Frage, die gestellt wird — offen, nicht suggestiv. */
  frage: string;
}

/**
 * Ob eine Klärungsfrage ansteht.
 *
 * Sie wird gestellt, nicht beantwortet. Aus der Antwort kann eine
 * Präferenz werden; aus der Zählung allein nie.
 */
export function klaerungsfrage(
  ablehnungen: readonly Ablehnung[],
  jetzt: Date,
  bereitsGefragt: readonly string[] = [],
): Klaerungsfrage | null {
  const grenze = jetzt.getTime() - KLAERUNG_FENSTER_TAGE * 86_400_000;
  const zaehler = new Map<string, number>();

  for (const a of ablehnungen) {
    /*
     * Ohne Grund zählt sie nicht mit.
     *
     * „Nicht relevant" ohne Angabe heisst: diese Stelle nicht. Daraus
     * einen Berufswunsch abzuleiten wäre geraten.
     */
    if (!a.grund || a.grund === "kein_interesse" || a.grund === "sonstiges") continue;
    if (a.erstelltAm.getTime() < grenze) continue;
    zaehler.set(a.grund, (zaehler.get(a.grund) ?? 0) + 1);
  }

  const schonGefragt = new Set(bereitsGefragt);
  /* Deterministisch: bei Gleichstand der alphabetisch erste Grund.
     Ohne diese Zeile stellte derselbe Datenstand mal die eine, mal
     die andere Frage. */
  const kandidaten = [...zaehler.entries()]
    .filter(([grund, n]) => n >= KLAERUNG_AB && !schonGefragt.has(grund))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const treffer = kandidaten[0];
  if (!treffer) return null;
  return { grund: treffer[0], anzahl: treffer[1], frage: frageZu(treffer[0], treffer[1]) };
}

/**
 * Die Frage ist offen gestellt.
 *
 * „Soll ich solche Stellen künftig weglassen?" wäre suggestiv — es
 * legt die Antwort nahe und macht aus einer Beobachtung eine
 * Empfehlung. Gefragt wird, was zutrifft, nicht ob wir recht haben.
 */
function frageZu(grund: string, anzahl: number): string {
  const worte: Record<string, string> = {
    gehalt: "wegen des Gehalts",
    standort: "wegen des Orts",
    remote: "wegen der Vor-Ort-Anwesenheit",
    aufgaben: "wegen der Aufgaben",
    unternehmen: "wegen des Unternehmens",
    karrierestufe: "wegen der Erfahrungsstufe",
    arbeitszeit: "wegen der Arbeitszeit",
    branche: "wegen der Branche",
    anforderungen: "wegen der Anforderungen",
  };
  const was = worte[grund] ?? `wegen „${grund}"`;
  return `Du hast ${anzahl} Stellen ${was} abgelehnt. Ist das etwas, das für dich generell nicht passt — oder war es bei diesen Stellen so?`;
}

export interface Ruhestand {
  ruhend: boolean;
  /** Wie viele Tage ohne verlässliche Aktivität. `null`, wenn nie eine war. */
  tage: number | null;
}

/**
 * Ob die Benachrichtigungen ruhen sollten.
 *
 * ── Warum pausieren und nicht abmelden ────────────────────────
 *
 * Weil Inaktivität kein Widerruf ist. Vielleicht hat jemand eine
 * Stelle gefunden, vielleicht war er krank. Eine Pause lässt sich
 * beim nächsten Besuch mit einer Frage beenden; eine Abmeldung
 * verlangt einen neuen Double-Opt-in für etwas, das nie widerrufen
 * wurde.
 *
 * ── Warum kein Öffnungspixel ──────────────────────────────────
 *
 * Weil er nichts beweist und viel verrät. Vorschaufenster laden
 * Bilder ohne Zutun, Bildblocker laden sie nie — die Zahl misst
 * Postfacheinstellungen, nicht Interesse. Und ein stillschweigend
 * gesetzter Zähler ist Beobachtung ohne Anlass.
 */
export function ruhestand(zuletztAktiv: Date | null, jetzt: Date): Ruhestand {
  if (zuletztAktiv === null) return { ruhend: false, tage: null };
  const tage = Math.floor((jetzt.getTime() - zuletztAktiv.getTime()) / 86_400_000);
  return { ruhend: tage >= RUHEND_NACH_TAGEN, tage };
}
