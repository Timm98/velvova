/**
 * Was an einer Stelle offen ist, und was zwei Stellen unterscheidet.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das ohne Modell geht
 * ══════════════════════════════════════════════════════════════
 *
 * Weil die Angaben strukturiert vorliegen. Ob eine Anzeige ein Gehalt
 * nennt, steht in einer Spalte; ob sie etwas zur Schichtarbeit sagt,
 * auch. Ein Sprachmodell zu fragen, was fehlt, hiesse, eine Auskunft
 * zu erfinden, die die Datenbank sicher weiss.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum eine fehlende Angabe kein Vorwurf ist
 * ══════════════════════════════════════════════════════════════
 *
 * „Diese Anzeige nennt kein Gehalt" ist eine Tatsache. „Das Gehalt
 * ist wahrscheinlich schlecht" wäre eine Unterstellung gegenüber
 * einem Arbeitgeber, den wir nicht kennen — und für die Person eine
 * Behauptung, die sie beim Vorstellungsgespräch nicht halten kann.
 *
 * Deshalb steht hier nur, was zu klären ist, und nie, was es
 * bedeuten könnte.
 */

export interface Stellenangabenkurz {
  jobId: string;
  titel: string;
  arbeitgeber: string | null;
  ort: string | null;
  entfernungKm: number | null;
  gehaltMin: number | null;
  gehaltMax: number | null;
  gehaltGenannt: boolean;
  vertragsform: string | null;
  wochenstunden: number | null;
  arbeitsmodell: string | null;
  remoteAnteil: number | null;
  schichtarbeit: boolean | null;
  erfahrungsniveau: string | null;
}

export interface OffeneFrage {
  /** Der Schlüssel, damit dieselbe Frage nicht zweimal entsteht. */
  schluessel: string;
  /** Die Frage, so wie die Person sie stellen würde. */
  frage: string;
}

/**
 * Die Fragen, die eine Anzeige offen lässt.
 *
 * ── Warum höchstens vier ──────────────────────────────────────
 *
 * Eine Liste mit zwölf offenen Punkten liest niemand, und sie sagt
 * am Ende dasselbe wie „diese Anzeige ist dünn". Vier sind das, was
 * jemand vor einem Gespräch tatsächlich abarbeitet.
 */
export const FRAGEN_MAX = 4;

export function offeneFragen(s: Stellenangabenkurz): OffeneFrage[] {
  const fragen: OffeneFrage[] = [];

  if (!s.gehaltGenannt || (s.gehaltMin === null && s.gehaltMax === null))
    fragen.push({
      schluessel: "gehalt",
      frage: "Was verdient man auf dieser Stelle?",
    });
  else if (s.gehaltMin !== null && s.gehaltMax !== null && s.gehaltMax > s.gehaltMin * 1.4)
    /*
     * Eine sehr weite Spanne ist keine Angabe, sondern eine
     * Ankündigung. Zwischen 40.000 und 70.000 liegt ein anderes Leben.
     */
    fragen.push({
      schluessel: "gehaltsspanne",
      frage: "Die Spanne ist weit — wovon hängt es ab, wo man darin landet?",
    });

  if (s.wochenstunden === null)
    fragen.push({ schluessel: "stunden", frage: "Wie viele Stunden pro Woche sind das?" });

  if (s.schichtarbeit === null)
    fragen.push({
      schluessel: "schicht",
      frage: "Gibt es Schicht- oder Wochenendarbeit?",
    });

  /*
   * Bei „hybrid" fehlt die eigentliche Auskunft fast immer: wie oft.
   * Zwischen einem Bürotag im Monat und vier in der Woche liegt der
   * Unterschied zwischen umziehen und nicht umziehen.
   */
  if (s.arbeitsmodell === "hybrid" && s.remoteAnteil === null)
    fragen.push({
      schluessel: "buerotage",
      frage: "Wie oft muss man ins Büro?",
    });
  else if (s.arbeitsmodell === null)
    fragen.push({
      schluessel: "arbeitsmodell",
      frage: "Arbeitet man vor Ort, hybrid oder ortsunabhängig?",
    });

  if (s.vertragsform === null)
    fragen.push({ schluessel: "vertrag", frage: "Ist die Stelle unbefristet?" });

  return fragen.slice(0, FRAGEN_MAX);
}

/* ═══════════════════════════════════════════════════════════════
   Vergleich
   ═══════════════════════════════════════════════════════════════ */

export interface Vergleichszeile {
  /** Das Merkmal, in der Sprache der Person. */
  merkmal: string;
  /** Je Stelle der Wert — `null` heisst: die Anzeige sagt nichts. */
  werte: (string | null)[];
  /** Ob sich die Stellen hier unterscheiden. */
  unterschiedlich: boolean;
}

export interface Vergleich {
  jobIds: string[];
  titel: string[];
  zeilen: Vergleichszeile[];
  /** Die Merkmale, in denen sie sich unterscheiden — das Interessante. */
  unterschiede: string[];
  /** Was bei mindestens einer Stelle offen ist. */
  offen: string[];
}

function gehaltstext(s: Stellenangabenkurz): string | null {
  if (!s.gehaltGenannt) return null;
  const eur = (n: number) => `${Math.round(n).toLocaleString("de-DE")} €`;
  if (s.gehaltMin !== null && s.gehaltMax !== null && s.gehaltMin !== s.gehaltMax)
    return `${eur(s.gehaltMin)} – ${eur(s.gehaltMax)}`;
  const einer = s.gehaltMin ?? s.gehaltMax;
  return einer === null ? null : `ab ${eur(einer)}`;
}

const MODELLWORT: Record<string, string> = {
  on_site: "vor Ort",
  hybrid: "hybrid",
  remote: "ortsunabhängig",
};

const VERTRAGSWORT: Record<string, string> = {
  permanent: "unbefristet",
  fixed_term: "befristet",
  temp_agency: "Zeitarbeit",
  freelance: "freie Mitarbeit",
  internship: "Praktikum",
  apprenticeship: "Ausbildung",
  working_student: "Werkstudent",
};

/**
 * Zwei oder mehr Stellen nebeneinander.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum `null` sichtbar bleibt
 * ══════════════════════════════════════════════════════════════
 *
 * Eine Vergleichstabelle mit leeren Zellen sieht unfertig aus, und
 * die Versuchung ist gross, sie mit einem Strich oder einem
 * Schätzwert zu füllen.
 *
 * Aber „diese Anzeige sagt nichts zum Gehalt" ist beim Vergleich
 * zweier Stellen die wichtigste Auskunft überhaupt: Sie ist der
 * Grund, warum man die eine nicht mit der anderen vergleichen kann.
 * Sie zu verstecken hiesse, den Vergleich vollständiger aussehen zu
 * lassen, als er ist.
 */
export function vergleichBauen(stellen: readonly Stellenangabenkurz[]): Vergleich | null {
  if (stellen.length < 2) return null;

  const merkmale: { merkmal: string; wert: (s: Stellenangabenkurz) => string | null }[] = [
    { merkmal: "Gehalt", wert: gehaltstext },
    {
      merkmal: "Entfernung",
      wert: (s) => (s.entfernungKm === null ? null : `${Math.round(s.entfernungKm)} km Luftlinie`),
    },
    { merkmal: "Ort", wert: (s) => s.ort },
    {
      merkmal: "Arbeitsmodell",
      wert: (s) => (s.arbeitsmodell === null ? null : (MODELLWORT[s.arbeitsmodell] ?? s.arbeitsmodell)),
    },
    {
      merkmal: "Vertrag",
      wert: (s) => (s.vertragsform === null ? null : (VERTRAGSWORT[s.vertragsform] ?? s.vertragsform)),
    },
    {
      merkmal: "Wochenstunden",
      wert: (s) => (s.wochenstunden === null ? null : `${s.wochenstunden} h`),
    },
    {
      merkmal: "Schichtarbeit",
      wert: (s) => (s.schichtarbeit === null ? null : s.schichtarbeit ? "ja" : "nein"),
    },
    { merkmal: "Erfahrungsstufe", wert: (s) => s.erfahrungsniveau },
  ];

  const zeilen: Vergleichszeile[] = merkmale.map(({ merkmal, wert }) => {
    const werte = stellen.map(wert);
    const bekannt = werte.filter((w): w is string => w !== null);
    return {
      merkmal,
      werte,
      /*
       * Unterschiedlich heisst: mindestens zwei bekannte Werte, und
       * die sind verschieden. Ein bekannter Wert gegen eine Lücke ist
       * kein Unterschied zwischen den Stellen — es ist eine Lücke.
       */
      unterschiedlich: bekannt.length >= 2 && new Set(bekannt).size > 1,
    };
  });

  return {
    jobIds: stellen.map((s) => s.jobId),
    titel: stellen.map((s) => s.titel),
    zeilen,
    unterschiede: zeilen.filter((z) => z.unterschiedlich).map((z) => z.merkmal),
    offen: zeilen.filter((z) => z.werte.some((w) => w === null)).map((z) => z.merkmal),
  };
}
