import type { schema } from "@paycheck/db";
import type { Job } from "@paycheck/domain";
import { erfahrungsniveauAusText } from "./erfahrungsniveau.ts";

/**
 * Eine Stellenzeile aus der Datenbank in das Fachobjekt übersetzen.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum es diese Funktion genau einmal gibt
 * ══════════════════════════════════════════════════════════════
 *
 * Zwei Abbildungen derselben Zeile laufen auseinander, und dann zeigt
 * die Detailseite etwas anderes als der Vergleich — für dieselbe
 * Stelle. Das ist in diesem Produkt schon passiert.
 *
 * Sie stand in `apps/web/src/lib/matching.ts` und ist hierher
 * gewandert, weil der Hintergrunddienst des Suchauftrags als Skript
 * ohne Next.js läuft und nicht an sie herankam.
 */

type JobZeileOhneText = Omit<typeof schema.jobs.$inferSelect, "description">;
/** Ohne die Wortmenge: 82 der 111 MB je Ladevorgang, die meist niemand liest. */
export type JobZeileSchlank = Omit<JobZeileOhneText, "descriptionTokens">;

export function rowToJob(
  row: JobZeileSchlank & { descriptionTokens?: string },
  companyName: string,
  wortmenge = "",
): Job {
  return {
    id: row.id,
    title: row.title,
    companyId: row.companyId,
    companyName,
    location: row.location,
    country: row.country,
    latitude: row.latitude,
    longitude: row.longitude,
    workModel: row.workModel,
    remotePercent: row.remotePercent,
    salary: {
      min: row.salaryMin,
      max: row.salaryMax,
      currency: row.salaryCurrency,
      period: row.salaryPeriod,
      disclosed: row.salaryDisclosed,
      provenance: row.salaryProvenance,
      evidence: row.salaryEvidence,
    },
    contractType: row.contractType,
    weeklyHours: row.weeklyHours,
    shiftWork: row.shiftWork,
    travelPercent: row.travelPercent,
    /*
     * Rückfall auf den Text, wenn das Feld leer ist.
     *
     * Der Import füllt es seit kurzem — für die rund eine Million
     * bereits gespeicherten Anzeigen bleibt es leer, und ein
     * Nachtragslauf über den ganzen Bestand ist teurer als diese
     * Zeile.
     *
     * `title` steht immer zur Verfügung; die Beschreibung nur, wenn
     * die Abfrage sie geladen hat — in der Rangliste tut sie das
     * bewusst nicht. Dann entscheidet der Titel allein, und das ist
     * genau die Angabe, auf die sich der Arbeitgeber festgelegt hat.
     */
    experienceLevel: row.experienceLevel ?? erfahrungsniveauAusText(row.title, null),
    industry: row.industry,
    languageRequirements: row.languageRequirements,
    requiredLicenses: row.requiredLicenses,
    workPermitRequired: row.workPermitRequired,
    coreTasks: row.coreTasks,
    /* Nicht geladen — nicht leer. Wer den Text braucht, holt ihn nach. */
    description: null,
    descriptionTokens: row.descriptionTokens ?? wortmenge,
    descriptionLength: row.descriptionLength,
    benefits: row.benefits,
    applyMethod: row.applyMethod,
    applyTarget: row.applyTarget,
    publishedAt: row.publishedAt,
    expiresAt: row.expiresAt,
    /*
     * Ob die Quelle die Stelle noch führt.
     *
     * Steht hier, weil die Oberfläche es zeigen muss: Eine gemerkte
     * Stelle bleibt sichtbar, auch wenn sie aus den Empfehlungen
     * gefallen ist — und dann gehört der Grund daneben.
     *
     * Der Wert entsteht in der Ernte aus allen Fundstellen; die Regel
     * steht in `standAusFundstellen`.
     */
    availabilityState: row.availabilityState ?? "unknown",
    availabilityReason: row.availabilityReason ?? null,
    fetchedAt: row.fetchedAt,
    lastLinkCheckAt: row.lastLinkCheckAt,
    lastLinkCheckOk: row.lastLinkCheckOk,
    originalUrl: row.originalUrl,
    sourceId: row.sourceId,
    contentHash: row.contentHash,
    kldb: row.kldb,
    isDemo: row.isDemo,
  };
}
