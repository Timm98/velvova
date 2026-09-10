import type { Metadata } from "next";
import Link from "next/link";
import { EBENEN, EBENENSATZ, type Ebene } from "@paycheck/domain";
import { arbeitgeberKontext } from "@/lib/arbeitgeber/zugang";
import { vorgaengeListen } from "@/lib/arbeitgeber/bedarfsvorgang";

export const metadata: Metadata = { title: "Klärungen" };
export const dynamic = "force-dynamic";

const EBENENNAME: Record<Ebene, string> = {
  beduerfnis: "Wunsch",
  beobachtung: "Beobachtung",
  hypothese: "Hypothese",
  bestaetigtes_problem: "Bestätigtes Problem",
  loesungsbedarf: "Lösungsbedarf",
  freigegebene_moeglichkeit: "Freigegeben",
};

/**
 * Die offenen Klärungen.
 *
 * ── Warum die Ebene in der Liste steht ──────────────────────────
 *
 * Weil sie die einzige Information ist, die sagt, was als Nächstes zu
 * tun ist. Eine Liste von Titeln mit Datum sagt, dass etwas
 * existiert; die Ebene sagt, woran es hängt.
 */
export default async function VorgaengePage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const { org } = await searchParams;
  const { organisation } = await arbeitgeberKontext(org);
  const vorgaenge = await vorgaengeListen(organisation.organizationId);

  return (
    <div className="grid gap-8">
      <div className="grid gap-2">
        <h1 className="font-display text-2xl font-normal tracking-[-0.02em]">Klärungen</h1>
        <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
          Zwischen einer Lage und einer Stelle liegen vier Schritte, und jeder kann ergeben, dass
          niemand eingestellt werden muss. Hier steht, wie weit jede Klärung ist.
        </p>
      </div>

      {vorgaenge.length === 0 ? (
        <div className="grid gap-3 rounded-(--radius-lg) border border-line bg-raised p-5">
          <p className="max-w-[var(--measure)] text-[14.5px] leading-relaxed text-ink-2">
            Noch keine Klärung. Wenn bei Ihnen etwas nicht rundläuft und Sie noch nicht wissen,
            woran es liegt, fangen Sie damit an — eine Stelle ist nur eine von mehreren möglichen
            Antworten.
          </p>
          <Link
            href="/business/bedarf?weg=klaerung"
            className="inline-flex min-h-11 w-fit items-center rounded-(--radius-control) bg-accent px-4 text-[14px] font-medium text-accent-on transition-opacity hover:opacity-90"
          >
            Lage beschreiben
          </Link>
        </div>
      ) : (
        <ul className="grid gap-3">
          {vorgaenge.map((v) => {
            const ebene = (EBENEN as readonly string[]).includes(v.ebene)
              ? (v.ebene as Ebene)
              : "beduerfnis";
            return (
              <li key={v.id}>
                <Link
                  href={`/business/vorgaenge/${v.id}`}
                  className="grid gap-1.5 rounded-(--radius-lg) border border-line bg-raised p-4 transition-colors hover:border-accent"
                >
                  <span className="text-[15px] font-medium text-ink">{v.titel}</span>
                  <span className="text-2xs text-ink-3">
                    {EBENENNAME[ebene]} · {v.erstelltAm.toLocaleDateString("de-DE")}
                  </span>
                  <span className="max-w-[var(--measure)] text-[14px] leading-relaxed text-ink-2">
                    {EBENENSATZ[ebene]}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
