import { missingImprintFields } from "@/lib/content/company";

/**
 * Rechtstexte und ihr Freigabezustand.
 *
 * Ein Entwurf, der aussieht wie ein fertiges Impressum, ist schlimmer
 * als eine leere Seite: er suggeriert eine Prüfung, die nicht
 * stattgefunden hat, und niemand sieht ihn sich noch einmal an.
 *
 * Deshalb trägt jeder Text einen Zustand, und die Seite zeigt ihn.
 */

export type ReviewStatus = "draft" | "legal_review_required" | "approved" | "published";

export interface LegalDocument {
  slug: string;
  title: string;
  reviewStatus: ReviewStatus;
  /** Was fehlt, damit er freigegeben werden könnte. */
  missingFields: string[];
  /** Darf er ohne Warnhinweis erscheinen? */
  publishable: boolean;
}

const STATUS_TEXT: Record<ReviewStatus, string> = {
  draft: "Entwurf — noch nicht juristisch geprüft.",
  legal_review_required: "Juristische Prüfung ausstehend.",
  approved: "Juristisch freigegeben.",
  published: "Veröffentlicht.",
};

export function statusLabel(status: ReviewStatus): string {
  return STATUS_TEXT[status];
}

/**
 * Der Zustand aller Pflichtseiten.
 *
 * Berechnet, nicht gepflegt: sobald die fehlenden Angaben ergänzt sind,
 * ändert sich der Zustand von selbst. Eine Liste, die jemand von Hand
 * aktualisieren müsste, stünde eines Tages falsch da.
 */
export function legalDocuments(): LegalDocument[] {
  const imprintMissing = missingImprintFields();

  return [
    {
      slug: "impressum",
      title: "Impressum",
      reviewStatus: imprintMissing.length > 0 ? "draft" : "legal_review_required",
      missingFields: imprintMissing,
      publishable: false,
    },
    {
      slug: "datenschutz",
      title: "Datenschutzerklärung",
      reviewStatus: "legal_review_required",
      missingFields: [
        "Verantwortliche Stelle",
        "Auftragsverarbeitungsverträge mit Modell- und E-Mail-Anbietern",
        "Angaben zur Drittlandübermittlung",
      ],
      publishable: false,
    },
    {
      slug: "terms",
      title: "Nutzungsbedingungen",
      reviewStatus: "draft",
      missingFields: ["Haftungsregelung", "Laufzeit und Kündigung"],
      publishable: false,
    },
    {
      slug: "ai-transparency",
      title: "KI-Transparenz",
      // Beschreibt, was das Produkt tut. Das können wir belegen — es
      // ist keine Rechtsaussage, sondern eine Selbstauskunft.
      reviewStatus: "approved",
      missingFields: [],
      publishable: true,
    },
    {
      slug: "source-policy",
      title: "Quellenrichtlinie",
      reviewStatus: "approved",
      missingFields: [],
      publishable: true,
    },
    {
      slug: "accessibility",
      title: "Barrierefreiheit",
      reviewStatus: "approved",
      missingFields: [],
      publishable: true,
    },
  ];
}

export function legalDocument(slug: string): LegalDocument | undefined {
  return legalDocuments().find((d) => d.slug === slug);
}

/**
 * Blockiert etwas den Produktivbetrieb?
 *
 * Nicht freigegebene Pflichtseiten sind ein Launch-Gate. Die Funktion
 * beantwortet die Frage an einer Stelle, statt sie jedem zu überlassen.
 */
export function launchBlockers(): string[] {
  return legalDocuments()
    .filter((d) => !d.publishable && (d.slug === "impressum" || d.slug === "datenschutz"))
    .map((d) => `${d.title}: ${statusLabel(d.reviewStatus)}`);
}
