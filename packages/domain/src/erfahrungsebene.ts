/**
 * Auf welcher Ebene Erfahrungen erhoben wurden.
 *
 * ── Warum das mitgezeigt werden muss ──────────────────────────
 *
 * „Vier Menschen sagen, es geht respektvoll zu" bedeutet etwas völlig
 * anderes, je nachdem, ob sie bei DIESEM Arbeitgeber waren oder
 * irgendwo in diesem Beruf. Ohne die Ebene liest man das Zweite als
 * das Erste — und das ist die stillste Art, jemanden in die Irre zu
 * führen.
 *
 * ── Warum hier und nicht neben der Abfrage ────────────────────
 *
 * Die Abfrage steht in einer `"use server"`-Datei, und dort darf nur
 * Asynchrones exportiert werden. Ein Textwörterbuch gehört ohnehin
 * nicht in eine Serveraktion — es ist Vokabular, kein Vorgang.
 */

export const ERFAHRUNGSEBENEN = ["stelle", "arbeitgeber", "beruf"] as const;
export type Erfahrungsebene = (typeof ERFAHRUNGSEBENEN)[number];

export const EBENENTEXT: Record<Erfahrungsebene, string> = {
  stelle: "zu genau dieser Stelle",
  arbeitgeber: "zu dieser Rolle bei diesem Arbeitgeber",
  beruf: "zu dieser Berufsgruppe allgemein",
};

/**
 * Wie belastbar eine Ebene ist.
 *
 * Die Stelle sagt am meisten und hat am seltensten genug Stimmen; die
 * Berufsgruppe hat am ehesten Daten und sagt am wenigsten über diesen
 * einen Arbeitsplatz. Beides gehört nebeneinander genannt.
 */
export function ebenenkonfidenz(e: Erfahrungsebene): "hoch" | "mittel" | "gering" {
  if (e === "stelle") return "hoch";
  if (e === "arbeitgeber") return "mittel";
  return "gering";
}
