"use client";

import { Component, type ReactNode } from "react";

/**
 * Ein Block, der scheitern darf, ohne die Seite mitzunehmen.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum es das braucht
 * ══════════════════════════════════════════════════════════════
 *
 * In der rechten Spalte der Stellenliste stehen Bausteine, die
 * rechnen und dabei fremde Dienste befragen — Ortsauflösung für den
 * Arbeitsweg, Steuerlogik für das Netto. Bricht einer davon, riss er
 * bisher die ganze Spalte mit: Man sah nur noch die Liste links, und
 * nichts sagte, warum.
 *
 * Eine Fehlergrenze macht daraus einen lokalen Ausfall. Die Stelle
 * bleibt lesbar, ein Satz sagt, was fehlt, und alles andere steht
 * weiter da.
 *
 * ── Warum eine Klasse ─────────────────────────────────────────
 *
 * React fängt Renderfehler ausschliesslich über `componentDidCatch`
 * beziehungsweise `getDerivedStateFromError`, und beides gibt es nur
 * in Klassenkomponenten. Das ist kein Stilbruch, sondern die einzige
 * Bauform, die diese Aufgabe erfüllt.
 *
 * ── Was hier NICHT passiert ───────────────────────────────────
 *
 * Kein stilles Verschlucken. Der Fehler geht in die Konsole, damit er
 * beim Suchen auffindbar bleibt — eine Grenze, die Fehler versteckt,
 * verwandelt einen sichtbaren Ausfall in einen unsichtbaren.
 */
export class Fehlergrenze extends Component<
  { children: ReactNode; ersatz: ReactNode; name: string },
  { gescheitert: boolean }
> {
  override state = { gescheitert: false };

  static getDerivedStateFromError() {
    return { gescheitert: true };
  }

  override componentDidCatch(fehler: unknown) {
    console.error(`[fehlergrenze] ${this.props.name}:`, fehler);
  }

  override render() {
    return this.state.gescheitert ? this.props.ersatz : this.props.children;
  }
}
