import type { Abschnitt, Aktion, Ansicht } from "./aktionen";

/**
 * Was das Monday-Panel gerade zeigt.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum ein Stapel und kein einzelner Wert
 * ══════════════════════════════════════════════════════════════
 *
 * Der Auftrag verlangt ein „← Zurück" in jeder Unteransicht. Mit einem
 * einzelnen `ansicht`-Wert wäre Zurück immer die Übersicht — und das
 * ist falsch, sobald jemand von „Warum passt der Job" zu „Gehalt
 * prüfen" geht: Zurück soll dann zur Erklärung führen, nicht an den
 * Anfang.
 *
 * Ein Stapel beantwortet das ohne Sonderfälle.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum der Stapel begrenzt ist
 * ══════════════════════════════════════════════════════════════
 *
 * Wer zwanzig Mal hin und her wechselt, will nicht zwanzig Mal zurück.
 * Die Tiefe ist auf sechs begrenzt; darunter fällt der älteste Eintrag
 * heraus. Die Übersicht bleibt dabei immer der Boden.
 */

export const MAX_TIEFE = 6;

export type Panelzustand = {
  /** Von unten nach oben. Das letzte Element ist sichtbar. */
  stapel: Ansicht[];
  /** Die Stelle, um die es gerade geht. */
  jobId: string | null;
  /** Die zweite Stelle im Vergleich. */
  vergleichJobId: string | null;
  /**
   * Die zuvor geöffnete Stelle.
   *
   * Damit „ist der besser als der davor?" beantwortbar ist, ohne dass
   * jemand zwei Titel nennen muss. Sie wird beim Wechsel gesetzt und
   * überlebt ihn — das ist der ganze Zweck.
   */
  vorherigeJobId: string | null;
  /** Ein Abschnitt, der kurz hervorgehoben wird. */
  hervorgehoben: Abschnitt | null;
};

export const ANFANG: Panelzustand = {
  stapel: ["uebersicht"],
  jobId: null,
  vergleichJobId: null,
  vorherigeJobId: null,
  hervorgehoben: null,
};

/** Was gerade zu sehen ist. */
export function sichtbar(z: Panelzustand): Ansicht {
  return z.stapel[z.stapel.length - 1] ?? "uebersicht";
}

/** Ob ein Zurück-Weg existiert. */
export function kannZurueck(z: Panelzustand): boolean {
  return z.stapel.length > 1;
}

export type Ereignis =
  | { art: "aktion"; aktion: Aktion }
  | { art: "zurueck" }
  /** Die Person hat links eine andere Stelle angeklickt. */
  | { art: "stelle_gewechselt"; jobId: string | null }
  /** Die Hervorhebung ist abgelaufen. */
  | { art: "hervorhebung_aus" };

/**
 * Der nächste Zustand.
 *
 * Rein und ohne Nebenwirkung: Dieselbe Eingabe ergibt denselben
 * Zustand, egal ob sie aus einem Klick, aus dem Chat oder aus der
 * Spracherkennung kommt. Das ist der Punkt der ganzen Datei — sonst
 * gäbe es drei Fassungen dieser Übergänge.
 */
export function naechster(z: Panelzustand, e: Ereignis): Panelzustand {
  switch (e.art) {
    case "zurueck": {
      if (!kannZurueck(z)) return z;
      return { ...z, stapel: z.stapel.slice(0, -1), hervorgehoben: null };
    }

    case "hervorhebung_aus":
      return z.hervorgehoben === null ? z : { ...z, hervorgehoben: null };

    case "stelle_gewechselt": {
      /*
       * Beim Stellenwechsel zurück auf die Übersicht.
       *
       * Die geöffnete Gehaltsansicht gehörte zur vorigen Stelle. Sie
       * stehen zu lassen und nur die Zahlen zu tauschen wäre
       * unauffälliger und schlechter: Wer eine Stelle anklickt, will
       * die Stelle sehen, nicht eine Unteransicht, die er für die
       * vorige geöffnet hatte.
       *
       * Der Vergleich wird dabei mit verworfen — er bezog sich auf ein
       * Paar, von dem eine Hälfte nicht mehr gilt.
       */
      if (e.jobId === z.jobId) return z;
      /*
       * Die alte Stelle wird zur vorherigen, nicht vergessen.
       *
       * Ohne sie müsste jemand für „ist der besser als der davor?"
       * beide Titel nennen — und das ist genau die Art von Aufwand,
       * die eine gesprochene Frage unbrauchbar macht.
       */
      return { ...ANFANG, jobId: e.jobId, vorherigeJobId: z.jobId };
    }

    case "aktion": {
      const { name, args } = e.aktion;

      if (name === "show_panel") {
        const ziel = args.ansicht;
        /* Zweimal dieselbe Ansicht stapelt nicht — sonst braucht
           Zurück zwei Klicks für einen sichtbaren Wechsel. */
        if (sichtbar(z) === ziel) {
          return { ...z, jobId: args.jobId ?? z.jobId, hervorgehoben: null };
        }
        const stapel = [...z.stapel, ziel].slice(-MAX_TIEFE);
        return {
          ...z,
          stapel,
          jobId: args.jobId ?? z.jobId,
          hervorgehoben: null,
        };
      }

      if (name === "highlight_section") {
        /*
         * Hervorheben wechselt die Ansicht nicht.
         *
         * Der Abschnitt liegt in der MITTE, das Panel steht rechts.
         * Wer „die Arbeitszeiten sind unklar" liest und dorthin
         * springt, soll Mondays Satz weiterhin sehen — sonst verliert er
         * beim Hinsehen den Grund, warum er hinsieht.
         */
        return { ...z, hervorgehoben: args.abschnitt };
      }

      if (name === "compare_jobs") {
        const stapel =
          sichtbar(z) === "vergleich" ? z.stapel : [...z.stapel, "vergleich" as Ansicht].slice(-MAX_TIEFE);
        return {
          ...z,
          stapel,
          jobId: args.jobA,
          vergleichJobId: args.jobB,
          hervorgehoben: null,
        };
      }

      if (name === "open_job") {
        if (args.jobId === z.jobId) return z;
        return { ...ANFANG, jobId: args.jobId, vorherigeJobId: z.jobId };
      }

      /*
       * Serveraktionen ändern den Panelzustand nicht.
       *
       * Merken, Bewerbung anlegen — sie ändern Daten, nicht die
       * Ansicht. Dass hier nichts passiert, ist die richtige Antwort
       * und kein vergessener Fall: Wer nach dem Merken die Ansicht
       * wechselte, nähme der Person die Stelle weg, die sie gerade
       * gemerkt hat.
       */
      return z;
    }
  }
}
