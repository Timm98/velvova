/**
 * Welcher Beleg zählt zu welchem Profilbereich.
 *
 * Diese Datei ist bewusst KEINE Server-Aktion.
 *
 * Die Zuordnung stand zuerst in `profile.ts`. Die trägt `"use server"`,
 * und dort müssen alle Exporte asynchrone Funktionen sein — eine reine
 * Abbildung von Zeichenkette auf Bereich passt da nicht hinein. Der
 * Typecheck liess es durch, der Build nicht:
 *
 *   Error: Server Actions must be async functions.
 *
 * Getrennt ist es ohnehin richtiger: Die Zuordnung ist reine Logik,
 * ohne Datenbank und ohne Anmeldung, und lässt sich so prüfen.
 */

/**
 * Die Bereiche, aus denen sich ein tragfähiges Profil zusammensetzt.
 *
 * `location_and_logistics` steht bewusst NICHT mehr darin.
 *
 * Der Bereich war nie gefüllt: in 326 Belegen kein einziger, weder im
 * alten noch im neuen Schema. Er deckelte die Abdeckung damit
 * dauerhaft bei sechs von sieben — niemand konnte je über 86 Prozent
 * kommen, ganz gleich wie vollständig das Gespräch war. Ein Maß, das
 * seinen eigenen Höchstwert nicht erreichen kann, misst nicht.
 *
 * Ort und Pendelweg sind deshalb nicht unwichtig — sie stehen als
 * harte Bedingungen in `user_constraints` und werden dort geprüft.
 */
export const BEREICHE = [
  "experience_episodes",
  "tasks_and_energy",
  "hard_constraints",
  "work_style_and_environment",
  "values_and_motives",
  "background",
] as const;

/*
 * Zwei Benennungsschemata, ein Maß.
 *
 * In der Datenbank stehen nebeneinander:
 *
 *   interview:experience_episodes:solved_problem   (älter)
 *   nina:v3:career_evidence:current_situation      (aktuell)
 *
 * Die Abdeckung erkannte bisher nur das erste. Das zweite ist aber das
 * Schema, das die heutige Nina schreibt — und es stellt mit 180 von 326
 * Belegen die Mehrheit. Ergebnis: Wer heute ein Gespräch führte, sammelte
 * Belege, die für den Fortschritt nicht zählten. Der Balken stand still,
 * während das Gespräch lief, und niemand konnte sagen warum.
 *
 * Sichtbar wurde es an einem Verhältnis, das nicht sein kann:
 * 326 Belege, ein einziges Karriereprofil.
 */
const NINA_V3_ZU_BEREICH: Record<string, (typeof BEREICHE)[number]> = {
  career_evidence: "experience_episodes",
  constraints: "hard_constraints",
  preferred_tasks: "tasks_and_energy",
  disliked_tasks: "tasks_and_energy",
  values: "values_and_motives",
  work_style_preferences: "work_style_and_environment",
  skills: "background",
  /*
   * `goals` fehlt mit Absicht.
   *
   * Ziele sagen, wohin jemand will — nicht, was er mitbringt. Sie
   * gehören in die Suchrichtung, nicht in ein Maß dafür, wie gut wir
   * jemanden verstanden haben.
   */
};

/** Welchem Bereich zählt dieser Beleg zu? `null`, wenn keinem. */
export function bereichAus(sourceRef: string | null): (typeof BEREICHE)[number] | null {
  if (!sourceRef) return null;

  if (sourceRef.startsWith("nina:v3:")) {
    const thema = sourceRef.split(":")[2] ?? "";
    return NINA_V3_ZU_BEREICH[thema] ?? null;
  }

  return BEREICHE.find((b) => sourceRef.includes(b)) ?? null;
}
