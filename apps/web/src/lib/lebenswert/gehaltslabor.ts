import { rechnerFuer, zuEuro, type Eingabe } from "../payroll";
import { eingabeAus } from "../payroll/eingabe.ts";
import type { Gehaltsangaben } from "../payroll/angaben.ts";

/**
 * Zwei Fragen, die ein Bruttorechner nicht beantwortet.
 *
 * ── „Was bleibt von der Erhöhung?" ────────────────────────────
 *
 * Die teuerste Fehleinschätzung im Berufsleben. Wer 5.000 € mehr
 * verhandelt, rechnet im Kopf mit vierhundert im Monat und bekommt
 * zweihundertzwanzig. Der Grund ist der Grenzsteuersatz: Auf den
 * ZUSÄTZLICHEN Euro liegt eine ganz andere Belastung als auf dem
 * Durchschnitt des bisherigen Gehalts — bei mittleren Einkommen in
 * Deutschland oft über 45 %, während die Durchschnittsbelastung bei 30
 * liegt.
 *
 * Beide Zahlen stehen deshalb nebeneinander. Die Differenz zwischen
 * ihnen ist der Grund, warum sich Gehaltsverhandlungen anders anfühlen,
 * als sie sich rechnen.
 *
 * ── „Was müsste ich verdienen?" ───────────────────────────────
 *
 * Die Frage in der Verhandlung selbst. Man weiss, was man zum Leben
 * braucht — 2.800 € netto —, und muss daraus eine Bruttoforderung
 * machen. Die Umrechnung ist nicht linear und im Kopf nicht zu machen.
 *
 * ── Warum gesucht und nicht umgekehrt gerechnet wird ──────────
 *
 * Es gibt keine Umkehrfunktion. Die Lohnsteuer ist stückweise
 * definiert, die Sozialabgaben haben Beitragsbemessungsgrenzen, und der
 * Zusatzbeitrag hängt an der Kasse. Statt eine zweite, vereinfachte
 * Steuerformel zu schreiben — die dann irgendwann von der ersten
 * abweicht, ohne dass es jemand merkt — sucht diese Datei mit dem
 * ECHTEN Rechner, bis sie nah genug ist.
 *
 * Ein Regelwerk, eine Wahrheit.
 */

export interface Erhoehung {
  bruttoVorher: number;
  bruttoNachher: number;
  /** Wie viel brutto dazukommt, im Jahr. */
  bruttoPlusJahr: number;
  /** Was davon netto ankommt, im Jahr. */
  nettoPlusJahr: number;
  nettoPlusMonat: number;
  /**
   * Der Anteil der Erhöhung, der abgeht — der Grenzabgabensatz.
   *
   * Die Zahl, die niemand im Kopf hat und die alles erklärt.
   */
  grenzabgaben: number;
  /** Was insgesamt vom Bruttogehalt abgeht — zum Vergleich daneben. */
  durchschnittsabgaben: number;
}

/**
 * Was von einer Gehaltserhöhung übrig bleibt.
 *
 * `null`, wenn eine der beiden Rechnungen nicht abgedeckt ist — dann
 * gibt es keine Zahl, denn eine halbe Rechnung ist hier schlimmer als
 * keine: Der Betrag sähe genauso aus.
 */
export function erhoehung(
  bruttoJahr: number,
  plusBruttoJahr: number,
  angaben: Gehaltsangaben | null,
  land = "DE",
): Erhoehung | null {
  if (bruttoJahr <= 0 || plusBruttoJahr <= 0) return null;
  const rechner = rechnerFuer(land as Eingabe["land"], 2026);
  if (!rechner) return null;

  const vorher = rechner.berechne(eingabeAus(angaben, bruttoJahr, land));
  const nachher = rechner.berechne(eingabeAus(angaben, bruttoJahr + plusBruttoJahr, land));
  if (!vorher.abgedeckt || !nachher.abgedeckt) return null;

  const nettoVorher = zuEuro(vorher.nettoJahr);
  const nettoNachher = zuEuro(nachher.nettoJahr);
  const nettoPlus = nettoNachher - nettoVorher;

  return {
    bruttoVorher: bruttoJahr,
    bruttoNachher: bruttoJahr + plusBruttoJahr,
    bruttoPlusJahr: plusBruttoJahr,
    nettoPlusJahr: Math.round(nettoPlus),
    nettoPlusMonat: Math.round(nettoPlus / 12),
    grenzabgaben: runde(1 - nettoPlus / plusBruttoJahr),
    durchschnittsabgaben: runde(1 - nettoNachher / (bruttoJahr + plusBruttoJahr)),
  };
}

export interface Zielbrutto {
  zielNettoMonat: number;
  bruttoJahr: number;
  /** Was dabei tatsächlich herauskommt — nie exakt das Ziel. */
  erreichtesNettoMonat: number;
}

export interface Zielbefund {
  ergebnis: Zielbrutto | null;
  /** Warum es keine Zahl gibt. `null`, wenn es eine gibt. */
  grund: string | null;
}

/**
 * Welches Bruttogehalt zu einem gewünschten Netto führt.
 *
 * Binäre Suche über den echten Rechner — es gibt keine Umkehrfunktion,
 * und eine zweite, vereinfachte Steuerformel würde irgendwann von der
 * ersten abweichen, ohne dass es jemand merkt.
 */
export function bruttoFuerNetto(
  zielNettoMonat: number,
  angaben: Gehaltsangaben | null,
  land = "DE",
): Zielbefund {
  if (zielNettoMonat <= 0) {
    return { ergebnis: null, grund: "Nenne ein Zielnetto, dann rechne ich das Brutto dazu aus." };
  }
  const rechner = rechnerFuer(land as Eingabe["land"], 2026);
  if (!rechner) {
    return { ergebnis: null, grund: `Für ${land} habe ich noch kein Steuerregelwerk.` };
  }

  const netto = (brutto: number): number | null => {
    const r = rechner.berechne(eingabeAus(angaben, brutto, land));
    return r.abgedeckt ? zuEuro(r.nettoMonat) : null;
  };

  /*
   * Die Suchgrenzen werden ERTASTET, nicht abgeschrieben.
   *
   * Der Rechner deckt nicht jedes Bruttogehalt ab: Unterhalb des
   * Übergangsbereichs laufen die Beiträge anders, oberhalb einer
   * Millionengrenze verweist er auf eine individuelle Berechnung. Diese
   * beiden Zahlen hier zu wiederholen hiesse, sie an zwei Stellen zu
   * pflegen — und beim nächsten Steuerjahr stimmte eine davon nicht
   * mehr, ohne dass ein Test rot würde.
   *
   * Stattdessen wird gesucht, wo die Abdeckung beginnt und endet.
   * Vierzig Rechnerläufe kosten nichts; das Regelwerk hängt an keiner
   * Datenbank und keinem Netz.
   */
  const untereGrenze = grenzeSuchen(netto, 1, 100_000, "aufwärts");
  const obereGrenze = grenzeSuchen(netto, 100_000, 20_000_000, "abwärts");
  if (untereGrenze === null || obereGrenze === null || untereGrenze >= obereGrenze) {
    return { ergebnis: null, grund: "Diese Konstellation kann ich nicht zuverlässig rechnen." };
  }

  const nettoUnten = netto(untereGrenze);
  const nettoOben = netto(obereGrenze);
  if (nettoUnten === null || nettoOben === null) {
    return { ergebnis: null, grund: "Diese Konstellation kann ich nicht zuverlässig rechnen." };
  }

  if (zielNettoMonat < nettoUnten) {
    /*
     * Unterhalb des abgedeckten Bereichs.
     *
     * Der Randwert wäre hier eine besonders verführerische Antwort: Er
     * sieht aus wie ein Ergebnis und ist die untere Kante des
     * Suchfensters. Wer danach seine Forderung richtet, fordert zu wenig
     * — und merkt es nie.
     */
    return {
      ergebnis: null,
      grund:
        `Ein Nettoziel unter etwa ${Math.round(nettoUnten)} € im Monat liegt im Minijob- oder ` +
        "Übergangsbereich. Dort laufen die Beiträge anders, und die rechne ich noch nicht.",
    };
  }
  if (zielNettoMonat > nettoOben) {
    return {
      ergebnis: null,
      grund:
        "Für dieses Nettoziel lohnt eine individuelle Berechnung mehr als eine Schätzung — " +
        "es liegt oberhalb dessen, was dieses Regelwerk abdeckt.",
    };
  }

  /*
   * Vierzig Halbierungen.
   *
   * Der Bereich schrumpft dabei auf weniger als einen Cent — die
   * Genauigkeit ist also nicht die Grenze. Ein festes Limit statt einer
   * Toleranzschleife, weil eine Schleife über einer Treppenfunktion
   * nicht terminieren muss: Die Lohnsteuer ist stückweise definiert,
   * und zwischen zwei Bruttowerten kann dasselbe Netto stehen.
   */
  let unten = untereGrenze;
  let oben = obereGrenze;
  for (let i = 0; i < 40; i++) {
    const mitte = (unten + oben) / 2;
    const n = netto(mitte);
    if (n === null) return { ergebnis: null, grund: "Diese Konstellation kann ich nicht zuverlässig rechnen." };
    if (n < zielNettoMonat) unten = mitte;
    else oben = mitte;
  }

  /*
   * Auf hundert Euro gerundet — und dann nachgerechnet.
   *
   * „63.472 €" ist keine Zahl, mit der man in eine Verhandlung geht.
   * Das Runden verschiebt aber das Ergebnis, deshalb steht daneben, was
   * bei der gerundeten Zahl tatsächlich herauskommt, statt weiterhin
   * das Ziel zu behaupten.
   */
  const brutto = Math.round(oben / 100) * 100;
  const erreicht = netto(brutto);
  if (erreicht === null) {
    return { ergebnis: null, grund: "Diese Konstellation kann ich nicht zuverlässig rechnen." };
  }

  return {
    ergebnis: { zielNettoMonat, bruttoJahr: brutto, erreichtesNettoMonat: Math.round(erreicht) },
    grund: null,
  };
}

/**
 * Wo die Abdeckung des Rechners beginnt beziehungsweise endet.
 *
 * `aufwärts`: der kleinste abgedeckte Wert zwischen `von` und `bis`.
 * `abwärts`: der grösste. `null`, wenn im ganzen Bereich nichts
 * abgedeckt ist — dann gibt es nichts zu suchen.
 */
function grenzeSuchen(
  netto: (b: number) => number | null,
  von: number,
  bis: number,
  richtung: "aufwärts" | "abwärts",
): number | null {
  const abgedeckt = (b: number) => netto(b) !== null;
  const anker = richtung === "aufwärts" ? bis : von;
  if (!abgedeckt(anker)) return null;

  let drinnen = anker;
  let draussen = richtung === "aufwärts" ? von : bis;
  if (abgedeckt(draussen)) return draussen;

  for (let i = 0; i < 40; i++) {
    const mitte = (drinnen + draussen) / 2;
    if (abgedeckt(mitte)) drinnen = mitte;
    else draussen = mitte;
  }
  return drinnen;
}

function runde(n: number): number {
  return Math.round(n * 1000) / 1000;
}
