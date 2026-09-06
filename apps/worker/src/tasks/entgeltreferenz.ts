import { referenzenNachtragen, zuordnungNachtragen } from "@paycheck/jobs/entgeltreferenz";

/**
 * Die Gehalts-Referenz frisch halten.
 *
 * ── Warum das ein Worker-Auftrag ist ──────────────────────────
 *
 * Der erste Sammellauf deckte den damaligen Bestand ab. Danach kommen
 * täglich neue Anzeigen mit neuen Titeln — und für die stünde wieder
 * „zu wenige Gehaltsangaben", weil sie niemand nachgeschlagen hat. Eine
 * Abdeckung, die nur am Tag ihrer Einrichtung stimmt, ist keine.
 *
 * ── Warum das Budget so klein ist ─────────────────────────────
 *
 * Zwölf Titel und drei Berufe je Durchlauf sind bei einem Takt von
 * fünfzehn Minuten rund 1.150 Titel und 290 Berufe am Tag — mehr als
 * jeder Import an neuen Titeln bringt. Grösser zu greifen brächte
 * nichts ausser Last bei einem fremden Dienst.
 *
 * Der Auftrag ist jederzeit abbrechbar: was schon dasteht, wird beim
 * nächsten Mal übersprungen.
 */

/**
 * Beschäftigungsformen ohne Vollzeitvergleich.
 *
 * Dieselbe Sperre wie in der Weboberfläche
 * (`lib/jobs/beschaeftigungsform.ts`). Sie steht hier ein zweites Mal,
 * weil der Worker nicht in die Weboberfläche greifen soll — und
 * `beschaeftigungsform.test.ts` hält beide Fassungen aneinander.
 */
const KEIN_VOLLZEITVERGLEICH =
  /(werkstudent|werkstudium|werkstudierend|working\s+student|praktikum|praktikant|\bpraktika\b|\binternship\b|\bintern\b|\bausbildung\b|ausbildungsplatz|ausbildungsstelle|ausbildungs-|\bauszubildend|\bazubi\b|dual(?:es)? studium|bachelorstudium|masterstudium|trainee|\baushilfe\b|\bminijob\b|geringf[üu]gig|bachelorand|masterand|bachelorarbeit|masterarbeit|(?:bachelor|master)[-\s]?thesis|\bthesis\b|abschlussarbeit|\bschüler|\bferienjob\b|volontariat|volontär)/i;

const TITEL_JE_LAUF = 12;
const BERUFE_JE_LAUF = 3;

export async function runEntgeltReferenz(): Promise<{
  zugeordnet: number;
  titelGefragt: number;
  referenzen: number;
  berufeGefragt: number;
}> {
  const z = await zuordnungNachtragen(TITEL_JE_LAUF, KEIN_VOLLZEITVERGLEICH);

  /*
   * Nach einem Abbruch nicht weitermachen.
   *
   * Wenn die Jobsuche gerade 429 sagt, ist der zweite Durchgang keine
   * andere Frage an einen anderen Dienst — er ist dieselbe Last
   * nochmal.
   */
  if (z.abgebrochen) {
    return { zugeordnet: z.zugeordnet, titelGefragt: z.gefragt, referenzen: 0, berufeGefragt: 0 };
  }

  const r = await referenzenNachtragen(BERUFE_JE_LAUF);
  return {
    zugeordnet: z.zugeordnet,
    titelGefragt: z.gefragt,
    referenzen: r.geschrieben,
    berufeGefragt: r.gefragt,
  };
}
