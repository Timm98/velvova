import { EMPFEHLUNGSTEXT, PUNKTTEXT, type Jobcheck as Befund } from "@paycheck/domain";
import { Badge, Card } from "@/components/ui";

/**
 * Der Job-Check: soll ich diesen Job annehmen?
 *
 * ── Warum vier Kästen und keine Zahl ──────────────────────────
 *
 * Ein Prozentwert verschmilzt Dinge, die verschieden sind und
 * verschieden ausgehen. Vier getrennte Listen zeigen, worauf die
 * Empfehlung beruht — und jede lässt sich einzeln bestreiten.
 *
 * ── Warum „widersprüchlich" einen eigenen Kasten hat ──────────
 *
 * Er ist der einzige, den keine andere Plattform hat: Er braucht zwei
 * Quellen, die gegeneinander gehalten werden. In der Anzeige steht
 * Homeoffice, im Gespräch heisst es „erst nach der Probezeit" — beides
 * klingt für sich plausibel, und der Widerspruch fällt sonst im
 * vierten Monat auf.
 */

function Kasten({
  titel,
  hinweis,
  eintraege,
  ton,
}: {
  titel: string;
  hinweis: string;
  eintraege: string[];
  ton: "positive" | "critical" | "offen" | "caution";
}) {
  if (eintraege.length === 0) return null;
  const rand =
    ton === "positive"
      ? "border-positive-border"
      : ton === "critical"
        ? "border-critical-border"
        : ton === "caution"
          ? "border-caution-border"
          : "border-line";
  return (
    <div className={`grid gap-2 rounded-(--radius-md) border-l-2 ${rand} bg-inset px-4 py-3.5`}>
      <div className="grid gap-0.5">
        <h3 className="abschnitts-titel text-ink-3">{titel}</h3>
        <p className="text-2xs leading-relaxed text-ink-3">{hinweis}</p>
      </div>
      <ul className="grid gap-1.5">
        {eintraege.map((e) => (
          <li key={e} className="max-w-[var(--measure)] text-[15px] leading-relaxed text-ink">
            {e}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Jobcheck({ befund, fragen }: { befund: Befund; fragen: string[] }) {
  const e = EMPFEHLUNGSTEXT[befund.empfehlung];

  return (
    <Card>
      <div className="grid gap-5">
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold text-ink">Soll ich diesen Job annehmen?</h2>
            <Badge tone={e.ton}>{e.wort}</Badge>
          </div>
          <p className="max-w-[var(--measure)] text-[17px] leading-relaxed text-ink">
            {befund.kernsatz}
          </p>
        </div>

        <div className="grid gap-3">
          <Kasten
            titel="Passt wahrscheinlich"
            hinweis="Was für die Stelle spricht."
            eintraege={befund.passt}
            ton="positive"
          />
          <Kasten
            titel="Passt wahrscheinlich nicht"
            hinweis="Was dagegen spricht — auch wenn du die Arbeit könntest."
            eintraege={befund.passtNicht}
            ton="critical"
          />
          <Kasten
            titel="Ungeklärt"
            hinweis="Steht nirgends. Nicht „egal“, nicht „passt schon“."
            eintraege={befund.ungeklaert}
            ton="offen"
          />
          <Kasten
            titel="Widersprüchlich"
            hinweis="Zwei verschiedene Aussagen zum selben Punkt. Eine davon stimmt nicht."
            eintraege={befund.widersprueche.map((w) => w.erklaerung)}
            ton="caution"
          />
        </div>

        {/*
         * Die Fragen fürs nächste Gespräch.
         *
         * Aus dem, was offen und widersprüchlich ist — nicht aus einer
         * Vorlage. „Wie sieht eine typische Woche aus?" fragt jeder;
         * „Sie schreiben Homeoffice ab Tag eins, im Gespräch hiess es
         * nach der Probezeit — was gilt?" fragt nur, wer beides
         * nebeneinander hat.
         */}
        {fragen.length > 0 && (
          <div className="grid gap-2 rounded-(--radius-md) border border-line px-4 py-3.5">
            <h3 className="abschnitts-titel text-ink-3">
              Das würde ich vorher fragen
            </h3>
            <ol className="grid gap-1.5">
              {fragen.map((f, i) => (
                <li key={f} className="max-w-[var(--measure)] text-[15px] leading-relaxed text-ink-2">
                  {i + 1}. {f}
                </li>
              ))}
            </ol>
          </div>
        )}

        <p className="max-w-[var(--measure)] text-2xs leading-relaxed text-ink-3">
          {befund.grenzen}
        </p>
      </div>
    </Card>
  );
}
