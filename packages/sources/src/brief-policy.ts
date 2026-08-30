import type { SourceDecision } from "./decision-types.ts";
import type { SourceEntry } from "./source-registry.ts";

/**
 * Was von einer fremden Stellenanzeige gezeigt werden darf.
 *
 * Die Regel, die alles andere trägt: **Umschreiben ist keine
 * Nutzungserlaubnis.** Einen Anzeigentext durch ein Sprachmodell laufen
 * zu lassen macht ihn nicht zu unserem. Eine Zusammenfassung ist eine
 * abgeleitete Bearbeitung — und wer den Ausgangstext nicht verwenden
 * darf, darf auch die Bearbeitung nicht veröffentlichen.
 *
 * Daraus folgen sechs Darstellungsebenen. Sie hängen nicht daran, wie
 * gut wir den Text technisch bekommen könnten, sondern daran, was die
 * Quelle erlaubt.
 */

export type RenderMode =
  | "metadata_only"
  | "licensed_excerpt"
  | "licensed_full_text"
  | "generated_summary_allowed"
  | "private_summary_only"
  | "link_only";

export type BriefAudience = "public" | "authenticated" | "private_user_only";

export interface BriefPermission {
  renderMode: RenderMode;
  /** Darf überhaupt ein Brief entstehen? */
  mayGenerate: boolean;
  /** Für wen? */
  audience: BriefAudience;
  /** Wie viele Sätze aus Quellenfakten. Null heisst: keine. */
  maxFactSentences: number;
  /** Darf der Originaltext im Wortlaut erscheinen? */
  verbatimAllowed: boolean;
  /** Muss ein Verweis auf das Original dabeistehen? */
  requiresOriginalLink: boolean;
  attributionText: string | null;
  /** In ganzen Sätzen — steht so in der Oberfläche. */
  reason: string;
}

/**
 * Wie lange ein Brief gilt.
 *
 * Eine Zusammenfassung altert mit ihrer Quelle. Steht sie noch da,
 * wenn die Anzeige längst geändert wurde, behauptet sie etwas über
 * eine Stelle, die es so nicht mehr gibt.
 */
export const BRIEF_TTL_HOURS = 72;

export function decideBrief(
  entry: SourceEntry | null,
  decision: SourceDecision,
  /** Hat die Person den Text selbst mitgebracht? */
  userSupplied = false,
): BriefPermission {
  /*
   * Der eigene Text der Person schlägt alles.
   *
   * Was sie selbst gelesen und eingefügt hat, ist ihre Recherche. Sie
   * darf sie analysieren lassen — aber das Ergebnis bleibt bei ihr und
   * geht in keinen öffentlichen Bestand.
   */
  if (userSupplied) {
    return {
      renderMode: "private_summary_only",
      mayGenerate: true,
      audience: "private_user_only",
      maxFactSentences: 6,
      verbatimAllowed: false,
      requiresOriginalLink: true,
      attributionText: null,
      reason:
        "Du hast den Text selbst mitgebracht. Die Analyse bleibt in deinem Konto und " +
        "erscheint in keiner öffentlichen Liste.",
    };
  }

  if (!entry || decision.decision !== "approved") {
    return {
      renderMode: "link_only",
      mayGenerate: false,
      audience: "public",
      maxFactSentences: 0,
      verbatimAllowed: false,
      requiresOriginalLink: true,
      attributionText: entry?.attributionText ?? null,
      reason:
        entry
          ? `Von ${entry.displayName} zeigen wir nur den Verweis. ${decision.reason}`
          : "Diese Quelle ist nicht freigegeben. Es wird nur auf das Original verwiesen.",
    };
  }

  const darfZusammenfassen = decision.allowedOperations.includes("Summarize");
  const darfAnzeigen = decision.allowedOperations.includes("PublicDisplay");

  if (!darfAnzeigen) {
    return {
      renderMode: "link_only",
      mayGenerate: false,
      audience: "public",
      maxFactSentences: 0,
      verbatimAllowed: false,
      requiresOriginalLink: true,
      attributionText: entry.attributionText,
      reason: `${entry.displayName} erlaubt keine öffentliche Darstellung der Inhalte.`,
    };
  }

  if (!darfZusammenfassen) {
    /*
     * Anzeigen ja, zusammenfassen nein. Klingt widersprüchlich, ist es
     * nicht: die erlaubten Felder dürfen stehen, eine daraus abgeleitete
     * Fassung ist eine Bearbeitung und braucht eine eigene Erlaubnis.
     */
    return {
      renderMode: "metadata_only",
      mayGenerate: false,
      audience: "public",
      maxFactSentences: 0,
      verbatimAllowed: entry.fullTextAllowed,
      requiresOriginalLink: entry.requiresOriginalLink,
      attributionText: entry.attributionText,
      reason:
        `${entry.displayName} erlaubt die Anzeige der Felder, aber keine abgeleitete ` +
        "Zusammenfassung. Wir zeigen die Angaben, wie sie dastehen.",
    };
  }

  return {
    renderMode: entry.fullTextAllowed ? "generated_summary_allowed" : "licensed_excerpt",
    mayGenerate: true,
    audience: "public",
    // Vier Sätze. Mehr wäre keine Kurzfassung mehr, sondern ein Ersatz
    // für die Anzeige — und der steht uns nicht zu.
    maxFactSentences: 4,
    verbatimAllowed: entry.fullTextAllowed,
    requiresOriginalLink: entry.requiresOriginalLink,
    attributionText: entry.attributionText,
    reason: `${entry.displayName} erlaubt eine kurze eigene Zusammenfassung mit Quellenangabe.`,
  };
}

/**
 * Der Hinweis unter jedem Brief.
 *
 * Er ersetzt die Quellenangabe des Anbieters nicht — er steht daneben.
 */
export function briefDisclaimer(assistantName: string): string {
  return (
    `Kurzfassung von ${assistantName} auf Basis der genannten Quelle. ` +
    "Bitte prüfe vor der Bewerbung die vollständige Originalanzeige."
  );
}

/** Ist ein vorhandener Brief noch gültig? */
export function briefIsStale(generatedAt: Date, now = new Date()): boolean {
  return now.getTime() - generatedAt.getTime() > BRIEF_TTL_HOURS * 3600_000;
}
