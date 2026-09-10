import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { aufgabeStellen } from "@/lib/bruecke/probe";
import { Arbeitsprobe } from "@/components/bruecke/Arbeitsprobe";
import { PageHeader } from "@/components/ui/states";

export const metadata: Metadata = { title: "Arbeitsprobe" };
export const dynamic = "force-dynamic";

/**
 * Die Arbeitsprobe zu einer Stelle.
 *
 * ── Warum es diesen Schritt gibt ────────────────────────────────
 *
 * Die Liste sagt, dass jemand eine Stelle antreten könnte. Die
 * Übersetzung sagt, wie er es aufschreibt. Beides sind Aussagen von
 * Velvova über einen Menschen — und ein randomisiertes Feldexperiment
 * hat gezeigt, dass genau das nichts bewirkt: Privates Feedback
 * erhöhte die Beschäftigung um null.
 *
 * Was wirkte, waren teilbare Nachweise: plus 5,2 Prozentpunkte. Hier
 * entsteht einer.
 */
export default async function ProbeSeite({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const lage = await aufgabeStellen(jobId);

  return (
    <div className="grid gap-8">
      <div className="grid gap-4">
        <Link
          href={`/app/bruecke/${jobId}`}
          className="inline-flex w-fit items-center gap-1.5 text-[14px] text-ink-3 transition-colors hover:text-ink-2"
        >
          <ArrowLeft className="size-4 shrink-0" strokeWidth={1.8} />
          Zurück zur Übersetzung
        </Link>

        <PageHeader
          eyebrow={lage.art === "aufgabe" ? lage.stellentitel : undefined}
          title="Zeig, dass du es kannst"
          lead="Eine kurze Aufgabe aus dieser Tätigkeit. Wenn sie trägt, bekommst du einen Nachweis, den du weitergeben kannst — und den niemand sieht, solange du ihn nicht freigibst."
        />
      </div>

      {lage.art === "aufgabe" && <Arbeitsprobe jobId={jobId} aufgabe={lage.aufgabe} />}

      {lage.art === "kein_modell" && (
        <section className="rounded-(--radius-lg) border border-line bg-raised p-6">
          <p className="max-w-[var(--measure)] text-[15px] leading-relaxed text-ink-2">
            Für die Aufgabe ist gerade kein Modell erreichbar. Eine geratene Aufgabe wäre keine
            Prüfung, sondern eine Beschäftigung.
          </p>
        </section>
      )}

      {lage.art === "stelle_unbekannt" && (
        <section className="rounded-(--radius-lg) border border-line bg-raised p-6">
          <p className="max-w-[var(--measure)] text-[15px] leading-relaxed text-ink-2">
            Diese Stelle gibt es nicht mehr im Bestand.
          </p>
        </section>
      )}

      {lage.art === "untauglich" && (
        /*
         * Die erzeugte Aufgabe hat die Prüfung nicht bestanden — meist,
         * weil ihr die Prüfpunkte fehlen oder sie zu lang geraten ist.
         *
         * Das dem Menschen zu zeigen ist richtiger, als eine schlechte
         * Aufgabe zu stellen: Eine Probe, die sich nicht bewerten
         * lässt, endet in einem Urteil, und ein Urteil ist genau das,
         * was hier nicht entstehen darf.
         */
        <section className="grid gap-2 rounded-(--radius-lg) border border-line bg-raised p-6">
          <h2 className="text-[17px] font-semibold text-ink">Dafür habe ich keine Aufgabe</h2>
          <p className="max-w-[var(--measure)] text-[15px] leading-relaxed text-ink-2">
            Aus dieser Anzeige liess sich keine Aufgabe ableiten, die sich fair bewerten lässt.
            {lage.grund === "zu_lang" && " Sie wäre länger als eine Arbeitsprobe sein darf."}
            {lage.grund === "keine_taetigkeit" &&
              " Die Anzeige sagt nicht deutlich genug, was zu tun wäre."}
          </p>
        </section>
      )}
    </div>
  );
}
