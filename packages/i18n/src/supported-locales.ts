import { de } from "./messages/de.ts";
import { en } from "./messages/en.ts";
import type { Messages } from "./messages/de.ts";

/**
 * Welche Sprachen es gibt — und wie weit sie wirklich sind.
 *
 * Der Kern dieser Datei ist eine Regel aus V7 §20.3: **keine falsche
 * „alle Sprachen"-Behauptung.** Eine Sprache darf nur dann als
 * unterstützt in der Auswahl stehen, wenn ihre Texte auch da sind.
 *
 * Deshalb wird der Zustand nicht eingetragen, sondern GEMESSEN. Es gibt
 * kein Feld `status: "vollständig"`, das jemand setzen und dann
 * vergessen könnte. Es gibt nur den Katalog, und wie vollständig er
 * gegenüber dem deutschen ist. Trägt jemand eine halbe Übersetzung ein,
 * steht die Sprache automatisch als Beta da — und wenn er sie
 * fertigstellt, wandert sie von allein nach oben.
 *
 * Warum die zehn übrigen Sprachen leer sind und nicht maschinell
 * gefüllt: eine automatische Übersetzung wäre Text, den niemand geprüft
 * hat, in der Stimme des Produkts. Bei „Deine Bewerbung wurde
 * abgelehnt" oder einer Einwilligungserklärung ist das keine
 * Bequemlichkeit mehr, sondern ein Risiko. Vorbereitet heisst hier:
 * eingetragen, auswählbar, mit ehrlichem Zustand — nicht erfunden.
 */

/** BCP-47. Nicht „de-DE", solange es keine regionale Fassung gibt. */
export type LocaleCode =
  | "de" | "en" | "fr" | "es" | "it" | "nl"
  | "pl" | "pt" | "tr" | "uk" | "ar" | "ru";

export interface LocaleEintrag {
  code: LocaleCode;
  /** Wie die Sprache sich selbst nennt. Steht immer so in der Auswahl. */
  eigenname: string;
  /** Übliches Land für Vorbelegung von Währung und Zeitzone. */
  land: string;
  waehrung: string;
  zeitzone: string;
  richtung: "ltr" | "rtl";
}

/*
 * Die zwölf aus §20.2. Reihenfolge ohne Bedeutung — die Oberfläche
 * sortiert nach Zustand und dann alphabetisch.
 */
export const LOCALES: readonly LocaleEintrag[] = [
  { code: "de", eigenname: "Deutsch", land: "DE", waehrung: "EUR", zeitzone: "Europe/Berlin", richtung: "ltr" },
  { code: "en", eigenname: "English", land: "GB", waehrung: "GBP", zeitzone: "Europe/London", richtung: "ltr" },
  { code: "fr", eigenname: "Français", land: "FR", waehrung: "EUR", zeitzone: "Europe/Paris", richtung: "ltr" },
  { code: "es", eigenname: "Español", land: "ES", waehrung: "EUR", zeitzone: "Europe/Madrid", richtung: "ltr" },
  { code: "it", eigenname: "Italiano", land: "IT", waehrung: "EUR", zeitzone: "Europe/Rome", richtung: "ltr" },
  { code: "nl", eigenname: "Nederlands", land: "NL", waehrung: "EUR", zeitzone: "Europe/Amsterdam", richtung: "ltr" },
  { code: "pl", eigenname: "Polski", land: "PL", waehrung: "PLN", zeitzone: "Europe/Warsaw", richtung: "ltr" },
  { code: "pt", eigenname: "Português", land: "PT", waehrung: "EUR", zeitzone: "Europe/Lisbon", richtung: "ltr" },
  { code: "tr", eigenname: "Türkçe", land: "TR", waehrung: "TRY", zeitzone: "Europe/Istanbul", richtung: "ltr" },
  { code: "uk", eigenname: "Українська", land: "UA", waehrung: "UAH", zeitzone: "Europe/Kyiv", richtung: "ltr" },
  { code: "ar", eigenname: "العربية", land: "EG", waehrung: "EGP", zeitzone: "Africa/Cairo", richtung: "rtl" },
  { code: "ru", eigenname: "Русский", land: "RU", waehrung: "RUB", zeitzone: "Europe/Moscow", richtung: "ltr" },
] as const;

/** Kataloge, die es wirklich gibt. */
const KATALOGE: Partial<Record<LocaleCode, Messages>> = { de, en };

export const DEFAULT_LOCALE: LocaleCode = "de";
/** Worauf zurückgefallen wird, wenn ein Text fehlt (§20.3). */
export const FALLBACK_LOCALE: LocaleCode = "en";

/** Alle Textschlüssel eines Katalogs, als flache Pfade. */
function schlüssel(objekt: unknown, präfix = ""): string[] {
  if (typeof objekt !== "object" || objekt === null) return [];
  return Object.entries(objekt).flatMap(([k, v]) => {
    const pfad = präfix ? `${präfix}.${k}` : k;
    return typeof v === "object" && v !== null ? schlüssel(v, pfad) : [pfad];
  });
}

/**
 * Die Kernstrings.
 *
 * Der deutsche Katalog ist die Referenz: er ist der vollständigste, und
 * an ihm misst sich alles andere. Wäre die Liste von Hand gepflegt,
 * müsste jemand sie bei jedem neuen Text nachziehen — und würde es
 * vergessen, worauf eine halbe Sprache als vollständig gälte.
 */
const KERNSCHLÜSSEL = schlüssel(de);

export type Sprachzustand = "vollständig" | "beta" | "geplant";

export interface Sprachstand {
  eintrag: LocaleEintrag;
  zustand: Sprachzustand;
  /** 0 bis 1. Für die Anzeige „73 % übersetzt". */
  abdeckung: number;
  fehlende: number;
}

/** Gemessen, nicht behauptet. */
export function sprachstand(code: LocaleCode): Sprachstand {
  const eintrag = LOCALES.find((l) => l.code === code)!;
  const katalog = KATALOGE[code];

  if (!katalog) {
    return { eintrag, zustand: "geplant", abdeckung: 0, fehlende: KERNSCHLÜSSEL.length };
  }

  const vorhanden = new Set(schlüssel(katalog));
  const fehlende = KERNSCHLÜSSEL.filter((k) => !vorhanden.has(k)).length;
  const abdeckung = (KERNSCHLÜSSEL.length - fehlende) / KERNSCHLÜSSEL.length;

  return {
    eintrag,
    /*
     * Kein „fast vollständig". Fehlt ein einziger Kernstring, steht die
     * Sprache als Beta da — sonst entstehen gemischte Oberflächen, in
     * denen ein deutscher Satz zwischen französischen steht (§20.3).
     */
    zustand: fehlende === 0 ? "vollständig" : "beta",
    abdeckung,
    fehlende,
  };
}

export function alleSprachstände(): Sprachstand[] {
  const rang: Record<Sprachzustand, number> = { vollständig: 0, beta: 1, geplant: 2 };
  return LOCALES.map((l) => sprachstand(l.code)).sort(
    (a, b) =>
      rang[a.zustand] - rang[b.zustand] ||
      a.eintrag.eigenname.localeCompare(b.eintrag.eigenname),
  );
}

/** Sprachen, in denen die Oberfläche wirklich läuft. */
export function nutzbareUiSprachen(): LocaleEintrag[] {
  return alleSprachstände()
    .filter((s) => s.zustand !== "geplant")
    .map((s) => s.eintrag);
}

/**
 * Nina darf mehr Sprachen als die Oberfläche (§20.2, letzter Absatz).
 *
 * Ihre Antworten entstehen im Modell und brauchen keinen Katalog. Die
 * Oberfläche drumherum bleibt dabei in ihrer eigenen Sprache — das ist
 * kein gemischter String, sondern eine bewusste Trennung: Rahmen und
 * Gespräch sind zwei Dinge (§20.1).
 */
export function ninaSprachen(): LocaleEintrag[] {
  return [...LOCALES].sort((a, b) => a.eigenname.localeCompare(b.eigenname));
}

export function istLocaleCode(wert: unknown): wert is LocaleCode {
  return typeof wert === "string" && LOCALES.some((l) => l.code === wert);
}

export function localeEintrag(code: LocaleCode): LocaleEintrag {
  return LOCALES.find((l) => l.code === code) ?? LOCALES[0]!;
}
