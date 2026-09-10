import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EBENEN, type Ebene } from "@paycheck/domain";
import { arbeitgeberKontext } from "@/lib/arbeitgeber/zugang";
import { vorgangLesen } from "@/lib/arbeitgeber/bedarfsvorgang";
import { Klaerung } from "./Klaerung";

export const metadata: Metadata = { title: "Klärung" };
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
 * Ein Vorgang, von der Ausgangslage bis zur Freigabe.
 *
 * ── Warum die Leiter oben steht ─────────────────────────────────
 *
 * Weil sie die einzige Erklärung dafür ist, warum hier noch kein
 * Angebot entstanden ist. Ohne sie sieht die Seite aus wie ein
 * Formular, das nicht fertig wird; mit ihr ist sie ein Weg, auf dem
 * man sieht, wo man steht.
 *
 * ── Warum die abgelehnten Schritte sichtbar sind ────────────────
 *
 * „Es gibt nur eine Quelle" ist die nützlichste Auskunft, die diese
 * Seite geben kann: Sie sagt, was zu besorgen ist. Sie wegzulassen
 * hiesse, den Betrieb raten zu lassen, warum es nicht weitergeht.
 */
export default async function VorgangPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ org?: string }>;
}) {
  const { id } = await params;
  const { org } = await searchParams;
  const { organisation } = await arbeitgeberKontext(org);

  const v = await vorgangLesen(organisation.organizationId, id);
  if (!v) notFound();

  const stand = EBENEN.indexOf(v.ebene);

  return (
    <div className="grid gap-8">
      <div className="grid gap-2">
        <h1 className="font-display text-2xl font-normal tracking-[-0.02em]">{v.titel}</h1>
        <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">{v.ebenensatz}</p>
      </div>

      <section className="grid gap-3">
        <h2 className="text-[15px] font-semibold text-ink">Wo die Klärung steht</h2>
        <ol className="grid gap-1.5">
          {EBENEN.map((e, i) => (
            <li
              key={e}
              className={`flex items-baseline gap-2.5 text-[14.5px] leading-relaxed ${
                i === stand ? "text-ink" : i < stand ? "text-ink-3" : "text-ink-3/60"
              }`}
            >
              <span aria-hidden className="w-4 shrink-0 text-center text-2xs">
                {i < stand ? "·" : i === stand ? "▸" : "·"}
              </span>
              <span className={i === stand ? "font-medium" : undefined}>{EBENENNAME[e]}</span>
              {i === stand && <span className="text-2xs text-ink-3">— hier stehen Sie</span>}
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-2 rounded-(--radius-lg) border border-line bg-soft p-4">
        <h2 className="text-[15px] font-semibold text-ink">Ihre Ausgangslage</h2>
        <p className="max-w-[var(--measure)] whitespace-pre-wrap text-[14.5px] leading-relaxed text-ink-2">
          {v.ausgangslage}
        </p>
      </section>

      {v.fragen.length > 0 && (
        <section className="grid gap-2">
          <h2 className="text-[15px] font-semibold text-ink">Was jetzt weiterhilft</h2>
          <ul className="grid gap-1.5">
            {v.fragen.map((f) => (
              <li key={f} className="text-[14.5px] leading-relaxed text-ink-2">
                · {f}
              </li>
            ))}
          </ul>
        </section>
      )}

      <Klaerung
        orgId={organisation.organizationId}
        vorgangId={v.id}
        ebene={v.ebene}
        weg={v.weg}
        unabhaengig={v.unabhaengig}
        quellen={v.quellen}
        befunde={v.befunde}
      />

      {v.schritte.length > 0 && (
        <section className="grid gap-2 border-t border-line pt-6">
          <h2 className="text-[15px] font-semibold text-ink">Was bisher versucht wurde</h2>
          <ul className="grid gap-2">
            {v.schritte.map((s, i) => (
              <li key={`${s.von}-${s.nach}-${i}`} className="grid gap-0.5">
                <span className="text-[14px] text-ink-2">
                  {EBENENNAME[s.von as Ebene] ?? s.von} → {EBENENNAME[s.nach as Ebene] ?? s.nach}
                  {s.erlaubt ? "" : " — nicht möglich"}
                </span>
                {s.grund && (
                  <span className="text-2xs leading-relaxed text-caution">{s.grund}</span>
                )}
                <span className="text-2xs text-ink-3">{s.am.toLocaleDateString("de-DE")}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {v.darfAngebot && (
        <section className="grid gap-2 rounded-(--radius-lg) border border-line bg-raised p-4">
          <h2 className="text-[15px] font-semibold text-ink">Daraus darf jetzt ein Angebot werden</h2>
          <p className="max-w-[var(--measure)] text-[14.5px] leading-relaxed text-ink-2">
            Freigegeben von {v.freigabeVon}. Der gewählte Weg braucht einen Menschen von aussen —
            unter „Bedarf" beschreiben Sie die Rolle, und daraus entsteht ein Angebot mit
            Konditionen und Frist.
          </p>
        </section>
      )}
    </div>
  );
}
