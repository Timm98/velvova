/**
 * Mondays Einrichtung — Texte und Regeln für beide Kontotypen.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum eine Datei und nicht zwei Seiten
 * ══════════════════════════════════════════════════════════════
 *
 * Arbeitnehmer und Unternehmen sehen dieselbe Seite mit anderen
 * Sätzen. Zwei getrennte Seiten wären am ersten Tag bequemer und
 * danach dauerhaft teurer: Jede Änderung an Aufbau, Reihenfolge oder
 * Barrierefreiheit müsste zweimal gemacht werden, und beim zweiten
 * Mal fehlt sie irgendwann.
 *
 * Der Kontotyp ist deshalb ein Wert, kein Codepfad. Er entscheidet
 * über Texte, Beispiele und die Zusammenfassung — nicht über die
 * Seite.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum die Verbotsliste hier steht und nicht in der Oberfläche
 * ══════════════════════════════════════════════════════════════
 *
 * „Monday darf nicht" ist keine Beruhigung, sondern eine Zusage. Sie
 * gehört an dieselbe Stelle wie die Stufen, damit beim Hinzufügen
 * einer Stufe sichtbar wird, was sie nicht aufhebt.
 *
 * Keine dieser Sperren hängt an der gewählten Stufe. Das ist der
 * ganze Punkt: Wer Stufe 3 wählt, erweitert, was Monday vorbereiten
 * darf — nicht, was sie ohne Freigabe abschicken darf.
 */

export type Kontotyp = "arbeitnehmer" | "unternehmen";
export type Bedienart = "sprache" | "text";
export type Sprachspeicherung = "nur_bestaetigte" | "transkript";
export type Stufe = "manual" | "observe_and_save" | "prepare_and_connect";
export type Rhythmus = "taeglich" | "werktags" | "woechentlich";
export type Kanal = "in_app" | "email" | "push";

/**
 * Die Fassung der Texte auf dieser Seite.
 *
 * Sie wird bei jeder Zustimmung mitgespeichert. Ändert sich hier
 * etwas Wesentliches, erscheint die Seite erneut — daran hängt die
 * Regel „nicht bei jeder Anmeldung, aber bei einer wesentlichen
 * Änderung".
 *
 * Beim Ändern: nur hochzählen, wenn sich der Inhalt einer Zusage
 * ändert. Ein Tippfehler ist keine neue Fassung; eine neue Stufe oder
 * ein gestrichenes Verbot schon.
 */
export const TEXTFASSUNG = "2026-09-1";

export const IST_STUFE = (w: unknown): w is Stufe =>
  w === "manual" || w === "observe_and_save" || w === "prepare_and_connect";
export const IST_BEDIENART = (w: unknown): w is Bedienart => w === "sprache" || w === "text";
export const IST_SPEICHERUNG = (w: unknown): w is Sprachspeicherung =>
  w === "nur_bestaetigte" || w === "transkript";
export const IST_RHYTHMUS = (w: unknown): w is Rhythmus =>
  w === "taeglich" || w === "werktags" || w === "woechentlich";
export const IST_KANAL = (w: unknown): w is Kanal =>
  w === "in_app" || w === "email" || w === "push";
export const IST_KONTOTYP = (w: unknown): w is Kontotyp =>
  w === "arbeitnehmer" || w === "unternehmen";

/** „08:00" — vierundzwanzig Stunden, führende Null. */
export const IST_ZEIT = (w: unknown): w is string =>
  typeof w === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(w);

/* ── Kopf ─────────────────────────────────────────────────────── */

export const KOPF = {
  eyebrow: "MONDAY EINRICHTEN",
  titel: "Bevor Monday für dich loslegt.",
  text:
    "Lege kurz fest, wie du mit Monday sprechen möchtest und was sie im " +
    "Hintergrund für dich tun darf. Du kannst alles später jederzeit ändern.",
  fortschritt: "1 von 2 · Monday einrichten",
};

/* ── Bereich 1: Sprache oder Text ─────────────────────────────── */

export const BEDIENUNG: Record<
  Kontotyp,
  { titel: string; text: string; karten: { wert: Bedienart; titel: string; text: string; badge?: string; zusatz?: string }[] }
> = {
  arbeitnehmer: {
    titel: "Sprich einfach, wie du denkst.",
    text:
      "Monday versteht deine Erfahrungen, Wünsche und Ziele am besten, wenn du sie frei " +
      "erklärst. Du musst nichts vorbereiten und keine perfekten Antworten formulieren. " +
      "Monday strukturiert das Gespräch anschliessend für dich.",
    karten: [
      {
        wert: "sprache",
        titel: "Mit Monday sprechen",
        badge: "Empfohlen",
        text: "Erzähl Monday in deinen eigenen Worten, was du kannst und welche Chance du suchst.",
        zusatz: "Du kannst das Gespräch jederzeit pausieren, korrigieren oder zur Texteingabe wechseln.",
      },
      {
        wert: "text",
        titel: "Mit Monday schreiben",
        text: "Schreibe Monday kurz, was du suchst. Sie fragt nur nach, wenn wichtige Informationen fehlen.",
      },
    ],
  },
  unternehmen: {
    titel: "Sprich einfach, wie du denkst.",
    text:
      "Monday versteht euer Unternehmen und euren Personalbedarf am besten, wenn ihr frei " +
      "erklärt, wie ihr arbeitet und wen ihr sucht. Ihr müsst keine langen Formulare " +
      "ausfüllen. Monday strukturiert das Gespräch anschliessend für euch.",
    karten: [
      {
        wert: "sprache",
        titel: "Mit Monday sprechen",
        badge: "Empfohlen",
        text: "Erkläre Monday in deinen eigenen Worten, was euer Unternehmen macht und welche Menschen ihr sucht.",
        zusatz: "Du kannst das Gespräch jederzeit pausieren, korrigieren oder zur Texteingabe wechseln.",
      },
      {
        wert: "text",
        titel: "Mit Monday schreiben",
        text: "Schreibt Monday kurz, wen ihr sucht und wie ihr arbeitet. Sie fragt nur nach, wenn wichtige Informationen fehlen.",
      },
    ],
  },
};

export const SPRACHHINWEIS = {
  titel: "So verwendet Monday deine Sprache",
  text:
    "Monday wandelt deine Sprache in Text um, damit sie deine Angaben strukturieren kann. " +
    "Bewertet wird ausschliesslich der Inhalt deiner Antworten — nicht deine Stimme, dein " +
    "Akzent, deine Emotionen oder deine Sprechweise.",
  frage: "Was soll gespeichert werden?",
  optionen: [
    {
      wert: "nur_bestaetigte" as Sprachspeicherung,
      titel: "Nur bestätigte Angaben speichern",
      badge: "Empfohlen",
      text:
        "Das Audio und das vollständige Transkript werden nach der Verarbeitung gelöscht. " +
        "In deinem Profil bleiben nur die Angaben, die du geprüft und bestätigt hast.",
    },
    {
      wert: "transkript" as Sprachspeicherung,
      titel: "Transkript zusätzlich speichern",
      text:
        "Das vollständige Gespräch bleibt in deinem privaten Monday-Verlauf verfügbar, " +
        "bis du es löschst.",
    },
  ],
  /* Der Browser fragt erst beim Aufnehmen. Hier wird eine Absicht
     festgehalten, keine Freigabe erteilt. */
  mikrofonHinweis:
    "Der Zugriff auf dein Mikrofon wird erst abgefragt, wenn du die Aufnahme wirklich startest.",
};

/* ── Bereich 2: Hintergrund ───────────────────────────────────── */

export const HINTERGRUND: Record<Kontotyp, { titel: string; text: string }> = {
  arbeitnehmer: {
    titel: "Soll Monday auch dann nach Chancen suchen, wenn du nicht online bist?",
    text:
      "Monday kann neue und veränderte Möglichkeiten kontinuierlich prüfen und dir später " +
      "nur die relevantesten Ergebnisse zeigen.",
  },
  unternehmen: {
    titel: "Soll Monday auch dann nach passenden Menschen suchen, wenn ihr nicht online seid?",
    text:
      "Monday kann neue und aktualisierte Profile kontinuierlich prüfen und eurem Team später " +
      "nur die relevantesten Ergebnisse zeigen.",
  },
};

export type Stufenbeschreibung = {
  wert: Stufe;
  titel: string;
  text: string;
  badge?: string;
  /** Steht zusätzlich unter der Stufe — nur, wo es nötig ist. */
  nachsatz?: string;
};

export const STUFEN: Record<Kontotyp, Stufenbeschreibung[]> = {
  arbeitnehmer: [
    {
      wert: "manual",
      titel: "Nur suchen, wenn ich Monday öffne",
      text: "Monday arbeitet nur, während du aktiv mit ihr arbeitest.",
    },
    {
      wert: "observe_and_save",
      titel: "Im Hintergrund Chancen finden",
      badge: "Empfohlen",
      text:
        "Monday prüft im Hintergrund neue Jobs, Veränderungen und mögliche Chancen. " +
        "Relevante Ergebnisse werden gespeichert, aber es wird nichts versendet.",
    },
    {
      wert: "prepare_and_connect",
      titel: "Vorbereiten und Verbindungen ermöglichen",
      text:
        "Monday darf passende Chancen speichern, nächste Schritte vorbereiten und anonymes " +
        "Interesse ermöglichen. Eine Bewerbung oder verbindliche Nachricht wird nur nach " +
        "deiner Freigabe versendet.",
      nachsatz:
        "Persönliche Informationen und Kontaktdaten werden erst bei gegenseitiger Zustimmung freigegeben.",
    },
  ],
  unternehmen: [
    {
      wert: "manual",
      titel: "Nur suchen, wenn wir Monday öffnen",
      text: "Monday arbeitet nur, während euer Team aktiv mit ihr arbeitet.",
    },
    {
      wert: "observe_and_save",
      titel: "Im Hintergrund passende Menschen finden",
      badge: "Empfohlen",
      text:
        "Monday prüft im Hintergrund neue und aktualisierte Kandidatenprofile. Relevante " +
        "Ergebnisse werden gespeichert, aber niemand wird automatisch kontaktiert.",
    },
    {
      wert: "prepare_and_connect",
      titel: "Kontakte vorbereiten und Verbindungen ermöglichen",
      text:
        "Monday darf passende Profile speichern, Kontaktentwürfe vorbereiten und anonymes " +
        "Interesse ermöglichen. Kandidaten werden nur innerhalb der festgelegten Regeln und " +
        "mit den erforderlichen Freigaben kontaktiert.",
      nachsatz:
        "Persönliche Informationen und Kontaktdaten werden erst bei gegenseitiger Zustimmung freigegeben.",
    },
  ],
};

/* ── Was Monday darf, je Stufe ──────────────────────────────────── */

const DARF: Record<Kontotyp, Record<Stufe, string[]>> = {
  arbeitnehmer: {
    manual: ["suchen, während du mit ihr arbeitest", "dir erklären, warum etwas passt"],
    observe_and_save: [
      "im Hintergrund neue Jobs und Veränderungen prüfen",
      "relevante Ergebnisse für dich speichern",
      "dir erklären, warum etwas passt",
    ],
    prepare_and_connect: [
      "im Hintergrund neue Jobs und Veränderungen prüfen",
      "relevante Ergebnisse für dich speichern",
      "nächste Schritte und Entwürfe vorbereiten",
      "anonymes Interesse ermöglichen",
      "dir erklären, warum etwas passt",
    ],
  },
  unternehmen: {
    manual: ["suchen, während ihr mit ihr arbeitet", "euch erklären, warum jemand passt"],
    observe_and_save: [
      "im Hintergrund neue und aktualisierte Profile prüfen",
      "relevante Ergebnisse für euch speichern",
      "euch erklären, warum jemand passt",
    ],
    prepare_and_connect: [
      "im Hintergrund neue und aktualisierte Profile prüfen",
      "relevante Ergebnisse für euch speichern",
      "Kontaktentwürfe vorbereiten",
      "anonymes Interesse ermöglichen",
      "euch erklären, warum jemand passt",
    ],
  },
};

/**
 * Was Monday in keiner Stufe darf.
 *
 * Diese Listen hängen ausdrücklich NICHT an der Stufe. Wer das
 * ändert, hebt eine Zusage auf, die auf der Seite steht — und sollte
 * dabei diesen Kommentar lesen müssen.
 */
export const NIEMALS: Record<Kontotyp, string[]> = {
  arbeitnehmer: [
    "eine Bewerbung verbindlich versenden",
    "einen Arbeitsvertrag annehmen",
    "eine Kündigung aussprechen",
    "sensible Daten an ein Unternehmen übertragen",
    "Kontaktdaten offenlegen",
    "öffentliche Profilinformationen verändern",
  ],
  unternehmen: [
    "einen Kandidaten endgültig ablehnen",
    "ein verbindliches Jobangebot abgeben",
    "einen Vertrag schliessen",
    "sensible Kandidatendaten weitergeben",
    "eine Stelle veröffentlichen",
    "uneingeschränkt Nachrichten versenden",
    "eine Einstellungsentscheidung treffen",
  ],
};

export function berechtigungen(kontotyp: Kontotyp, stufe: Stufe) {
  return { darf: DARF[kontotyp][stufe], niemals: NIEMALS[kontotyp] };
}

/* ── Briefing ─────────────────────────────────────────────────── */

export const BRIEFING: Record<
  Kontotyp,
  { titel: string; text: string; schalter: string; beispiel: string }
> = {
  arbeitnehmer: {
    titel: "Dein persönliches Chancen-Briefing",
    text:
      "Monday fasst neue Chancen, wichtige Veränderungen und offene Entscheidungen für dich zusammen.",
    schalter: "Morning Review aktivieren",
    beispiel:
      "Guten Morgen, Tim. Monday hat 126 neue Stellen geprüft, vier relevante Chancen " +
      "gespeichert und eine wichtige Veränderung erkannt.",
  },
  unternehmen: {
    titel: "Euer persönliches Recruiting-Briefing",
    text:
      "Monday fasst neue Talente, mögliche Verbindungen und offene Recruiting-Entscheidungen " +
      "für euch zusammen.",
    schalter: "Morning Review aktivieren",
    beispiel:
      "Guten Morgen. Monday hat 84 neue oder aktualisierte Profile geprüft, fünf passende " +
      "Menschen gespeichert und eine mögliche Verbindung erkannt.",
  },
};

export const RHYTHMEN: { wert: Rhythmus; label: string }[] = [
  { wert: "taeglich", label: "täglich" },
  { wert: "werktags", label: "werktags" },
  { wert: "woechentlich", label: "wöchentlich" },
];

export const KANAELE: { wert: Kanal; label: string; hinweis?: string }[] = [
  { wert: "in_app", label: "Nur in Velvova" },
  { wert: "email", label: "Per E-Mail" },
  { wert: "push", label: "Push-Mitteilung", hinweis: "Sobald verfügbar" },
];

/* ── Bereich 3: Vertrauen ─────────────────────────────────────── */

export const VERTRAUEN: Record<Kontotyp, string[]> = {
  arbeitnehmer: [
    "Monday veröffentlicht nichts ohne deine Freigabe.",
    "Du kannst jede gespeicherte Angabe prüfen und löschen.",
    "Alle Berechtigungen lassen sich später ändern.",
    "Monday erklärt dir, warum eine Chance oder Verbindung vorgeschlagen wird.",
  ],
  unternehmen: [
    "Monday veröffentlicht keine Stelle und trifft keine Personalentscheidung ohne menschliche Freigabe.",
    "Du kannst jede gespeicherte Angabe prüfen und löschen.",
    "Alle Berechtigungen lassen sich später ändern.",
    "Monday erklärt dir, warum eine Chance oder Verbindung vorgeschlagen wird.",
  ],
};

export const VERWEISE = [
  { href: "/privacy", label: "Datenschutzerklärung" },
  { href: "/app/settings/privacy#nina", label: "Wie Monday deine Daten verwendet" },
  { href: "/app/settings/privacy#berechtigungen", label: "Berechtigungen im Detail" },
];

export const KNOEPFE = {
  primaer: "Monday einrichten und fortfahren",
  sekundaer: "Ohne Hintergrundsuche fortfahren",
};

/* ── Abschluss ────────────────────────────────────────────────── */

const RHYTHMUSWORT: Record<Rhythmus, string> = {
  taeglich: "täglich",
  werktags: "werktags",
  woechentlich: "wöchentlich",
};

/**
 * Der Abschlusstext — aus dem Gewählten gebaut, nicht geschrieben.
 *
 * Ein fester Satz („Monday sucht ab jetzt im Hintergrund") wäre für die
 * Hälfte der Nutzer falsch, nämlich für alle, die Stufe 1 gewählt
 * haben. Was hier steht, muss die getroffene Wahl wiedergeben — sonst
 * ist die Bestätigung eine Behauptung.
 */
export function abschluss(opt: {
  kontotyp: Kontotyp;
  bedienart: Bedienart;
  stufe: Stufe;
  briefingAktiv: boolean;
  rhythmus: Rhythmus;
  zeit: string;
}): { titel: string; text: string; knoepfe: { primaer: string; sekundaer: string } } {
  const firma = opt.kontotyp === "unternehmen";

  const reden = firma
    ? opt.bedienart === "sprache" ? "Ihr sprecht mit Monday." : "Ihr schreibt mit Monday."
    : opt.bedienart === "sprache" ? "Du sprichst mit Monday." : "Du schreibst mit Monday.";

  const suche =
    opt.stufe === "manual"
      ? firma
        ? "Sie sucht nur, wenn ihr sie öffnet."
        : "Sie sucht nur, wenn du sie öffnest."
      : firma
        ? "Sie darf im Hintergrund nach passenden Menschen suchen."
        : "Sie darf im Hintergrund nach Chancen suchen.";

  const briefing = opt.briefingAktiv
    ? firma
      ? ` Sie erstellt ${RHYTHMUSWORT[opt.rhythmus]} um ${opt.zeit} Uhr euer Recruiting-Briefing.`
      : ` Sie erstellt ${RHYTHMUSWORT[opt.rhythmus]} um ${opt.zeit} Uhr dein Briefing.`
    : "";

  const grenze = firma
    ? " Stellen, Kontakte und Personalentscheidungen benötigen weiterhin eure Freigabe."
    : " Bewerbungen und persönliche Daten werden niemals ohne deine Freigabe versendet.";

  return {
    titel: firma ? "Monday ist für euer Unternehmen eingerichtet." : "Monday ist eingerichtet.",
    text: `${reden} ${suche}${briefing}${grenze}`,
    knoepfe: {
      primaer: firma ? "Monday unser Unternehmen erklären" : "Monday erzählen, was ich suche",
      sekundaer: "Später starten",
    },
  };
}

/** Wohin es nach der Einrichtung geht. */
export function weiterZu(kontotyp: Kontotyp): string {
  return kontotyp === "unternehmen" ? "/business/onboarding" : "/app/monday";
}
