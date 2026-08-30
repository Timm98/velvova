import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Target } from "lucide-react";
import { plural } from "@paycheck/domain";
import { requireUser } from "@/lib/auth";
import { getPageContext } from "@/lib/locale";
import { loadGate } from "@/lib/gate";
import { buildAndStoreFunnel } from "@/lib/opportunity/reality-engine";
import { Button, Card } from "@/components/ui";
import { EmptyState, PageHeader } from "@/components/ui/states";

export const metadata: Metadata = { title: "Dein realer Chancenraum" };
export const dynamic = "force-dynamic";

/**
 * Der Chancenraum.
 *
 * Diese Seite existiert, um eine bestimmte Zahl nicht mehr zu zeigen:
 * „1.842 Stellen gefunden". Sie klingt nach Auswahl und ist keine.
 *
 * Stattdessen ein Trichter, der jede Stufe einzeln herunterzählt und
 * bei jeder sagt, was weggefallen ist. Am Ende steht eine kleine Zahl —
 * und die ist ehrlich.
 */
export default async function OpportunitiesPage() {
  const user = await requireUser();
  const { brand } = await getPageContext();
  const gate = await loadGate(user.id);

  if (!gate.unlocked) {
    return (
      <div className="grid gap-6">
        <PageHeader eyebrow="Chancenraum" title="Dein realer Chancenraum" />
        <EmptyState
          icon={<Target className="size-5" strokeWidth={1.7} />}
          title={`${brand.assistantName} braucht erst dein bestätigtes Profil`}
          body="Ohne Profil gibt es keine harten Bedingungen, gegen die sich etwas prüfen liesse — und damit keinen ehrlichen Trichter."
          action={
            <Button asChild variant="primary">
              <Link href="/app/nina">Gespräch fortsetzen</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const funnel = await buildAndStoreFunnel(user.id);
  const erste = funnel.stufen[0]!.count;
  const letzte = funnel.stufen.at(-1)!.count;

  return (
    <div className="grid max-w-[900px] gap-8">
      <PageHeader
        eyebrow="Chancenraum"
        title="Dein realer Chancenraum"
        lead={
          funnel.belastbar
            ? `Von ${plural(erste, "Quelleneintrag", "Quelleneinträgen")} bleiben ${plural(letzte, "Möglichkeit", "Möglichkeiten")}, über die du heute entscheiden kannst.`
            : "Noch nicht genügend Daten für eine belastbare Aussage."
        }
      />

      {/* ── Der Trichter ────────────────────────────────────── */}
      <section aria-labelledby="trichter">
        <h2 id="trichter" className="sr-only">
          Vom Quelleneintrag zur Entscheidung
        </h2>

        <ol className="grid gap-0">
          {funnel.stufen.map((stufe, i) => {
            const anteil = erste > 0 ? Math.max(0.02, stufe.count / erste) : 0;
            const letzteStufe = i === funnel.stufen.length - 1;
            return (
              <li key={stufe.key} className="grid gap-1.5 py-3">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span
                    className={
                      letzteStufe
                        ? "font-mono text-2xl font-semibold tabular-nums text-accent-text"
                        : "font-mono text-xl tabular-nums text-ink"
                    }
                  >
                    {stufe.count}
                  </span>
                  <span className={letzteStufe ? "text-sm font-medium text-ink" : "text-sm text-ink-2"}>
                    {stufe.label}
                  </span>
                  {stufe.lost && (
                    <span className="text-xs text-ink-3">— {stufe.lost}</span>
                  )}
                </div>

                {/* Ein Balken statt einer Karte. Der Trichter soll man
                    sehen, nicht lesen müssen. */}
                <div
                  aria-hidden
                  className="h-1.5 rounded-[--radius-full] bg-inset"
                >
                  <div
                    className={`h-full rounded-[--radius-full] ${letzteStufe ? "bg-accent" : "bg-line-2"}`}
                    style={{ width: `${anteil * 100}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {/* ── Der Engpass ─────────────────────────────────────── */}
      {funnel.engpass && (
        <Card className="grid gap-3 border-line-2">
          <p className="font-mono text-2xs uppercase tracking-wider text-ink-3">
            Wo am meisten wegfällt
          </p>
          <p className="text-base font-medium">
            {funnel.engpass.verlust} bei „{funnel.engpass.label}“
          </p>
          <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
            {funnel.engpass.erklaerung}
          </p>
          <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
            {funnel.engpass.handlung}
          </p>
          {funnel.engpass.key === "bedingungen" && (
            <Link
              href="/app/career"
              className="inline-flex min-h-6 items-center gap-1.5 text-sm text-accent-text underline underline-offset-[3px]"
            >
              Deine Bedingungen ansehen
              <ArrowRight className="size-3.5" strokeWidth={1.9} />
            </Link>
          )}
        </Card>
      )}

      <p className="text-xs leading-relaxed text-ink-3">
        {funnel.hinweis} Berechnet am{" "}
        {new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(
          funnel.berechnetAm,
        )}
        , Fassung {funnel.version}.
      </p>
    </div>
  );
}
