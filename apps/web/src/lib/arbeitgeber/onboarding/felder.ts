/**
 * Die Angaben, die Monday aus einem Gespräch gewinnt.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum diese Datei die einzige Quelle ist
 * ══════════════════════════════════════════════════════════════
 *
 * Aus denselben Angaben entstehen vier Ergebnisse — Unternehmensprofil,
 * Stellenanzeige, Matching-Profil, Bewerbungsprozess. Jedes davon
 * bräuchte sonst seine eigene Vorstellung davon, welche Felder es
 * gibt, welche zählen und welche zwingend sind.
 *
 * Beim ersten neuen Feld kennten drei der vier es nicht: Es stünde im
 * Gespräch, zählte aber nicht zur Vollständigkeit, erschiene nicht in
 * der Anzeige und ginge nicht ins Matching. Genau die Sorte Fehler,
 * die niemand meldet, weil nichts abstürzt.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum „zwingend" hier nicht heisst „Pflichtfeld"
 * ══════════════════════════════════════════════════════════════
 *
 * Ein Gespräch lässt sich nicht validieren wie ein Formular. Wer nach
 * zwei Sätzen aufhört, hat einen Entwurf — keinen Fehler. `zwingend`
 * sagt deshalb nur: Ohne diese Angabe lässt sich das jeweilige
 * Ergebnis nicht veröffentlichen. Bis dahin fehlt sie, und Monday fragt
 * danach.
 */

/** Die vier Ergebnisse, die aus dem Gespräch entstehen. */
export type Ergebnis = "profil" | "anzeige" | "matching" | "bewerbung";

export const ERGEBNISNAME: Record<Ergebnis, string> = {
  profil: "Unternehmensprofil",
  anzeige: "Stellenanzeige",
  matching: "Matching-Profil",
  bewerbung: "Bewerbungsprozess",
};

export type Feldart = "text" | "lang" | "zahl" | "liste" | "spanne";

export type OnboardingFeld = {
  bereich: string;
  feld: string;
  label: string;
  art: Feldart;
  /** In welche Ergebnisse diese Angabe eingeht. */
  fuer: Ergebnis[];
  /** Ohne sie lässt sich das Ergebnis nicht veröffentlichen. */
  zwingend?: boolean;
  /** Die Frage, die Monday stellt, wenn die Angabe fehlt. */
  frage?: string;
  /**
   * Die Rückfrage, wenn der Wert dasteht, aber eine Entscheidung
   * dahinter fehlt — etwa „ist das wirklich zwingend".
   */
  nachfrage?: string;
};

export const BEREICHSNAME: Record<string, string> = {
  unternehmen: "Unternehmen",
  kultur: "Kultur und Arbeitsweise",
  stelle: "Stelle",
  aufgaben: "Aufgaben",
  muss: "Muss-Anforderungen",
  wunsch: "Wunsch-Anforderungen",
  erlernbar: "Erlernbare Fähigkeiten",
  bedingungen: "Arbeitsbedingungen",
  gehalt: "Gehalt",
  standort: "Standort und Remote",
  entwicklung: "Entwicklung",
  bewerbung: "Bewerbungsprozess",
  matching: "Matching-Regeln",
  freigaben: "Kontaktfreigaben",
};

export const FELDER: OnboardingFeld[] = [
  /* ── Unternehmen ──────────────────────────────────────── */
  { bereich: "unternehmen", feld: "name", label: "Name", art: "text", fuer: ["profil"], zwingend: true },
  { bereich: "unternehmen", feld: "branche", label: "Branche", art: "text", fuer: ["profil", "matching"], zwingend: true,
    frage: "In welcher Branche seid ihr unterwegs?" },
  { bereich: "unternehmen", feld: "beschreibung", label: "Was das Unternehmen macht", art: "lang", fuer: ["profil", "anzeige"], zwingend: true,
    frage: "Erzähl mir in zwei Sätzen, was ihr macht." },
  { bereich: "unternehmen", feld: "groesse", label: "Mitarbeitende", art: "zahl", fuer: ["profil"],
    frage: "Wie viele Menschen arbeiten bei euch?" },
  { bereich: "unternehmen", feld: "hauptsitz", label: "Hauptsitz", art: "text", fuer: ["profil", "matching"], zwingend: true,
    frage: "Wo sitzt ihr?" },
  { bereich: "unternehmen", feld: "gruendungsjahr", label: "Gegründet", art: "zahl", fuer: ["profil"] },
  { bereich: "unternehmen", feld: "produkte", label: "Produkte und Leistungen", art: "liste", fuer: ["profil"] },

  /* ── Kultur ───────────────────────────────────────────── */
  { bereich: "kultur", feld: "arbeitsweise", label: "Wie bei euch gearbeitet wird", art: "lang", fuer: ["profil"],
    frage: "Wie läuft eine typische Arbeitswoche bei euch ab?" },
  { bereich: "kultur", feld: "fuehrung", label: "Führung", art: "lang", fuer: ["profil"] },
  { bereich: "kultur", feld: "teamgroesse", label: "Teamgrösse", art: "zahl", fuer: ["profil", "anzeige"],
    frage: "Wie gross ist das Team, in dem die Person arbeitet?" },
  { bereich: "kultur", feld: "werte", label: "Werte", art: "liste", fuer: ["profil"],
    nachfrage: "Woran merkt man diesen Wert im Alltag? Ohne Beispiel bleibt er eine Behauptung." },

  /* ── Stelle ───────────────────────────────────────────── */
  { bereich: "stelle", feld: "titel", label: "Berufsbezeichnung", art: "text", fuer: ["anzeige", "matching"], zwingend: true,
    frage: "Wie heisst die Position?" },
  { bereich: "stelle", feld: "ziel", label: "Ziel der Position", art: "lang", fuer: ["anzeige"], zwingend: true,
    frage: "Wozu gibt es diese Stelle — was soll sich dadurch ändern?" },
  { bereich: "stelle", feld: "berichtslinie", label: "Berichtet an", art: "text", fuer: ["anzeige"],
    frage: "Wem berichtet die Person?" },
  { bereich: "stelle", feld: "starttermin", label: "Start", art: "text", fuer: ["anzeige"] },

  /* ── Aufgaben ─────────────────────────────────────────── */
  { bereich: "aufgaben", feld: "haupt", label: "Hauptaufgaben", art: "liste", fuer: ["anzeige", "matching"], zwingend: true,
    frage: "Welche drei Aufgaben sind die wichtigsten?" },
  { bereich: "aufgaben", feld: "woche", label: "Typische Arbeitswoche", art: "lang", fuer: ["anzeige"],
    frage: "Wie sieht eine typische Woche in dieser Rolle aus?" },
  { bereich: "aufgaben", feld: "erste90", label: "Die ersten 90 Tage", art: "lang", fuer: ["anzeige", "bewerbung"],
    frage: "Was soll nach 30, 60 und 90 Tagen erreicht sein?" },

  /* ── Anforderungen ────────────────────────────────────── */
  { bereich: "muss", feld: "faehigkeiten", label: "Unverzichtbar", art: "liste", fuer: ["anzeige", "matching"], zwingend: true,
    frage: "Was muss die Person am ersten Tag können?",
    nachfrage: "Ist das wirklich ein Ausschlussgrund — oder wäre jemand mit weniger, aber starkem Fach, ebenfalls interessant?" },
  { bereich: "muss", feld: "erfahrungsjahre", label: "Berufserfahrung", art: "zahl", fuer: ["anzeige", "matching"],
    nachfrage: "Sind die Jahre zwingend, oder zählt, was jemand belegen kann?" },
  { bereich: "muss", feld: "abschluss", label: "Abschluss", art: "text", fuer: ["anzeige", "matching"],
    nachfrage: "Ist ein Abschluss nötig, oder reicht praktische Erfahrung?" },
  { bereich: "wunsch", feld: "faehigkeiten", label: "Von Vorteil", art: "liste", fuer: ["anzeige", "matching"] },
  { bereich: "erlernbar", feld: "faehigkeiten", label: "In der Einarbeitung erreichbar", art: "liste", fuer: ["anzeige", "matching"],
    frage: "Was davon könnte jemand bei euch lernen, statt es mitzubringen?" },

  /* ── Bedingungen ──────────────────────────────────────── */
  { bereich: "bedingungen", feld: "wochenstunden", label: "Wochenstunden", art: "zahl", fuer: ["anzeige", "matching"], zwingend: true,
    frage: "Wie viele Wochenstunden?" },
  { bereich: "bedingungen", feld: "ueberstunden", label: "Überstunden", art: "lang", fuer: ["anzeige"],
    frage: "Fallen Überstunden an — und wie werden sie behandelt?" },
  { bereich: "bedingungen", feld: "reiseanteil", label: "Reiseanteil", art: "text", fuer: ["anzeige", "matching"] },
  { bereich: "bedingungen", feld: "arbeitssprache", label: "Arbeitssprache", art: "text", fuer: ["anzeige", "matching"] },

  /* ── Gehalt ───────────────────────────────────────────── */
  { bereich: "gehalt", feld: "spanne", label: "Gehaltsspanne", art: "spanne", fuer: ["anzeige", "matching"], zwingend: true,
    frage: "In welcher Spanne liegt das Gehalt?",
    nachfrage: "Ist das die Spanne, in der ihr tatsächlich einstellt — oder die Wunschvorstellung?" },

  /* ── Standort ─────────────────────────────────────────── */
  { bereich: "standort", feld: "ort", label: "Arbeitsort", art: "text", fuer: ["anzeige", "matching"], zwingend: true },
  { bereich: "standort", feld: "modell", label: "Arbeitsmodell", art: "text", fuer: ["anzeige", "matching"], zwingend: true,
    frage: "Vor Ort, hybrid oder remote?" },
  { bereich: "standort", feld: "bueroTage", label: "Bürotage je Woche", art: "zahl", fuer: ["anzeige", "matching"],
    frage: "Wie viele Tage im Büro werden erwartet?" },

  /* ── Entwicklung ──────────────────────────────────────── */
  { bereich: "entwicklung", feld: "moeglichkeiten", label: "Entwicklungsmöglichkeiten", art: "lang", fuer: ["profil", "anzeige", "matching"] },
  { bereich: "entwicklung", feld: "weiterbildung", label: "Weiterbildung", art: "lang", fuer: ["profil"] },

  /* ── Bewerbungsprozess ────────────────────────────────── */
  { bereich: "bewerbung", feld: "schritte", label: "Ablauf", art: "liste", fuer: ["bewerbung", "anzeige"], zwingend: true,
    frage: "Wie läuft euer Bewerbungsverfahren ab — wie viele Gespräche, mit wem?" },
  { bereich: "bewerbung", feld: "antwortzeit", label: "Antwortzeit", art: "text", fuer: ["bewerbung", "anzeige"], zwingend: true,
    frage: "Innerhalb welcher Frist meldet ihr euch zurück?" },
  { bereich: "bewerbung", feld: "ansprechperson", label: "Ansprechperson", art: "text", fuer: ["bewerbung"] },
  { bereich: "bewerbung", feld: "unterlagen", label: "Unterlagen", art: "liste", fuer: ["bewerbung"] },

  /* ── Matching und Freigaben ───────────────────────────── */
  { bereich: "matching", feld: "minFit", label: "Mindestpassung", art: "zahl", fuer: ["matching"] },
  { bereich: "matching", feld: "maxProWoche", label: "Vorschläge je Woche", art: "zahl", fuer: ["matching"] },
  { bereich: "freigaben", feld: "stufe", label: "Automatisierungsstufe", art: "text", fuer: ["matching"], zwingend: true,
    frage: "Darf ich passende Menschen von mir aus ansprechen, oder soll jeder Kontakt vorher durch euch?" },
  { bereich: "freigaben", feld: "kontaktFreigabe", label: "Freigabe vor Kontakt", art: "text", fuer: ["matching"], zwingend: true },
];

/**
 * Formulierungen, die nichts aussagen.
 *
 * Sie stehen in fast jeder Anzeige und bedeuten in jeder etwas
 * anderes. Monday markiert sie und verlangt die konkrete Angabe
 * dahinter — nicht, weil sie falsch wären, sondern weil sie an der
 * Stelle stehen, an der eine Auskunft stehen müsste.
 */
export const LEERFORMELN: { muster: RegExp; label: string; frage: string }[] = [
  { muster: /attraktive[sr]?\s+(gehalt|vergütung)|wettbewerbsfähige\s+vergütung/i,
    label: "attraktives Gehalt",
    frage: "Welche Spanne meint ihr damit konkret?" },
  { muster: /flache\s+hierarchien/i,
    label: "flache Hierarchien",
    frage: "Über wie viele Ebenen geht eine Entscheidung bei euch?" },
  { muster: /dynamisches?\s+(team|umfeld)|junges\s+team/i,
    label: "dynamisches Team",
    frage: "Was heisst das im Alltag — und wie gross ist das Team?" },
  { muster: /flexible\s+arbeitszeiten/i,
    label: "flexible Arbeitszeiten",
    frage: "Gibt es Kernzeiten, und wer entscheidet über die Lage?" },
  { muster: /spannende\s+(aufgaben|projekte)|abwechslungsreich/i,
    label: "spannende Aufgaben",
    frage: "Welche drei Aufgaben sind das konkret?" },
  { muster: /marktübliche[sr]?\s+gehalt/i,
    label: "marktübliches Gehalt",
    frage: "Welche Spanne ist das bei euch?" },
];

/** Die Felder eines Ergebnisses — für Vollständigkeit und Warnungen. */
export function felderFuer(ergebnis: Ergebnis): OnboardingFeld[] {
  return FELDER.filter((f) => f.fuer.includes(ergebnis));
}

export function feldFinden(bereich: string, feld: string): OnboardingFeld | undefined {
  return FELDER.find((f) => f.bereich === bereich && f.feld === feld);
}

/**
 * Text in den Wert umwandeln, den das Feld erwartet.
 *
 * Gibt `null` zurück, wenn die Umwandlung nicht sauber gelingt — dann
 * fällt die Angabe weg. Eine Zahl, die keine ist, wäre schlimmer als
 * eine Lücke: Die Lücke sieht man.
 */
export function alsWert(feld: OnboardingFeld, roh: string): unknown | null {
  const text = roh.trim();
  if (text.length === 0) return null;

  switch (feld.art) {
    case "zahl": {
      const n = Number.parseFloat(text.replace(/\./g, "").replace(",", "."));
      return Number.isFinite(n) ? n : null;
    }
    case "liste": {
      const teile = text
        .split(/[,;]|\bund\b|\boder\b/i)
        .map((t) => t.trim())
        .filter((t) => t.length > 1);
      return teile.length > 0 ? teile : null;
    }
    case "spanne": {
      const m = text.match(/(\d[\d.\s]*)\s*(?:bis|-|–)\s*(\d[\d.\s]*)/);
      if (!m) return null;
      const z = (s: string) => Number.parseFloat(s.replace(/[.\s]/g, ""));
      const von = z(m[1]!);
      const bis = z(m[2]!);
      if (!Number.isFinite(von) || !Number.isFinite(bis) || bis < von) return null;
      const faktor = von < 1000 ? 1000 : 1;
      return { von: von * faktor, bis: bis * faktor, waehrung: "EUR", zeitraum: "jahr" };
    }
    default:
      return text;
  }
}
