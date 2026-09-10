import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { arbeitsweiseLaden } from "@/lib/arbeitsweise";
import { PageHeader } from "@/components/ui/states";
import { DIMENSIONEN, profilfortschritt } from "@paycheck/domain";
import { Dimensionsfeld } from "./Dimensionsfeld";

export const metadata: Metadata = { title: "Wie du arbeitest" };
export const dynamic = "force-dynamic";

/**
 * ══════════════════════════════════════════════════════════════════
 * Das weiss Nina über deine Arbeit
 * ══════════════════════════════════════════════════════════════════
 *
 * Der Passungswert rechnet aus sieben Faktoren. Drei davon lesen
 * genau das, was auf dieser Seite entsteht: was Energie gibt, wie
 * jemand am besten arbeitet, was ihn hält.
 *
 * Am 10.09.2026 gemessen: 561 berechnete Treffer, mittlere Abdeckung
 * 0,12, höchster Passungswert 13 von 100. Kein niedriger Wert,
 * sondern ein fast leerer — der Rechnung fehlten die Eingaben.
 *
 * ── Warum das eine Seite ist und kein Fragebogen ────────────────
 *
 * Weil es dem Menschen gehört. Er sieht jede Zeile, kann jede
 * zurücknehmen, und nichts davon ist Pflicht. Ein Fragebogen, der
 * erst weitergeht, wenn alles ausgefüllt ist, erzeugt Antworten, die
 * niemand meint — und die landen dann in einer Rechnung.
 *
 * ── Warum hier nichts gemessen wird ─────────────────────────────
 *
 * Kein Test, kein Typ, kein Score. Was jemand über seine eigene
 * Arbeit sagt, ist die bessere Auskunft als das, was sich aus seinem
 * Verhalten ableiten liesse — und die einzige, die er kontrollieren
 * kann.
 */
export default async function ArbeitsweiseSeite() {
  await requireUser();
  const staende = await arbeitsweiseLaden();
  const f = profilfortschritt(
    staende.map((s) => ({
      dimension: s.dimension,
      aussagen: s.aussagen.map((a) => a.text),
      freigegeben: false,
    })),
  );

  return (
    <div className="grid gap-8">
      <PageHeader
        title="Wie du arbeitest"
        lead="Was hier steht, hast du gesagt — nichts davon ist gemessen, geraten oder aus deinem Verhalten abgeleitet. Es fliesst in die Passung deiner Vorschläge ein, und du kannst jede Zeile zurücknehmen."
      />

      <p className="max-w-[var(--measure)] text-[14.5px] leading-relaxed text-ink-2">
        {f.gefuellt === 0
          ? `Noch nichts davon steht. Solange das so ist, kann Monday bei einer Stelle nur prüfen, ob deine harten Bedingungen passen — nicht, ob die Arbeit zu dir passt.`
          : f.gefuellt === f.gesamt
            ? "Alle fünf stehen. Das ist die Grundlage, auf der die Passung deiner Vorschläge gerechnet wird."
            : `${f.gefuellt} von ${f.gesamt} stehen. Jede weitere macht die Vorschläge genauer.`}
      </p>

      <div className="grid gap-4">
        {DIMENSIONEN.map((d) => (
          <Dimensionsfeld
            key={d}
            dimension={d}
            aussagen={staende.find((s) => s.dimension === d)?.aussagen ?? []}
          />
        ))}
      </div>

      <section className="grid gap-2 border-t border-line pt-6">
        <h2 className="text-[15px] font-semibold text-ink">Was damit passiert</h2>
        <ul className="grid gap-1.5 text-[14px] leading-relaxed text-ink-2">
          <li>· Es bleibt bei dir. Kein Arbeitgeber sieht diese Seite.</li>
          <li>· Es geht in die Passung deiner Vorschläge ein — dort, wo heute nichts steht.</li>
          <li>· Was nach dem Gleichbehandlungsgesetz kein Auswahlkriterium sein darf, wird nicht gespeichert. Der Grund steht dann dabei.</li>
          <li>· Zurückgenommene Zeilen zählen sofort nicht mehr.</li>
        </ul>
      </section>
    </div>
  );
}
