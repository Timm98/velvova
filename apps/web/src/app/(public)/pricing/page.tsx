import type { Metadata } from "next";
import Link from "next/link";
import { getPageContext } from "@/lib/locale";

export const metadata: Metadata = { title: "Preise" };

/**
 * Preise.
 *
 * Es gibt noch kein Preismodell, und deshalb steht hier auch keines.
 * Eine erfundene Tabelle mit drei Spalten wäre genau die Sorte Fassade,
 * die dieses Produkt vermeiden will.
 */
export default async function PricingPage() {
  const { brand } = await getPageContext();

  return (
    <div className="grid gap-8">
      <header className="grid gap-4">
        <p className="text-2xs font-medium uppercase tracking-[0.14em] text-brand">Preise</p>
        <h1 className="font-display text-[2.5rem] font-medium leading-[1.08] tracking-[-0.02em]">
          Noch nicht festgelegt.
        </h1>
      </header>

      <div className="grid gap-4 rounded-[--radius-lg] border border-line bg-raised p-6">
        <p className="max-w-[var(--measure)] leading-relaxed text-ink-2">
          {brand.name} befindet sich im Aufbau. Es gibt bisher kein Preismodell — und wir stellen
          hier keine Tabelle hin, die es nicht gibt.
        </p>
        <p className="max-w-[var(--measure)] leading-relaxed text-ink-2">
          Zwei Dinge stehen jetzt schon fest, weil sie das Produkt bestimmen: Die Person, die Arbeit
          sucht, ist die Kundin — nicht der Arbeitgeber. Und Reihenfolgen in der Trefferliste sind
          nicht käuflich.
        </p>
      </div>

      <p className="text-sm text-ink-2">
        <Link href="/register" className="text-accent-text underline underline-offset-[3px]">
          Konto anlegen
        </Link>{" "}
        und in der Aufbauphase kostenlos nutzen.
      </p>
    </div>
  );
}
