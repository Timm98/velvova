import { inhaltskennung } from "./inhaltskennung.ts";

/**
 * Welche Vermutungen noch auf ein Urteil warten.
 *
 * Drei Wege, die ein Mensch gewählt haben kann, und einer, den er nicht
 * wählen musste:
 *
 *   bestätigt  → steht jetzt unter den belegten Fakten.
 *   abgelehnt  → wurde bestritten.
 *   verworfen  → wurde weggelegt, ohne Urteil.
 *   INHALT schon erledigt → kommt nicht wieder.
 *
 * Der letzte Punkt war der Fehler. Nina leitet dieselbe Vermutung aus
 * der nächsten Nachricht erneut ab — neue Zeile, neue Kennung. Weil die
 * Ablehnung an der Kennung hing, war die neue Zeile unbelastet, und für
 * den Menschen sah es aus, als bewirke das Ablehnen nichts.
 *
 * Der Hash wird hier gerechnet und nicht aus der Spalte gelesen: die
 * Spalte kann veralten, weil `editEvidence` die Aussage ändert und den
 * Hash stehen lässt. Eine bearbeitete Erkenntnis würde dann gegen ihren
 * früheren Wortlaut geprüft und im schlimmsten Fall unterdrückt,
 * obwohl sie inzwischen etwas anderes sagt.
 *
 * Eigene Datei und kein Block im Rumpf von `interview.ts`: sie trägt die
 * Regel, an der sich entscheidet, ob eine weggeklickte Aussage
 * wiederkommt — und die gehört geprüft, nicht in einen
 * 60-Zeilen-Rückgabewert eingebettet.
 *
 * Dass es eine eigene DATEI sein muss und nicht nur eine eigene
 * Funktion, hat `interview.ts` selbst entschieden: die Datei trägt
 * `"use server"`, und dort muss jeder Export eine asynchrone Server
 * Action sein. Eine gewöhnliche Funktion daneben zu stellen bricht den
 * Build — und zwar erst dort. Weder der Typprüfer noch die Unit-Tests
 * haben es gesehen.
 */
export function offeneErkenntnisse(
  evidence: { id: string; statement: string; userConfirmed: boolean; userRejected: boolean; dismissedAt: Date | null }[],
): { id: string; statement: string }[] {
  const kennung = (e: { statement: string }) => inhaltskennung(e.statement);
  const erledigteInhalte = new Set(
    evidence.filter((e) => e.userRejected || e.dismissedAt !== null).map(kennung),
  );
  return evidence
    .filter(
      (e) =>
        !e.userConfirmed &&
        !e.userRejected &&
        e.dismissedAt === null &&
        !erledigteInhalte.has(kennung(e)),
    )
    .map((e) => ({ id: e.id, statement: e.statement }));
}
