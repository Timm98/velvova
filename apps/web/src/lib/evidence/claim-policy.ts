/**
 * Was eine Quelle tragen kann.
 *
 * Ein Reddit-Beitrag, eine Unternehmensumfrage und eine amtliche
 * Statistik stehen im Internet nebeneinander und sehen gleich aus. Sie
 * tragen aber sehr verschiedene Aussagen:
 *
 *   Der Forenbeitrag erzeugt eine **Hypothese**. „Manche berichten…"
 *   Die Unternehmensumfrage ist **interessengefärbt**. Wer sie zahlt,
 *   steht dabei — oder die Zahl wird nicht gezeigt.
 *   Die amtliche Statistik trägt eine **Aussage**, mit Zeitraum und Region.
 *
 * Ohne diese Unterscheidung behauptet ein Produkt mehr, als es belegen
 * kann — und zwar gegenüber Menschen, die auf dieser Grundlage über
 * ihren Beruf entscheiden.
 */

export type EvidenceType =
  | "official_statistics"
  | "peer_reviewed_research"
  | "working_paper"
  | "institutional_report"
  | "company_sponsored_survey"
  | "journalism"
  | "industry_article"
  | "user_review"
  | "forum_or_social_anecdote";

export type QualityTier = "high" | "moderate" | "context_only" | "anecdotal" | "unverified";

export interface EvidenceRecord {
  id: string;
  title: string;
  publisher: string | null;
  publicationDate: Date | null;
  url: string | null;
  evidenceType: EvidenceType;
  geography: string | null;
  sampleSize: number | null;
  commercialInterest: string | null;
  limitations: string | null;
  qualityTier: QualityTier;
  expiresAt: Date | null;
}

/** Welche Belegart welche Stufe rechtfertigt, wenn nichts dagegen spricht. */
const STANDARD_STUFE: Record<EvidenceType, QualityTier> = {
  official_statistics: "high",
  peer_reviewed_research: "high",
  working_paper: "moderate",
  institutional_report: "moderate",
  company_sponsored_survey: "context_only",
  journalism: "context_only",
  industry_article: "context_only",
  user_review: "anecdotal",
  forum_or_social_anecdote: "anecdotal",
};

const STUFEN_LABEL: Record<QualityTier, string> = {
  high: "belastbar",
  moderate: "eingeschränkt belastbar",
  context_only: "nur als Einordnung",
  anecdotal: "Einzelbericht",
  unverified: "ungeprüft",
};

const ART_LABEL: Record<EvidenceType, string> = {
  official_statistics: "Amtliche Statistik",
  peer_reviewed_research: "Begutachtete Studie",
  working_paper: "Arbeitspapier",
  institutional_report: "Institutsbericht",
  company_sponsored_survey: "Unternehmensstudie",
  journalism: "Medienbericht",
  industry_article: "Branchenartikel",
  user_review: "Nutzerbewertung",
  forum_or_social_anecdote: "Forenbeitrag",
};

export interface ClaimVerdict {
  allowed: boolean;
  /** Wie die Aussage formuliert werden darf. */
  hedge: string | null;
  reason: string;
  /** Die Quellenzeile, die neben der Zahl stehen muss. */
  citation: string;
}

/**
 * Darf mit dieser Quelle eine Zahl im Produkt gezeigt werden?
 *
 * Drei Dinge sperren unabhängig voneinander:
 *
 *   **Fehlende Angaben.** Eine Zahl ohne Zeitraum und Region ist keine
 *   Zahl, sondern ein Eindruck.
 *
 *   **Abgelaufene Gültigkeit.** Arbeitsmarktdaten von 2019 beschreiben
 *   einen anderen Arbeitsmarkt.
 *
 *   **Belegstufe.** Ein Einzelbericht trägt keine allgemeine Aussage,
 *   egal wie überzeugend er klingt.
 */
export function assessClaim(
  record: EvidenceRecord,
  claim: { isStatistic: boolean; isIndividualAdvice: boolean },
  now = new Date(),
): ClaimVerdict {
  const citation = buildCitation(record);

  if (record.expiresAt && record.expiresAt.getTime() < now.getTime()) {
    return {
      allowed: false,
      hedge: null,
      reason: "Die Quelle ist als überholt gekennzeichnet.",
      citation,
    };
  }

  if (claim.isStatistic) {
    if (!record.publicationDate) {
      return {
        allowed: false,
        hedge: null,
        reason: "Ohne Erscheinungsdatum lässt sich die Zahl nicht einordnen.",
        citation,
      };
    }
    if (!record.geography) {
      return {
        allowed: false,
        hedge: null,
        reason: "Ohne geografischen Bezug lässt sich die Zahl nicht einordnen.",
        citation,
      };
    }
    if (record.qualityTier === "anecdotal" || record.qualityTier === "unverified") {
      return {
        allowed: false,
        hedge: null,
        reason:
          "Ein Einzelbericht trägt keine allgemeine Zahl. Er darf als Erfahrung genannt " +
          "werden, nicht als Statistik.",
        citation,
      };
    }
  }

  /*
   * Der subtilste Fall: eine allgemeine Studie als individuellen Beweis
   * verwenden. „Studien zeigen, dass Bewerbungen mit X erfolgreicher
   * sind — deshalb solltest du X tun." Der Schluss von der Verteilung
   * auf den Einzelfall ist unzulässig, und er klingt überzeugend.
   */
  if (claim.isIndividualAdvice) {
    return {
      allowed: true,
      hedge:
        "Das gilt im Durchschnitt der untersuchten Fälle und sagt über deine Bewerbung " +
        "nichts Sicheres.",
      reason: "Allgemeine Erkenntnis, auf einen Einzelfall bezogen.",
      citation,
    };
  }

  const hedge =
    record.qualityTier === "high"
      ? null
      : record.qualityTier === "moderate"
        ? "Die Datenlage ist eingeschränkt."
        : record.evidenceType === "company_sponsored_survey"
          ? "Erhoben von einem Unternehmen mit eigenem Interesse am Ergebnis."
          : "Einzelne Berichte, keine repräsentative Erhebung.";

  return { allowed: true, hedge, reason: "Quelle trägt die Aussage.", citation };
}

/**
 * Die Quellenzeile.
 *
 * Sie enthält, was zum Nachprüfen nötig ist: Art, Herausgeber, Datum,
 * Region, Stichprobe. Eine Zahl ohne diese Zeile erscheint im Produkt
 * nicht.
 */
export function buildCitation(record: EvidenceRecord): string {
  const teile = [ART_LABEL[record.evidenceType]];
  if (record.publisher) teile.push(record.publisher);
  if (record.publicationDate) teile.push(String(record.publicationDate.getFullYear()));
  if (record.geography) teile.push(record.geography);
  if (record.sampleSize) teile.push(`n = ${record.sampleSize}`);
  teile.push(STUFEN_LABEL[record.qualityTier]);
  return teile.join(" · ");
}

/** Die Standardstufe für eine Belegart — als Vorschlag, nicht als Urteil. */
export function defaultTier(type: EvidenceType): QualityTier {
  return STANDARD_STUFE[type];
}

/**
 * Widersprechen sich zwei Quellen?
 *
 * Zwei Zahlen zur selben Frage, die weit auseinanderliegen, dürfen
 * nicht beide als Fakt erscheinen. Das Produkt zeigt dann die
 * Spannweite und sagt, dass die Quellen uneins sind.
 */
export function reconcile(
  werte: { value: number; record: EvidenceRecord }[],
  toleranz = 0.25,
): { publishable: boolean; range: [number, number] | null; note: string } {
  if (werte.length === 0) return { publishable: false, range: null, note: "Keine Quelle." };
  if (werte.length === 1) {
    return { publishable: true, range: null, note: buildCitation(werte[0]!.record) };
  }

  const zahlen = werte.map((w) => w.value);
  const min = Math.min(...zahlen);
  const max = Math.max(...zahlen);
  const abweichung = min === 0 ? 1 : (max - min) / min;

  if (abweichung > toleranz) {
    return {
      publishable: false,
      range: [min, max],
      note:
        `Die Quellen widersprechen sich (${min} bis ${max}). Eine einzelne Zahl wäre hier ` +
        "eine Auswahl, keine Erkenntnis.",
    };
  }

  return {
    publishable: true,
    range: [min, max],
    note: `${werte.length} Quellen, übereinstimmend im Rahmen von ${Math.round(abweichung * 100)} %.`,
  };
}
