/**
 * Wann die nächste Zusammenfassung fällig ist.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das mehr ist als „acht Uhr"
 * ══════════════════════════════════════════════════════════════
 *
 * „08:00" ist ohne Zone keine Uhrzeit. Eine pauschale
 * Berlin-Annahme trifft jede Person ausserhalb Mitteleuropas zur
 * falschen Tageszeit — und wer in Vancouver sucht, bekommt seine
 * Morgenpost um elf Uhr abends.
 *
 * Gerechnet wird deshalb in UTC, und die Ortszeit ist die Eingabe.
 *
 * ══════════════════════════════════════════════════════════════
 * Sommerzeit: die zwei Tage im Jahr, an denen es zählt
 * ══════════════════════════════════════════════════════════════
 *
 * Im Frühjahr gibt es 02:30 nicht — die Uhr springt von 02:00 auf
 * 03:00. Im Herbst gibt es 02:30 zweimal.
 *
 * Die Regel hier, offengelegt statt geraten:
 *
 *   Übersprungene Ortszeit → der erste Zeitpunkt danach.
 *   Doppelte Ortszeit      → die erste der beiden Gelegenheiten.
 *
 * Beides bedeutet: höchstens ein Versand. Nicht keiner, nicht zwei.
 * Der Fensterschlüssel hängt am lokalen Datum, nicht an der Uhrzeit —
 * damit erzeugt auch ein doppelt laufender Cron kein zweites Fenster.
 */

export type Rhythmus = "taeglich" | "woechentlich";

/** Der Abstand der Zone zu UTC, in Minuten, zu diesem Zeitpunkt. */
export function zonenversatzMinuten(zeitpunkt: Date, zone: string): number {
  const format = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const teile = format.formatToParts(zeitpunkt);
  const lies = (art: string) => Number(teile.find((t) => t.type === art)!.value);
  const alsWaereEsUtc = Date.UTC(
    lies("year"),
    lies("month") - 1,
    lies("day"),
    /* „24" statt „00" liefern manche Umgebungen bei hour12: false. */
    lies("hour") % 24,
    lies("minute"),
    lies("second"),
  );
  return (alsWaereEsUtc - zeitpunkt.getTime()) / 60_000;
}

/** Das Datum in der Zone, als „JJJJ-MM-TT". */
export function lokalesDatum(zeitpunkt: Date, zone: string): string {
  const format = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return format.format(zeitpunkt);
}

/** Der Wochentag in der Zone: 1 Montag bis 7 Sonntag. */
export function lokalerWochentag(zeitpunkt: Date, zone: string): number {
  const kurz = new Intl.DateTimeFormat("en-US", { timeZone: zone, weekday: "short" }).format(zeitpunkt);
  const tage = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return tage.indexOf(kurz) + 1;
}

/** Die Ortszeit als „JJJJ-MM-TTTHH:MM" — vergleichbar als Zeichenkette. */
function ortsstempel(zeitpunkt: Date, zone: string): string {
  const format = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const teile = format.formatToParts(zeitpunkt);
  const lies = (art: string) => teile.find((t) => t.type === art)!.value;
  /* „24" statt „00" liefern manche Umgebungen bei hour12: false. */
  const stunde = lies("hour") === "24" ? "00" : lies("hour");
  return `${lies("year")}-${lies("month")}-${lies("day")}T${stunde}:${lies("minute")}`;
}

/**
 * Eine Ortszeit in einen Zeitpunkt umrechnen.
 *
 * ── Warum drei Proben und kein zweiter Durchgang ──────────────
 *
 * Der naheliegende Weg — Versatz nehmen, abziehen, Versatz neu
 * nehmen — trifft an einem Umstellungstag genau eine der beiden
 * Möglichkeiten, und zwar die, die zufällig zuerst geprüft wurde.
 *
 * Hier werden alle in Frage kommenden Zeitpunkte gebildet und dann
 * beurteilt:
 *
 *   Gibt es die Ortszeit → der früheste Zeitpunkt, an dem sie gilt.
 *   Gibt es sie nicht    → der früheste Zeitpunkt danach.
 *
 * Beides liefert genau einen Zeitpunkt. Das ist die ganze Zusage:
 * höchstens ein Versand, nicht keiner und nicht zwei.
 */
export function ortszeitNachUtc(
  jahr: number,
  monat: number,
  tag: number,
  stunde: number,
  minute: number,
  zone: string,
): Date {
  const gewuenscht =
    `${String(jahr).padStart(4, "0")}-${String(monat).padStart(2, "0")}-${String(tag).padStart(2, "0")}` +
    `T${String(stunde).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  const alsWaereEsUtc = Date.UTC(jahr, monat - 1, tag, stunde, minute);

  /*
   * Die Proben liegen einen halben Tag auseinander. Weiter braucht es
   * nicht: Kein Übergang der Welt verschiebt die Uhr um mehr als eine
   * Stunde, und die Zone selbst wechselt nicht zwischen Mittag und
   * Mitternacht ihre Grundlage.
   */
  const kandidaten = new Set<number>();
  for (const probe of [alsWaereEsUtc - 43_200_000, alsWaereEsUtc, alsWaereEsUtc + 43_200_000]) {
    const versatz = zonenversatzMinuten(new Date(probe), zone);
    kandidaten.add(alsWaereEsUtc - versatz * 60_000);
  }
  const sortiert = [...kandidaten].sort((a, b) => a - b);

  const genau = sortiert.filter((ts) => ortsstempel(new Date(ts), zone) === gewuenscht);
  if (genau.length > 0) return new Date(genau[0]!);

  const danach = sortiert.filter((ts) => ortsstempel(new Date(ts), zone) > gewuenscht);
  if (danach.length > 0) return new Date(danach[0]!);

  return new Date(sortiert[0]!);
}

function uhrzeitLesen(hhmm: string): { stunde: number; minute: number } {
  const treffer = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!treffer) return { stunde: 8, minute: 0 };
  const stunde = Math.min(23, Math.max(0, Number(treffer[1])));
  const minute = Math.min(59, Math.max(0, Number(treffer[2])));
  return { stunde, minute };
}

export interface Fensterplan {
  /** Wann das Fenster beginnt, in UTC. */
  faelligAm: Date;
  /**
   * Der stabile Schlüssel des Fensters.
   *
   * Zwei Cronläufe im selben Fenster erzeugen denselben Schlüssel und
   * damit dank der Eindeutigkeit in der Datenbank nur eine
   * Zusammenfassung. Er hängt am lokalen Datum, nicht an der Uhrzeit:
   * eine Zeitumstellung verschiebt den Zeitpunkt, nicht den Tag.
   */
  schluessel: string;
}

/**
 * Das nächste Versandfenster nach `jetzt`.
 *
 * Streng nach `jetzt`: Ein Fenster, das gerade läuft, gilt als
 * verbraucht. Sonst liefe ein Auftrag nach dem Versand sofort wieder
 * fällig.
 */
export function naechstesFenster(
  jetzt: Date,
  zone: string,
  sendezeitLokal: string,
  rhythmus: Rhythmus = "taeglich",
  wochentag: number | null = null,
): Fensterplan {
  const { stunde, minute } = uhrzeitLesen(sendezeitLokal);
  const ziel = rhythmus === "woechentlich" ? (wochentag ?? 1) : null;

  /* Höchstens vierzehn Tage voraus — mehr braucht kein Rhythmus. */
  for (let versatz = 0; versatz <= 14; versatz++) {
    const tagInZone = new Date(jetzt.getTime() + versatz * 86_400_000);
    const datum = lokalesDatum(tagInZone, zone);
    const [jahr, monat, tag] = datum.split("-").map(Number);
    const kandidat = ortszeitNachUtc(jahr!, monat!, tag!, stunde, minute, zone);
    if (kandidat.getTime() <= jetzt.getTime()) continue;
    if (ziel !== null && lokalerWochentag(kandidat, zone) !== ziel) continue;
    return { faelligAm: kandidat, schluessel: `${datum}:${rhythmus}` };
  }

  /* Unerreichbar bei gültigem Wochentag — aber nie stillschweigend. */
  throw new Error(`Kein Versandfenster in 14 Tagen für ${zone} / ${rhythmus}.`);
}

/**
 * Der Schlüssel des Fensters, in dem ein Zeitpunkt liegt.
 *
 * Für den Fall, dass ein Lauf verspätet startet: Die Zusammenfassung
 * gehört zum Fenster, für das sie gedacht war, nicht zum Zeitpunkt,
 * an dem der Worker endlich Luft hatte.
 */
export function fensterschluessel(zeitpunkt: Date, zone: string, rhythmus: Rhythmus): string {
  return `${lokalesDatum(zeitpunkt, zone)}:${rhythmus}`;
}
