"use client";

import { useState, useTransition } from "react";
import { BELEGSTUFENTEXT, type Belegstufe } from "@paycheck/domain";
import { Card } from "@/components/ui";
import { belegTeilen } from "@/lib/belegAktionen";
import type { Beleg } from "@/lib/belege";

/**
 * Was du zeigen kannst — und was du nur behauptest.
 *
 * ── Warum die Trennung sichtbar sein muss ─────────────────────
 *
 * Ein Profil, das Beobachtetes und Behauptetes gleich darstellt, ist
 * wieder ein Lebenslauf: Alles klingt gleich sicher, also glaubt man
 * nichts davon.
 *
 * Getrennt dargestellt entsteht etwas Neues — man sieht, wo man steht,
 * und was man tun müsste, um mehr zeigen zu können.
 */

const TON: Record<Belegstufe, string> = {
  beobachtet: "bg-positive-bg text-positive-text",
  bestaetigt: "bg-accent-soft text-accent-text",
  berichtet: "bg-inset text-ink-2",
  behauptet: "bg-inset text-ink-3",
};

export function Belegliste({ belege }: { belege: Beleg[] }) {
  const [stand, setStand] = useState<Record<string, boolean>>(
    Object.fromEntries(belege.map((b) => [b.id, b.geteilt])),
  );
  const [laeuft, starten] = useTransition();

  if (belege.length === 0) return null;

  return (
    <ul className="grid gap-2.5">
      {belege.map((b) => {
        const t = BELEGSTUFENTEXT[b.stufe];
        const geteilt = stand[b.id] ?? false;
        return (
          <li key={b.id}>
            <Card>
              <div className="grid gap-2">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span
                    className={`rounded-(--radius-pill) px-2 py-0.5 abschnitts-titel ${TON[b.stufe]}`}
                  >
                    {t.wort}
                  </span>
                  <span className="text-2xs text-ink-3">{b.herkunft}</span>
                </div>
                <p className="max-w-[var(--measure)] text-[15px] leading-relaxed text-ink">
                  {b.aussage}
                </p>
                <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-ink-2">
                  <input
                    type="checkbox"
                    checked={geteilt}
                    disabled={laeuft}
                    onChange={(e) => {
                      const neu = e.target.checked;
                      setStand({ ...stand, [b.id]: neu });
                      starten(async () => {
                        await belegTeilen(b.id, neu);
                      });
                    }}
                  />
                  Arbeitgebern zeigen
                </label>
              </div>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
