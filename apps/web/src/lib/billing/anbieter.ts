/**
 * Die Zahlungsabstraktion.
 *
 * Es steht noch nicht fest, über wen abgerechnet wird. Diese Datei
 * hält die Entscheidung offen, ohne sie zu vertagen: der Rest der
 * Anwendung spricht ausschliesslich mit diesem Vertrag, und der
 * konkrete Anbieter ist eine Implementierung davon.
 *
 * Warum das mehr ist als Vorsicht: Zahlungsanbieter unterscheiden sich
 * genau dort, wo es wehtut — welche Zahlarten sie können, wie sie
 * Rückläufer melden, wie ihre Webhooks aussehen. Wer sie direkt in die
 * Seiten einbaut, baut sie in jede Seite ein.
 *
 * Ohne konfigurierten Anbieter meldet `verfügbar()` ehrlich `false`.
 * Die Preisseite steht dann trotzdem und sagt, dass die Zahlung noch
 * nicht freigeschaltet ist — statt einen Knopf zu zeigen, der ins
 * Leere führt.
 */

export type Zahlart =
  | "card"
  | "paypal"
  | "apple_pay"
  | "google_pay"
  | "sepa_debit"
  | "bank_transfer";

export const ZAHLART_TEXT: Record<Zahlart, string> = {
  card: "Kreditkarte",
  paypal: "PayPal",
  apple_pay: "Apple Pay",
  google_pay: "Google Pay",
  sepa_debit: "SEPA-Lastschrift",
  bank_transfer: "Überweisung",
};

export interface KassengangEingabe {
  userId: string;
  plan: "premium";
  interval: "month" | "year";
  /** Wohin nach erfolgreicher Zahlung. */
  erfolgUrl: string;
  abbruchUrl: string;
}

export interface Zahlungsanbieter {
  readonly key: string;
  readonly name: string;
  /** Welche Zahlarten dieser Anbieter hier wirklich kann. */
  readonly zahlarten: Zahlart[];
  /** Ist er eingerichtet? Ohne Schlüssel: nein. */
  verfügbar(): boolean;
  /** Legt einen Kassengang an und gibt die Adresse zurück. */
  kassengang(eingabe: KassengangEingabe): Promise<{ url: string }>;
}

/**
 * Der Platzhalter, solange kein Anbieter eingerichtet ist.
 *
 * Er tut ausdrücklich NICHTS und behauptet auch nichts. Kein
 * Testmodus, keine simulierte Zahlung, kein „Premium freigeschaltet"
 * ohne Abrechnung — das wäre eine Demo-Funktion in einem
 * Produktionspfad und damit genau das, was hier nicht sein darf.
 */
class KeinAnbieter implements Zahlungsanbieter {
  readonly key = "none";
  readonly name = "Kein Zahlungsanbieter verbunden";
  readonly zahlarten: Zahlart[] = [];
  verfügbar(): boolean {
    return false;
  }
  async kassengang(): Promise<{ url: string }> {
    throw new Error("Es ist kein Zahlungsanbieter eingerichtet.");
  }
}

/*
 * Die geplanten Zahlarten.
 *
 * Sie stehen hier, damit die Preisseite sie nennen kann, bevor der
 * Anbieter angeschlossen ist — als Absicht, klar als solche
 * gekennzeichnet, nicht als Versprechen eines fertigen Knopfes.
 */
export const GEPLANTE_ZAHLARTEN: Zahlart[] = [
  "card",
  "paypal",
  "apple_pay",
  "google_pay",
  "sepa_debit",
  "bank_transfer",
];

let gemerkt: Zahlungsanbieter | null = null;

export function zahlungsanbieter(): Zahlungsanbieter {
  if (gemerkt) return gemerkt;
  /*
   * Hier wird später nach `BILLING_PROVIDER` verzweigt. Solange nichts
   * gesetzt ist, gibt es keinen Anbieter — und das sagt die Oberfläche
   * dann auch.
   */
  gemerkt = new KeinAnbieter();
  return gemerkt;
}
