"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { stelleAblehnen } from "@/lib/jobActions";
import { ABLEHNUNGSGRUENDE } from "@/lib/nina/musterregeln";

/**
 * Eine Stelle ablegen.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das Ablegen zwei Stufen hat
 * ══════════════════════════════════════════════════════════════
 *
 * Ein Klick legt die Stelle ab. Erst danach fragt die Oberfläche nach
 * dem Grund, und die Antwort ist freiwillig.
 *
 * Die Reihenfolge ist der Punkt. Ein Dialog, der vor dem Ablegen einen
 * Grund verlangt, macht aus einer Nebensache eine Unterbrechung — und
 * wer schnell durch eine Liste geht, klickt dann irgendetwas an.
 * Daraus lernt Monday Muster, die es nie gab.
 *
 * ══════════════════════════════════════════════════════════════
 * Was mit dem Grund passiert
 * ══════════════════════════════════════════════════════════════
 *
 * Er wird gezählt, nicht angewendet. Häuft sich derselbe Grund, stellt
 * Monday eine Frage — sie setzt keinen Filter. Der Unterschied ist, ob
 * Stellen verschwinden, weil jemand das entschieden hat, oder weil ein
 * Zähler eine Schwelle überschritten hat.
 */
export function StelleAblegen({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [abgelegt, setAbgelegt] = useState(false);
  const [frage, setFrage] = useState<string | null>(null);

  const ablegen = (grund: string | null) => {
    setAbgelegt(true);
    startTransition(async () => {
      const r = await stelleAblehnen(jobId, grund);
      if (r.frage) setFrage(r.frage);
      /*
       * Erst nach dem Grund neu laden.
       *
       * Ein sofortiges `router.refresh()` risse die Grundauswahl weg,
       * bevor jemand sie lesen konnte — die Stelle wäre abgelegt und
       * die Frage nach dem Warum nie gestellt.
       */
      if (grund) router.refresh();
    });
  };

  if (frage) {
    return (
      <p className="rounded-[10px] border border-line-3 px-3 py-2.5 text-sm leading-relaxed text-ink-2">
        {frage}
      </p>
    );
  }

  if (abgelegt) {
    return (
      <div className="grid gap-2">
        <p className="text-sm text-ink-2">Abgelegt. Magst du sagen, woran es lag?</p>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(ABLEHNUNGSGRUENDE).map(([schluessel, { label }]) => (
            <button
              key={schluessel}
              type="button"
              disabled={pending}
              onClick={() => ablegen(schluessel)}
              className="min-h-8 rounded-(--radius-pill) border border-line-3 px-3 text-xs text-ink-2 transition-colors hover:border-line hover:text-ink disabled:opacity-50"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => ablegen(null)}
      className="inline-flex min-h-6 items-center gap-1.5 self-start text-sm text-ink-2 underline underline-offset-[3px] transition-colors hover:text-ink disabled:opacity-50"
    >
      <X className="size-3.5" strokeWidth={1.9} />
      Passt nicht
    </button>
  );
}
