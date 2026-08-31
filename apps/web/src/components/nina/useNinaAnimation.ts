"use client";

import { AnimationMixer, type AnimationAction, type AnimationClip, type Object3D } from "three";
import type { NinaVisualState } from "./NinaProvider";

/**
 * Zustand zu Animation.
 *
 * Die drei Clipnamen stammen aus der Datei selbst, ausgelesen mit
 * `scripts/inspect-nina-glb.mjs` — nicht aus dem Dateinamen geraten:
 *
 *   CALM      35 Kanäle
 *   Talking   35 Kanäle
 *   Thinking  27 Kanäle
 *
 * Sechs Produktzustände treffen auf drei Clips. Wo es keinen eigenen
 * gibt, läuft CALM. Eine erfundene Ersatzanimation wäre eine Aussage
 * über einen Zustand, den das Modell nicht darstellt.
 */

export const CLIP_FÜR_ZUSTAND: Record<NinaVisualState, string> = {
  idle: "CALM",
  thinking: "Thinking",
  speaking: "Talking",
  // Kein eigener Listening-Clip. CALM plus der pulsierende Lichtkreis
  // trägt den Zustand — siehe NinaVisual.
  listening: "CALM",
  success: "CALM",
  error: "CALM",
};

const ÜBERBLENDUNG = 0.3;

/**
 * Der Animationsmischer.
 *
 * Bewusst eine Klasse und kein Hook: sie lebt in einem `useRef` neben
 * der three.js-Szene und wird von `requestAnimationFrame` getaktet.
 * React sieht davon nichts — ein Zustandswechsel je Bild wäre genau
 * die Sorte Re-Render, die die Anwendung langsam gemacht hat.
 */
export class NinaAnimation {
  private readonly mixer: AnimationMixer;
  private readonly aktionen = new Map<string, AnimationAction>();
  private laufend: AnimationAction | null = null;
  private aktuellerClip: string | null = null;

  constructor(wurzel: Object3D, clips: AnimationClip[]) {
    this.mixer = new AnimationMixer(wurzel);
    for (const clip of clips) {
      const aktion = this.mixer.clipAction(clip);
      aktion.enabled = true;
      this.aktionen.set(clip.name, aktion);
    }
  }

  /** Welche Clips die Datei wirklich enthält. Für Prüfungen und Protokoll. */
  get verfügbareClips(): string[] {
    return [...this.aktionen.keys()];
  }

  /**
   * Auf einen Zustand wechseln.
   *
   * Überblendet, statt umzuschalten: ein harter Wechsel springt
   * sichtbar, weil die Figur in einer anderen Haltung steht, sobald
   * Nina zu denken anfängt. Beide Aktionen laufen kurz gleichzeitig.
   */
  setzeZustand(state: NinaVisualState, sofort = false): void {
    const name = CLIP_FÜR_ZUSTAND[state];
    if (this.aktuellerClip === name) return;

    const ziel = this.aktionen.get(name);
    if (!ziel) return;

    const dauer = sofort ? 0 : ÜBERBLENDUNG;
    ziel.reset().setEffectiveWeight(1).fadeIn(dauer).play();
    this.laufend?.fadeOut(dauer);

    this.laufend = ziel;
    this.aktuellerClip = name;
  }

  tick(delta: number): void {
    this.mixer.update(delta);
  }

  entsorge(): void {
    this.mixer.stopAllAction();
    this.aktionen.clear();
    this.laufend = null;
    this.aktuellerClip = null;
  }
}
