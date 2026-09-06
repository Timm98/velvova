/**
 * Die Stufen einer Bewerbung.
 *
 * Eigene Datei, weil `bewerbungen.ts` mit `"use server"` beginnt und
 * dort nur asynchrone Funktionen stehen dürfen — ein exportiertes Objekt
 * daneben bricht den Build. Und zwar erst im Build: weder der Typprüfer
 * noch die Unit-Tests sehen es. Dieselbe Falle wie bei
 * `payroll/angaben.ts`.
 */

export const STUFEN = [
  { key: "new", label: "Neu" },
  { key: "screening", label: "Sichtung" },
  { key: "interview", label: "Gespräch" },
  { key: "offer", label: "Angebot" },
  { key: "hired", label: "Eingestellt" },
  /*
   * „Abgesagt" steht am Ende und ist eine Stufe wie jede andere.
   *
   * Kein eigener Papierkorb: Eine Absage ist Teil des Verlaufs, nicht
   * sein Abbruch. Wer sie wegräumt, verliert die Auskunft, warum
   * abgesagt wurde — und das ist genau die, die in drei Wochen jemand
   * braucht.
   */
  { key: "rejected", label: "Abgesagt" },
] as const;

export type Stufe = (typeof STUFEN)[number]["key"];

export const STUFENNAME: Record<Stufe, string> = Object.fromEntries(
  STUFEN.map((s) => [s.key, s.label]),
) as Record<Stufe, string>;
