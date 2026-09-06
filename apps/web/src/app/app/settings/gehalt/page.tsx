import type { Metadata } from "next";
import { ladeGehaltsangaben } from "@/lib/payroll/einstellungen";
import { ladeAktuelleStelle } from "@/lib/lebenswert/speicher";
import { GehaltsFormular } from "./GehaltsFormular";

export const metadata: Metadata = { title: "Gehalt & Steuern" };
export const dynamic = "force-dynamic";

/**
 * Die Angaben, mit denen Velvova das Netto schätzt.
 *
 * Sie stehen hier und nicht in einem Rechner-Fenster, weil sie über
 * eine einzelne Berechnung hinausgehen: einmal eingetragen, gelten sie
 * für jede Stelle, die man sich ansieht.
 *
 * Was diese Seite von einer gewöhnlichen Einstellungsseite
 * unterscheidet: **Speichern ist eine eigene Entscheidung.** Man kann
 * hier rechnen, ohne etwas zu hinterlassen. Steuerklasse und
 * Kinderzahl sagen etwas über die Lebensform, und das soll niemand
 * nebenbei ablegen, nur weil er wissen wollte, was von 45.000 Euro
 * übrig bleibt.
 */
export default async function GehaltPage() {
  const [angaben, stelle] = await Promise.all([ladeGehaltsangaben(), ladeAktuelleStelle()]);

  /*
   * Das eigene Brutto als Vorschlag, wenn es hinterlegt ist.
   *
   * Der Grenzabgabensatz gilt nicht allgemein, sondern genau für ein
   * bestimmtes Gehalt. Ohne Angabe bleibt das Feld deshalb leer — eine
   * eingesetzte Beispielzahl wäre die erste, die jemand sieht, und sie
   * beschriebe ein fremdes Einkommen.
   */
  const bruttoVorschlag =
    stelle?.salaryPeriod === "year"
      ? stelle.grossAmount
      : stelle?.salaryPeriod === "month" && stelle.grossAmount !== null
        ? stelle.grossAmount * 12
        : null;

  return (
    <div className="grid gap-8">
      <div className="grid gap-2">
        <h2 className="font-display text-xl font-semibold tracking-[-0.02em]">Gehalt & Steuern</h2>
        <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
          Mit diesen Angaben schätze ich, was von einem Bruttogehalt übrig bleibt. Je genauer sie
          sind, desto näher liegt die Schätzung — aber die tatsächliche Lohnabrechnung kann immer
          abweichen.
        </p>
        <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-3">
          Diese Angaben werden ausschliesslich für deine persönliche Gehaltsberechnung verwendet.
          Sie gehen nicht an Arbeitgeber, nicht an Jobanbieter und in keine Auswertung.
        </p>
      </div>

      <GehaltsFormular angaben={angaben} bruttoVorschlag={bruttoVorschlag} />
    </div>
  );
}
