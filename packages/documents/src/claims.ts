import type { Claim, EvidenceItem } from "@paycheck/domain";
import { isConfirmedFact } from "@paycheck/domain";

/**
 * Claim-Provenienz.
 *
 * Der technische Riegel gegen erfundene Bewerbungsaussagen. Jeder Satz in
 * einem erzeugten Dokument wird gegen die bestaetigte Evidenz gehalten.
 * Ohne Beleg bekommt er den Status "unsupported" - und ein Dokument mit
 * einer unbelegten Aussage kann nicht freigegeben werden.
 *
 * Das ist bewusst haerter als eine Warnung. Eine Warnung klickt man weg;
 * eine gesperrte Freigabe zwingt zur Entscheidung: belegen oder abschwaechen.
 */

/** Saetze, die keine ueberpruefbare Behauptung enthalten. */
const NON_CLAIM_PATTERNS = [
  /^(sehr geehrte|mit freundlichen|liebe[rs]?\b|hallo\b|guten tag)/i,
  /^(anlage|anlagen|betreff|datum)\s*:/i,
  /^\s*$/,
];

/** Formulierungen, die eine Behauptung bereits als Wunsch kennzeichnen. */
const HEDGED = /\b(moechte|wuerde gern|interessiere mich|reizt mich|suche|freue mich|kann ich mir vorstellen)\b/i;

export function isCheckableClaim(sentence: string): boolean {
  const s = sentence.trim();
  if (s.length < 20) return false;
  if (NON_CLAIM_PATTERNS.some((p) => p.test(s))) return false;
  // Absichtserklaerungen sind keine Tatsachenbehauptungen.
  if (HEDGED.test(s)) return false;
  return true;
}

export function splitIntoSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Wortueberlappung als Naeherung. Kein semantisches Modell, aber pruefbar. */
function overlapScore(claim: string, evidence: string): number {
  const tokenise = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .split(/\s+/)
        .filter((w) => w.length > 3),
    );
  const a = tokenise(claim);
  const b = tokenise(evidence);
  if (a.size === 0 || b.size === 0) return 0;
  let hits = 0;
  for (const w of a) if (b.has(w)) hits++;
  return hits / Math.min(a.size, b.size);
}

const SUPPORT_THRESHOLD = 0.34;

export interface ClaimAnalysis {
  claims: Claim[];
  /** Aussagen ohne Beleg. Solange eine davon besteht, keine Freigabe. */
  unsupported: Claim[];
  supportedRatio: number;
}

export function analyseClaims(
  artifactId: string,
  text: string,
  evidence: EvidenceItem[],
): ClaimAnalysis {
  const confirmed = evidence.filter(isConfirmedFact);
  const sentences = splitIntoSentences(text).filter(isCheckableClaim);

  const claims: Claim[] = sentences.map((sentence, index) => {
    const matches = confirmed
      .map((e) => ({ id: e.id, score: overlapScore(sentence, e.statement) }))
      .filter((m) => m.score >= SUPPORT_THRESHOLD)
      .sort((a, b) => b.score - a.score);

    if (matches.length === 0) {
      return {
        id: `${artifactId}:${index}`,
        artifactId,
        text: sentence,
        evidenceIds: [],
        status: "unsupported",
        note:
          "Fuer diese Aussage gibt es keinen bestaetigten Beleg in deinem Profil. " +
          "Ergaenze einen Beleg oder formuliere sie vorsichtiger.",
      };
    }

    const strong = matches[0]!.score >= 0.5;
    return {
      id: `${artifactId}:${index}`,
      artifactId,
      text: sentence,
      evidenceIds: matches.slice(0, 3).map((m) => m.id),
      status: strong ? "supported" : "weakened",
      note: strong
        ? "Belegt durch eine von dir bestaetigte Erfahrung."
        : "Nur teilweise belegt. Pruefe, ob die Formulierung nicht mehr behauptet als der Beleg hergibt.",
    };
  });

  const unsupported = claims.filter((c) => c.status === "unsupported");
  return {
    claims,
    unsupported,
    supportedRatio: claims.length === 0 ? 1 : (claims.length - unsupported.length) / claims.length,
  };
}

export interface ApprovalCheck {
  canApprove: boolean;
  blockers: { text: string; reason: string }[];
}

/**
 * Die Freigabepruefung. Genau eine Regel, aber sie gilt ausnahmslos.
 */
export function checkApproval(analysis: ClaimAnalysis): ApprovalCheck {
  return {
    canApprove: analysis.unsupported.length === 0,
    blockers: analysis.unsupported.map((c) => ({ text: c.text, reason: c.note })),
  };
}

/**
 * Schwaecht eine unbelegte Aussage ab, statt sie zu loeschen. Der Mensch
 * entscheidet, ob er das uebernimmt - vorgeschlagen wird es aber, weil
 * "loesch den Satz" selten der richtige Rat ist.
 */
export function suggestSofterWording(sentence: string): string {
  const trimmed = sentence.trim().replace(/\.$/, "");
  if (/^ich (habe|bin|kann|verfuege)/i.test(trimmed)) {
    return `${trimmed.replace(/^Ich /i, "Ich ")} — hier fehlt noch ein konkretes Beispiel.`;
  }
  return `${trimmed}. (Fuer diese Aussage brauchst du noch einen Beleg.)`;
}
