import type { ClaimAnalysis } from "@paycheck/documents";
import type { ApplyCapability } from "./capability-registry";

/**
 * Das Bewerbungspaket.
 *
 * Es gibt genau eine Stelle, an der dieses Produkt einer Person schaden
 * kann, ohne dass sie es merkt: wenn es in ihrem Namen etwas behauptet,
 * das nicht stimmt. Sie erfährt davon im Gespräch — und muss dann
 * dafür geradestehen, nicht wir.
 *
 * Deshalb ist das Paket erst fertig, wenn jede Aussage belegt und jede
 * Änderung sichtbar ist. „Fertig" heisst hier nicht „vollständig
 * ausgefüllt", sondern „von einem Menschen angesehen und freigegeben".
 */

export type ItemStatus = "ready" | "needs_review" | "missing" | "not_required";

export interface PackageItem {
  key: string;
  label: string;
  status: ItemStatus;
  /** Warum dieser Zustand — in einem Satz. */
  detail: string;
  /** Was die Person tun muss, falls etwas fehlt. */
  action: string | null;
}

export interface DocumentDiff {
  original: string;
  revised: string;
  /** Warum Nina das geändert hat. */
  rationale: string;
  /** Welche bestätigte Erfahrung den Satz trägt. */
  evidenceIds: string[];
  /** Ohne Beleg: die Änderung darf nicht ins Dokument. */
  supported: boolean;
}

export interface ApplicationPackage {
  items: PackageItem[];
  diffs: DocumentDiff[];
  /** Alle Pflichtstücke bereit? */
  ready: boolean;
  blockers: string[];
  capability: ApplyCapability;
  estimatedMinutes: { min: number; max: number } | null;
  summary: string;
}

export interface PackageInput {
  capability: ApplyCapability;
  /** Ergebnis des Belegabgleichs über alle erzeugten Texte. */
  claims: ClaimAnalysis | null;
  documents: { key: string; label: string; present: boolean; approved: boolean; required: boolean }[];
  screeningQuestions: { question: string; answered: boolean; approved: boolean; voluntary: boolean }[];
  passportFields: { key: string; label: string; filled: boolean; required: boolean }[];
  estimatedMinutes?: { min: number; max: number } | null;
  diffs?: DocumentDiff[];
}

export function buildPackage(input: PackageInput): ApplicationPackage {
  const items: PackageItem[] = [];

  for (const d of input.documents) {
    items.push({
      key: `document:${d.key}`,
      label: d.label,
      status: !d.required
        ? "not_required"
        : !d.present
          ? "missing"
          : d.approved
            ? "ready"
            : "needs_review",
      detail: !d.required
        ? "Für diese Stelle nicht verlangt."
        : !d.present
          ? "Noch nicht erstellt."
          : d.approved
            ? "Von dir freigegeben."
            : "Erstellt, aber noch nicht von dir angesehen.",
      action: !d.required ? null : !d.present ? "Erstellen" : d.approved ? null : "Ansehen und freigeben",
    });
  }

  for (const [i, q] of input.screeningQuestions.entries()) {
    items.push({
      key: `question:${i}`,
      label: q.question.length > 70 ? `${q.question.slice(0, 70)}…` : q.question,
      /*
       * Freiwillige Angaben — etwa zu Diversität — sind nie ein
       * Hindernis. Sie werden auch nie vorbelegt: eine vorgeschlagene
       * Antwort auf eine freiwillige Frage ist ein Vorschlag zu viel.
       */
      status: q.voluntary
        ? "not_required"
        : !q.answered
          ? "missing"
          : q.approved
            ? "ready"
            : "needs_review",
      detail: q.voluntary
        ? "Freiwillige Angabe. Du entscheidest, ob du sie machst — wir schlagen nichts vor."
        : !q.answered
          ? "Noch unbeantwortet."
          : q.approved
            ? "Von dir freigegeben."
            : "Entwurf liegt vor, noch nicht bestätigt.",
      action: q.voluntary ? null : q.approved ? null : "Antwort prüfen",
    });
  }

  for (const f of input.passportFields) {
    items.push({
      key: `passport:${f.key}`,
      label: f.label,
      status: !f.required ? "not_required" : f.filled ? "ready" : "missing",
      detail: !f.required
        ? "Für diese Stelle nicht verlangt."
        : f.filled
          ? "Aus deinem Bewerbungspass."
          : "Fehlt noch in deinem Bewerbungspass.",
      action: f.required && !f.filled ? "Ergänzen" : null,
    });
  }

  const blockers: string[] = [];

  /*
   * Der harte Riegel.
   *
   * Eine unbelegte Aussage sperrt das Paket — nicht als Warnung,
   * sondern als Sperre. Eine Warnung klickt man weg; eine Sperre zwingt
   * zur Entscheidung: belegen oder abschwächen.
   */
  if (input.claims && input.claims.unsupported.length > 0) {
    blockers.push(
      `${input.claims.unsupported.length} ${
        input.claims.unsupported.length === 1 ? "Aussage hat" : "Aussagen haben"
      } keinen Beleg in deinem Profil.`,
    );
  }

  const fehlend = items.filter((i) => i.status === "missing");
  const ungeprueft = items.filter((i) => i.status === "needs_review");

  if (fehlend.length > 0) {
    blockers.push(`${fehlend.length} Pflichtangaben fehlen noch.`);
  }
  if (ungeprueft.length > 0) {
    blockers.push(`${ungeprueft.length} Stücke hast du noch nicht angesehen.`);
  }

  const diffs = input.diffs ?? [];
  const unbelegteAenderungen = diffs.filter((d) => !d.supported);
  if (unbelegteAenderungen.length > 0) {
    blockers.push(
      `${unbelegteAenderungen.length} Änderungen stützen sich auf keine bestätigte Erfahrung.`,
    );
  }

  const ready = blockers.length === 0;

  return {
    items,
    diffs,
    ready,
    blockers,
    capability: input.capability,
    estimatedMinutes: input.estimatedMinutes ?? null,
    summary: ready
      ? "Alles bereit. Der letzte Schritt liegt bei dir."
      : blockers[0]!,
  };
}

/**
 * Was nach der Übergabe gilt.
 *
 * Ein Redirect ist kein Versand. Das Produkt weiss nach dem Öffnen der
 * Originalseite genau so viel wie vorher — nämlich nichts darüber, ob
 * die Person die Bewerbung abgeschickt hat.
 *
 * Deshalb bleibt der Status auf „übergeben", bis sie es sagt. Alles
 * andere wäre eine Zahl im Bewerbungstracker, die niemand geprüft hat.
 */
export type HandoffConfirmation = "sent" | "not_yet" | "aborted" | "later";

export function statusAfterHandoff(
  confirmation: HandoffConfirmation | null,
): "handed_off" | "confirmed_sent" | "abandoned" {
  if (confirmation === "sent") return "confirmed_sent";
  if (confirmation === "aborted") return "abandoned";
  return "handed_off";
}
