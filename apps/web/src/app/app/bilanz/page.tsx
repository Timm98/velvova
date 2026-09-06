import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { Card } from "@/components/ui";
import { PageHeader } from "@/components/ui/states";
import { MIN_FUER_AUSSAGE, bilanz } from "@/lib/ergebnisse";

export const metadata: Metadata = { title: "Haben unsere Empfehlungen getaugt?" };
export const dynamic = "force-dynamic";

/**
 * Was aus den Empfehlungen wurde.
 *
 * ── Warum diese Seite auch dann existiert, wenn sie schweigt ──
 *
 * Sie wird lange nichts zu sagen haben. Genau deshalb steht sie hier:
 * Ein Produkt, das behauptet, aus echten Ergebnissen zu lernen, muss
 * zeigen können, wo es damit steht — auch wenn die Antwort „noch
 * nirgends" lautet.
 *
 * Die Alternative wäre, sie erst zu bauen, wenn die Zahlen gut
 * aussehen. Dann wäre sie Werbung.
 *
 * ── Warum keine Quote unter zwanzig Fällen ───────────────────
 *
 * Eine Interviewquote aus vier Bewerbungen springt um 25
 * Prozentpunkte, sobald ein einziger Fall anders ausgeht — und sähe
 * trotzdem aus wie eine Zahl, auf die man sich verlassen kann.
 */

const BANDNAME: Record<string, string> = {
  high: "passt gut",
  medium: "passt teilweise",
  exploratory: "zum Ausprobieren",
  insufficient: "zu wenig bekannt",
};

function Quote({ wert }: { wert: number | null }) {
  if (wert === null) {
    return <span className="font-mono text-sm text-ink-3">—</span>;
  }
  return <span className="font-mono text-sm tabular text-ink">{Math.round(wert * 100)} %</span>;
}

export default async function BilanzPage() {
  await requireUser();
  const b = await bilanz();

  return (
    <div className="grid gap-8">
      <PageHeader eyebrow="Ergebnisse" title="Haben unsere Empfehlungen getaugt?" />

      <p className="max-w-[var(--measure)] leading-relaxed text-ink-2">
        Wenn „passt gut“ und „passt teilweise“ zu denselben Quoten führen, sagt unsere Passung
        nichts. Dann ist genau das die wichtigste Erkenntnis, die dieses Produkt haben kann — und
        sie steht nirgends sonst.
      </p>

      {b.gesamt === 0 ? (
        <Card>
          <h2 className="text-base font-semibold text-ink">Noch nichts zu zeigen</h2>
          <p className="mt-2 max-w-[var(--measure)] leading-relaxed text-ink-2">
            Es liegt noch keine Bewerbung vor, deren Ausgang wir kennen. Die Aufzeichnung läuft
            trotzdem: Sobald du dich bewirbst, halten wir fest, was wir damals über die Stelle
            gesagt haben — unveränderlich, damit sich später vergleichen lässt.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4">
          <div className="overflow-x-auto rounded-(--radius-md) border border-line">
            <table className="w-full min-w-[34rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-line bg-inset">
                  {["Was wir sagten", "Bewerbungen", "Gespräch", "Angebot", "Zufrieden nach 90 Tagen"].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-4 py-2.5 abschnitts-titel text-ink-3"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {b.baender.map((z) => (
                  <tr key={z.band} className="border-b border-line last:border-b-0">
                    <td className="px-4 py-3 text-[15px] text-ink">{BANDNAME[z.band] ?? z.band}</td>
                    <td className="px-4 py-3 font-mono text-sm tabular text-ink-2">{z.beworben}</td>
                    <td className="px-4 py-3">
                      <Quote wert={z.interviewQuote} />
                    </td>
                    <td className="px-4 py-3">
                      <Quote wert={z.angebotQuote} />
                    </td>
                    <td className="px-4 py-3">
                      {z.zufriedenheit === null ? (
                        <span className="font-mono text-sm text-ink-3">—</span>
                      ) : (
                        <span className="font-mono text-sm tabular text-ink">
                          {z.zufriedenheit.toFixed(1)} von 5
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!b.tragfaehig && (
            <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
              Ein Strich heisst: unter {MIN_FUER_AUSSAGE} Bewerbungen in diesem Band. Die Fälle
              sind gezählt, aber eine Quote daraus wäre eine Zahl, die beim nächsten Fall um
              zwanzig Prozentpunkte springt.
            </p>
          )}
        </div>
      )}

      {/*
       * Die Grenze der Aussage steht immer dabei — auch wenn die
       * Tabelle leer ist. Sie gehört zur Zahl, nicht neben sie.
       */}
      <Card>
        <h2 className="abschnitts-titel text-ink-3">
          Was diese Zahlen nicht zeigen
        </h2>
        <p className="mt-2 max-w-[var(--measure)] leading-relaxed text-ink-2">{b.grenzen}</p>
      </Card>
    </div>
  );
}
