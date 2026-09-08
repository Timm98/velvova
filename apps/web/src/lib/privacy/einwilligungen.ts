/**
 * Die Einwilligungen — an einer Stelle, für beide Seiten.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum sie nicht mehr in der Einstellungsseite stehen
 * ══════════════════════════════════════════════════════════════
 *
 * Sie standen dort als lokale Konstante, und nur dort. Wer nicht
 * angemeldet ist, konnte nirgends nachlesen, worin er einwilligen
 * würde — die Sicherheitsseite im öffentlichen Kopf zählte
 * Verschlüsselung und Rollenmodell auf und schwieg zu der Frage, die
 * Menschen tatsächlich stellen: was gebe ich frei, und wie nehme ich
 * es zurück.
 *
 * Die Liste zweimal zu schreiben wäre der falsche Weg gewesen. Zwei
 * Aufzählungen derselben Einwilligungen laufen auseinander, sobald
 * eine dazukommt — und dann verspricht die öffentliche Seite etwas
 * anderes, als die Anwendung schaltet. Bei Einwilligungen ist das
 * kein Schönheitsfehler.
 */

export type Einwilligungsart =
  | "career_profile"
  | "document_analysis"
  | "voice_input"
  | "transcript_storage"
  | "external_ai_processing"
  | "model_training"
  | "partner_sharing";

export interface Einwilligung {
  /** Die Überschrift am Haken. */
  title: string;
  /** Was genau geschieht, wenn der Haken gesetzt ist. */
  body: string;
  /**
   * Wofür sie gebraucht wird.
   *
   * `funktion` heisst: Ohne sie fehlt eine Funktion, die jemand
   * ausdrücklich benutzen will — Spracheingabe etwa gibt es ohne
   * Zustimmung zur Spracheingabe nicht.
   *
   * `weitergabe` heisst: Daten verlassen das Haus. Diese stehen
   * getrennt, weil sie eine andere Frage beantworten als „welche
   * Funktion hätte ich gern".
   */
  art: "funktion" | "weitergabe";
}

/**
 * Alle sieben, in der Reihenfolge, in der sie im Privacy Center
 * stehen.
 *
 * ── Keine ist voreingestellt ────────────────────────────────
 *
 * Der Zustand wird als `state[kind] ?? false` gelesen: Was nicht
 * ausdrücklich erteilt wurde, gilt als nicht erteilt. Es gibt keine
 * Einwilligung, die mit dem Konto mitkommt, und keine, die durch
 * Weiterklicken entsteht.
 */
export const EINWILLIGUNGEN: Record<Einwilligungsart, Einwilligung> = {
  career_profile: {
    title: "Karriereprofil",
    body: "Deine Antworten werden gespeichert, damit daraus ein Profil entsteht.",
    art: "funktion",
  },
  document_analysis: {
    title: "Unterlagen auswerten",
    body: "Text aus hochgeladenen Dokumenten wird ausgewertet, um das Profil vorzubefüllen.",
    art: "funktion",
  },
  voice_input: {
    title: "Spracheingabe",
    body: "Du kannst sprechen statt zu schreiben.",
    art: "funktion",
  },
  transcript_storage: {
    title: "Transkript speichern",
    body: "Ohne diese Zustimmung wird gesprochener Text verarbeitet, aber nicht abgelegt.",
    art: "funktion",
  },
  external_ai_processing: {
    title: "Externer KI-Anbieter",
    body: "Texte werden zur Analyse an einen externen Anbieter übermittelt. Direkte Identifikatoren werden vorher entfernt.",
    art: "weitergabe",
  },
  model_training: {
    title: "Training von Modellen",
    body: "Standardmäßig aus. Ohne diese ausdrückliche Zustimmung werden deine Daten nicht für Modelltraining verwendet.",
    art: "weitergabe",
  },
  partner_sharing: {
    title: "Weitergabe an Partner",
    body: "Standardmäßig aus. Ohne diese Zustimmung sehen institutionelle Partner ausschließlich aggregierte Zahlen, nie dein Profil.",
    art: "weitergabe",
  },
};

/**
 * Die Einwilligungserklärung.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum sie in Sätzen steht und nicht in Paragraphen
 * ══════════════════════════════════════════════════════════════
 *
 * Eine Einwilligung ist nur wirksam, wenn sie informiert ist. Ein
 * Text, den niemand liest, informiert niemanden — und zwar auch
 * dann nicht, wenn jedes Wort darin juristisch richtig ist.
 *
 * Deshalb sechs Sätze, jeder mit einer Aussage. Was darüber hinaus
 * an Rechtstext nötig ist, steht in der Datenschutzerklärung; hier
 * steht, was gilt.
 */
export const EINWILLIGUNGSERKLAERUNG: string[] = [
  "Jede Einwilligung wird einzeln erteilt. Es gibt keinen Schalter, der alle auf einmal setzt, und keine, die durch Weiterklicken entsteht.",
  "Ohne Einwilligung ist nichts erteilt. Der gespeicherte Zustand kennt nur „erteilt“ — alles andere gilt als nicht erteilt.",
  "Jede Einwilligung ist jederzeit widerrufbar, einzeln, im Privacy Center. Der Widerruf wirkt sofort und braucht keine Begründung.",
  "Ein Widerruf gilt ab dem Zeitpunkt des Widerrufs. Was davor rechtmäßig verarbeitet wurde, bleibt rechtmäßig verarbeitet — was danach geschehen wäre, geschieht nicht mehr.",
  "Die Nutzung des Dienstes hängt nicht an den beiden Weitergabe-Einwilligungen. Wer sie nicht erteilt, sucht, vergleicht und bewirbt sich wie alle anderen.",
  "Du kannst deine Daten jederzeit ausleiten und dein Konto löschen. Beides steht im selben Bereich wie die Haken.",
];
