import { vomArbeitgeber, type Gehaltsquelle } from "./gehaltsquelle.ts";

/**
 * ══════════════════════════════════════════════════════════════════
 * Was jemand am Markt wert ist — und wann man das nicht sagen darf
 * ══════════════════════════════════════════════════════════════════
 *
 * „Bin ich unterbezahlt?" ist die Frage, die jeder Berufstätige hat
 * und die niemand beantwortet. Gehaltsportale geben Spannen von
 * 45.000 bis 75.000 — das ist keine Antwort, sondern eine Ausrede.
 *
 * Diese Datei rechnet die Antwort aus echten Ausschreibungen. Sie
 * enthält deshalb mehr Regeln darüber, wann sie SCHWEIGT, als darüber,
 * wie sie rechnet.
 *
 * ── Warum das Schweigen wichtiger ist als die Zahl ──────────────
 *
 * Ein Marktwert wird beim ersten Blick geprüft. Wer 68.000 verdient
 * und liest „dein Marktwert liegt bei 52.000", weiss sofort, dass das
 * Produkt Unsinn erzählt — und glaubt ihm nie wieder etwas, auch
 * nicht die richtigen Sachen.
 *
 * Eine falsche Zahl kostet also nicht diesen einen Nutzer, sondern
 * alles, was danach kommt. Deshalb: lieber „dazu weiss ich zu wenig"
 * als eine Zahl aus vier Anzeigen.
 *
 * ── Was hier NICHT steht ────────────────────────────────────────
 *
 * Die Umrechnung auf ein Jahresgehalt und die Frage, ob eine Zahl vom
 * Arbeitgeber stammt. Beides gibt es bereits in
 * `verguetungsangabe.ts` und `gehaltsquelle.ts` — inklusive einer
 * Regel, die mir gefehlt hätte: Ein Gesamtpaket ist nicht mit einem
 * Festgehalt vergleichbar.
 *
 * ── Die drei Regeln ─────────────────────────────────────────────
 *
 *   1. Nur echte Angaben. Ein Portal, das selbst schätzt, ist keine
 *      Quelle — es ist dieselbe Vermutung, nur mit fremdem Briefkopf.
 *   2. Keine Zahl unter der Mindeststichprobe.
 *   3. Nie über Senioritätsstufen hinweg mitteln. Junior und Principal
 *      liegen siebzigtausend auseinander; ihr Mittelwert beschreibt
 *      niemanden.
 */

/* ── 1. Welche Gehaltsangaben zählen ─────────────────────────── */

/**
 * Die Spalte `jobs.salary_provenance` auf die Quellen der Domäne.
 *
 * ── Warum eine Abbildung und keine zweite Liste ─────────────────
 *
 * `gehaltsquelle.ts` beantwortet die Frage längst: `vomArbeitgeber()`
 * sagt, ob eine Zahl eine Aussage über DIESE Stelle ist. Was fehlte,
 * war die Übersetzung der Werte, die tatsächlich in der Datenbank
 * stehen.
 *
 * `board_estimate` wird zu `portal`, und das ist die wichtigste Zeile:
 * 280.283 Angaben im Bestand sind Schätzungen eines Portals. Sie zu
 * verwenden hiesse, eine fremde Vermutung als Messung auszugeben —
 * ausgerechnet in der Zahl, an der das ganze Produkt gemessen wird.
 */
export const QUELLE_AUS_SPALTE: Record<string, Gehaltsquelle> = {
  employer: "arbeitgeber",
  provider: "arbeitgeber",
  text: "aus_text",
  board_estimate: "portal",
};

/**
 * Darf diese Gehaltsangabe in einen Marktwert eingehen?
 *
 * Unbekannte Werte fallen durch. Eine neue Herkunft, die noch niemand
 * eingeordnet hat, ist keine Erlaubnis — sie ist eine offene Frage.
 */
export function gehaltZaehlt(spaltenwert: string | null | undefined): boolean {
  const quelle = QUELLE_AUS_SPALTE[spaltenwert ?? ""];
  return quelle !== undefined && vomArbeitgeber(quelle);
}

/* ── 2. Senioritätsstufe ─────────────────────────────────────── */

/**
 * Die Stufen, in denen Gehälter vergleichbar sind.
 *
 * `unbekannt` ist ein vollwertiger Wert und kein Fehlerfall. Genau
 * hier liegt der Defekt, den die Datenbank heute zeigt: 63.209
 * Anzeigen als „senior" eingestuft, 44.830 als „lead" — aber nur 360
 * als „mid". Das beschreibt keinen Arbeitsmarkt, sondern eine
 * Erkennung, die nur bei eindeutigen Titelwörtern anschlägt und den
 * Rest still einer Stufe zuschlägt.
 *
 * Wer nicht weiss, ob eine Stelle für Einsteiger oder für Leitende
 * ausgeschrieben ist, darf sie in keine der beiden Gruppen legen.
 */
export type Stufe = "einstieg" | "erfahren" | "senior" | "leitung" | "unbekannt";

/*
 * Reihenfolge zählt: Was zuerst passt, gewinnt. „Senior Team Lead" ist
 * eine Leitungsstelle, nicht eine Seniorstelle — die andere Lesart
 * legte Führungsgehälter in die Seniorgruppe und höbe deren Median an.
 *
 * ── Warum die deutschen Stämme offen enden ──────────────────────
 *
 * `\bteamleit\b` findet „Teamleiter" NICHT: Zwischen „t" und „e" steht
 * keine Wortgrenze. Deutsche Komposita hängen die Endung an, und ein
 * Muster mit geschlossenem Ende greift dann still nicht — der Titel
 * fällt auf `unbekannt`, und niemand sieht, dass eine ganze
 * Titelfamilie fehlt.
 *
 * Die englischen Kürzel behalten ihr `\b`: `lead\w*` würde sonst
 * „Leadership" und „leading" mitnehmen, und beides steht in Titeln,
 * die keine Leitungsstellen sind.
 */
const MUSTER: readonly (readonly [Stufe, RegExp])[] = [
  [
    "leitung",
    /(\blead\b|\bhead of\b|\bprincipal\b|\bdirector\b|\bvorstand|\bleiter|\bleitung|\bchefarzt|\bchefärzt|\bgeschäftsführ|\w*leiter|\w*leitung|\w*leiterin)/i,
  ],
  [
    "einstieg",
    /(\bjunior\b|\bjr\.?\b|\btrainee\b|\bvolontär|\bpraktikant|\bpraktikum\b|\bwerkstudent|\bstudentische|\bazubi\b|\bauszubildende|\bausbildung\b|\beinsteiger|\bberufseinsteiger|\bquereinsteiger|\babsolvent|\bentry.level\b|\bschulabg)/i,
  ],
  [
    "senior",
    /(\bsenior\b|\bsr\.?\b|\bexpert\b|\bexpertin\b|\bspezialist|\bspecialist\b|\barchitekt|\bstaff engineer\b|\berfahrene?r?\b)/i,
  ],
  ["erfahren", /(\bmid.level\b|\bprofessional\b|\bregular\b)/i],
];

/**
 * Die Stufe aus dem Stellentitel — oder `unbekannt`.
 *
 * Absichtlich nur der Titel und kein Fliesstext: Im Anzeigentext
 * stehen Wörter wie „senior" auch dann, wenn ein Team gemeint ist
 * („du arbeitest mit unseren Senior Engineers"). Der Titel ist die
 * eine Stelle, an der das Wort die Stelle beschreibt.
 */
export function stufeAusTitel(titel: string | null | undefined): Stufe {
  const t = (titel ?? "").trim();
  if (t.length === 0) return "unbekannt";
  for (const [stufe, muster] of MUSTER) if (muster.test(t)) return stufe;
  return "unbekannt";
}

/* ── 3. Der Marktwert ────────────────────────────────────────── */

/**
 * Wie viele vergleichbare Ausschreibungen es mindestens braucht.
 *
 * Dreissig ist keine statistische Konstante, sondern die Grenze, ab
 * der ein Median gegen einzelne Ausreisser stabil ist. Darunter
 * entscheidet eine einzige aussergewöhnlich bezahlte Stelle über die
 * Aussage — und beim nächsten Abruf steht dort eine andere Zahl,
 * ohne dass sich am Markt etwas geändert hätte.
 */
export const MINDESTZAHL = 30;

export interface Gehaltszeile {
  /** Untergrenze der Jahresangabe in Euro. */
  von: number;
  /** Obergrenze; gleich `von`, wenn nur ein Wert genannt wurde. */
  bis: number;
}

export type Marktwert =
  | {
      art: "bekannt";
      /** Das mittlere Jahresgehalt der Vergleichsgruppe. */
      median: number;
      /** Das untere und obere Viertel — die ehrliche Spanne. */
      p25: number;
      p75: number;
      /** Worauf die Zahl beruht. Steht immer daneben, nie darunter. */
      stellen: number;
    }
  | {
      art: "zu_wenig";
      /** Was vorhanden war. Auch das ist eine Auskunft. */
      stellen: number;
      benoetigt: number;
    };

/**
 * Der Marktwert einer Vergleichsgruppe.
 *
 * Gerechnet wird auf der MITTE der ausgeschriebenen Spanne. „60.000
 * bis 75.000" ist ein Angebot, dessen Untergrenze der Arbeitgeber
 * nennt und dessen Obergrenze er meint — die Untergrenze allein
 * unterschätzt den Markt systematisch, die Obergrenze überschätzt
 * ihn.
 */
export function marktwert(
  zeilen: readonly Gehaltszeile[],
  mindestzahl: number = MINDESTZAHL,
): Marktwert {
  const werte = zeilen
    .map((z) => (z.von + Math.max(z.von, z.bis)) / 2)
    .filter((w) => Number.isFinite(w) && w > 0)
    .sort((a, b) => a - b);

  if (werte.length < mindestzahl) {
    return { art: "zu_wenig", stellen: werte.length, benoetigt: mindestzahl };
  }

  return {
    art: "bekannt",
    median: Math.round(quantil(werte, 0.5)),
    p25: Math.round(quantil(werte, 0.25)),
    p75: Math.round(quantil(werte, 0.75)),
    stellen: werte.length,
  };
}

/**
 * Lineare Interpolation zwischen den Nachbarn.
 *
 * Nicht der nächstgelegene Wert: Bei kleinen Gruppen springt der
 * Median sonst um tausende Euro, sobald eine einzige Anzeige
 * dazukommt — und ein Marktwert, der ohne Marktbewegung springt, ist
 * als Beobachtung wertlos.
 */
function quantil(sortiert: readonly number[], p: number): number {
  if (sortiert.length === 1) return sortiert[0]!;
  const pos = (sortiert.length - 1) * p;
  const unten = Math.floor(pos);
  const oben = Math.ceil(pos);
  if (unten === oben) return sortiert[unten]!;
  return sortiert[unten]! + (sortiert[oben]! - sortiert[unten]!) * (pos - unten);
}

/* ── 4. Die Einordnung des eigenen Gehalts ───────────────────── */

export type Lage =
  | { art: "unbekannt" }
  | {
      art: "eingeordnet";
      /** Wie viel Prozent der Vergleichsgruppe weniger zahlen. */
      perzentil: number;
      /** Differenz zum Median, negativ heisst darunter. */
      zumMedian: number;
      /** Ob der Abstand gross genug ist, um darüber zu sprechen. */
      deutlich: boolean;
    };

/**
 * Wo ein Gehalt in der Vergleichsgruppe liegt.
 *
 * ── Warum `deutlich` ───────────────────────────────────────────
 *
 * Weil ein Abstand von drei Prozent innerhalb der Genauigkeit dieser
 * Rechnung liegt. Ihn als „du bist unterbezahlt" auszugeben, wäre
 * eine Aussage über Rauschen — und sie hätte Folgen: Jemand geht
 * damit in ein Gehaltsgespräch.
 *
 * Zehn Prozent sind die Grenze, ab der der Unterschied grösser ist
 * als das, was Stellenzuschnitt und Firmengrösse ohnehin erklären.
 */
export const DEUTLICH_AB = 0.1;

export function einordnen(
  eigenes: number | null | undefined,
  wert: Marktwert,
  werte?: readonly number[],
): Lage {
  if (!eigenes || !Number.isFinite(eigenes) || eigenes <= 0) return { art: "unbekannt" };
  if (wert.art !== "bekannt") return { art: "unbekannt" };

  const zumMedian = eigenes - wert.median;
  const anteil = werte
    ? werte.filter((w) => w < eigenes).length / werte.length
    : /* Ohne die Einzelwerte nur grob aus den drei Kennzahlen. Das ist
         eine Näherung und wird als solche gerechnet: zwischen den
         Vierteln linear, ausserhalb gedeckelt. */
      naeherung(eigenes, wert);

  return {
    art: "eingeordnet",
    perzentil: Math.round(anteil * 100),
    zumMedian: Math.round(zumMedian),
    deutlich: Math.abs(zumMedian) / wert.median >= DEUTLICH_AB,
  };
}

function naeherung(eigenes: number, w: Extract<Marktwert, { art: "bekannt" }>): number {
  if (eigenes <= w.p25) return 0.25 * Math.min(1, eigenes / Math.max(w.p25, 1));
  if (eigenes <= w.median) return 0.25 + 0.25 * ((eigenes - w.p25) / Math.max(w.median - w.p25, 1));
  if (eigenes <= w.p75) return 0.5 + 0.25 * ((eigenes - w.median) / Math.max(w.p75 - w.median, 1));
  return Math.min(0.99, 0.75 + 0.24 * ((eigenes - w.p75) / Math.max(w.p75, 1)));
}

/* ── 5. Auf ein Jahresgehalt bringen ─────────────────────────── */

/**
 * ══════════════════════════════════════════════════════════════════
 * Warum hier keine Umrechnung steht
 * ══════════════════════════════════════════════════════════════════
 *
 * Ich hatte eine gebaut. Sie war überflüssig: `aufJahr` in
 * `verguetungsangabe.ts` tut genau dasselbe und ist strenger — dort
 * hängt an einer Angabe ausserdem, ob sie das FESTE Gehalt meint, das
 * Jahresziel mit Provision oder ein Gesamtpaket. Ein Marktwert, der
 * Festgehälter mit Gesamtpaketen mittelt, misst nichts.
 *
 * Zwei Umrechnungen nebeneinander wären genau das Duplikat, vor dem
 * `LINKRANG` in `herkunft.ts` warnt: Jemand ändert die eine, die
 * andere bleibt, und ab da widersprechen sich zwei Zahlen, die
 * dasselbe heissen.
 *
 * Also: `aufJahr(angabe, betrag)` aus `verguetungsangabe.ts`, und
 * `vomArbeitgeber(quelle)` aus `gehaltsquelle.ts` statt einer eigenen
 * Herkunftsprüfung.
 *
 * Was hier bleibt, ist die eine Frage, die dort NICHT beantwortet
 * wird: ob eine Arbeitszeitspalte überhaupt eine Angabe enthält.
 */

/**
 * Ist diese Arbeitszeitangabe eine Angabe — oder ein Standardwert?
 *
 * Eine Spalte, in der jeder Wert gleich ist, beschreibt nichts. Diese
 * Prüfung gehört an jede Stelle, die Arbeitszeiten aus einer Quelle
 * übernimmt, und nicht nur an die eine, an der es aufgefallen ist.
 *
 * Zurückgegeben wird der Anteil des häufigsten Werts. Ab `verdaechtig`
 * ist die Spalte für Rechnungen nicht zu gebrauchen.
 */
export function istStandardwert(
  werte: readonly (number | null | undefined)[],
  verdaechtig = 0.98,
): { verdaechtig: boolean; anteil: number; haeufigster: number | null } {
  const echte = werte.filter((w): w is number => typeof w === "number" && Number.isFinite(w));
  if (echte.length === 0) return { verdaechtig: false, anteil: 0, haeufigster: null };

  const zaehler = new Map<number, number>();
  for (const w of echte) zaehler.set(w, (zaehler.get(w) ?? 0) + 1);

  let haeufigster = echte[0]!;
  let anzahl = 0;
  for (const [w, n] of zaehler) if (n > anzahl) ((haeufigster = w), (anzahl = n));

  const anteil = anzahl / echte.length;
  return { verdaechtig: anteil >= verdaechtig, anteil, haeufigster };
}
