import { redact } from "./redact.ts";

/**
 * Nutzungsmessung.
 *
 * Datensparsam und ohne feste Bindung an einen Anbieter: ein Ereignis
 * ist ein Name plus wenige einfache Werte. Kein Freitext, kein
 * Dokumentinhalt, kein Chatverlauf.
 *
 * Und: ohne Einwilligung wird nichts gemessen. Der Adapter prueft das
 * selbst, damit es nicht an jeder Aufrufstelle vergessen werden kann.
 */

export type EventName =
  | "onboarding_started" | "onboarding_completed"
  | "interview_stage_completed" | "profile_confirmed" | "role_cluster_saved"
  | "job_viewed" | "job_saved"
  | "application_started" | "application_sent"
  | "response_received" | "interview_scheduled" | "offer_received" | "accepted"
  | "fit_check_30" | "fit_check_60" | "fit_check_90";

export type EventProperties = Record<string, string | number | boolean>;

export interface AnalyticsAdapter {
  readonly name: string;
  track(name: EventName, subjectKey: string, properties: EventProperties): Promise<void>;
}

/** Standard: schreibt nichts nach aussen. */
export class NullAnalyticsAdapter implements AnalyticsAdapter {
  readonly name = "none";
  async track(): Promise<void> {
    // Absichtlich leer. Ohne konfigurierten Adapter wird nicht gemessen.
  }
}

export interface TrackOptions {
  adapter: AnalyticsAdapter;
  /** Ohne Einwilligung passiert nichts - hier, nicht beim Aufrufer. */
  hasConsent: boolean;
}

export async function track(
  { adapter, hasConsent }: TrackOptions,
  name: EventName,
  subjectKey: string,
  properties: EventProperties = {},
): Promise<{ tracked: boolean; reason?: string }> {
  if (!hasConsent) return { tracked: false, reason: "keine Einwilligung" };

  const safe = redact(properties) as EventProperties;
  // Zusaetzlicher Riegel: nur kurze, einfache Werte passieren.
  const filtered: EventProperties = {};
  for (const [k, v] of Object.entries(safe)) {
    if (typeof v === "string" && v.length > 64) continue;
    filtered[k] = v;
  }

  await adapter.track(name, subjectKey, filtered);
  return { tracked: true };
}
