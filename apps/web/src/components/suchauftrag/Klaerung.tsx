"use client";

import { useState, useTransition } from "react";
import { MessageCircleQuestion } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { klaerungBeantworten } from "@/lib/suchauftrag/aktionen";
import type { Klaerungsfrage } from "@paycheck/matching";

/**
 * Die Frage, die aus einem Muster entsteht.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum gefragt und nicht gefiltert wird
 * ══════════════════════════════════════════════════════════════
 *
 * Aus sieben Ablehnungen wegen Kundenkontakt wird kein Filter. Ein
 * System, das aus beobachtetem Verhalten stillschweigend Regeln
 * macht, erklärt einen Menschen für festgelegt — und er kann es nicht
 * widerrufen, weil er nie etwas gesagt hat. Er merkt nur, dass
 * bestimmte Stellen nicht mehr kommen.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum beide Antworten gleichwertig aussehen
 * ══════════════════════════════════════════════════════════════
 *
 * „Ja, generell" hervorzuheben wäre eine Empfehlung. Die Frage soll
 * aber offen sein: Beide Antworten sind plausibel, und die zweite
 * kommt in der Praxis oft genug vor, dass sie kein Nebenausgang sein
 * darf.
 */
export function Klaerung({ frage }: { frage: Klaerungsfrage }) {
  const [laeuft, starten] = useTransition();
  const [erledigt, setErledigt] = useState<string | null>(null);

  if (erledigt) {
    return (
      <Card>
        <p className="text-sm leading-relaxed text-ink-2">{erledigt}</p>
      </Card>
    );
  }

  const antworten = (art: "generell" | "diese_stellen", danach: string) =>
    starten(async () => {
      await klaerungBeantworten(frage.grund, art);
      setErledigt(danach);
    });

  return (
    <Card>
      <div className="grid gap-3">
        <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
          <MessageCircleQuestion aria-hidden className="size-4 text-ink-3" />
          Eine Frage dazu
        </h3>
        <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">{frage.frage}</p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            disabled={laeuft}
            onClick={() =>
              antworten(
                "generell",
                "Verstanden. Ich gewichte solche Stellen künftig niedriger — ausschliessen tue ich sie nicht, dafür müsstest du es als Bedingung setzen.",
              )
            }
          >
            Passt generell nicht
          </Button>
          <Button
            variant="ghost"
            disabled={laeuft}
            onClick={() => antworten("diese_stellen", "Gut, dann lasse ich es beim Einzelfall.")}
          >
            War nur bei diesen Stellen so
          </Button>
        </div>
      </div>
    </Card>
  );
}
