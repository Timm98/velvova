/**
 * ══════════════════════════════════════════════════════════════════
 * Der Monatsbericht — was sich tatsächlich verändert hat
 * ══════════════════════════════════════════════════════════════════
 *
 * Ein Bericht, der jeden Monat etwas finden muss, findet jeden Monat
 * etwas. Diese Datei ist gegen genau diesen Zug gebaut: Sie rechnet
 * aus zwei Ständen einen Vergleich und lässt „kein belastbarer neuer
 * Stand" als vollwertiges Ergebnis stehen.
 *
 * ── Der Fehler, gegen den sie vor allem gebaut ist ──────────────
 *
 * **Fehlende Daten bedeuten nicht, dass ein Problem gelöst ist.**
 *
 * Ein Thema, das im Vormonat gemessen wurde und diesen Monat fehlt,
 * ist `nicht_mehr_gemessen` — nicht `geloest`. Der Unterschied ist
 * der zwischen einem ehrlichen Bericht und einem, der Erfolge
 * ausweist, sobald jemand aufhört hinzusehen. Und weil ein Ausbleiben
 * bequemer ist als eine Verschlechterung, ist das der Fehler, der
 * sich von selbst einschleicht.
 *
 * ── Der zweite ─────────────────────────────────────────────────
 *
 * Ein Wechsel der Messmethode darf nicht als Verbesserung erscheinen.
 * Wer im Januar Vorgänge zählt und im Februar nur noch abgeschlossene,
 * hat weniger Vorgänge — und nichts verbessert. Jedes Thema trägt
 * deshalb eine `methodenkennung`; ändert sie sich, ist der Vergleich
 * ausgesetzt und wird als solcher benannt.
 */

/** Höchstens so viele Themen stehen vorn. Der Rest ist aufklappbar. */
export const MAX_THEMEN = 3;

/**
 * Der Stand eines Themas zum Berichtszeitpunkt.
 *
 * Ein „Thema" ist ein Bedarfsvorgang. Die fortgeführte Historie hängt
 * an seinem Schlüssel — deshalb entsteht derselbe Befund nicht jeden
 * Monat neu als Entdeckung.
 */
export interface Themenstand {
  schluessel: string;
  titel: string;
  /** Eine aus `EBENEN`. */
  ebene: string;
  /** `bestaetigt` · `hypothese` · `verworfen` · `kein_befund` */
  befundstand: string;
  /** Wie viele unabhängige Quellen dahinterstehen. */
  quellen: number;
  /**
   * Woran gemessen wurde.
   *
   * Alles, dessen Änderung den Vergleich ungültig macht: die Quellen,
   * ihr Zuschnitt, die Zählweise. Gleich heisst vergleichbar.
   */
  methodenkennung: string;
}

export const VERAENDERUNGSARTEN = [
  "neu",
  "fortgeschritten",
  "zurueckgenommen",
  "unveraendert",
  "nicht_mehr_gemessen",
  "methode_gewechselt",
] as const;
export type Veraenderungsart = (typeof VERAENDERUNGSARTEN)[number];

export const VERAENDERUNGSTEXT: Record<Veraenderungsart, string> = {
  neu: "neu in diesem Monat",
  fortgeschritten: "einen Schritt weiter",
  zurueckgenommen: "zurückgenommen — der Befund wurde verworfen",
  unveraendert: "unverändert",
  nicht_mehr_gemessen:
    "in diesem Monat nicht mehr gemessen — das ist keine Aussage darüber, ob es behoben ist",
  methode_gewechselt: "nicht vergleichbar — die Messmethode hat sich geändert",
};

export interface Themenveraenderung {
  schluessel: string;
  titel: string;
  art: Veraenderungsart;
  /** Der Stand jetzt. `null` bei `nicht_mehr_gemessen`. */
  jetzt: Themenstand | null;
  vorher: Themenstand | null;
}

/**
 * Zwei Stände nebeneinander.
 *
 * ── Warum die Reihenfolge der Prüfungen feststeht ───────────────
 *
 * Der Methodenwechsel kommt zuerst. Sonst läse sich eine Zahl, die
 * nach anderen Regeln entstanden ist, als Fortschritt — und das ist
 * die Sorte Verbesserung, die man nicht widerlegen kann, weil niemand
 * merkt, dass sie erfunden wurde.
 */
export function staendeVergleichen(
  vorher: readonly Themenstand[],
  jetzt: readonly Themenstand[],
  ebenenrang: (e: string) => number,
): Themenveraenderung[] {
  const vorherNach = new Map(vorher.map((t) => [t.schluessel, t]));
  const jetztNach = new Map(jetzt.map((t) => [t.schluessel, t]));
  const raus: Themenveraenderung[] = [];

  for (const t of jetzt) {
    const alt = vorherNach.get(t.schluessel) ?? null;
    if (alt === null) {
      raus.push({ schluessel: t.schluessel, titel: t.titel, art: "neu", jetzt: t, vorher: null });
      continue;
    }
    if (alt.methodenkennung !== t.methodenkennung) {
      raus.push({
        schluessel: t.schluessel,
        titel: t.titel,
        art: "methode_gewechselt",
        jetzt: t,
        vorher: alt,
      });
      continue;
    }
    if (t.befundstand === "verworfen" && alt.befundstand !== "verworfen") {
      raus.push({
        schluessel: t.schluessel,
        titel: t.titel,
        art: "zurueckgenommen",
        jetzt: t,
        vorher: alt,
      });
      continue;
    }
    if (ebenenrang(t.ebene) > ebenenrang(alt.ebene)) {
      raus.push({
        schluessel: t.schluessel,
        titel: t.titel,
        art: "fortgeschritten",
        jetzt: t,
        vorher: alt,
      });
      continue;
    }
    raus.push({
      schluessel: t.schluessel,
      titel: t.titel,
      art: "unveraendert",
      jetzt: t,
      vorher: alt,
    });
  }

  /*
   * Was verschwunden ist.
   *
   * Nie `geloest`. Ein Thema kann aus dem Bericht fallen, weil es
   * behoben wurde — oder weil die Quelle versiegt ist, weil jemand
   * den Zugang entzogen hat, weil ein Import ausblieb. Der Bericht
   * kann diese Fälle nicht auseinanderhalten, also behauptet er
   * keinen davon.
   */
  for (const t of vorher) {
    if (jetztNach.has(t.schluessel)) continue;
    raus.push({
      schluessel: t.schluessel,
      titel: t.titel,
      art: "nicht_mehr_gemessen",
      jetzt: null,
      vorher: t,
    });
  }

  return raus;
}

export type Berichtslage =
  | { art: "stand"; themen: Themenveraenderung[]; weitere: number }
  | { art: "kein_neuer_stand"; grund: string };

/**
 * Was der Bericht zu sagen hat.
 *
 * ── Warum „kein neuer Stand" ein Ergebnis ist ───────────────────
 *
 * Weil die Alternative ist, etwas zu schreiben. Ein Bericht, der
 * jeden Monat erscheinen muss und nie „nichts Neues" sagen darf,
 * erzeugt in dem Monat, in dem nichts passiert ist, genau die
 * Beobachtung, die er braucht — und danach ist er als Auskunft
 * wertlos.
 */
export function berichtslage(veraenderungen: readonly Themenveraenderung[]): Berichtslage {
  if (veraenderungen.length === 0) {
    return { art: "kein_neuer_stand", grund: "Es liegt kein Thema vor." };
  }

  const bewegt = veraenderungen.filter((v) => v.art !== "unveraendert");
  if (bewegt.length === 0) {
    return {
      art: "kein_neuer_stand",
      grund: "Alle Themen stehen unverändert. Neue Auskünfte sind seit dem letzten Bericht nicht dazugekommen.",
    };
  }

  const rang: Record<Veraenderungsart, number> = {
    zurueckgenommen: 0,
    neu: 1,
    fortgeschritten: 2,
    methode_gewechselt: 3,
    nicht_mehr_gemessen: 4,
    unveraendert: 5,
  };
  const sortiert = [...bewegt].sort((a, b) => rang[a.art] - rang[b.art]);

  return {
    art: "stand",
    themen: sortiert.slice(0, MAX_THEMEN),
    weitere: Math.max(0, sortiert.length - MAX_THEMEN),
  };
}

/**
 * Der Berichtsmonat — der letzte VOLLSTÄNDIGE Monat vor `jetzt`.
 *
 * ── Warum nicht der laufende ────────────────────────────────────
 *
 * Weil ein Bericht über einen halben Monat sich wie ein Bericht über
 * einen ganzen liest. Am 3. Oktober über den Oktober zu berichten
 * hiesse, drei Tage mit einunddreissig zu vergleichen — und jede
 * Zahl darin sähe nach Rückgang aus.
 *
 * Der Schlüssel ist `JJJJ-MM` und der Anker der Lauf: Zwei Auslöser
 * im selben Monat erzeugen denselben Schlüssel und damit denselben
 * Bericht, keinen zweiten.
 */
export function berichtsmonat(jetzt: Date, zeitzone = "Europe/Berlin"): string {
  const teile = new Intl.DateTimeFormat("en-CA", {
    timeZone: zeitzone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(jetzt);
  const jahr = Number(teile.find((t) => t.type === "year")!.value);
  const monat = Number(teile.find((t) => t.type === "month")!.value);
  const vorher = monat === 1 ? { j: jahr - 1, m: 12 } : { j: jahr, m: monat - 1 };
  return `${vorher.j}-${String(vorher.m).padStart(2, "0")}`;
}

/** Der erste Tag des Berichtsmonats als `JJJJ-MM-TT`. */
export function monatsanfang(schluessel: string): string {
  return `${schluessel}-01`;
}

/**
 * Der Hinweis auf einen unvollständigen Zeitraum.
 *
 * `null`, wenn der Monat vollständig erfasst ist. Sonst ein Satz, der
 * neben der Zahl steht — nicht darunter: Ein Rückgang um ein Drittel
 * ist keine Verbesserung, wenn ein Drittel der Tage fehlt.
 */
export function teilzeitraumHinweis(tageErfasst: number, tageImMonat: number): string | null {
  if (tageImMonat <= 0) return null;
  if (tageErfasst >= tageImMonat) return null;
  return `Erfasst sind ${tageErfasst} von ${tageImMonat} Tagen. Zahlen aus diesem Monat sind mit dem Vormonat nicht unmittelbar vergleichbar.`;
}

/** Zustände eines Laufs. `laeuft` ist der wieder aufnehmbare. */
export const LAUFZUSTAENDE = ["laeuft", "fertig", "abgebrochen"] as const;
export type Laufzustand = (typeof LAUFZUSTAENDE)[number];

/**
 * Darf dieser Lauf aufgenommen werden?
 *
 * ── Warum ein Cron-Auslöser allein nicht genügt ─────────────────
 *
 * Weil er einmal feuert und niemand nachsieht, ob etwas ankam. Ein
 * abgestürzter Lauf hinterlässt eine Zeile auf `laeuft`; erst nach
 * `TOTZEIT_MINUTEN` gilt er als abgebrochen und darf neu beginnen.
 * Ohne diese Frist würde ein zweiter Auslöser einen laufenden Bericht
 * doppelt rechnen — und am Ende zweimal versenden.
 */
export const TOTZEIT_MINUTEN = 90;

export function laufAufnehmbar(
  zustand: Laufzustand,
  begonnenAm: Date,
  jetzt: Date,
): { ja: boolean; grund: string } {
  if (zustand === "fertig") return { ja: false, grund: "Für diesen Monat liegt bereits ein Bericht vor." };
  if (zustand === "abgebrochen") return { ja: true, grund: "Der vorige Lauf wurde abgebrochen." };

  const minuten = (jetzt.getTime() - begonnenAm.getTime()) / 60_000;
  if (minuten < TOTZEIT_MINUTEN) {
    return { ja: false, grund: "Ein Lauf für diesen Monat ist gerade unterwegs." };
  }
  return { ja: true, grund: `Der vorige Lauf hängt seit ${Math.floor(minuten)} Minuten.` };
}
