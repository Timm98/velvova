"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mic, Send } from "lucide-react";

/**
 * Das Eingabefeld, das immer dasteht.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum es unten steht und klein bleibt
 * ══════════════════════════════════════════════════════════════
 *
 * Es ist der Weg für alles, was in keine Ansicht passt — nicht die
 * Hauptform der Bedienung. Stünde es oben, wäre das Panel wieder ein
 * Chatfenster mit Knöpfen darunter, und die Ansichten wären das
 * Beiwerk.
 *
 * ══════════════════════════════════════════════════════════════
 * Zum Mikrofon
 * ══════════════════════════════════════════════════════════════
 *
 * Der Knopf führt in den Sprachmodus, statt hier eine zweite
 * Aufnahme zu starten. Zwei Stellen, an denen zugehört wird, wären
 * zwei Fassungen derselben Sache — und die Regel für dieses Projekt
 * lautet, dass Sprache und Text denselben Weg nehmen.
 */
export function NinaEingabe({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [text, setText] = useState("");

  const absenden = () => {
    const frage = text.trim();
    if (!frage) return;
    /*
     * Die Frage geht mit der Stellenkennung ins Gespräch.
     *
     * Ohne sie beginnt Nina auf der anderen Seite ohne Bezug, und die
     * Person müsste wiederholen, worüber sie gerade liest.
     */
    router.push(`/app/nina?job=${jobId}&frage=${encodeURIComponent(frage)}`);
  };

  return (
    /*
     * Klein und unten.
     *
     * Es ist der Weg für alles, was in keine Ansicht passt — nicht die
     * Hauptform der Bedienung. Ein grosses Feld oben machte aus dem
     * Panel wieder ein Chatfenster mit Knöpfen darunter, und die
     * Ansichten wären das Beiwerk.
     *
     * Zwei Zeilen Höhe, kleine Schrift, Knöpfe in Symbolgrösse: Es soll
     * sichtbar bereitstehen, ohne den Blick zu nehmen.
     */
    <div className="mt-1 flex items-center gap-1 rounded-(--radius-pill) border border-line-2 bg-raised px-1 py-0.5">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") absenden();
        }}
        placeholder="Frag Nina etwas zu dieser Stelle …"
        aria-label="Frage an Nina zu dieser Stelle"
        className="min-w-0 flex-1 bg-transparent px-2.5 py-1 text-[13px] outline-none placeholder:text-ink-3"
      />
      <button
        type="button"
        onClick={() => router.push(`/app/nina?job=${jobId}&modus=sprache`)}
        aria-label="Mit Nina sprechen"
        className="grid size-7 shrink-0 place-items-center rounded-full text-ink-3 transition-colors hover:bg-soft hover:text-ink-2"
      >
        <Mic aria-hidden className="size-3.5" strokeWidth={1.9} />
      </button>
      <button
        type="button"
        onClick={absenden}
        disabled={!text.trim()}
        aria-label="Frage senden"
        className="grid size-7 shrink-0 place-items-center rounded-full text-ink-3 transition-colors hover:bg-soft hover:text-ink-2 disabled:opacity-40"
      >
        <Send aria-hidden className="size-3.5" strokeWidth={1.9} />
      </button>
    </div>
  );
}
