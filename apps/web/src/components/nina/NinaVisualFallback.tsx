"use client";

import { NinaSignal, type NinaState } from "./NinaSignal";
import type { NinaVisualState } from "./NinaProvider";

/**
 * Monday ohne 3D.
 *
 * Drei Wege führen hierher, und alle drei sind normal — keiner ist ein
 * Absturz:
 *
 *   **Das Modell lädt noch.** 12,4 MB brauchen auf einer schlechten
 *   Verbindung Sekunden. Statt einer leeren Fläche mit Ladekringel
 *   steht hier von der ersten Sekunde an ein vollständiges Monday-Bild.
 *
 *   **Der Browser kann kein WebGL.** Ältere Geräte, abgeschaltete
 *   Hardwarebeschleunigung, Fernwartungssitzungen, manche
 *   Unternehmensrichtlinien.
 *
 *   **Das Laden ist fehlgeschlagen.** Netzwerk weg, Datei kaputt, CSP
 *   dazwischen. Der technische Grund geht ins Protokoll, nicht auf den
 *   Bildschirm.
 *
 * Wichtig ist, was hier NICHT steht: keine Fehlermeldung, kein
 * „3D nicht verfügbar", kein leerer Rahmen. Monday ist da und
 * ansprechbar; dass sie gerade flach ist statt räumlich, ändert nichts
 * daran, was sie kann. Ein Hinweis darauf wäre eine Entschuldigung für
 * ein Problem, das die Person gar nicht hat.
 *
 * Dieselbe Formsprache und dieselben Zustände wie das Signal im Header:
 * wer zwischen den Seiten wechselt, sieht kein anderes Produkt.
 */

/**
 * Sechs Produktzustände auf vier Signalzustände.
 *
 * `success` und `listening` sind beide „aktiv": das Signal hat kein
 * eigenes Bild dafür, und eines zu erfinden wäre eine Aussage über
 * etwas, das es nicht unterscheidet. `error` wird bewusst zu `idle` —
 * Monday ist ruhig, nicht kaputt. Das rote Blinken gehört zur Meldung im
 * Gespräch, nicht zum Bild einer Person.
 */
const SIGNAL_FÜR_ZUSTAND: Record<NinaVisualState, NinaState> = {
  idle: "idle",
  thinking: "thinking",
  speaking: "speaking",
  listening: "active",
  success: "active",
  error: "idle",
};

export function NinaVisualFallback({
  state,
  size = "xl",
}: {
  state: NinaVisualState;
  size?: "lg" | "xl" | "hero";
}) {
  return (
    <div className="grid h-full w-full place-items-center">
      <NinaSignal size={size} state={SIGNAL_FÜR_ZUSTAND[state]} />
    </div>
  );
}
