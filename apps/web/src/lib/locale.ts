import { cookies } from "next/headers";
import { getTranslator, isLocale, type Locale, type Translator } from "@paycheck/i18n";
import { brand, flags, integrationStatus, loadRuntimeConfig } from "@paycheck/config";

/**
 * Sprache und Laufzeitzustand fuer eine Serverkomponente an einer Stelle.
 * Jede Seite ruft das auf, statt sich Konfiguration einzeln zusammenzusuchen.
 */

export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get("paycheck_locale")?.value;
  return isLocale(value) ? value : "de";
}

export interface PageContext {
  locale: Locale;
  t: Translator["t"];
  brand: typeof brand;
  flags: typeof flags;
  /** Ehrlicher Zustand der Anbindungen. Grundlage fuer "nicht verbunden". */
  integrations: ReturnType<typeof integrationStatus>;
  isDemoMode: boolean;
}

export async function getPageContext(): Promise<PageContext> {
  const locale = await getLocale();
  const cfg = loadRuntimeConfig();
  const { t } = getTranslator(locale);

  return {
    locale,
    t,
    brand,
    flags,
    integrations: integrationStatus(cfg),
    isDemoMode: cfg.mode === "demo",
  };
}
