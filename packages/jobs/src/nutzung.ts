/**
 * Was die Anbieter heute tatsächlich gekostet haben.
 *
 * ── Warum das nicht in der Datenbank steht ─────────────────────
 *
 * Es zählt im Arbeitsspeicher und ist beim Neustart weg. Das ist eine
 * Entscheidung, keine Auslassung: für die Frage „läuft dieser Anbieter
 * gerade und wie oft fragen wir ihn" reicht der laufende Prozess, und
 * ein Schreibzugriff je Netzanfrage wäre teurer als die Auskunft wert
 * ist.
 *
 * Die Betriebsansicht sagt deshalb ausdrücklich dazu, seit wann
 * gezählt wird. Eine Zahl ohne Bezugszeitraum lädt zu der Annahme ein,
 * sie gelte seit gestern — und dann wirkt ein neu gestarteter Dienst
 * wie ein ungenutzter.
 *
 * ── Was gezählt wird ──────────────────────────────────────────
 *
 * Anfragen, Fehlschläge mit ihrem Statuscode, gelieferte Stellen und
 * der Zeitpunkt der letzten erfolgreichen Antwort. Zusammen ergibt das
 * die Unterscheidung, auf die es ankommt: ein Anbieter, der nichts
 * liefert, weil er nichts findet, gegen einen, der nichts liefert, weil
 * er seit zwei Stunden 403 antwortet.
 */

export interface Nutzungszahlen {
  provider: string;
  anfragen: number;
  fehler: number;
  /** Statuscodes mit ihrer Häufigkeit, z. B. { "429": 3 }. */
  codes: Record<string, number>;
  /** Summe der Stellen, die dieser Anbieter geliefert hat. */
  stellen: number;
  letzterErfolg: Date | null;
  letzterFehler: { zeitpunkt: Date; text: string } | null;
  /** Millisekunden, gemittelt über erfolgreiche Anfragen. */
  mittlereDauer: number | null;
}

interface Zaehler extends Nutzungszahlen {
  dauerSumme: number;
  dauerAnzahl: number;
}

const zaehler = new Map<string, Zaehler>();
let seit = new Date();

function hol(provider: string): Zaehler {
  let z = zaehler.get(provider);
  if (!z) {
    z = {
      provider,
      anfragen: 0,
      fehler: 0,
      codes: {},
      stellen: 0,
      letzterErfolg: null,
      letzterFehler: null,
      mittlereDauer: null,
      dauerSumme: 0,
      dauerAnzahl: 0,
    };
    zaehler.set(provider, z);
  }
  return z;
}

export function merkeErfolg(provider: string, dauerMs: number, stellen = 0): void {
  const z = hol(provider);
  z.anfragen++;
  z.stellen += stellen;
  z.letzterErfolg = new Date();
  z.dauerSumme += dauerMs;
  z.dauerAnzahl++;
  z.mittlereDauer = Math.round(z.dauerSumme / z.dauerAnzahl);
}

export function merkeFehler(provider: string, status: number | null, text: string): void {
  const z = hol(provider);
  z.anfragen++;
  z.fehler++;
  const schluessel = status === null ? "netz" : String(status);
  z.codes[schluessel] = (z.codes[schluessel] ?? 0) + 1;
  /*
   * Der Fehlertext wird gekürzt und nicht durchgereicht.
   *
   * Antworten von Anbietern enthalten gelegentlich die gestellte
   * Anfrage — und damit unter Umständen einen Kopfzeilenwert. Diese
   * Zahlen landen in einer Betriebsansicht, die jemand abfotografiert
   * und weiterschickt.
   */
  z.letzterFehler = { zeitpunkt: new Date(), text: text.slice(0, 200) };
}

export function nutzung(): { seit: Date; zeilen: Nutzungszahlen[] } {
  return {
    seit,
    zeilen: [...zaehler.values()]
      .map(({ dauerSumme: _s, dauerAnzahl: _a, ...rest }) => rest)
      .sort((a, b) => b.anfragen - a.anfragen),
  };
}

/** Für Tests. Im Betrieb gibt es keinen Grund, die Zählung zurückzusetzen. */
export function nutzungZuruecksetzen(): void {
  zaehler.clear();
  seit = new Date();
}
