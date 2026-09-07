import { redirect } from "next/navigation";

/**
 * „Bevor wir anfangen" gibt es nicht mehr.
 *
 * ══════════════════════════════════════════════════════════════
 * Was hier stand und warum es weg ist
 * ══════════════════════════════════════════════════════════════
 *
 * Eine Seite mit Sprache, Land, Standort, Arbeitsmodell, einer
 * Karriereprofil-Pflicht und vier weiteren Einwilligungshaken — als
 * erster Bildschirm nach der Bestätigung. Wer sie öffnete, sah eine
 * Liste von Erlaubnissen für Funktionen, die er noch nie gesehen
 * hatte.
 *
 * Eine Einwilligung ohne Zusammenhang ist keine Entscheidung, sondern
 * eine Hürde. Man setzt die Haken, um weiterzukommen — und danach
 * steht im Protokoll eine Zustimmung, die niemand gelesen hat.
 *
 * Was daraus geworden ist:
 *
 *   • Standort und Arbeitsmodell fragt Monday im Gespräch, wo sie
 *     hingehören.
 *   • Lebenslauf, Dokumente, Website-Analyse, Aufzeichnung werden im
 *     Moment ihrer Nutzung gefragt — mit Kontext.
 *   • Sprache und Wohnort stehen weiterhin auf der neuen Seite, jetzt
 *     aber mit allen Ländern statt dreien.
 *   • Was Monday im Hintergrund tun darf, ist von einer Hakenliste zu
 *     drei erklärten Stufen geworden.
 *
 * ── Warum eine Weiterleitung und keine gelöschte Datei ────────
 *
 * Der Pfad steht an mehreren Stellen: in `entryRoute`, in älteren
 * Lesezeichen, im Ziel nach der Anmeldung. Dasselbe Vorgehen wie bei
 * `/business/bestaetigen` und `/business/einrichten`, die aus
 * denselben Gründen hier liegen.
 */
export default function SetupWeiterleitung() {
  redirect("/monday-einrichten");
}
