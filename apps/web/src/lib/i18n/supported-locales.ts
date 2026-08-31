/**
 * Der in V7 §20.2 genannte Pfad.
 *
 * Das eigentliche Register liegt in `@paycheck/i18n`, weil es dort neben
 * den Textkatalogen steht — und nur dort lässt sich messen, wie
 * vollständig eine Sprache wirklich ist. Diese Datei ist die Adresse,
 * unter der die Spezifikation es sucht, damit niemand zwei Register
 * anlegt, die auseinanderlaufen.
 */
export {
  SUPPORTED_LOCALES,
  FALLBACK_LOCALE,
  REGISTRY_DEFAULT_LOCALE,
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
} from "@paycheck/i18n";
