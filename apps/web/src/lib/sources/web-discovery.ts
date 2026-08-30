import { decideForUrl } from "./policy-engine.ts";
import type { PolicyDecision } from "./decision-types.ts";

/**
 * Entdeckung.
 *
 * Eine Websuche darf sagen: „unter dieser Adresse gibt es eine Stelle."
 * Sie darf nicht sagen: „also darfst du sie kopieren." Genau diese
 * Trennung ist hier eingebaut.
 *
 * Der Dienst gibt deshalb **niemals Inhalt zurück**, sondern nur
 * Kandidaten mit einer Entscheidung. Wer Inhalt will, muss durch die
 * Policy Engine — und für die gesperrten Plattformen kommt er dort
 * nicht durch.
 */

export interface DiscoveryCandidate {
  discoveredUrl: string;
  domain: string;
  title: string | null;
  discoveryProvider: string;
  discoveredAt: string;
  sourceId: string | null;
  policyDecision: PolicyDecision;
  policyReason: string;
  /** Was mit diesem Fund geschehen darf — in einem Satz. */
  nextStep: string;
}

const NEXT_STEP: Record<PolicyDecision, string> = {
  approved: "Kann über die freigegebene Schnittstelle geladen werden.",
  link_only:
    "Nur als Verweis. Wenn du die Stelle prüfen möchtest, öffne sie selbst oder " +
    "füge den Text privat hinzu.",
  private_import: "Kann als privater Eintrag hinzugefügt werden, sichtbar nur für dich.",
  blocked: "Wird nicht geladen und nicht gespeichert.",
  pending_review:
    "Diese Quelle wurde noch nicht geprüft. Bis dahin wird nichts geladen.",
};

/**
 * Kandidaten bewerten.
 *
 * Bewusst synchron und ohne Netzzugriff: diese Funktion entscheidet nur.
 * Der eigentliche Abruf passiert danach, und ausschließlich für das,
 * was `approved` ist.
 */
export function classifyCandidates(
  urls: { url: string; title?: string | null }[],
  discoveryProvider: string,
  now = new Date(),
): DiscoveryCandidate[] {
  return urls.map(({ url, title }) => {
    const decision = decideForUrl(url, now);
    let domain = "";
    try {
      domain = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    } catch {
      domain = "ungültig";
    }

    return {
      discoveredUrl: url,
      domain,
      title: title ?? null,
      discoveryProvider,
      discoveredAt: now.toISOString(),
      sourceId: decision.sourceId,
      policyDecision: decision.decision,
      policyReason: decision.reason,
      nextStep: NEXT_STEP[decision.decision],
    };
  });
}

/** Nur die Funde, die tatsächlich geladen werden dürfen. */
export function ingestable(candidates: DiscoveryCandidate[]): DiscoveryCandidate[] {
  return candidates.filter((c) => c.policyDecision === "approved");
}

/**
 * Was die Person über die Reichweite der Suche erfährt.
 *
 * Der Auftrag verbietet die Behauptung, „das gesamte Internet" zu
 * durchsuchen. Dieser Satz ist die ehrliche Fassung — und er wird aus
 * echten Zahlen gebildet, nicht aus einer Formulierung.
 */
export function coverageStatement(candidates: DiscoveryCandidate[]): string {
  const approved = candidates.filter((c) => c.policyDecision === "approved").length;
  const linkOnly = candidates.filter((c) => c.policyDecision === "link_only").length;
  const pending = candidates.filter((c) => c.policyDecision === "pending_review").length;

  const parts = [`${approved} aus freigegebenen Quellen geladen`];
  if (linkOnly > 0) parts.push(`${linkOnly} nur verlinkt`);
  if (pending > 0) parts.push(`${pending} ungeprüft und deshalb nicht geladen`);

  return parts.join(", ") + ".";
}
