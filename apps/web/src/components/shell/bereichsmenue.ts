/**
 * ══════════════════════════════════════════════════════════════════
 * Die Aufklappmenüs der Kopfzeile
 * ══════════════════════════════════════════════════════════════════
 *
 * In `TopNav` stand bis heute die Begründung, warum es hier keine
 * Untermenüs gibt: Zustand, Tastaturbedienung und Schliessverhalten
 * neu zu erfinden lohne sich nicht für fünf Ziele, die nebeneinander
 * passen.
 *
 * Das galt, solange es fünf Ziele waren. Inzwischen gibt es hinter
 * jedem davon mehrere Seiten — „Lösungen" allein hat einen Überblick,
 * vier Einstiege, ein Beispiel und die Jobsuche daneben. Wer die
 * flache Zeile benutzt, landet auf einer Seite und sucht von dort
 * weiter. Das Menü nimmt diesen Zwischenschritt weg.
 *
 * ── Die eine Regel für diese Datei ──────────────────────────────
 *
 * Jedes `ziel` ist eine Route, die es gibt. Keine Platzhalter, kein
 * `#`, keine Seite, die „bald kommt". Ein Aufklappmenü ist ein
 * Versprechen über den Umfang einer Website — wer darin sieben
 * Einträge zeigt und vier davon führen ins Leere, hat nicht mehr
 * Struktur geschaffen, sondern weniger.
 *
 * Anker (`#beispiel`, `#wege`) sind ebenfalls echt: Sie stehen als
 * `id` an einem Abschnitt der Zielseite. Wird dort ein Abschnitt
 * umbenannt, führt der Eintrag nur noch an den Seitenanfang — deshalb
 * stehen die Anker hier bei der Route und nicht verstreut im Markup.
 */

export interface Menueintrag {
  text: string;
  ziel: string;
  /** Ein Halbsatz darunter. Nur dort, wo der Name allein zu wenig sagt. */
  hinweis?: string;
}

export interface Menuspalte {
  titel: string;
  eintraege: readonly Menueintrag[];
}

/**
 * Zugeordnet über die Route des Navigationspunkts.
 *
 * Nicht über den Beschriftungstext: Der ist übersetzbar und ändert
 * sich beim ersten Umformulieren, die Route nicht.
 */
export const BEREICHSMENUE: Record<string, readonly Menuspalte[]> = {
  "/product": [
    {
      titel: "Deine Entscheidung",
      eintraege: [
        { text: "Alle Einstiege", ziel: "/product", hinweis: "Überblick über die vier Wege" },
        { text: "Vier Wege hinein", ziel: "/product#wege" },
        { text: "Beispiel ansehen", ziel: "/product#beispiel", hinweis: "Ein Fall, drei Ansichten" },
      ],
    },
    {
      titel: "Stellen",
      eintraege: [
        { text: "Stellen durchsuchen", ziel: "/jobs" },
        { text: "So funktioniert es", ziel: "/how-it-works" },
      ],
    },
    {
      titel: "Für Unternehmen",
      eintraege: [
        { text: "Klarheits-Check", ziel: "/for-business" },
        { text: "Preise", ziel: "/pricing" },
      ],
    },
  ],

  "/how-it-works": [
    {
      titel: "Der Ablauf",
      eintraege: [
        { text: "Von der Anzeige zum Schritt", ziel: "/how-it-works" },
        { text: "Drei Schritte am Beispiel", ziel: "/how-it-works#beispiel" },
      ],
    },
    {
      titel: "Grundlage",
      eintraege: [
        { text: "Methodik", ziel: "/methodology", hinweis: "Wie eine Einordnung entsteht" },
        { text: "KI-Transparenz", ziel: "/ai-transparency" },
        { text: "Sicherheit", ziel: "/security" },
      ],
    },
    {
      titel: "Über uns",
      eintraege: [
        { text: "Über Velvova", ziel: "/about" },
        { text: "Bewertungen", ziel: "/reviews" },
      ],
    },
  ],

  "/for-business": [
    {
      titel: "Angebot",
      eintraege: [
        { text: "Überblick", ziel: "/for-business" },
        { text: "Beispiel-Check", ziel: "/for-business#beispiel" },
        { text: "Preise", ziel: "/pricing" },
      ],
    },
    {
      titel: "Zugang",
      eintraege: [
        { text: "Unternehmensbereich", ziel: "/business" },
        { text: "Pilot anfragen", ziel: "/contact" },
      ],
    },
    {
      titel: "Grundlage",
      eintraege: [
        { text: "Studienlage", ziel: "/for-business/studien", hinweis: "Befunde mit Herausgeber und Grenze" },
        { text: "Sicherheit", ziel: "/security" },
      ],
    },
  ],

  "/help": [
    {
      titel: "Hilfe",
      eintraege: [
        { text: "Alle Antworten", ziel: "/help" },
        { text: "Support kontaktieren", ziel: "/contact" },
      ],
    },
    {
      titel: "Transparenz",
      eintraege: [
        { text: "Methodik", ziel: "/methodology" },
        { text: "KI-Transparenz", ziel: "/ai-transparency" },
        { text: "Sicherheit", ziel: "/security" },
      ],
    },
    {
      titel: "Rechtliches",
      eintraege: [
        { text: "Datenschutz", ziel: "/privacy" },
        { text: "AGB", ziel: "/terms" },
        { text: "Impressum", ziel: "/imprint" },
      ],
    },
  ],

  /*
   * „Sicherheit" bekommt bewusst keines.
   *
   * Die Seite ist ein Ziel und keine Abteilung: Einstieg, drei
   * Fragen, die umgesetzten Massnahmen, die offenen Punkte. Ein Menü
   * mit einem einzigen Eintrag darin wäre ein Klick, der nichts
   * erspart — und ein Pfeil, der etwas ankündigt, was nicht kommt.
   */
};

export function hatMenue(href: string): boolean {
  return href in BEREICHSMENUE;
}
