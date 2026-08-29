import { currentEnv } from "./env.js";

/**
 * Feature Flags. Standardwerte sind bewusst konservativ: alles, was Geld,
 * Zugangsdaten oder eine noch offene Produktentscheidung beruehrt, ist aus.
 */

export interface FeatureFlags {
  /** /pricing bleibt verborgen, bis das Geschaeftsmodell entschieden ist. */
  readonly pricingPage: boolean;
  /** Native App-Bruecke und Push-Adapter. */
  readonly mobilePush: boolean;
  /** Freiwillige Micro-Work-Samples im Interview. */
  readonly microWorkSamples: boolean;
  /** Echter E-Mail-Versand. Erfordert verbundenes Konto und Bestaetigung. */
  readonly liveApplicationSending: boolean;
  /** Angebotsvergleich und Verhandlungsvorbereitung. */
  readonly offers: boolean;
  /** 30/60/90-Tage-Check-ins nach Jobstart. */
  readonly checkIns: boolean;
  /** Interner Admin-Bereich. Nur fuer Rolle "operator". */
  readonly adminArea: boolean;
  /** Sprachmodus im Interview und Coaching. */
  readonly voiceMode: boolean;
}

function envFlag(key: string, fallback: boolean): boolean {
  const raw = currentEnv()[key]?.trim().toLowerCase();
  if (raw === undefined || raw === "") return fallback;
  return raw === "1" || raw === "true" || raw === "on" || raw === "yes";
}

export const flags: FeatureFlags = {
  pricingPage: envFlag("FLAG_PRICING_PAGE", false),
  mobilePush: envFlag("FLAG_MOBILE_PUSH", false),
  microWorkSamples: envFlag("FLAG_MICRO_WORK_SAMPLES", true),
  liveApplicationSending: envFlag("FLAG_LIVE_SENDING", false),
  offers: envFlag("FLAG_OFFERS", true),
  checkIns: envFlag("FLAG_CHECK_INS", true),
  adminArea: envFlag("FLAG_ADMIN_AREA", true),
  voiceMode: envFlag("FLAG_VOICE_MODE", true),
};
