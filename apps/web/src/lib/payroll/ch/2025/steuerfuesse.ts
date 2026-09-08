/**
 * Die Schweizer Steuerfüsse 2025, für die Kantonshauptorte.
 *
 * ══════════════════════════════════════════════════════════════
 * Quelle
 * ══════════════════════════════════════════════════════════════
 *
 * Eidgenössische Steuerverwaltung, „Vielfaches der einfachen Ansätze
 * pro 2025 — Kantonshauptorte". Übernommen am 8. September 2026,
 * Zeile für Zeile, ohne Umrechnung ausser der unten beschriebenen
 * Vereinheitlichung.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum nur die Hauptorte — und was das heisst
 * ══════════════════════════════════════════════════════════════
 *
 * Der Gemeindesteuerfuss ist eine Sache der GEMEINDE, nicht des
 * Kantons. In der Schweiz gibt es rund 2.100 davon, und sie
 * unterscheiden sich innerhalb eines Kantons erheblich.
 *
 * Diese Tabelle nennt je Kanton eine einzige Gemeinde: den Hauptort.
 * Das ist eine brauchbare Näherung für „in diesem Kanton" und keine
 * Aussage über eine bestimmte Adresse. Wer in Winterthur wohnt,
 * bekommt hier den Zürcher Stadtfuss — und muss das wissen.
 *
 * ══════════════════════════════════════════════════════════════
 * Zwei Schreibweisen, eine Bedeutung
 * ══════════════════════════════════════════════════════════════
 *
 * Die Quelle mischt sie, und das ist kein Fehler in der Quelle:
 *
 *   Zürich   98%      Luzern   1,55
 *   Bern     2,975    Sarnen   3,25
 *
 * Beides ist derselbe Rechenschritt — die einfache Steuer wird damit
 * multipliziert. Kantone mit tiefem Grundtarif brauchen einen Faktor
 * über eins, Kantone mit hohem einen unter eins. Dass Bern 2,975
 * schreibt und Zürich 98%, sagt nichts über die Steuerlast; es sagt
 * etwas über den Grundtarif dahinter.
 *
 * Hier steht deshalb überall ein MULTIPLIKATOR: 98% wird zu 0.98,
 * 2,975 bleibt 2.975. Wer die Zahlen nebeneinanderlegt und daraus auf
 * die Belastung schliesst, liegt falsch — dafür gibt es den Tarif.
 *
 * ══════════════════════════════════════════════════════════════
 * Was hier NICHT steht — und warum daraus noch keine Steuer wird
 * ══════════════════════════════════════════════════════════════
 *
 * Ein Steuerfuss ist ein Multiplikator. Die Rechnung geht:
 *
 *   steuerbares Einkommen
 *     → einfache Staatssteuer   (progressiver Tarif JE KANTON)
 *
 *   Kantonssteuer  = einfache Steuer × Kantonssteuerfuss
 *   Gemeindesteuer = einfache Steuer × Gemeindesteuerfuss
 *   Kirchensteuer  = einfache Steuer × Kirchensteuerfuss
 *
 *   Steuer = Summe der drei + direkte Bundessteuer
 *
 * ── Addiert, nicht multipliziert ────────────────────────────
 *
 * Hier stand zuerst „× Kantonssteuerfuss × Gemeindesteuerfuss", und
 * das war falsch. Jeder Fuss wird EINZELN auf die einfache Steuer
 * angewendet, und die Ergebnisse werden addiert.
 *
 * Der Unterschied ist keine Feinheit: In Zürich sind es 0,98 + 1,19 =
 * 2,17 mal die einfache Steuer. Multipliziert wären es 1,17 — knapp
 * die Hälfte. Aufgefallen ist es an Basel-Stadt, wo Kanton und Stadt
 * je 50 Prozent erheben und zusammen die 100 Prozent ergeben, die in
 * der ESTV-Tabelle stehen. Bei einer Multiplikation ergäben 50 % mal
 * 50 % ein Viertel, nicht das Ganze.
 *
 * Die Tarife stehen hier nicht. Ohne sie hat der Multiplikator nichts
 * zum Multiplizieren, und diese Datei ist eine Tabelle, aus der noch
 * keine Zahl folgt. Genau deshalb rechnet der Nettorechner für die
 * Schweiz weiterhin nicht — er zeigt, was bekannt ist, und schweigt
 * zum Rest.
 */

/**
 * Ein Wert, der in der Quelle nur als Fussnote steht.
 *
 * Elf Felder tragen eine Fussnotenziffer, und bei Basel-Stadt, Liestal
 * und Sion steht STATT einer Zahl nur die Ziffer. Was dort gilt,
 * entscheidet der Fussnotentext — und den hat die Vorlage nicht
 * mitgeliefert.
 *
 * `null` heisst deshalb: nicht bekannt. Es heisst ausdrücklich nicht
 * „null Prozent". Ein fehlender Steuerfuss als Null gerechnet ergäbe
 * eine Steuer von null Franken, und das sähe aus wie ein Ergebnis.
 */
/**
 * Das Jahr, aus dem diese Steuerfüsse stammen.
 *
 * Steht als Zahl da und nicht nur im Dateinamen, weil der Rechenkern
 * sie gegen das Steuerjahr prüft. Ein Steuerfuss ändert sich seltener
 * als ein Tarif — und genau deshalb wird er gern aus dem Vorjahr
 * weiterbenutzt, ohne dass es jemandem auffällt.
 */
export const STEUERFUESSE_JAHR = 2025;

export type Steuerfuss = number | null;

export interface Kantonssatz {
  /** Kantonskürzel nach ISO 3166-2:CH. */
  kanton: string;
  /** Der Hauptort, für den die Gemeindewerte gelten. */
  hauptort: string;
  /** Multiplikator auf die einfache Staatssteuer. */
  kanton_fuss: Steuerfuss;
  /** Multiplikator der Gemeinde des Hauptorts. */
  gemeinde_fuss: Steuerfuss;
  /** Kirchensteuer evangelisch-reformiert. */
  kirche_ev: Steuerfuss;
  /** Kirchensteuer römisch-katholisch. */
  kirche_kath: Steuerfuss;
  /**
   * Welche Felder in der Quelle eine Fussnote tragen.
   *
   * Sie steht dabei, weil ein Wert mit Fussnote nicht dasselbe ist wie
   * einer ohne: Bei Chur tragen drei der vier Felder die Ziffer 7,
   * und was sie bedeutet, ändert womöglich alle drei.
   */
  fussnoten?: string;
}

/**
 * Die 26 Kantone, in der Reihenfolge der Quelle.
 *
 * ── Was bewusst fehlt ───────────────────────────────────────
 *
 * Die Vermögenssteuer. Fribourg und Liestal führen sie in der Quelle
 * als eigene Zeile („Fortune", „Vermögen"); übernommen ist hier nur
 * die Einkommenszeile. Für ein Gehalt ist die Vermögenssteuer nicht
 * einschlägig, und sie mitzuführen hiesse, zwei Steuerarten in einer
 * Tabelle zu vermengen.
 */
export const STEUERFUESSE_2025: Kantonssatz[] = [
  { kanton: "ZH", hauptort: "Zürich", kanton_fuss: 0.98, gemeinde_fuss: 1.19, kirche_ev: 0.1, kirche_kath: 0.1 },
  { kanton: "BE", hauptort: "Bern", kanton_fuss: 2.975, gemeinde_fuss: 1.54, kirche_ev: 0.184, kirche_kath: 0.19 },
  { kanton: "LU", hauptort: "Luzern", kanton_fuss: 1.55, gemeinde_fuss: 1.55, kirche_ev: 0.25, kirche_kath: 0.25 },
  { kanton: "UR", hauptort: "Altdorf", kanton_fuss: 1.0, gemeinde_fuss: 0.95, kirche_ev: 1.15, kirche_kath: 0.82 },
  { kanton: "SZ", hauptort: "Schwyz", kanton_fuss: 1.15, gemeinde_fuss: 1.75, kirche_ev: 0.25, kirche_kath: 0.26 },
  { kanton: "OW", hauptort: "Sarnen", kanton_fuss: 3.25, gemeinde_fuss: 3.86, kirche_ev: 0.54, kirche_kath: 0.54 },
  { kanton: "NW", hauptort: "Stans", kanton_fuss: 2.66, gemeinde_fuss: 2.35, kirche_ev: 0.26, kirche_kath: 0.4 },
  { kanton: "GL", hauptort: "Glarus", kanton_fuss: 0.597, gemeinde_fuss: 0.56, kirche_ev: 0.075, kirche_kath: 0.08 },
  { kanton: "ZG", hauptort: "Zug", kanton_fuss: 0.82, gemeinde_fuss: 0.5211, kirche_ev: 0.075, kirche_kath: 0.07 },
  /* Fribourg: nur die Zeile „Revenu". Die Zeile „Fortune" ist die
     Vermögenssteuer und gehört nicht zu einem Gehalt. */
  { kanton: "FR", hauptort: "Fribourg", kanton_fuss: 0.96, gemeinde_fuss: 0.8, kirche_ev: 0.09, kirche_kath: 0.06 },
  { kanton: "SO", hauptort: "Solothurn", kanton_fuss: 1.04, gemeinde_fuss: 1.07, kirche_ev: 0.16, kirche_kath: 0.21 },
  /*
   * Basel-Stadt: die Null ist hier richtig und keine Lücke.
   *
   * Die Stadt Basel erhebt keine eigene Gemeindesteuer neben der
   * kantonalen — Kanton und Stadt sind dieselbe Körperschaft.
   * Aufgelöst am 8. September 2026: „Der kantonale Steuerfuss liegt
   * bei 50 % und der städtische bei ebenfalls 50 % (Total 100 %)."
   * Die 100 % in der ESTV-Zeile sind also bereits die Summe, und
   * daneben kommt nichts mehr dazu.
   *
   * Deshalb `0` und nicht `null`: `null` hiesse „wir wissen es
   * nicht" und würde den Kanton vom Rechnen ausschliessen. Hier
   * wissen wir es — es kommt nichts hinzu.
   */
  { kanton: "BS", hauptort: "Basel", kanton_fuss: 1.0, gemeinde_fuss: 0, kirche_ev: 0.08, kirche_kath: 0.08, fussnoten: "Gemeinde 4) = in der Kantonssteuer enthalten; Kirche 5)" },
  { kanton: "BL", hauptort: "Liestal", kanton_fuss: null, gemeinde_fuss: 0.65, kirche_ev: 0.0055, kirche_kath: 0.0675, fussnoten: "Kanton 3); Kirche ev. 2), kath. 6)" },
  { kanton: "SH", hauptort: "Schaffhausen", kanton_fuss: 0.79, gemeinde_fuss: 0.86, kirche_ev: 0.13, kirche_kath: 0.13 },
  { kanton: "AR", hauptort: "Herisau", kanton_fuss: 3.3, gemeinde_fuss: 4.1, kirche_ev: 0.6, kirche_kath: 0.47 },
  { kanton: "AI", hauptort: "Appenzell", kanton_fuss: 0.96, gemeinde_fuss: 0.56, kirche_ev: 0.1, kirche_kath: 0.1 },
  { kanton: "SG", hauptort: "St. Gallen", kanton_fuss: 1.05, gemeinde_fuss: 1.38, kirche_ev: 0.25, kirche_kath: 0.26 },
  { kanton: "GR", hauptort: "Chur", kanton_fuss: 0.95, gemeinde_fuss: 0.88, kirche_ev: 0.145, kirche_kath: 0.1, fussnoten: "Gemeinde und Kirche 7)" },
  { kanton: "AG", hauptort: "Aarau", kanton_fuss: 1.11, gemeinde_fuss: 0.96, kirche_ev: 0.15, kirche_kath: 0.19 },
  { kanton: "TG", hauptort: "Frauenfeld", kanton_fuss: 1.09, gemeinde_fuss: 1.44, kirche_ev: 0.16, kirche_kath: 0.16 },
  /* Tessin und Waadt erheben keine Kirchensteuer über die Steuer —
     in der Quelle steht dort ein Strich, nicht eine Fussnote. */
  { kanton: "TI", hauptort: "Bellinzona", kanton_fuss: 1.0, gemeinde_fuss: 0.93, kirche_ev: 0, kirche_kath: 0 },
  { kanton: "VD", hauptort: "Lausanne", kanton_fuss: 1.55, gemeinde_fuss: 0.785, kirche_ev: 0, kirche_kath: 0 },
  { kanton: "VS", hauptort: "Sion", kanton_fuss: null, gemeinde_fuss: 1.1, kirche_ev: 0, kirche_kath: 0.03, fussnoten: "Kanton 3); Kirche kath. 8)" },
  { kanton: "NE", hauptort: "Neuchâtel", kanton_fuss: 1.24, gemeinde_fuss: 0.65, kirche_ev: 0.11, kirche_kath: 0.11 },
  { kanton: "GE", hauptort: "Genève", kanton_fuss: 1.475, gemeinde_fuss: 0.4549, kirche_ev: 0.16, kirche_kath: 0.16, fussnoten: "Kanton 9)" },
  { kanton: "JU", hauptort: "Delémont", kanton_fuss: 2.85, gemeinde_fuss: 1.9, kirche_ev: 0.081, kirche_kath: 0.064, fussnoten: "Kirche 6)" },
];

/** Der Satz eines Kantons, oder `null`. */
export function satzFuer(kanton: string): Kantonssatz | null {
  const k = kanton.trim().toUpperCase();
  return STEUERFUESSE_2025.find((s) => s.kanton === k) ?? null;
}

/**
 * Ob mit diesem Kanton überhaupt gerechnet werden könnte.
 *
 * Nur wahr, wenn Kantons- UND Gemeindefuss bekannt sind. Bei
 * Basel-Stadt, Liestal und Sion fehlt einer von beiden — dort steht in
 * der Quelle eine Fussnote statt einer Zahl, und der Fussnotentext
 * fehlt.
 *
 * Auch bei `true` folgt daraus noch keine Steuer: Es fehlt weiterhin
 * der Tarif der einfachen Staatssteuer. Diese Funktion sagt nur, dass
 * an DIESER Tabelle nichts fehlt.
 */
export function fuesseVollstaendig(kanton: string): boolean {
  const s = satzFuer(kanton);
  return s !== null && s.kanton_fuss !== null && s.gemeinde_fuss !== null;
}
