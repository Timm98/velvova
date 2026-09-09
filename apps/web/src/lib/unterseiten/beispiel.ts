/**
 * ══════════════════════════════════════════════════════════════════
 * Das eine Beispiel, das auf allen Unterseiten dasselbe ist
 * ══════════════════════════════════════════════════════════════════
 *
 * Die alten Seiten zeigten vier verschiedene erfundene Firmen mit
 * verschiedenen Gehältern und verschiedenen Punktwerten. Wer zwei
 * Seiten hintereinander liest, hält das für vier Produkte.
 *
 * Hier steht ein einziger Fall, und jede Seite zeigt einen anderen
 * Ausschnitt davon: „Lösungen" die Vorschau, „So funktioniert es" die
 * drei Schritte, „Für Unternehmen" dieselbe Anzeige aus der Sicht des
 * Arbeitgebers.
 *
 * ── Warum ausgerechnet dieser Fall ──────────────────────────────
 *
 * Er enthält von jeder Sorte genau eine: eine belegte Angabe, eine
 * fehlende, einen Widerspruch. Ein Beispiel ohne Widerspruch könnte
 * jede Jobbörse zeigen; der Widerspruch ist der Grund, warum es
 * Velvova gibt.
 *
 * ── Die Grenze, die dieses Beispiel nicht überschreitet ─────────
 *
 * Keine Gesamtnote, kein Prozentwert, keine Nettoberechnung, keine
 * Fahrzeit. Für all das fehlen belastbare Eingaben, und ein erfundener
 * Wert in einer Vorschau ist ein Versprechen, das das Produkt danach
 * einlösen muss.
 *
 * Und: „bekannt" heisst hier ausschliesslich „einer Quelle zugeordnet".
 * Es heisst nicht „unabhängig überprüft". Das ist kein Feinschliff —
 * der Unterschied ist das ganze Versprechen der Seite.
 */

export const BEISPIEL_KENNZEICHEN = "Fiktives Beispiel";

/** Die erfundene Anzeige, wie sie ein Mensch vor sich hätte. */
export const ANZEIGE = {
  titel: "Kundenservice (m/w/d)",
  zeilen: [
    "Standort: Köln",
    "32 bis 40 Stunden pro Woche",
    "Hybrides Arbeiten möglich",
  ],
  fliesstext: "Du unterstützt unser Service-Team. Dein Einsatzort ist Essen.",
} as const;

/**
 * Die drei Sorten Angabe.
 *
 * `art` ist nicht nur eine Farbe: Sie entscheidet, was der Satz
 * daneben behaupten darf.
 */
export type Angabeart = "bekannt" | "offen" | "widerspruch";

export interface Angabe {
  art: Angabeart;
  punkt: string;
  /** Woher es kommt — bei „bekannt" die Quelle, bei „offen" warum nichts dasteht. */
  herkunft: string;
}

export const ANGABEN: readonly Angabe[] = [
  {
    art: "bekannt",
    punkt: "32 bis 40 Stunden pro Woche",
    herkunft: "So in der Anzeige genannt",
  },
  {
    art: "bekannt",
    punkt: "Hybrides Arbeiten ist möglich",
    herkunft:
      "So in der Anzeige genannt. Wie viele Tage das sind, steht dort nicht — „möglich“ ist keine Anzahl.",
  },
  {
    art: "offen",
    punkt: "Gehaltsrahmen",
    herkunft: "Die Anzeige nennt keinen. Fehlende Angaben sind nicht automatisch schlechte.",
  },
  {
    art: "offen",
    punkt: "Verbindliche Präsenztage",
    herkunft: "Nicht genannt, und aus „hybrid möglich“ nicht ableitbar.",
  },
  {
    art: "offen",
    punkt: "Wochenendeinsätze",
    herkunft: "Nicht genannt.",
  },
  {
    art: "widerspruch",
    punkt: "Köln oder Essen?",
    herkunft:
      "Die Kopfzeile nennt Köln, der Fliesstext Essen. Velvova markiert den Unterschied und legt keinen der beiden Orte als richtig fest.",
  },
] as const;

/**
 * Ein Wunsch des Beispielnutzers — ausdrücklich nicht Teil der Anzeige.
 *
 * Er steht getrennt, weil sonst genau die Verwechslung entsteht, die
 * das Produkt vermeiden will: Ein Wunsch macht eine Frage wichtig, er
 * macht sie nicht beantwortet.
 */
export const WUNSCH = {
  text: "Mir sind freie Wochenenden wichtig.",
  folge:
    "Dadurch rückt die Wochenendfrage nach oben. Über die Stelle selbst sagt der Wunsch nichts.",
} as const;

/** Der nächste Schritt: eine Nachricht, die man kopieren und abschicken kann. */
export const NACHRICHT =
  "Guten Tag, ich interessiere mich für die Stelle im Kundenservice. In der Anzeige " +
  "werden Köln und Essen genannt. An welchem Ort findet die Tätigkeit statt? Können Sie " +
  "außerdem den Gehaltsrahmen, die regelmäßigen Präsenztage und mögliche Wochenendeinsätze " +
  "erläutern? Vielen Dank.";

/**
 * Eine erfundene Antwort, um den neuen Stand zu zeigen.
 *
 * Die Kennzeichnung ist Teil des Inhalts und nicht des Layouts: Käme
 * so ein Satz später von einem Nutzer, wäre seine Herkunft „von dir
 * eingefügt" — und auch dann kein unabhängiger Beleg.
 */
export const ANTWORT = {
  kennzeichen: "Simulierte Arbeitgeberantwort",
  text: "Die Tätigkeit findet in Essen statt; die Angabe Köln war ein Fehler.",
  folge:
    "Der Widerspruch ist damit geklärt, die Herkunft bleibt „vom Arbeitgeber genannt“. Velvova hat nichts nachgeprüft.",
} as const;

/** Was ein Arbeitgeber an derselben Anzeige sieht. */
export const ARBEITGEBERSICHT = {
  vorhanden: ["Wochenstunden", "Hinweis auf hybrides Arbeiten"],
  offen: ["Gehaltsrahmen", "Verbindliche Präsenztage"],
  widerspruch: "Standort Köln, Einsatzort Essen",
  ergaenzung: [
    "Arbeitsort klären",
    "Präsenzregel beschreiben",
    "Gehaltsrahmen ergänzen",
  ],
} as const;
