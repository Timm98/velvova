/**
 * Die Wissensbasis für Hilfe, FAQ und Ninas Supportchat.
 *
 * Eine Datei, zwei Verbraucher: die Hilfeseite zeigt sie, Nina
 * antwortet aus ihr. Das ist Absicht — stünden die Antworten zweimal
 * da, liefen sie auseinander, und Nina erklärte irgendwann etwas
 * anderes als die Seite daneben.
 *
 * Der Zuschnitt folgt V7 §24.3: das hier ist **Produktwissen**, kein
 * Karrierewissen. Nina darf im Supportchat erklären, wie Velvova
 * arbeitet und was mit den Daten geschieht. Sie darf dort nicht auf das
 * Karriereprofil zugreifen — das ist eine Zugriffsentscheidung, keine
 * Frage des Tonfalls, und sie steht deshalb in der Gesprächsart
 * (`support`) und nicht in einer Formulierung.
 */

export interface HilfeEintrag {
  id: string;
  frage: string;
  antwort: string;
  /** Für die Suche: Wörter, die Menschen benutzen, aber nicht in der Frage stehen. */
  synonyme: string[];
  bereich: HilfeBereich;
}

export type HilfeBereich =
  | "Erste Schritte"
  | "Nina und das Gespräch"
  | "Stellen und Passung"
  | "Bewerbungen"
  | "Daten und Datenschutz"
  | "Konto";

export const HILFE: HilfeEintrag[] = [
  {
    id: "was-ist-paycheck",
    bereich: "Erste Schritte",
    frage: "Was macht Velvova anders als eine Jobbörse?",
    antwort:
      "Eine Jobbörse beginnt mit einem Suchbegriff. Velvova beginnt mit dir: Nina führt ein " +
      "Gespräch über deine Erfahrungen, Stärken und Bedingungen und leitet daraus ab, welche " +
      "Stellen wirklich passen. Die Reihenfolge entsteht aus begründeter Passung, nicht aus " +
      "Werbebudget. Was Nina nicht belegen kann, sagt sie als unbelegt.",
    synonyme: ["unterschied", "jobbörse", "stepstone", "indeed", "warum"],
  },
  {
    id: "wie-anfangen",
    bereich: "Erste Schritte",
    frage: "Wie fange ich an?",
    antwort:
      "Mit dem Karrieregespräch unter „Nina“. Es dauert so lange, wie du möchtest, und du " +
      "kannst jederzeit pausieren — der Stand bleibt erhalten. Je mehr Nina bestätigt " +
      "bekommt, desto begründeter wird die Reihenfolge deiner Stellen.",
    synonyme: ["start", "beginnen", "erste schritte", "onboarding"],
  },
  {
    id: "warum-wenige-treffer",
    bereich: "Stellen und Passung",
    frage: "Warum sehe ich weniger Stellen als erwartet?",
    antwort:
      "Weil harte Bedingungen nicht heimlich gelockert werden. Wenn du „höchstens zwei " +
      "Bürotage“ gesagt hast, verschwinden Stellen mit vier — auch wenn die Liste dadurch " +
      "kurz wird. Unter der Liste steht immer, wie viele Stellen geprüft wurden und wie " +
      "viele an welcher Bedingung gescheitert sind. Du kannst jede Bedingung einzeln " +
      "weglassen.",
    synonyme: ["wenige", "leer", "keine treffer", "filter", "zu wenig"],
  },
  {
    id: "passung-nicht-berechenbar",
    bereich: "Stellen und Passung",
    frage: "Was heißt „Passung nicht berechenbar“?",
    antwort:
      "Dass zu wenige bestätigte Angaben vorliegen, um eine Passung zu begründen. Velvova " +
      "zeigt dann keine Zahl, statt eine zu erfinden. Sobald im Gespräch belegte Erfahrungen " +
      "dazukommen, wird aus „nicht berechenbar“ eine begründete Einschätzung mit Angabe der " +
      "Unsicherheit.",
    synonyme: ["score", "prozent", "matching", "passung", "unbekannt"],
  },
  {
    id: "abgelaufene-anzeigen",
    bereich: "Stellen und Passung",
    frage: "Warum stehen manche Stellen nicht mehr in der Liste?",
    antwort:
      "Weil die Anzeige abgelaufen oder nicht mehr erreichbar ist. Eine Bewerbung dort würde " +
      "ins Leere gehen. Die Zahl steht unter der Liste, damit nachvollziehbar bleibt, warum " +
      "sich die Gesamtzahl ändert.",
    synonyme: ["verschwunden", "weg", "abgelaufen", "nicht mehr da"],
  },
  {
    id: "nina-sprache",
    bereich: "Nina und das Gespräch",
    frage: "Kann Nina in einer anderen Sprache mit mir sprechen?",
    antwort:
      "Ja. Unter „Sprache & Region“ lassen sich drei Dinge getrennt einstellen: die Sprache " +
      "der Oberfläche, die Sprache im Gespräch mit Nina und die Sprache deiner " +
      "Bewerbungsunterlagen. Nina spricht mehr Sprachen, als die Oberfläche übersetzt ist — " +
      "die Oberfläche wird nur dann in einer Sprache angeboten, wenn ihre Texte wirklich " +
      "vorliegen.",
    synonyme: ["sprache", "englisch", "türkisch", "übersetzung", "language"],
  },
  {
    id: "sprachmodus",
    bereich: "Nina und das Gespräch",
    frage: "Wie funktioniert das Live-Gespräch?",
    antwort:
      "Du sprichst, Nina hört zu, denkt nach und antwortet mit ihrer Stimme. Du kannst sie " +
      "jederzeit unterbrechen — sobald du zu reden anfängst, hört sie auf. Für den " +
      "Sprachmodus brauchen wir eine eigene Einwilligung; sie ist von der allgemeinen " +
      "KI-Nutzung getrennt und jederzeit widerrufbar. Ohne Mikrofon läuft alles unverändert " +
      "in Textform weiter.",
    synonyme: ["sprechen", "mikrofon", "voice", "stimme", "live"],
  },
  {
    id: "keine-auto-bewerbung",
    bereich: "Bewerbungen",
    frage: "Bewirbt Velvova sich automatisch für mich?",
    antwort:
      "Nein. Es gibt keine automatische Bewerbung. Jede Bewerbung wird von dir ausgelöst und " +
      "vorher von dir freigegeben. Unterlagen entstehen aus belegten Angaben — was nicht " +
      "belegt ist, steht nicht drin.",
    synonyme: ["automatisch", "auto apply", "bewerben", "verschickt"],
  },
  {
    id: "daten-loeschen",
    bereich: "Daten und Datenschutz",
    frage: "Wie lösche ich meine Daten?",
    antwort:
      "Unter „Datenschutz & Daten“ kannst du alle Daten exportieren und das Konto samt " +
      "Inhalten löschen. Die Löschung ist endgültig. Einwilligungen lassen sich einzeln " +
      "widerrufen, ohne das Konto zu löschen.",
    synonyme: ["löschen", "dsgvo", "export", "konto entfernen", "daten"],
  },
  {
    id: "wer-sieht-daten",
    bereich: "Daten und Datenschutz",
    frage: "Wer kann meine Daten sehen?",
    antwort:
      "Nur du. Kein anderes Konto kann deine Daten lesen oder ändern — das ist auf " +
      "Datenbankebene abgesichert, nicht nur in der Oberfläche. Für die Analyse werden " +
      "Texte an einen externen KI-Anbieter übermittelt, sofern du zugestimmt hast; direkte " +
      "Identifikatoren werden vorher entfernt. Ohne deine ausdrückliche Zustimmung werden " +
      "deine Daten nicht für das Training von Modellen verwendet.",
    synonyme: ["sichtbar", "andere", "datenschutz", "openai", "training"],
  },
  {
    id: "passwort-vergessen",
    bereich: "Konto",
    frage: "Ich komme nicht mehr in mein Konto.",
    antwort:
      "Auf der Anmeldeseite gibt es „Passwort vergessen?“. Du bekommst einen Link per " +
      "E-Mail. Aus Sicherheitsgründen verrät die Antwort nicht, ob zu einer Adresse ein " +
      "Konto besteht.",
    synonyme: ["passwort", "login", "anmelden", "gesperrt", "zugang"],
  },
];

export const HILFE_BEREICHE: HilfeBereich[] = [
  "Erste Schritte",
  "Nina und das Gespräch",
  "Stellen und Passung",
  "Bewerbungen",
  "Daten und Datenschutz",
  "Konto",
];

/**
 * Suche in der Hilfe.
 *
 * Absichtlich einfach und ohne Modell: eine Volltextsuche über elf
 * Einträge, die sofort antwortet, ist einer semantischen Suche
 * überlegen, die eine halbe Sekunde braucht. Die Synonyme fangen die
 * Lücke zwischen der Frage, die jemand tippt, und der Frage, die
 * dasteht.
 */
export function sucheHilfe(begriff: string): HilfeEintrag[] {
  const suche = begriff.trim().toLowerCase();
  if (suche.length < 2) return HILFE;

  const wörter = suche.split(/\s+/).filter((w) => w.length > 1);

  return HILFE.map((e) => {
    const heuhaufen = `${e.frage} ${e.antwort} ${e.synonyme.join(" ")} ${e.bereich}`.toLowerCase();
    // Je mehr Suchwörter vorkommen, desto weiter oben. Ein Treffer in
    // der Frage zählt doppelt — danach sucht man meistens.
    const punkte = wörter.reduce(
      (summe, w) =>
        summe +
        (heuhaufen.includes(w) ? 1 : 0) +
        (e.frage.toLowerCase().includes(w) ? 1 : 0),
      0,
    );
    return { eintrag: e, punkte };
  })
    .filter((x) => x.punkte > 0)
    .sort((a, b) => b.punkte - a.punkte)
    .map((x) => x.eintrag);
}

/** Was Nina im Supportchat als Grundlage bekommt. */
export function hilfeAlsKontext(): string {
  return HILFE.map((e) => `F: ${e.frage}\nA: ${e.antwort}`).join("\n\n");
}
