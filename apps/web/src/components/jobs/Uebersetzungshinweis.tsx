"use client";

import { useState } from "react";
import { Anzeigentext } from "./Anzeigentext";

/**
 * Eine übersetzte Anzeige — mit dem Original eine Umschaltung entfernt.
 *
 * ── Warum der Hinweis nicht weggelassen werden darf ───────────
 *
 * Eine maschinelle Übersetzung ist eine Interpretation. „Mindestens
 * drei Jahre Erfahrung" und „three years of experience preferred"
 * unterscheiden sich, und wer sich auf eine Anzeige beruft, muss auf
 * den Text zurückkommen können, den der Arbeitgeber geschrieben hat.
 *
 * ── Warum umschalten und nicht zwei Blöcke ────────────────────
 *
 * Beides untereinander wäre die doppelte Länge für dieselbe Auskunft.
 * Die Umschaltung braucht einen Klick und behält den Platz.
 */
export function Uebersetzungshinweis({
  uebersetzt,
  original,
  ausSprache,
}: {
  uebersetzt: string;
  original: string;
  ausSprache: string;
}) {
  const [zeigeOriginal, setZeigeOriginal] = useState(false);

  const sprachname = ausSprache === "en" ? "Englisch" : ausSprache;

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="rounded-(--radius-pill) bg-inset px-2 py-0.5 abschnitts-titel text-ink-3">
          {zeigeOriginal ? `Original · ${sprachname}` : "Automatisch übersetzt"}
        </span>
        <button
          type="button"
          onClick={() => setZeigeOriginal((v) => !v)}
          className="text-sm text-accent-text underline underline-offset-[3px]"
        >
          {zeigeOriginal ? "Übersetzung anzeigen" : "Original anzeigen"}
        </button>
      </div>

      {!zeigeOriginal && (
        <p className="max-w-[var(--measure)] text-2xs leading-relaxed text-ink-3">
          Diese Anzeige ist auf {sprachname} geschrieben und maschinell übersetzt. Für Bedingungen,
          auf die du dich berufen willst, gilt das Original.
        </p>
      )}

      <Anzeigentext text={zeigeOriginal ? original : uebersetzt} />
    </div>
  );
}
