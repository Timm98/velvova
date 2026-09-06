import { cache } from "react";
import { KEIN_VOLLZEITVERGLEICH } from "./beschaeftigungsform.ts";
import { berufFuerTitel, referenzFuerTitel } from "./berufsreferenz.ts";
import { amtlicherWert, entgeltatlasVerfuegbar } from "./entgeltatlas.ts";
import { getDb, schema, withSystem } from "@paycheck/db";
import { eq, sql } from "drizzle-orm";
import { berufsgruppe, type BerufsgruppeKey } from "./visuals.ts";

/**
 * Ein Vergleichswert für Stellen ohne Gehaltsangabe.
 *
 * ── Was das ist und was es nicht ist ──────────────────────────
 *
 * Es ist NICHT „das Gehalt dieser Stelle". Es ist, was vergleichbare
 * Stellen in unserem Bestand zahlen, die eine Zahl genannt haben. Der
 * Unterschied ist keine Formulierungsfrage: Wer mit dem einen in eine
 * Verhandlung geht, hat eine Grundlage; wer mit dem anderen geht, hat
 * eine Behauptung.
 *
 * Deshalb steht überall die Herkunft dabei, und deshalb ist es immer
 * eine Spanne. Ein Punktwert aus zwölf Stellen wäre eine Genauigkeit,
 * die es nicht gibt.
 *
 * ── Warum höchstens zwei Werte je Arbeitgeber ─────────────────
 *
 * Ohne diese Grenze bestimmt ein einziger Personalvermittler eine ganze
 * Berufsgruppe. Gemessen: 48 gleichlautende Anzeigen „Steuerberater …
 * mindestens 90.000 €" ergaben für `finance` einen Median von
 * 110.000 € und eine Quartilsspanne von exakt null. Jeder Buchhalter
 * hätte eine Schätzung von 110.000 € bekommen — plausibel formatiert
 * und grob falsch.
 *
 * Mit der Kappung: sechs unabhängige Werte, Median 90.000, Spanne
 * 50.000–110.000. Unschärfer, und richtig.
 *
 * ── Warum mindestens fünf ─────────────────────────────────────
 *
 * Unter fünf unabhängigen Angaben ist ein Median kein Median, sondern
 * ein Zufallswert mit Nachkommastellen. Dann steht hier lieber nichts.
 *
 * ── Was das nicht ersetzt ─────────────────────────────────────
 *
 * Eine offizielle Statistik. Der Entgeltatlas der Bundesagentur hätte
 * echte Zahlen je Berufsgattung und Region; er antwortet auf unsere
 * Kennung mit 403 und braucht eigene Zugangsdaten. Sobald es sie gibt,
 * gehört diese Datei ersetzt — die Schnittstelle nach aussen bleibt
 * gleich.
 */

/** Unter diesem Wert wird nichts ausgegeben. */
const MIN_STELLEN = 5;

/** Höchstens so viele Werte je Arbeitgeber und Gruppe. */
const JE_ARBEITGEBER = 2;

export interface Vergleichswert {
  /** Die eigene Berufsgruppe — `null`, wenn der Wert von aussen kommt. */
  gruppe: BerufsgruppeKey | null;
  /** Unteres Quartil, Median, oberes Quartil — in Euro je Jahr. */
  /*
   * Quartile dürfen fehlen, der Median nicht.
   *
   * Der Entgeltatlas weist für manche Berufsgattungen einen echten
   * Median aus und lässt ein Quartil offen (gemessen: Median 7.958 €
   * bei `entgeltQ75` als Kennzahl „nicht ausgewiesen"). Wer daraus ein
   * `number` erzwingt, hat zwei Möglichkeiten: die Zahl erfinden oder
   * den echten Median wegwerfen. Beides ist schlechter als eine
   * Spanne, die ehrlich einseitig ist.
   */
  q1: number | null;
  median: number;
  q3: number | null;
  /** Auf wie vielen unabhängigen Angaben es beruht. */
  anzahl: number;
  /**
   * Woher die Zahl stammt.
   *
   * Sie steht in der Oberfläche. Eine Grössenordnung aus der amtlichen
   * Statistik und eine aus 190 eigenen Anzeigen sind nicht dasselbe,
   * und wer sie liest, soll den Unterschied sehen können.
   */
  quelle: "entgeltatlas" | "bundesagentur" | "bestand";
  /** Die amtliche Berufsbezeichnung, wo es eine gibt. */
  beruf?: string;
}

/**
 * Monats- und Stundenangaben aufs Jahr — oder `null`.
 *
 * ── Warum das nachgereicht wurde ──────────────────────────────
 *
 * Die erste Fassung zählte nur Jahresangaben und warf damit 61 von 190
 * Gehältern weg: 46 monatliche und 15 stündliche. Das war keine
 * Vorsicht, sondern Verschwendung — ein Monatsgehalt mal zwölf ist
 * keine Schätzung, sondern dieselbe Zahl in anderer Einheit.
 *
 * Der Zugewinn ist erheblich: `administration` stieg von 5 auf 16
 * unabhängige Werte, `customer_success` von 7 auf 11, `logistics` von 7
 * auf 10. Ein Median aus fünf Werten ist ein Zufall mit
 * Nachkommastellen; einer aus sechzehn ist eine Aussage.
 *
 * ── Warum ein Stundenlohn die Wochenstunden braucht ───────────
 *
 * Ohne sie müsste man vierzig unterstellen — und läge bei einer
 * Teilzeitstelle um die Hälfte daneben. Ohne Angabe wird der Wert
 * deshalb verworfen, nicht gebogen.
 *
 * 47 Arbeitswochen statt 52: Urlaub und Feiertage sind nicht bezahlt
 * gearbeitete Zeit. Mit 52 läge jede hochgerechnete Stundenangabe
 * systematisch zu hoch.
 */
function aufsJahr(betrag: number | null, zeitraum: string, wochenstunden: number | null): number | null {
  if (betrag === null) return null;
  if (zeitraum === "year") return betrag;
  if (zeitraum === "month") return betrag * 12;
  if (zeitraum === "hour" && wochenstunden && wochenstunden > 0) {
    return betrag * wochenstunden * 47;
  }
  return null;
}

/**
 * Die Statistik je Berufsgruppe, einmal je Anfrage.
 *
 * `cache` von React: Eine Trefferliste mit fünfundzwanzig Stellen
 * fragte sonst fünfundzwanzigmal dasselbe. Die Werte ändern sich
 * innerhalb einer Anfrage nicht.
 */
/**
 * Die Statistik hält länger als eine Anfrage.
 *
 * ── Warum `cache` von React hier nicht genügt ─────────────────
 *
 * Es gilt je Anfrage. Diese Statistik ist aber für alle Personen
 * dieselbe — sie zählt Gehaltsangaben im Bestand und weiss nichts von
 * einem Profil.
 *
 * Gemessen bei 263.961 Stellen mit Gehalt: **6,3 Sekunden**, und zwar
 * bei jedem Seitenaufruf jeder Person. Als der Bestand bei 2.500 lag,
 * war das unmerklich; bei einer Viertelmillion ist es der grösste
 * einzelne Posten einer Stellenliste.
 *
 * Eine Viertelstunde ist kurz genug, dass neue Gehaltsangaben zeitnah
 * einfliessen, und lang genug, dass die Abfrage selten läuft.
 */
const STATISTIK_TTL_MS = 15 * 60_000;
let statistikSpeicher: { at: number; werte: Map<BerufsgruppeKey, Vergleichswert> } | null = null;
let statistikLaeuft: Promise<Map<BerufsgruppeKey, Vergleichswert>> | null = null;

async function statistik(): Promise<Map<BerufsgruppeKey, Vergleichswert>> {
  if (statistikSpeicher && Date.now() - statistikSpeicher.at < STATISTIK_TTL_MS) {
    return statistikSpeicher.werte;
  }
  /*
   * Der abgelaufene Stand geht sofort raus, während daneben neu
   * gerechnet wird. Sonst zahlt genau eine Person die sechs Sekunden —
   * die, die zufällig als erste nach Ablauf kommt.
   */
  if (statistikSpeicher) {
    void neuRechnen().catch((e) => console.error("[gehaltsvergleich] Statistik:", e));
    return statistikSpeicher.werte;
  }
  return neuRechnen();
}

function neuRechnen(): Promise<Map<BerufsgruppeKey, Vergleichswert>> {
  statistikLaeuft ??= statistikBerechnen()
    .then((werte) => {
      statistikSpeicher = { at: Date.now(), werte };
      return werte;
    })
    .finally(() => {
      statistikLaeuft = null;
    });
  return statistikLaeuft;
}

const statistikBerechnen = cache(async (): Promise<Map<BerufsgruppeKey, Vergleichswert>> => {
  const db = await getDb();

  /*
   * Ohne Nutzerkontext gelesen.
   *
   * Es ist eine Auswertung über den öffentlichen Stellenbestand, keine
   * Nutzerabfrage — sie enthält keine personenbezogenen Daten und
   * gehört deshalb nicht unter eine Nutzerkennung.
   */
  const zeilen = await withSystem(db, (tx) =>
    tx.execute(sql`
      select j.title, j.core_tasks, j.salary_min, j.salary_max, j.salary_period,
             j.weekly_hours, c.name as firma
      from jobs j
      join companies c on c.id = j.company_id
      where (j.salary_min is not null or j.salary_max is not null)
    `),
  ).catch((e) => {
    console.error("[gehaltsvergleich] Statistik nicht lesbar:", e);
    return { rows: [] } as never;
  });

  const roh = (zeilen as unknown as { rows: Record<string, unknown>[] }).rows ?? [];

  const sammeln = new Map<BerufsgruppeKey, { werte: number[]; firmen: Map<string, number> }>();

  for (const r of roh) {
    const titel = String(r.title ?? "");
    const aufgaben = Array.isArray(r.core_tasks) ? (r.core_tasks as string[]) : [];
    if (KEIN_VOLLZEITVERGLEICH.test(titel)) continue;

    const g = berufsgruppe(titel, aufgaben);
    if (!g) continue;

    const min = (r.salary_min ?? null) as number | null;
    const max = (r.salary_max ?? null) as number | null;
    const roh: number | null = min !== null && max !== null ? (min + max) / 2 : (max ?? min);
    const mitte = aufsJahr(roh, String(r.salary_period ?? "year"), (r.weekly_hours ?? null) as number | null);
    if (mitte === null || mitte < 15_000 || mitte > 250_000) continue;

    const eintrag = sammeln.get(g) ?? {
      werte: [] as number[],
      firmen: new Map<string, number>(),
    };
    const firma = String(r.firma ?? "?").toLowerCase().trim();
    const bisher = eintrag.firmen.get(firma) ?? 0;
    if (bisher >= JE_ARBEITGEBER) continue;

    eintrag.werte.push(Math.round(mitte));
    eintrag.firmen.set(firma, bisher + 1);
    sammeln.set(g, eintrag);
  }

  const raus = new Map<BerufsgruppeKey, Vergleichswert>();
  for (const [g, { werte }] of sammeln) {
    if (werte.length < MIN_STELLEN) continue;
    werte.sort((a, b) => a - b);
    const bei = (anteil: number) => werte[Math.min(werte.length - 1, Math.floor(werte.length * anteil))]!;
    raus.set(g, {
      gruppe: g,
      q1: bei(0.25),
      median: bei(0.5),
      q3: bei(0.75),
      anzahl: werte.length,
      quelle: "bestand",
    });
  }
  return raus;
});

/**
 * Der Vergleichswert für eine Stelle. `null`, wenn die Basis zu dünn ist.
 *
 * `null` ist der ehrliche Normalfall für rund ein Drittel der Stellen —
 * und besser als eine Zahl, die aus drei Angaben stammt.
 */
export async function vergleichswert(
  titel: string,
  aufgaben: string[] = [],
  kldb: string | null = null,
): Promise<Vergleichswert | null> {
  /*
   * ── Zuerst die amtliche Kennung ───────────────────────────
   *
   * Sie stand an der Stelle und wurde hier nie benutzt. Gesucht wurde
   * über den Titel — und Titelabgleich ist bei deutschen Berufsnamen
   * unzuverlässig: „Laufschlosser" findet „Schlosser" nicht, „Werte
   * und Normen" findet „Wertpapierhändler".
   *
   * Über die Kennung ist es ein Nachschlag: `entgelt_kldb` bindet die
   * 1.926 Entgeltatlas-Werte an 752 KldB-Codes, und zwar über einen
   * exakten Namensvergleich zwischen zwei Tabellen derselben Quelle.
   * Gemessen decken diese 752 Codes 99,1 Prozent aller Stellen mit
   * Kennung ab.
   *
   * Die Titelsuche bleibt als Rückfall für die 19 Prozent ohne
   * Kennung.
   */
  if (kldb && !KEIN_VOLLZEITVERGLEICH.test(titel)) {
    const amtlich = await amtlicherWertNachKldb(kldb).catch(() => null);
    if (amtlich) return amtlich;
  }

  /*
   * Werkstudium, Praktikum, Ausbildung: kein Vergleich.
   *
   * Die Berufsgruppe sagt, WAS jemand tut — nicht, auf welcher Stufe.
   * „Werkstudent Vertrieb" bekam die Spanne der Vollzeitstellen im
   * Vertrieb und lag damit um ein Vielfaches daneben.
   */
  if (KEIN_VOLLZEITVERGLEICH.test(titel)) return null;

  /*
   * Drei Quellen, in dieser Reihenfolge.
   *
   * ── Warum genau so herum ──────────────────────────────────
   *
   *   1. **Entgeltatlas.** Amtliche Beschäftigungsstatistik, alle
   *      Berufe, Millionen Beschäftigte. Sobald Zugangsdaten
   *      hinterlegt sind, schlägt sie alles andere.
   *
   *   2. **Referenz je amtlichem Beruf.** Ausgewertete Gehaltsangaben
   *      aus der offenen Jobbörse derselben Behörde, gruppiert nach
   *      der amtlichen Berufsbezeichnung. Feiner als unsere fünfzehn
   *      Berufsgruppen: „Finanzbuchhalter/in" statt „finance".
   *
   *   3. **Eigener Bestand.** Die 190 Anzeigen, die eine Zahl nennen,
   *      nach grober Berufsgruppe. Gröber, aber es ist unsere eigene
   *      Grundgesamtheit — dieselben Stellen, die auch angezeigt
   *      werden.
   *
   * Fällt alles drei aus, steht nichts da. Das ist der ehrliche
   * Normalfall und besser als eine Zahl aus drei Anzeigen.
   */
  // Der Beruf wird nur nachgeschlagen, wenn der Atlas ihn auch
  // verwenden kann — sonst wäre es eine Abfrage ohne Abnehmer.
  const beruf = entgeltatlasVerfuegbar() ? await berufFuerTitel(titel) : null;

  if (beruf) {
    const amtlich = await amtlicherWert(beruf).catch(() => null);
    if (amtlich) {
      return {
        gruppe: null,
        q1: amtlich.q1,
        median: amtlich.median,
        q3: amtlich.q3,
        // Eine amtliche Statistik beruht nicht auf Stellenanzeigen.
        // Die Zahl steht für die Zahl der Beschäftigten, nicht für
        // eine Stichprobe — deshalb 0 und ein eigener Satz dazu.
        anzahl: 0,
        quelle: "entgeltatlas",
        beruf,
      };
    }
  }

  const referenz = await referenzFuerTitel(titel).catch(() => null);
  if (referenz) {
    return {
      gruppe: null,
      q1: referenz.q1,
      median: referenz.median,
      q3: referenz.q3,
      anzahl: referenz.anzahl,
      quelle: referenz.quelle,
      beruf: referenz.beruf,
    };
  }

  const g = berufsgruppe(titel, aufgaben);
  if (!g) return null;
  return (await statistik()).get(g) ?? null;
}

/**
 * Die Spanne als Text, etwa „54.500 € – 85.000 €".
 *
 * Fehlt ein Quartil, wird die Grenze benannt statt erfunden: „ab
 * 54.500 €" oder „bis 85.000 €". Fehlen beide, bleibt der Median —
 * `null` gibt es hier nicht, denn ohne Median gibt es keinen
 * Vergleichswert.
 */
export function alsSpanne(v: Vergleichswert): string {
  const f = (n: number) => `${n.toLocaleString("de-DE")} €`;
  if (v.q1 !== null && v.q3 !== null) return `${f(v.q1)} – ${f(v.q3)}`;
  if (v.q1 !== null) return `ab ${f(v.q1)}`;
  if (v.q3 !== null) return `bis ${f(v.q3)}`;
  return `um ${f(v.median)}`;
}

/**
 * Der Entgeltwert zu einer Berufskennung.
 *
 * Ein Nachschlag über 752 Zeilen — keine Textsuche, keine Ähnlichkeit,
 * kein Schwellenwert. Entweder die Kennung steht in der Tabelle oder
 * nicht.
 */
async function amtlicherWertNachKldb(kldb: string): Promise<Vergleichswert | null> {
  const code = kldb.replace(/\D/g, "").slice(0, 5);
  if (code.length < 5) return null;

  const db = await getDb();
  const [z] = await withSystem(db, (tx) =>
    tx
      .select()
      .from(schema.entgeltKldb)
      .where(eq(schema.entgeltKldb.kldb, code))
      .limit(1),
  ).catch(() => []);
  if (!z) return null;

  return {
    /* Keine eigene Berufsgruppe: Der Wert kommt von aussen. */
    gruppe: null,
    q1: z.q1,
    median: z.median,
    q3: z.q3,
    /*
     * Die Besetzung ist die Anzahl, auf der der Wert beruht — nicht
     * eine Zahl aus unserem Bestand. Der Unterschied entscheidet, was
     * die Zahl bedeutet.
     */
    anzahl: z.besetzung ?? 0,
    quelle: "entgeltatlas",
    beruf: z.beruf,
  };
}
