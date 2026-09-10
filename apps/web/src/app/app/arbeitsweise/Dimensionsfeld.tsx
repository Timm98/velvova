"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import {
  aussageZuruecknehmen,
  dimensionSpeichern,
  type Aussage,
  type Speicherlage,
} from "@/lib/arbeitsweise";
import { TEXTE, type Dimension } from "@paycheck/domain";

/**
 * Eine Dimension: die Frage, was schon dasteht, ein Feld zum Ergänzen.
 *
 * ── Warum das Ausgeschlossene stehen bleibt ─────────────────────
 *
 * Wer erzählt, warum er keine Nachtschicht mehr kann, hat einen Grund
 * genannt, der ihm gehört. Ihn stillschweigend zu schlucken sieht aus
 * wie ein Fehler — und beim nächsten Mal schreibt er ihn wieder. Hier
 * steht, warum er nicht gespeichert wird und was stattdessen hilft.
 */
export function Dimensionsfeld({
  dimension,
  aussagen,
}: {
  dimension: Dimension;
  aussagen: Aussage[];
}) {
  const [text, setText] = useState("");
  const [lage, setLage] = useState<Speicherlage | null>(null);
  const [laeuft, starten] = useTransition();
  const t = TEXTE[dimension];

  function speichern() {
    starten(async () => {
      const a = await dimensionSpeichern(dimension, text);
      setLage(a);
      if (a.art === "gespeichert") setText("");
    });
  }

  return (
    <section className="grid gap-3 rounded-(--radius-lg) border border-line bg-raised p-5">
      <div className="grid gap-1">
        <h2 className="text-[16px] font-semibold text-ink">{t.ueberschrift}</h2>
        <p className="max-w-[var(--measure)] text-[14.5px] leading-relaxed text-ink-2">{t.frage}</p>
        <p className="max-w-[var(--measure)] text-2xs leading-relaxed text-ink-3">{t.nachfrage}</p>
      </div>

      {aussagen.length > 0 && (
        <ul className="grid gap-1.5 border-t border-line pt-3">
          {aussagen.map((a) => (
            <li key={a.id} className="flex items-start justify-between gap-3">
              <span className="text-[14.5px] leading-relaxed text-ink">{a.text}</span>
              <button
                type="button"
                onClick={() => starten(async () => void (await aussageZuruecknehmen(a.id)))}
                disabled={laeuft}
                aria-label="Zurücknehmen"
                title="Zurücknehmen"
                className="mt-0.5 shrink-0 text-ink-3 transition-colors hover:text-critical"
              >
                <X className="size-4" strokeWidth={1.8} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-2 border-t border-line pt-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          disabled={laeuft}
          placeholder="Eine Zeile je Gedanke. An einem Beispiel aus deinem Arbeitsalltag."
          className="w-full resize-y rounded-(--radius-sm) border border-line bg-surface px-3 py-2 text-[15px] leading-relaxed text-ink outline-none placeholder:text-ink-3 focus-visible:border-accent"
        />
        <button
          type="button"
          onClick={speichern}
          disabled={laeuft || text.trim().length < 12}
          className="inline-flex min-h-10 w-fit items-center rounded-(--radius-control) border border-line px-4 text-[14px] font-medium text-ink transition-colors hover:bg-soft disabled:opacity-60"
        >
          {laeuft ? "…" : "Dazuschreiben"}
        </button>
      </div>

      {lage?.art === "zu_duenn" && (
        <p className="text-[14px] leading-relaxed text-ink-2">{lage.hinweis}</p>
      )}

      {lage && lage.ausgeschlossen.length > 0 && (
        <div className="grid gap-2 border-t border-line pt-3">
          {lage.ausgeschlossen.map((a) => (
            <div key={a.aussage} className="grid gap-1">
              <span className="text-[14px] text-ink-3 line-through decoration-ink-3/40">
                {a.aussage}
              </span>
              <span className="text-2xs leading-relaxed text-critical">{a.erklaerung}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
