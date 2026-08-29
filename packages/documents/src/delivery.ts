import type { DeliveryPreview } from "@paycheck/domain";
import { loadRuntimeConfig, type RuntimeConfig } from "@paycheck/config";

/**
 * Versandwege.
 *
 * Die wichtigste Zeile dieses Moduls ist eine Regel, keine Funktion:
 * ohne ausdrueckliche Bestätigung des Menschen verlässt nichts das
 * System. Der Standardweg erzeugt einen Entwurf zum Herunterladen und
 * versendet gar nichts.
 */

export interface DeliveryResult {
  status: "draft_created" | "sent" | "not_connected" | "refused";
  /** true, wenn tatsächlich nichts versendet wurde. */
  isDemo: boolean;
  messageId: string | null;
  /** Verständliche Rückmeldung für den Menschen. */
  message: string;
  /** Bei Entwuerfen: der Inhalt zum Herunterladen. */
  draft?: { filename: string; mimeType: string; content: string };
}

export interface ApplicationDeliveryProvider {
  readonly key: string;
  readonly displayName: string;
  /** false heisst: in der Oberfläche erscheint "nicht verbunden". */
  isConnected(): boolean;
  /** Erzeugt die Vorschau, die der Mensch vor der Freigabe sieht. */
  preview(input: DeliveryPreview): DeliveryPreview;
  send(input: DeliveryPreview, userConfirmed: boolean): Promise<DeliveryResult>;
}

const NOT_CONFIRMED: DeliveryResult = {
  status: "refused",
  isDemo: true,
  messageId: null,
  message:
    "Es wurde nichts versendet: die ausdrueckliche Bestätigung fehlt. " +
    "Das ist kein Fehler, sondern Absicht.",
};

/**
 * Standardweg. Erzeugt eine .eml-Datei, die sich in jedem Mailprogramm
 * öffnen lässt - der Mensch versendet selbst und behält die Kontrolle.
 */
export class DraftDeliveryProvider implements ApplicationDeliveryProvider {
  readonly key = "draft";
  readonly displayName = "Entwurf zum Herunterladen";

  isConnected(): boolean {
    // Dieser Weg ist immer verfügbar - er braucht nichts.
    return true;
  }

  preview(input: DeliveryPreview): DeliveryPreview {
    return { ...input, isDemo: true, providerName: this.displayName };
  }

  async send(input: DeliveryPreview, userConfirmed: boolean): Promise<DeliveryResult> {
    if (!userConfirmed) return NOT_CONFIRMED;

    const headers = [
      `To: ${input.recipient}`,
      `Subject: ${input.subject}`,
      "MIME-Version: 1.0",
      'Content-Type: text/plain; charset="utf-8"',
      "",
    ].join("\r\n");

    return {
      status: "draft_created",
      isDemo: true,
      messageId: null,
      message:
        "Ein Entwurf wurde erstellt. Es wurde nichts versendet - du oeffnest ihn in deinem " +
        "Mailprogramm und schickst ihn selbst ab.",
      draft: {
        filename: `bewerbung-${input.subject.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}.eml`,
        mimeType: "message/rfc822",
        content: headers + input.body,
      },
    };
  }
}

/** Lokaler Testserver in der Entwicklung. Verlässt das Gerät nicht. */
export class MailpitDeliveryProvider implements ApplicationDeliveryProvider {
  readonly key = "mailpit";
  readonly displayName = "Lokaler Testserver (Mailpit)";

  private readonly smtpUrl: string | undefined;

  constructor(smtpUrl: string | undefined) {
    this.smtpUrl = smtpUrl;
  }

  isConnected(): boolean {
    return !!this.smtpUrl;
  }

  preview(input: DeliveryPreview): DeliveryPreview {
    return { ...input, isDemo: true, providerName: this.displayName };
  }

  async send(input: DeliveryPreview, userConfirmed: boolean): Promise<DeliveryResult> {
    if (!userConfirmed) return NOT_CONFIRMED;
    if (!this.isConnected()) {
      return {
        status: "not_connected",
        isDemo: true,
        messageId: null,
        message: "Der lokale Testserver ist nicht erreichbar. Es wurde nichts versendet.",
      };
    }
    return {
      status: "sent",
      isDemo: true,
      messageId: `mailpit-${Date.now()}`,
      message:
        "An den lokalen Testserver uebergeben. Die Nachricht hat dieses Gerät nicht verlassen " +
        "und keine echte Empfängerin erreicht.",
    };
  }
}

/**
 * Echte Postfächer. Bewusst nicht implementiert, solange keine
 * OAuth-Anwendung eingerichtet ist: eine halbfertige Anbindung, die
 * scheinbar funktioniert, wäre schlimmer als eine, die ehrlich sagt,
 * dass sie nicht verbunden ist.
 */
export class OAuthMailProvider implements ApplicationDeliveryProvider {
  readonly key: "gmail" | "outlook";
  readonly displayName: string;
  private readonly connected: boolean;

  constructor(key: "gmail" | "outlook", displayName: string, connected: boolean) {
    this.key = key;
    this.displayName = displayName;
    this.connected = connected;
  }

  isConnected(): boolean {
    return this.connected;
  }

  preview(input: DeliveryPreview): DeliveryPreview {
    return { ...input, isDemo: !this.connected, providerName: this.displayName };
  }

  async send(input: DeliveryPreview, userConfirmed: boolean): Promise<DeliveryResult> {
    if (!userConfirmed) return NOT_CONFIRMED;
    return {
      status: "not_connected",
      isDemo: true,
      messageId: null,
      message:
        `${this.displayName} ist nicht verbunden. Verbinde das Konto in den Einstellungen, ` +
        `oder lade den Entwurf herunter und versende ihn selbst.`,
    };
  }
}

export function selectDeliveryProvider(cfg: RuntimeConfig = loadRuntimeConfig()): ApplicationDeliveryProvider {
  switch (cfg.mail.provider) {
    case "mailpit":
      return new MailpitDeliveryProvider(cfg.mail.smtpUrl);
    case "gmail":
      return new OAuthMailProvider("gmail", "Gmail", false);
    case "outlook":
      return new OAuthMailProvider("outlook", "Outlook", false);
    default:
      return new DraftDeliveryProvider();
  }
}
