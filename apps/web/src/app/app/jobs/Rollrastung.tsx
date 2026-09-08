"use client";

import { useEffect } from "react";

/**
 * Schaltet die Rastung ein, solange die Stellenseite offen ist.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum ein Bauteil und keine Regel in der CSS-Datei
 * ══════════════════════════════════════════════════════════════
 *
 * `scroll-snap-type` muss auf dem Element stehen, das WIRKLICH
 * rollt. Auf dieser Seite ist das das Dokument selbst — die
 * Aufteilung hat zwar eigene Rollbereiche, aber der Rest der Seite
 * hängt am Fenster.
 *
 * Eine feste Regel auf `html` würde die Rastung überall einschalten:
 * im Gespräch, in den Einstellungen, auf jeder Textseite. Dort ist
 * sie falsch — sie zöge Seiten zurück, auf denen niemand ein
 * Problem hat.
 *
 * Also wird das Merkmal gesetzt, solange diese Seite steht, und beim
 * Verlassen wieder weggenommen. Die eigentliche Regel steht in
 * `globals.css` unter `html[data-rastung]`; hier steht nur, WANN sie
 * gilt.
 *
 * ── Warum es nichts rendert ─────────────────────────────────
 *
 * Weil es nichts zu zeigen gibt. Es ist ein Schalter, kein Element —
 * und ein leeres `div` im Raster wäre eine Lücke im Abstand.
 */
export function Rollrastung() {
  useEffect(() => {
    const wurzel = document.documentElement;
    wurzel.setAttribute("data-rastung", "");
    return () => wurzel.removeAttribute("data-rastung");
  }, []);
  return null;
}
