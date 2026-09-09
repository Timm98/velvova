import { brand, type BrandConfig } from "@paycheck/config";
import { de } from "./messages/de.ts";
import { en } from "./messages/en.ts";
import type { Messages } from "./messages/de.ts";

export type Locale = "de" | "en";
export type { Messages };

export const LOCALES: readonly Locale[] = ["de", "en"] as const;
export const DEFAULT_LOCALE: Locale = "de";

const CATALOGUE: Record<Locale, Messages> = { de, en };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * Setzt Platzhalter ein. {brand} und {assistant} kommen aus der zentralen
 * Konfiguration, alles Weitere aus den übergebenen Werten.
 */
export function interpolate(
  template: string,
  values: Record<string, string | number> = {},
  b: BrandConfig = brand,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    if (key === "brand") return b.name;
    if (key === "assistant") return b.assistantName;
    const value = values[key];
    return value === undefined ? match : String(value);
  });
}

/**
 * Uebersetzer für eine Sprache. Der Pfad wird als Punktnotation
 * angegeben, damit Aufrufstellen kurz bleiben.
 */
export interface Translator {
  locale: Locale;
  t: (path: string, values?: Record<string, string | number>) => string;
  messages: Messages;
}

export function getTranslator(locale: Locale): Translator {
  const messages = CATALOGUE[locale] ?? CATALOGUE[DEFAULT_LOCALE];
  return {
    locale,
    messages,
    t(path, values) {
      const raw = path.split(".").reduce<unknown>(
        (acc, key) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined),
        messages,
      );
      if (typeof raw !== "string") {
        // Ein fehlender Schlüssel ist ein Fehler im Code, kein Laufzeitfall.
        // Sichtbar machen statt leer anzeigen.
        return `[fehlender Text: ${path}]`;
      }
      return interpolate(raw, values);
    },
  };
}

/** Zahl-, Datums- und Währungsformate nach Sprache und Land. */
export function formatters(locale: Locale, currency = "EUR") {
  const tag = locale === "en" ? "en-GB" : "de-DE";
  return {
    number: new Intl.NumberFormat(tag),
    currency: new Intl.NumberFormat(tag, { style: "currency", currency, maximumFractionDigits: 0 }),
    date: new Intl.DateTimeFormat(tag, { day: "numeric", month: "long", year: "numeric" }),
    dateShort: new Intl.DateTimeFormat(tag, { day: "2-digit", month: "2-digit", year: "numeric" }),
    relativeDays(days: number): string {
      const rtf = new Intl.RelativeTimeFormat(tag, { numeric: "auto" });
      return rtf.format(-days, "day");
    },
  };
}

export { de, en };

/*
 * Das Sprach- und Regionsregister (V7 §20).
 *
 * Bewusst hier und nicht in der App: der Zustand einer Sprache wird an
 * ihrem Katalog gemessen, und die Kataloge liegen in diesem Paket. Eine
 * Registry, die anderswo läge, müsste den Zustand behaupten.
 */
export {
  LOCALES as SUPPORTED_LOCALES,
  DEFAULT_LOCALE as REGISTRY_DEFAULT_LOCALE,
  FALLBACK_LOCALE,
  alleSprachstände,
  istLocaleCode,
  localeEintrag,
  ninaSprachen,
  nutzbareUiSprachen,
  sprachstand,
  type LocaleCode,
  type LocaleEintrag,
  type Sprachstand,
  type Sprachzustand,
} from "./supported-locales.ts";

export {
  landName,
  länder,
  währungName,
  währungen,
  zeitzoneMitVersatz,
  zeitzonen,
  type Land,
} from "./regionen.ts";

/*
 * Die Sprachauflösung.
 *
 * Eigene Datei, weil sie nichts über den Bestand dieses Pakets weiss:
 * Sie bekommt Signale und eine Liste nutzbarer Sprachen und gibt eine
 * zurück. Wer sie prüft, braucht weder Browser noch Server.
 */
export {
  accepteSprachen,
  istSprachcode,
  LAND_ZU_SPRACHE,
  spracheAufloesen,
  VORBEREITETE_SPRACHEN,
  type Sprachcode,
  type Sprachsignale,
} from "./aufloesen.ts";

/**
 * Die Sprachen, für die es tatsächlich Texte gibt.
 *
 * Abgeleitet aus dem Katalog, nicht aufgeschrieben. Eine gepflegte
 * Liste daneben wäre die erste, die veraltet — und der Fehler daraus
 * ist stumm: `getTranslator` zeigt bei fehlendem Katalog die
 * Standardsprache, ohne sich zu beschweren.
 */
export const SPRACHEN_MIT_TEXTEN: readonly string[] = LOCALES;
