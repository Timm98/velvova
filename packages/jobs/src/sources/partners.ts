import type {
  FetchOptions,
  JobSourceAdapter,
  ProviderCapabilities,
  RawListing,
} from "../adapter.ts";

/**
 * Partnerquellen ohne Vertrag.
 *
 * Diese Klassen rufen nichts ab und werden nie etwas abrufen, solange
 * kein Vertrag vorliegt. Sie existieren trotzdem, und zwar aus einem
 * bestimmten Grund: **ohne sie ist die Lücke unsichtbar.**
 *
 * Fehlt der Adapter ganz, sieht eine Betriebsansicht aus, als gäbe es
 * LinkedIn schlicht nicht. Mit ihm steht dort „nicht freigegeben, kein
 * Vertrag" — und die nächste Person fragt nach dem Vertrag, statt einen
 * Scraper zu schreiben.
 *
 * `fetchListings` wirft. Es gibt keinen Codepfad, auf dem hier
 * versehentlich etwas abgerufen wird, auch nicht, wenn jemand die
 * Policy Engine umginge.
 *
 * Die Schlüssel tragen die Endung `_partner_pending`, weil das
 * Quellenverzeichnis sie so führt. Ohne diese Übereinstimmung greift
 * die Sperre zwar, aber mit der Begründung „unbekannte Quelle" statt
 * der richtigen — und der Fehler versteckt sich hinter einem korrekten
 * Verhalten. Die Driftprüfung hat genau das gefunden.
 */

class UnauthorizedPartnerAdapter implements JobSourceAdapter {
  readonly key: string;
  readonly displayName: string;
  readonly kind = "partner" as const;
  readonly licenseStatus = "unclear" as const;
  readonly attributionRequired = true;
  readonly attributionText: string | null;
  readonly termsUrl: string | null;
  readonly capabilities: ProviderCapabilities;

  /** Was fehlt, damit diese Quelle laufen könnte. */
  readonly missing: string;

  constructor(input: {
    key: string;
    displayName: string;
    missing: string;
    termsUrl?: string | null;
  }) {
    this.key = input.key;
    this.displayName = input.displayName;
    this.missing = input.missing;
    this.termsUrl = input.termsUrl ?? null;
    this.attributionText = null;
    this.capabilities = {
      search: false,
      details: false,
      since: false,
      maxPerRequest: 0,
      rateLimitPerMinute: null,
      salary: false,
      expiry: false,
      structuredRequirements: false,
    };
  }

  isConfigured(): boolean {
    return false;
  }

  async fetchListings(_options: FetchOptions = {}): Promise<RawListing[]> {
    // Kein leeres Array. Ein leeres Array sähe aus wie „keine Stellen
    // gefunden" und würde in einem Bericht als erfolgreicher Abruf
    // erscheinen. Das hier ist ein Zustand, kein Ergebnis.
    throw new Error(
      `${this.displayName} wird nicht abgerufen: ${this.missing} ` +
        `Ein Abruf ohne diese Grundlage findet nicht statt.`,
    );
  }
}

export class LinkedInPartnerAdapter extends UnauthorizedPartnerAdapter {
  constructor() {
    super({
      key: "linkedin_partner_pending",
      displayName: "LinkedIn",
      missing:
        "Es gibt keine schriftliche Freigabe und kein genehmigtes Partnerprogramm. " +
        "Eine eigene Kopie des LinkedIn-Bestands ist ausgeschlossen; einzelne vom Menschen " +
        "gespeicherte Links bleiben private Lesezeichen ohne automatischen Abruf.",
    });
  }
}

export class IndeedPartnerAdapter extends UnauthorizedPartnerAdapter {
  constructor() {
    super({
      key: "indeed_partner_pending",
      displayName: "Indeed",
      missing:
        "Es gibt keine Partnervereinbarung. Die Job Sync API ist keine offene Such-API für " +
        "den Gesamtbestand, sondern für autorisierte ATS-Prozesse bestimmt.",
    });
  }
}

export class StepStonePartnerAdapter extends UnauthorizedPartnerAdapter {
  constructor() {
    super({
      key: "stepstone_partner_pending",
      displayName: "StepStone",
      missing: "Es gibt keine Feed-, Lizenz- oder Partnervereinbarung.",
    });
  }
}

export class EuresPartnerAdapter extends UnauthorizedPartnerAdapter {
  constructor() {
    super({
      key: "eures",
      displayName: "EURES",
      missing:
        "Es gibt keinen offiziellen Datenzugang. EURES ist als Partner- und " +
        "Mitgliedschaftskanal geplant, nicht als abzurufendes Portal.",
    });
  }
}

/*
 * Der Platzhalter für die Bundesagentur ist entfallen.
 *
 * Er stand hier mit der Begründung, es gebe „keine dokumentierte
 * Schnittstelle für Stellenangebote" und nur eine Statistik-API. Das
 * war überholt: die Jobbörse betreibt eine offene REST-Schnittstelle
 * für Suche und Details. Es gibt jetzt einen echten Adapter
 * (`bundesagentur.ts`), der sie abruft.
 *
 * Beide gleichzeitig unter demselben Schlüssel wären ein Widerspruch —
 * die Betriebsansicht zeigte die Quelle doppelt, einmal als gesperrt
 * und einmal als aktiv, und welche Zeile stimmt, entschiede die
 * Reihenfolge einer Liste.
 */

export const PARTNER_ADAPTERS = [
  LinkedInPartnerAdapter,
  IndeedPartnerAdapter,
  StepStonePartnerAdapter,
  EuresPartnerAdapter,
] as const;
