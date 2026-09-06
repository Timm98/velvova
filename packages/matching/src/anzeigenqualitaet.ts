import type { Job } from "@paycheck/domain";

/**
 * Wie transparent die Anzeige ist — und sonst nichts.
 *
 * ══════════════════════════════════════════════════════════════
 * Der Fehler, den diese Datei behebt
 * ══════════════════════════════════════════════════════════════
 *
 * `computeJobQuality` mischte zwei Dinge in einer Zahl: `openness`
 * (was die Anzeige preisgibt, 15 % Gewicht) und sechs Dimensionen zu
 * den Arbeitsbedingungen (85 %).
 *
 * Damit ergaben eine ausführliche Anzeige mit schlechten Bedingungen
 * und eine knappe mit guten denselben Wert. Wer die Zahl liest, weiss
 * nicht, welche der beiden Aussagen er vor sich hat — und beide sind
 * für eine Entscheidung wichtig, aber verschieden.
 *
 * ══════════════════════════════════════════════════════════════
 * Sechs Punkte, gleich gewichtet
 * ══════════════════════════════════════════════════════════════
 *
 * Keine Gewichtung, weil es keine begründbare gäbe: Ob eine Anzeige
 * das Gehalt nennt, ist nicht „wichtiger" als ob sie den Arbeitsort
 * nennt — beides fehlt oder steht da. Sechs Ja-Nein-Fragen, geteilt
 * durch sechs.
 *
 * ══════════════════════════════════════════════════════════════
 * Was ein fehlender Punkt bedeutet — und was nicht
 * ══════════════════════════════════════════════════════════════
 *
 * Fehlende Angaben zählen hier als fehlende TRANSPARENZ, nicht als
 * schlechte Bedingungen. Eine Anzeige ohne Gehaltsangabe ist nicht
 * schlecht bezahlt; sie sagt es nur nicht.
 *
 * Umgekehrt gilt: Eine vollständige Anzeige ist keine gute Stelle. Sie
 * ist eine überprüfbare Stelle.
 */

export type Anzeigenpunkt = {
  key: string;
  label: string;
  erfuellt: boolean;
  /** Warum erfüllt oder warum nicht — in einem Satz. */
  satz: string;
};

export type Anzeigenqualitaet = {
  /** 0 bis 100. Immer berechenbar: Fehlen ist selbst die Antwort. */
  score: number;
  erfuellt: number;
  punkte: Anzeigenpunkt[];
  /**
   * Ob der Anzeigentext überhaupt vollständig vorliegt.
   *
   * Bei abgeschnittenem oder gar nicht importiertem Text ist ein
   * niedriger Wert ein Eingabeproblem und keine Aussage über den
   * Arbeitgeber — der Auftrag verlangt ausdrücklich, das zu trennen.
   */
  eingabeUnvollstaendig: boolean;
};

/** Unterhalb dieser Länge ist der Text vermutlich abgeschnitten. */
export const MIN_TEXTLAENGE = 200;

export function anzeigenqualitaet(
  job: Pick<
    Job,
    | "salary"
    | "coreTasks"
    | "contractType"
    | "weeklyHours"
    | "workModel"
    | "location"
    | "remotePercent"
    | "applyMethod"
    | "applyTarget"
    | "originalUrl"
    | "description"
  >,
): Anzeigenqualitaet {
  const punkte: Anzeigenpunkt[] = [
    {
      key: "verguetung",
      label: "Vergütung",
      /* Nur ein Betrag zählt. `disclosed` allein ist eine Zusage, keine
         Zahl — und eine Zusage ohne Zahl ist keine Transparenz. */
      erfuellt: job.salary.min !== null || job.salary.max !== null,
      satz:
        job.salary.min !== null || job.salary.max !== null
          ? "Die Anzeige nennt einen Betrag."
          : "Die Anzeige nennt kein Gehalt.",
    },
    {
      key: "aufgaben",
      label: "Aufgaben",
      erfuellt: (job.coreTasks?.length ?? 0) > 0,
      satz:
        (job.coreTasks?.length ?? 0) > 0
          ? "Die Anzeige beschreibt konkrete Aufgaben."
          : "Die Anzeige nennt keine konkreten Aufgaben.",
    },
    {
      key: "vertragsform",
      label: "Vertragsform",
      erfuellt: job.contractType !== null,
      satz:
        job.contractType !== null
          ? "Die Beschäftigungsform steht da."
          : "Die Beschäftigungsform bleibt offen.",
    },
    {
      key: "arbeitszeit",
      label: "Arbeitszeit",
      erfuellt: job.weeklyHours !== null,
      satz:
        job.weeklyHours !== null
          ? "Die Wochenstunden stehen da."
          : "Die Anzeige nennt keine Wochenstunden.",
    },
    {
      key: "arbeitsort",
      label: "Arbeitsort",
      /*
       * Ort ODER Remote-Regel — nicht beides.
       *
       * Eine reine Remote-Stelle hat keinen Arbeitsort im üblichen
       * Sinn; sie deswegen als intransparent zu führen wäre falsch.
       * Umgekehrt braucht eine Vor-Ort-Stelle keine Remote-Regel.
       */
      erfuellt:
        (job.location?.trim().length ?? 0) > 0 ||
        job.workModel === "remote" ||
        job.remotePercent !== null,
      satz:
        (job.location?.trim().length ?? 0) > 0 || job.workModel === "remote"
          ? "Arbeitsort oder Remote-Regelung stehen da."
          : "Weder Arbeitsort noch Remote-Regelung sind erkennbar.",
    },
    {
      key: "kontakt",
      label: "Bewerbungsweg",
      erfuellt: Boolean(job.applyTarget) || Boolean(job.originalUrl),
      satz:
        job.applyTarget || job.originalUrl
          ? "Es gibt einen erreichbaren Bewerbungsweg."
          : "Die Anzeige nennt keinen Bewerbungsweg.",
    },
  ];

  const erfuellt = punkte.filter((p) => p.erfuellt).length;

  return {
    score: Math.round((100 * erfuellt) / punkte.length),
    erfuellt,
    punkte,
    eingabeUnvollstaendig: (job.description?.length ?? 0) < MIN_TEXTLAENGE,
  };
}
