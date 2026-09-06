import { ausEuro, minus, plus, zuEuro, type Betrag } from "../payroll/core/dezimal.ts";

/**
 * Was am Ende übrig bleibt.
 *
 * ── Warum das eine eigene Rechnung ist ────────────────────────
 *
 * Ein Bruttogehalt beantwortet die Frage nicht, die jemand vor einem
 * Stellenwechsel wirklich hat. „70.000 statt 63.000" klingt nach
 * siebentausend; nach Steuern, Sozialabgaben und einem längeren
 * Arbeitsweg bleiben davon vielleicht hundertfünfzig Euro im Monat —
 * und dreissig Stunden weniger Freizeit im Jahr.
 *
 * Diese Datei rechnet nur. Sie holt keine Daten, ruft nichts auf und
 * kennt keinen Nutzer: Beträge hinein, Beträge heraus. Das macht sie
 * prüfbar, und geprüft muss sie sein — es ist die Zahl, nach der
 * jemand eine Entscheidung trifft.
 *
 * ── Was hier NICHT passiert ───────────────────────────────────
 *
 * Nichts wird geschätzt. Wer keine Wohnkosten angegeben hat, bekommt
 * keine „durchschnittlichen Wohnkosten in Deutschland" untergeschoben.
 * Eine Rechnung mit erfundenen Posten sieht vollständig aus und ist
 * falsch — und zwar in eine Richtung, die niemand nachprüft.
 *
 * Stattdessen zählt `unbekannt`, was fehlt. Eine Zahl mit dem Hinweis
 * „drei Posten fehlen" ist ehrlicher als eine glatte Summe.
 */

/** Monatliche Fixkosten. Alles in Euro, alles freiwillig. */
export interface Fixkosten {
  wohnen?: number | null;
  energie?: number | null;
  versicherungen?: number | null;
  mobilitaet?: number | null;
  lebensmittel?: number | null;
  kredite?: number | null;
  abos?: number | null;
  kinder?: number | null;
  freizeit?: number | null;
  sparen?: number | null;
  sonstiges?: number | null;
}

/**
 * Kosten, die NUR durch diese Stelle entstehen.
 *
 * Getrennt von den Fixkosten, weil sie beim Vergleich zweier Stellen
 * der entscheidende Unterschied sind: Die Miete bleibt gleich, der
 * Arbeitsweg nicht.
 */
export interface Jobkosten {
  pendeln?: number | null;
  parken?: number | null;
  verpflegung?: number | null;
  betreuung?: number | null;
  sonstiges?: number | null;
}

export interface Lebensrechnung {
  nettoMonat: number;
  fixkostenMonat: number;
  jobkostenMonat: number;
  /** Netto minus alles. Kann negativ sein — dann steht es auch so da. */
  freiMonat: number;
  freiJahr: number;
  /**
   * Welche Posten nicht angegeben wurden.
   *
   * Der wichtigste Teil des Ergebnisses. Ohne ihn liest sich „1.338 €
   * frei verfügbar" als vollständige Rechnung, auch wenn die Miete
   * fehlt.
   */
  unbekannt: string[];
  /** Wie viele Posten angegeben wurden, von wie vielen möglichen. */
  angegeben: { von: number; moeglich: number };
}

const FIX_NAMEN: Record<keyof Fixkosten, string> = {
  wohnen: "Wohnen",
  energie: "Strom und Energie",
  versicherungen: "Versicherungen",
  mobilitaet: "Mobilität",
  lebensmittel: "Lebensmittel",
  kredite: "Kredite",
  abos: "Abos",
  kinder: "Kinder",
  freizeit: "Freizeit",
  sparen: "Sparen",
  sonstiges: "Sonstiges",
};

const JOB_NAMEN: Record<keyof Jobkosten, string> = {
  pendeln: "Pendeln",
  parken: "Parken",
  verpflegung: "Verpflegung",
  betreuung: "Betreuung",
  sonstiges: "Sonstiges",
};

function summiere<T extends object>(
  werte: T,
  namen: Record<keyof T, string>,
): { summe: Betrag; fehlend: string[]; gesetzt: number } {
  let summe = ausEuro(0);
  const fehlend: string[] = [];
  let gesetzt = 0;

  for (const schluessel of Object.keys(namen) as (keyof T)[]) {
    const wert = werte[schluessel] as number | null | undefined;
    if (wert === null || wert === undefined) {
      fehlend.push(namen[schluessel]);
      continue;
    }
    /*
     * Eine ausdrückliche Null ist eine Angabe.
     *
     * „Ich zahle keine Miete" ist etwas anderes als „ich habe nichts
     * eingetragen". Wer beides gleich behandelt, kann nicht sagen, wie
     * vollständig die Rechnung ist.
     */
    summe = plus(summe, ausEuro(wert));
    gesetzt++;
  }

  return { summe, fehlend, gesetzt };
}

/**
 * Was vom Netto übrig bleibt.
 *
 * `nettoMonat` kommt aus dem Lohnrechner und wird hier nicht berechnet:
 * Steuern gehören in ein Regelwerk mit Jahreszahl, nicht in eine
 * Haushaltsrechnung.
 */
export function lebensrechnung(
  nettoMonat: number,
  fix: Fixkosten = {},
  job: Jobkosten = {},
): Lebensrechnung {
  const f = summiere(fix, FIX_NAMEN);
  const j = summiere(job, JOB_NAMEN);

  const netto = ausEuro(nettoMonat);
  const frei = minus(minus(netto, f.summe), j.summe);

  return {
    nettoMonat: zuEuro(netto),
    fixkostenMonat: zuEuro(f.summe),
    jobkostenMonat: zuEuro(j.summe),
    freiMonat: zuEuro(frei),
    freiJahr: zuEuro(frei) * 12,
    unbekannt: [...f.fehlend, ...j.fehlend],
    angegeben: {
      von: f.gesetzt + j.gesetzt,
      moeglich: Object.keys(FIX_NAMEN).length + Object.keys(JOB_NAMEN).length,
    },
  };
}

export interface Vergleich {
  /** Positiv heisst: die neue Stelle lässt mehr übrig. */
  nettoUnterschiedMonat: number;
  jobkostenUnterschiedMonat: number;
  freiUnterschiedMonat: number;
  freiUnterschiedJahr: number;
  /**
   * Trägt der Vergleich überhaupt?
   *
   * Fehlen auf einer Seite Posten, die auf der anderen gesetzt sind,
   * vergleicht man Ungleiches. Die Zahl steht dann trotzdem da — aber
   * mit dieser Warnung daneben.
   */
  vergleichbar: boolean;
  hinweis: string | null;
}

/**
 * Zwei Stellen nebeneinander.
 *
 * Die Fixkosten bleiben bewusst aussen vor: Miete und Versicherungen
 * ändern sich durch einen Stellenwechsel nicht. Was sich ändert, ist
 * das Netto und das, was die Stelle selbst kostet — und genau diese
 * Differenz ist die Antwort auf „lohnt sich das".
 */
export function vergleiche(
  neu: { nettoMonat: number; jobkosten?: Jobkosten },
  aktuell: { nettoMonat: number; jobkosten?: Jobkosten },
): Vergleich {
  const jNeu = summiere(neu.jobkosten ?? {}, JOB_NAMEN);
  const jAlt = summiere(aktuell.jobkosten ?? {}, JOB_NAMEN);

  const nettoDiff = zuEuro(minus(ausEuro(neu.nettoMonat), ausEuro(aktuell.nettoMonat)));
  const kostenDiff = zuEuro(minus(jNeu.summe, jAlt.summe));
  const freiDiff = nettoDiff - kostenDiff;

  /*
   * Ungleich gefüllte Seiten machen den Vergleich schief.
   *
   * Wer für die neue Stelle Pendelkosten einträgt und für die aktuelle
   * nicht, sieht die neue schlechter aussehen, als sie ist — und die
   * Zahl darunter behauptet trotzdem eine Differenz.
   */
  const vergleichbar = jNeu.gesetzt === jAlt.gesetzt;

  return {
    nettoUnterschiedMonat: nettoDiff,
    jobkostenUnterschiedMonat: kostenDiff,
    freiUnterschiedMonat: freiDiff,
    freiUnterschiedJahr: freiDiff * 12,
    vergleichbar,
    hinweis: vergleichbar
      ? null
      : "Für die beiden Stellen sind unterschiedlich viele Kostenposten angegeben. Der Unterschied ist deshalb nur eine grobe Richtung.",
  };
}
