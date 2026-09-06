/**
 * Welche Art von Beschäftigung eine Stelle ist.
 *
 * ── Warum das eine eigene Einteilung braucht ──────────────────
 *
 * `beschaeftigungsform.ts` beantwortet genau eine Frage: Darf diese
 * Stelle eine Vollzeit-Gehaltsspanne bekommen? Dafür genügt „ja oder
 * nein", und alles Studentische landet in einem Topf.
 *
 * Zum Auswählen genügt das nicht. Wer ein Praktikum sucht, sucht kein
 * Minijob, und wer eine Ausbildung sucht, will keine Trainee-Stelle.
 * Ein Filter, der beides vermischt, ist kein Filter.
 *
 * ── Warum nach dem Titel und nicht nach einem Feld ────────────
 *
 * Weil es das Feld nicht gibt. `contract_type` kennt befristet und
 * unbefristet, nicht „Praktikum". Die Quellen liefern die Art nur im
 * Titel — und dort steht sie fast immer, weil ein Arbeitgeber ein
 * Praktikum auch als solches ausschreiben will.
 *
 * ── Die Reihenfolge ist bedeutsam ─────────────────────────────
 *
 * „Werkstudent im Praktikumsprogramm" ist ein Werkstudium. Geprüft
 * wird deshalb von der spezifischsten Form zur allgemeinsten, und die
 * erste passende gewinnt.
 */

export const BESCHAEFTIGUNGSARTEN = [
  "werkstudium",
  "praktikum",
  "ausbildung",
  "trainee",
  "minijob",
  "regulaer",
] as const;

export type Beschaeftigungsart = (typeof BESCHAEFTIGUNGSARTEN)[number];

/**
 * Die Muster, in der Reihenfolge ihrer Prüfung.
 *
 * Zweisprachig, weil der Bestand es ist: „Working Student" ist die
 * häufigste Schreibweise für ein Werkstudium in unseren Daten — eine
 * frühere, rein deutsche Fassung liess 54 Stellen durchrutschen.
 */
const MUSTER: [Exclude<Beschaeftigungsart, "regulaer">, RegExp][] = [
  ["werkstudium", /(werkstudent|werkstudium|werkstudierend|working\s+student)/i],
  [
    "praktikum",
    /(praktikum|praktikant|\bpraktika\b|\binternship\b|\bintern\b|volontariat|volontär|bachelorand|masterand|bachelorarbeit|masterarbeit|(?:bachelor|master)[-\s]?thesis|\bthesis\b|abschlussarbeit)/i,
  ],
  [
    "ausbildung",
    /(\bausbildung\b|ausbildungsplatz|ausbildungsstelle|ausbildungs-|\bauszubildend|\bazubi\b|dual(?:es)? studium|bachelorstudium|masterstudium)/i,
  ],
  ["trainee", /trainee/i],
  ["minijob", /(\bminijob\b|geringf[üu]gig|\baushilfe\b|\bferienjob\b|\bschüler(?:job|aushilfe)?\b|\bstudentenjob\b)/i],
];

/** Die Art einer Stelle. `regulaer`, wenn nichts anderes erkennbar ist. */
export function beschaeftigungsart(titel: string): Beschaeftigungsart {
  for (const [art, muster] of MUSTER) {
    if (muster.test(titel)) return art;
  }
  return "regulaer";
}

/** Wie es in der Oberfläche heisst. */
export const ART_NAME: Record<Beschaeftigungsart, string> = {
  regulaer: "Feste Stelle",
  werkstudium: "Werkstudium",
  praktikum: "Praktikum",
  ausbildung: "Ausbildung",
  trainee: "Trainee",
  minijob: "Minijob / Aushilfe",
};

/**
 * Der erklärende Halbsatz zur Art — für die Filterleiste.
 *
 * „Praktikum" allein sagt nicht, warum daneben kein Gehalt steht. Der
 * Zusatz schon.
 */
export const ART_HINWEIS: Record<Beschaeftigungsart, string> = {
  regulaer: "Vollzeit oder Teilzeit, unbefristet oder befristet",
  werkstudium: "neben dem Studium, meist 20 Stunden",
  praktikum: "befristet, oft Teil des Studiums",
  ausbildung: "mit Berufsschule, mehrjährig",
  trainee: "Einstiegsprogramm nach dem Abschluss",
  minijob: "geringfügig, ohne Vollzeitgehalt",
};
