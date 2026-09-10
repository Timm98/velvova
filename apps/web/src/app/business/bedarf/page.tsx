import type { Metadata } from "next";
import { arbeitgeberKontext } from "@/lib/arbeitgeber/zugang";
import { Bedarfsaufnahme } from "./Bedarfsaufnahme";

export const metadata: Metadata = { title: "Bedarf" };
export const dynamic = "force-dynamic";

/**
 * ══════════════════════════════════════════════════════════════════
 * Bedarf hinterlegen, ohne eine Anzeige zu schreiben
 * ══════════════════════════════════════════════════════════════════
 *
 * Eine Stellenanzeige zu schreiben kostet zwei Stunden, und wer sie
 * nicht schreibt, kommt in keiner Suche vor. Für einen Betrieb mit
 * acht Leuten ist das der Grund, warum er niemanden findet — nicht
 * der Fachkräftemangel.
 *
 * Hier reicht ein Absatz.
 *
 * ── Was das von einer Anzeige unterscheidet ─────────────────────
 *
 * Eine Anzeige beschreibt, was sich jemand vorgestellt hat. Ein
 * Angebot ist bindend, sobald beide Seiten aufdecken. Deshalb steht
 * dazwischen ein zweiter Knopf und ein Satz, was das heisst.
 */
export default async function BedarfPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; weg?: string }>;
}) {
  const { org, weg } = await searchParams;
  const { organisation } = await arbeitgeberKontext(org);

  /*
   * Der Weg kommt von `/unterstuetzung` und ist ein Wert aus zwei
   * bekannten. Alles Unbekannte ist `rolle` — ein Parameter aus einer
   * Adresszeile darf keinen dritten Zustand erfinden.
   */
  const klaerung = weg === "klaerung";

  return (
    <div className="grid gap-8">
      <div className="grid gap-2">
        <h1 className="font-display text-2xl font-normal tracking-[-0.02em]">
          {klaerung ? "Was klemmt" : "Bedarf"}
        </h1>
        <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
          {klaerung
            ? "Beschreiben Sie in einem Absatz, was bei Ihnen nicht rundläuft. Ob daraus eine Stelle wird, entscheidet sich später — manche Engpässe verschwinden, sobald eine Zuständigkeit geklärt ist. Solange das nicht feststeht, entsteht hier kein Angebot."
            : "Sagen Sie in einem Absatz, wen Sie suchen. Daraus wird ein Angebot mit Konditionen und Frist — keine Anzeige, keine Sichtbarkeit, kein Ranking. Kandidaten sehen Ihren Namen erst, wenn beide Seiten aufdecken."}
        </p>
      </div>

      <Bedarfsaufnahme orgId={organisation.organizationId} klaerung={klaerung} />

      <section className="grid gap-2 border-t border-line pt-6">
        <h2 className="text-[15px] font-semibold text-ink">Was mit den Angaben passiert</h2>
        <ul className="grid gap-1.5 text-[14px] leading-relaxed text-ink-2">
          <li>· Der Entwurf liegt bei Ihnen, bis Sie ihn verbindlich hinterlegen.</li>
          <li>· Danach rechnet der nächtliche Lauf ihn gegen die Absichten der Suchenden.</li>
          <li>· Sie sehen keine Profile, nur Zahlen — und die erst ab einer Gruppengrösse, bei der niemand erkennbar ist.</li>
          <li>· Wünsche, die nach dem Gleichbehandlungsgesetz nicht ausgewählt werden dürfen, werden gestrichen und Ihnen gezeigt.</li>
        </ul>
      </section>
    </div>
  );
}
