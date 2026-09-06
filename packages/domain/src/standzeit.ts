/**
 * Wie lange eine Stelle schon steht — und was das heisst.
 *
 * ── Das Problem, das dahintersteht ────────────────────────────
 *
 * Eine Stellenanzeige kostet fast nichts und verpflichtet zu nichts.
 * Deshalb ist sie kein glaubwürdiges Signal dafür, dass jemand
 * einstellen will. Erhebungen im angelsächsischen Raum kommen auf
 * 18–22 % Anzeigen ohne Einstellungsabsicht; für den deutschen Markt
 * gibt es keine veröffentlichte Zahl.
 *
 * Im eigenen Bestand (1,58 Mio. Stellen, alle mit Veröffentlichungs-
 * datum) sind 26,3 % älter als 90 Tage, 16,0 % älter als 180 Tage und
 * 7,1 % älter als ein Jahr — und alle wurden in der letzten Woche
 * erneut von der Quelle ausgeliefert.
 *
 * ── Warum hier trotzdem nicht „Geisterstelle" steht ───────────
 *
 * Alt ist nicht dasselbe wie unecht. Eine Pflegestelle steht ein
 * halbes Jahr, weil niemand kommt — die Absicht ist echt, die Not
 * auch. Über die Absicht eines Arbeitgebers wissen wir nichts, und
 * eine Behauptung darüber wäre genau die Sorte unbelegter Aussage,
 * gegen die dieses Produkt gebaut ist.
 *
 * Was wir wissen: wie lange sie steht, und wie lange vergleichbare
 * Stellen derselben Berufsgruppe stehen. Beides gemessen.
 *
 * Und für die Entscheidung reicht das: Eine Stelle, die viermal so
 * lange steht wie ihre Vergleichsgruppe, ist entweder schwer zu
 * besetzen oder wird nicht besetzt. Wer sich das vorher überlegt, hat
 * die Auskunft, die er braucht — in beiden Fällen.
 */

export const STANDZEITBEFUNDE = ["unauffaellig", "laenger", "auffaellig"] as const;
export type Standzeitbefund = (typeof STANDZEITBEFUNDE)[number];

export interface Standzeitreferenz {
  gruppe: string;
  stellen: number;
  medianTage: number;
  p90Tage: number;
}

export interface Standzeit {
  tage: number;
  befund: Standzeitbefund;
  /** Der Vergleichswert der Gruppe. `null`, wenn es keinen gibt. */
  medianTage: number | null;
  satz: string;
}

/**
 * Unter wie vielen Stellen eine Gruppe nichts aussagt.
 *
 * Ein Median aus 200 Anzeigen einer Berufsgruppe schwankt mit jedem
 * Import. Darunter wird der Vergleich weggelassen und nur die eigene
 * Standzeit genannt — eine Zahl ohne Deutung ist besser als eine
 * Deutung ohne Grundlage.
 */
export const MIN_STELLEN_FUER_VERGLEICH = 3000;

/** Unter zwei Wochen wird gar nichts gesagt. Jede Stelle ist mal neu. */
export const MIN_TAGE = 14;

const TAG = 24 * 60 * 60 * 1000;

export function standzeit(
  veroeffentlichtAm: Date | null,
  referenz: Standzeitreferenz | null,
  jetzt: Date,
): Standzeit | null {
  if (!veroeffentlichtAm) return null;
  const tage = Math.floor((jetzt.getTime() - veroeffentlichtAm.getTime()) / TAG);
  if (tage < MIN_TAGE) return null;

  const brauchbar = referenz && referenz.stellen >= MIN_STELLEN_FUER_VERGLEICH;
  if (!brauchbar) {
    return {
      tage,
      befund: "unauffaellig",
      medianTage: null,
      satz: `Diese Anzeige steht seit ${tage} Tagen.`,
    };
  }

  const { medianTage, p90Tage } = referenz;

  if (tage > p90Tage) {
    return {
      tage,
      befund: "auffaellig",
      medianTage,
      /*
       * Der Satz nennt die Grundlage mit.
       *
       * „Auffällig" allein wäre ein Urteil. Mit der Vergleichszahl
       * daneben kann jemand selbst entscheiden, ob ihn das stört —
       * und im Zweifel widersprechen.
       */
      satz:
        `Diese Anzeige steht seit ${tage} Tagen. Vergleichbare Stellen in diesem Berufsfeld ` +
        `sind nach ${Math.round(medianTage)} Tagen weg, neun von zehn nach ${Math.round(p90Tage)}.`,
    };
  }

  if (tage > medianTage * 2) {
    return {
      tage,
      befund: "laenger",
      medianTage,
      satz:
        `Diese Anzeige steht seit ${tage} Tagen — vergleichbare Stellen in diesem Berufsfeld ` +
        `sind nach ${Math.round(medianTage)} Tagen weg.`,
    };
  }

  return {
    tage,
    befund: "unauffaellig",
    medianTage,
    satz: `Diese Anzeige steht seit ${tage} Tagen. Das ist für dieses Berufsfeld üblich.`,
  };
}

/**
 * Was daraus für die Entscheidung folgt.
 *
 * Bewusst zwei Möglichkeiten und keine Auswahl dazwischen: Wir wissen
 * nicht, welche zutrifft, und zu tun als wüssten wir es, wäre
 * dieselbe Anmassung wie eine erfundene Gehaltsangabe.
 */
export function standzeitFolge(befund: Standzeitbefund): string | null {
  if (befund !== "auffaellig") return null;
  return (
    "Das heisst eines von beiden: schwer zu besetzen, oder es wird gerade niemand gesucht. " +
    "Beides ist ein Grund, vorher zu fragen, statt eine Bewerbung zu schreiben."
  );
}
