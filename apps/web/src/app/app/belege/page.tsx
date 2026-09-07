import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { BELEGSTUFENTEXT, BELEGSTUFEN } from "@paycheck/domain";
import { Card } from "@/components/ui";
import { EmptyState, PageHeader } from "@/components/ui/states";
import { Belegliste } from "@/components/belege/Belegliste";
import { belegeLaden } from "@/lib/belege";

export const metadata: Metadata = { title: "Was du belegen kannst" };
export const dynamic = "force-dynamic";

/**
 * Belegte gegen behauptete Aussagen.
 *
 * ── Warum das etwas anderes ist als ein Lebenslauf ────────────
 *
 * Ein Lebenslauf stellt alles gleich sicher dar — deshalb glaubt man
 * nichts davon, deshalb rundet jeder auf, deshalb wird bestraft, wer
 * ehrlich ist.
 *
 * Hier steht an jeder Aussage, woher sie kommt. Eine Arbeitsprobe kann
 * schiefgehen; genau deshalb bedeutet ein Beleg daraus etwas.
 *
 * ── Warum auch Misslungenes dasteht ───────────────────────────
 *
 * „Hat es dreimal versucht und jedes Mal Energieverlust berichtet" ist
 * die wertvollste Auskunft im ganzen Profil — zuerst für die Person
 * selbst. Ein Profil, das nur Erfolge sammelt, ist wieder Werbung.
 *
 * Geteilt wird nichts davon ohne ausdrückliche Freigabe, je Beleg.
 */
export default async function BelegePage() {
  const user = await requireUser();
  const { belege, bilanz } = await belegeLaden(user.id);

  return (
    <div className="grid gap-8">
      <PageHeader eyebrow="Deine Belege" title="Was du belegen kannst" />

      <p className="max-w-[var(--measure)] leading-relaxed text-ink-2">
        An jeder Aussage steht, woher sie kommt. Das ist der Unterschied zu einem Lebenslauf, in
        dem alles gleich sicher klingt — und deshalb nichts davon geglaubt wird.
      </p>

      {bilanz.gesamt === 0 ? (
        <EmptyState
          title="Noch nichts"
          body="Nach einem Gespräch mit Monday stehen hier deine ersten Aussagen. Belegt werden sie durch Arbeitsproben."
        />
      ) : (
        <>
          <Card>
            <div className="grid gap-3">
              <h2 className="abschnitts-titel text-ink-3">
                Woraus dein Profil besteht
              </h2>
              <ul className="grid gap-1.5">
                {BELEGSTUFEN.map((s) => {
                  const n = bilanz[s];
                  if (n === 0) return null;
                  return (
                    <li key={s} className="grid gap-0.5">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-[15px] text-ink">{BELEGSTUFENTEXT[s].wort}</span>
                        <span className="font-mono text-sm tabular text-ink-2">{n}</span>
                      </div>
                      <p className="max-w-[var(--measure)] text-2xs leading-relaxed text-ink-3">
                        {BELEGSTUFENTEXT[s].erklaerung}
                      </p>
                    </li>
                  );
                })}
              </ul>
              {bilanz.beobachtet === 0 && (
                <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
                  Noch nichts davon ist beobachtet. Eine{" "}
                  <a href="/app/proben" className="text-accent-text underline underline-offset-[3px]">
                    Arbeitsprobe
                  </a>{" "}
                  dauert neunzig Sekunden — und was du dabei zeigst, muss dir danach niemand
                  glauben.
                </p>
              )}
            </div>
          </Card>

          <Belegliste belege={belege} />

          <Card>
            <h2 className="abschnitts-titel text-ink-3">
              Was damit passiert
            </h2>
            <p className="mt-2 max-w-[var(--measure)] leading-relaxed text-ink-2">
              Nichts, solange du nichts freigibst. Die Voreinstellung ist nicht geteilt — auch bei
              Belegen, die gut aussehen. Ein Arbeitgeber sieht nur, was du einzeln angehakt hast,
              und nie, was du nicht angehakt hast.
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
