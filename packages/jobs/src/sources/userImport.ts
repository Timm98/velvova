import { normalise, type JobSourceAdapter, type RawListing } from "../adapter.ts";

/**
 * Import durch den Menschen selbst: eine URL oder ein eingefuegter Text.
 *
 * Das ist der einzige Weg, auf dem eine Anzeige aus einer Quelle ins
 * System kommt, mit der wir keinen Vertrag haben - und er ist zulässig,
 * weil der Mensch die Anzeige selbst mitbringt. Es wird nichts abgerufen,
 * was er nicht selbst geöffnet hat, und nichts im Hintergrund
 * nachgeladen.
 */
export class UserTextImportAdapter implements JobSourceAdapter {
  // Muss dem Eintrag im Quellenverzeichnis entsprechen. Hiess einmal
  // "user_text" — die Policy Engine fand dazu nichts und entschied
  // "unbekannte Quelle", also fail-closed mit der falschen Begründung.
  // Gefunden hat das die verallgemeinerte Driftprüfung.
  readonly key = "user_private_import";
  readonly displayName = "Von dir eingefuegt";
  readonly kind = "user_text" as const;
  readonly licenseStatus = "user_provided" as const;
  readonly attributionRequired = false;
  readonly attributionText = null;
  readonly termsUrl = null;

  isConfigured(): boolean {
    return true;
  }

  async fetchListings(): Promise<RawListing[]> {
    // Diese Quelle wird nie abgefragt - sie nimmt entgegen.
    return [];
  }

  /** Wird aufgerufen, wenn jemand eine Stellenbeschreibung einfuegt. */
  parse(input: { text: string; url?: string; title?: string; companyName?: string }): RawListing {
    const firstLine = input.text.split("\n").find((l) => l.trim().length > 0)?.trim() ?? "Ohne Titel";
    return {
      externalId: `user:${Date.now()}`,
      title: input.title?.trim() || firstLine.slice(0, 120),
      companyName: input.companyName?.trim() || "Nicht angegeben",
      location: "Nicht angegeben",
      description: input.text,
      originalUrl: input.url ?? null,
      publishedAt: null,
      raw: { importedByUser: true },
    };
  }
}

export { normalise };
