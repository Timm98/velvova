import { headers } from "next/headers";
import { mondayLink } from "./domaenen";

/**
 * Der Link auf die Anwendung, vom aktuellen Host aus gesehen.
 *
 * Für Serverkomponenten. Sie kennen den Host aus den Kopfzeilen der
 * Anfrage — und nur damit lässt sich entscheiden, ob ein absoluter
 * Link richtig ist.
 *
 * ── Warum es keine Fassung für Client-Bauteile gibt ─────────────
 *
 * Weil sie keine bräuchte. Ein relativer Pfad ist überall richtig:
 * Die Weiche in der Middleware leitet ihn von der öffentlichen Seite
 * an die Anwendung weiter. Der absolute Link spart genau einen
 * Sprung — und dafür in jedem Client-Bauteil den Host zu ermitteln,
 * mit einem Wert, der beim ersten Zeichnen noch nicht feststeht,
 * wäre viel Aufwand für wenig.
 *
 * Wo es zählt — die Einstiege auf der öffentlichen Seite —, sind die
 * Bauteile ohnehin serverseitig.
 */
export async function mondayZiel(pfad = "/app/monday"): Promise<string> {
  try {
    return mondayLink(pfad, (await headers()).get("host"));
  } catch {
    /* Ausserhalb einer Anfrage — dann relativ, und das stimmt. */
    return pfad;
  }
}
