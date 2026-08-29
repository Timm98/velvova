import type { EvidenceItem, Job, JobRequirement } from "@paycheck/domain";
import { isConfirmedFact } from "@paycheck/domain";

/**
 * Dokumenterstellung aus belegter Evidenz.
 *
 * Wichtig: hier wird nichts erfunden. Die Bausteine kommen ausschließlich
 * aus bestaetigten Aussagen des Menschen. Was fehlt, wird als Lücke
 * benannt und nicht mit einer Formulierung ueberdeckt.
 */

export interface CvSection {
  heading: string;
  entries: { text: string; evidenceIds: string[] }[];
}

export interface GeneratedCv {
  sections: CvSection[];
  /** Was fehlt, damit der Mensch es ergänzen kann. */
  gaps: string[];
  /** ATS-tauglich: eine Spalte, keine Tabellen, keine Grafiken. */
  plainText: string;
}

export function buildCv(
  evidence: EvidenceItem[],
  job: Job,
  requirements: JobRequirement[],
  locale: "de" | "en" = "de",
): GeneratedCv {
  const confirmed = evidence.filter(isConfirmedFact);

  const byType = (types: EvidenceItem["type"][]) => confirmed.filter((e) => types.includes(e.type));

  const qualifications = byType(["qualification"]);
  const experiences = byType(["experience_episode", "result"]);
  const skills = byType(["skill", "tool", "knowledge"]);

  const sections: CvSection[] = [];

  if (qualifications.length > 0) {
    sections.push({
      heading: locale === "en" ? "Education" : "Ausbildung",
      entries: qualifications.map((e) => ({ text: e.statement, evidenceIds: [e.id] })),
    });
  }

  if (experiences.length > 0) {
    sections.push({
      heading: locale === "en" ? "Experience" : "Berufserfahrung",
      entries: experiences.map((e) => ({ text: e.statement, evidenceIds: [e.id] })),
    });
  }

  if (skills.length > 0) {
    sections.push({
      heading: locale === "en" ? "Skills" : "Fähigkeiten",
      entries: skills.map((e) => ({ text: e.statement, evidenceIds: [e.id] })),
    });
  }

  // Lücken gegen die Muss-Anforderungen der Stelle benennen.
  const musts = requirements.filter((r) => r.kind === "must");
  const gaps = musts
    .filter((r) => {
      const words = r.text.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
      return !confirmed.some((e) => {
        const s = e.statement.toLowerCase();
        return words.filter((w) => s.includes(w)).length >= Math.max(1, Math.floor(words.length / 3));
      });
    })
    .map((r) => r.text);

  const plainText = sections
    .map((s) => `${s.heading.toUpperCase()}\n${s.entries.map((e) => `- ${e.text}`).join("\n")}`)
    .join("\n\n");

  return { sections, gaps, plainText };
}

/**
 * Braucht diese Stelle ueberhaupt ein Anschreiben? Eines zu schreiben,
 * das niemand verlangt hat, kostet Zeit und bringt oft nichts.
 */
export function coverLetterAdvisable(job: Job): { advisable: boolean; reason: string } {
  const asksForIt = /anschreiben|motivationsschreiben|cover letter|motivation/i.test(job.description);
  if (asksForIt) {
    return { advisable: true, reason: "Die Anzeige verlangt ausdrücklich ein Anschreiben." };
  }
  if (job.applyMethod === "portal") {
    return {
      advisable: false,
      reason:
        "Die Bewerbung läuft über ein Portal und die Anzeige verlangt kein Anschreiben. " +
        "Eine kurze, präzise Antwort in den Portalfeldern wirkt hier meist besser.",
    };
  }
  return {
    advisable: false,
    reason:
      "Die Anzeige verlangt kein Anschreiben. Eine kurze E-Mail mit zwei konkreten Beispielen " +
      "reicht vermutlich - und wird eher gelesen.",
  };
}

export function buildApplicationEmail(
  job: Job,
  evidence: EvidenceItem[],
  displayName: string | null,
  locale: "de" | "en" = "de",
): { subject: string; body: string; usedEvidenceIds: string[] } {
  const confirmed = evidence.filter(isConfirmedFact);
  // Die zwei staerksten Belege: bestätigt, mit hoher eigener Sicherheit.
  const strongest = [...confirmed].sort((a, b) => b.confidence - a.confidence).slice(0, 2);

  const name = displayName ?? "";
  const subject =
    locale === "en"
      ? `Application: ${job.title}${name ? ` — ${name}` : ""}`
      : `Bewerbung: ${job.title}${name ? ` — ${name}` : ""}`;

  const opening =
    locale === "en"
      ? `Dear team at ${job.companyName},\n\nI am writing about the role "${job.title}".`
      : `Guten Tag,\n\nich schreibe Ihnen wegen der Stelle "${job.title}".`;

  const points = strongest.map((e) => `- ${e.statement}`).join("\n");

  const closing =
    locale === "en"
      ? `\n\nI would be glad to explain any of this in a conversation.\n\nKind regards\n${name}`
      : `\n\nGern erlaeutere ich das in einem Gespräch.\n\nMit freundlichen Grüßen\n${name}`;

  const relevant =
    locale === "en" ? "\n\nTwo things from my experience that are relevant here:\n" : "\n\nZwei Punkte aus meiner Erfahrung, die hier passen:\n";

  return {
    subject,
    body: opening + relevant + points + closing,
    usedEvidenceIds: strongest.map((e) => e.id),
  };
}
