import type { Arbeitsdimension } from "@paycheck/domain";
import type { Dimensionsschaetzung } from "./arbeitsdimensionen.ts";

/**
 * Wie eine Angabe über die Rolle zustande kam.
 *
 * ── Warum das mitgeführt wird ─────────────────────────────────
 *
 * „Viel Eigenverantwortung" ist dieselbe Zeichenkette, ob sie ein
 * Arbeitgeber ins Formular geschrieben, vier Mitarbeiter bestätigt oder
 * ein regulärer Ausdruck im Fliesstext gefunden hat. Als Auskunft sind
 * es drei verschiedene Dinge, und der Unterschied ist genau das, was
 * dieses Produkt verspricht.
 *
 * Ohne mitgeführte Herkunft verschwindet er beim ersten Zusammenführen.
 */
export type Aussageherkunft = "bestaetigt" | "arbeitgeber" | "abgeleitet";

/**
 * Wie schwer eine Herkunft wiegt.
 *
 * Bestätigt schlägt behauptet, behauptet schlägt geraten. Der Abstand
 * ist bewusst gross: Eine Bestätigung durch Menschen, die die Arbeit
 * tun, ist kategorisch etwas anderes als ein Fund im Anzeigentext.
 */
export const AUSSAGEGEWICHT: Record<Aussageherkunft, number> = {
  bestaetigt: 1.0,
  arbeitgeber: 0.6,
  abgeleitet: 0.3,
};

export interface Rollenangabe {
  dimension: Arbeitsdimension;
  wert: number;
  herkunft: Aussageherkunft;
  /** Wie viele Menschen die Angabe tragen. Nur bei `bestaetigt` > 0. */
  stimmen: number;
  /** Der Satz, der sie belegt. */
  beleg: string;
  /**
   * true, wenn Mitarbeiter deutlich anders antworten als der Arbeitgeber.
   *
   * Das ist die wertvollste Auskunft der ganzen Karte — und sie
   * verschwände, wenn man beide Seiten einfach mitteln würde.
   */
  widerspruch: boolean;
}

/** Ab wann eine Bestätigung als Bestätigung gilt. */
export const MIN_STIMMEN = 3;

/** Ab welchem Abstand ein Widerspruch einer ist. */
const WIDERSPRUCH_AB = 0.3;

export interface RollenwahrheitEingabe {
  /** Was der Arbeitgeber je Achse angegeben hat. */
  arbeitgeber: { dimension: Arbeitsdimension; wert: number; begruendung: string }[];
  /** Einzelne Mitarbeiterangaben, mehrere je Achse möglich. */
  bestaetigungen: { dimension: Arbeitsdimension; wert: number }[];
  /** Was aus dem Anzeigentext abgeleitet wurde. */
  abgeleitet: Dimensionsschaetzung[];
}

/**
 * Eine Angabe je Achse — mit ihrer Herkunft.
 *
 * ── Warum nicht gemittelt wird ────────────────────────────────
 *
 * Der naheliegende Weg wäre, alle drei Quellen zu gewichten und einen
 * Wert auszugeben. Das Ergebnis wäre glatter und wertloser: Ein
 * Arbeitgeber sagt „wenig Druck", sechs Mitarbeiter sagen „viel Druck",
 * der Mittelwert sagt „mittel" — und die eine Information, die zählt,
 * ist weg.
 *
 * Stattdessen gewinnt die belastbarste Quelle, und der Widerspruch wird
 * ausdrücklich vermerkt.
 */
export function rollenwahrheit(e: RollenwahrheitEingabe): Rollenangabe[] {
  const nachDimension = new Map<Arbeitsdimension, Rollenangabe>();

  /* Unterste Stufe: was im Text stand. */
  for (const a of e.abgeleitet) {
    if (a.sicherheit <= 0) continue;
    nachDimension.set(a.dimension, {
      dimension: a.dimension,
      wert: a.wert,
      herkunft: "abgeleitet",
      stimmen: 0,
      beleg: `aus der Anzeige gelesen: ${a.beleg}`,
      widerspruch: false,
    });
  }

  /* Mittlere Stufe: was der Arbeitgeber ausdrücklich angegeben hat. */
  const vomArbeitgeber = new Map<Arbeitsdimension, number>();
  for (const a of e.arbeitgeber) {
    vomArbeitgeber.set(a.dimension, a.wert);
    nachDimension.set(a.dimension, {
      dimension: a.dimension,
      wert: a.wert,
      herkunft: "arbeitgeber",
      stimmen: 0,
      beleg: a.begruendung || "vom Arbeitgeber angegeben",
      widerspruch: false,
    });
  }

  /* Oberste Stufe: was Menschen bestätigen, die die Arbeit tun. */
  const gruppiert = new Map<Arbeitsdimension, number[]>();
  for (const b of e.bestaetigungen) {
    const liste = gruppiert.get(b.dimension) ?? [];
    liste.push(b.wert);
    gruppiert.set(b.dimension, liste);
  }

  for (const [d, werte] of gruppiert) {
    /*
     * Unter drei Stimmen bleibt es bei der Arbeitgeberangabe.
     *
     * Eine einzelne Rückmeldung kann alles sein — ein schlechter Tag,
     * eine offene Rechnung. Sie als „bestätigt" auszugeben, wäre eine
     * Behauptung über die Rolle auf Basis einer Person.
     */
    if (werte.length < MIN_STIMMEN) continue;

    /*
     * Der Median, nicht der Mittelwert.
     *
     * Eine einzelne extreme Antwort verschiebt den Mittelwert bei sechs
     * Stimmen um mehr als einen Zehntel der Achse. Der Median steht
     * gegen sie.
     */
    const sortiert = [...werte].sort((a, b) => a - b);
    const mitte = Math.floor(sortiert.length / 2);
    const median =
      sortiert.length % 2 === 0 ? (sortiert[mitte - 1]! + sortiert[mitte]!) / 2 : sortiert[mitte]!;

    const behauptet = vomArbeitgeber.get(d);
    const widerspruch = behauptet !== undefined && Math.abs(behauptet - median) >= WIDERSPRUCH_AB;

    nachDimension.set(d, {
      dimension: d,
      wert: median,
      herkunft: "bestaetigt",
      stimmen: werte.length,
      beleg: widerspruch
        ? `${werte.length} Mitarbeiter antworten deutlich anders als der Arbeitgeber`
        : `von ${werte.length} Mitarbeitern bestätigt`,
      widerspruch,
    });
  }

  /* Widersprüche zuerst — sie sind die Auskunft, die man sonst nicht bekommt. */
  return [...nachDimension.values()].sort((a, b) => {
    if (a.widerspruch !== b.widerspruch) return a.widerspruch ? -1 : 1;
    return AUSSAGEGEWICHT[b.herkunft] - AUSSAGEGEWICHT[a.herkunft];
  });
}

/**
 * Wie belastbar die Karte insgesamt ist.
 *
 * Nicht als Note, sondern als Auskunft darüber, worauf sie beruht: Wie
 * viele Achsen sind überhaupt beantwortet, und wie viele davon von
 * Menschen bestätigt?
 */
export function kartenGuete(angaben: Rollenangabe[]): {
  achsen: number;
  bestaetigt: number;
  widersprueche: number;
} {
  return {
    achsen: angaben.length,
    bestaetigt: angaben.filter((a) => a.herkunft === "bestaetigt").length,
    widersprueche: angaben.filter((a) => a.widerspruch).length,
  };
}
