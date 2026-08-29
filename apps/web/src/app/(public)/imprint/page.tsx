import type { Metadata } from "next";
import { getPageContext } from "@/lib/locale";

export const metadata: Metadata = { title: "Impressum" };

/**
 * Impressum.
 *
 * Die Angaben nach § 5 DDG stehen noch nicht fest, und erfundene
 * Anbieterdaten wären hier nicht bloß unschön, sondern rechtlich falsch.
 * Deshalb sagt die Seite offen, dass sie unvollständig ist.
 */
export default async function ImprintPage() {
  const { brand } = await getPageContext();

  return (
    <div className="grid gap-8">
      <h1 className="font-display text-[2.5rem] font-medium leading-[1.08] tracking-[-0.02em]">
        Impressum
      </h1>

      <div
        role="note"
        className="grid gap-3 rounded-[--radius-lg] border border-caution/30 bg-caution-soft p-5"
      >
        <p className="text-sm font-medium text-caution">Noch nicht vollständig</p>
        <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
          {brand.name} ist ein Aufbauprojekt und wird noch nicht öffentlich angeboten. Die
          Anbieterkennzeichnung nach § 5 DDG wird ergänzt, sobald der Betreiber feststeht. Bis dahin
          stehen hier bewusst keine Platzhalterdaten.
        </p>
      </div>

      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">Verantwortlich für den Inhalt</h2>
        <p className="max-w-[var(--measure)] leading-relaxed text-ink-2">
          Wird mit dem Betriebsstart eingetragen.
        </p>
      </section>

      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">Herkunft der Stellenanzeigen</h2>
        <p className="max-w-[var(--measure)] leading-relaxed text-ink-2">
          Angezeigte Stellen stammen aus Quellen, die ihre Anzeigen selbst öffentlich zum Abruf
          anbieten. Jede Anzeige nennt ihre Quelle und den Abrufzeitpunkt und verlinkt auf das
          Original. Es werden keine Portale ausgelesen, die das untersagen.
        </p>
      </section>
    </div>
  );
}
