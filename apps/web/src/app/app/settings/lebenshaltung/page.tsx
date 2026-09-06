import type { Metadata } from "next";
import Link from "next/link";
import { ladeAktuelleStelle, ladeLebenshaltung } from "@/lib/lebenswert/speicher";
import { nettoAusBrutto } from "@/lib/lebenswert/netto";
import { AktuelleStelleFormular } from "./AktuelleStelleFormular";
import { Arbeitsweg } from "./Arbeitsweg";
import { KostenFormular } from "./KostenFormular";

export const metadata: Metadata = { title: "Lebenshaltung" };
export const dynamic = "force-dynamic";

/**
 * Was im Monat fest weggeht.
 *
 * ── Warum es diese Seite gibt ─────────────────────────────────
 *
 * Ein Bruttogehalt beantwortet die Frage nicht, die vor einem
 * Stellenwechsel wirklich zählt. „70.000 statt 63.000" klingt nach
 * siebentausend; nach Steuern und einem längeren Arbeitsweg bleiben
 * davon vielleicht hundertfünfzig Euro im Monat.
 *
 * Diese Seite ist die eine Hälfte der Antwort. Die andere steht unter
 * „Gehalt & Steuern".
 *
 * ── Warum sie hier steht und nicht im Karriereprofil ──────────
 *
 * Weil diese Angaben privat sind in einem anderen Sinn als der Rest.
 * Aus dem Karriereprofil fliessen Dinge in Lebensläufe, in Ninas
 * Begründungen, in Suchrichtungen. Eine Miete, die versehentlich in
 * einem Anschreiben landet, ist ein Schaden, den keine Korrektur
 * zurückholt — und beim zweiten Mal trägt niemand mehr etwas ein.
 *
 * Die Trennung ist deshalb keine Bitte an die Entwicklung, sondern in
 * Schema, Zeilensicherheit und Zugriffsfunktionen eingebaut.
 */
export default async function LebenshaltungPage() {
  const [kosten, stelle] = await Promise.all([ladeLebenshaltung(), ladeAktuelleStelle()]);


  /*
   * Das Netto kommt aus der aktuellen Stelle.
   *
   * Ohne Bruttoangabe bleibt es `null`, und die Seite sagt daneben,
   * woran es liegt. Mit einem Durchschnittsgehalt zu rechnen wäre
   * naheliegend und falsch: Das Ergebnis sähe aus wie eine Auskunft
   * über das eigene Leben und wäre eine über ein statistisches Mittel.
   */
  const brutto =
    stelle?.salaryPeriod === "year"
      ? stelle.grossAmount
      : stelle?.salaryPeriod === "month" && stelle.grossAmount !== null
        ? stelle.grossAmount * 12
        : null;
  const { nettoMonat, grund } = await nettoAusBrutto(brutto, "DE");

  return (
    <div className="grid gap-8">
      <div className="grid gap-2">
        <h2 className="font-display text-xl font-semibold tracking-[-0.02em]">Lebenshaltung</h2>
        <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
          Was im Monat fest weggeht. Damit kann ich sagen, was von einem Gehalt tatsächlich übrig
          bleibt — und was ein Wechsel wirklich bringt.
        </p>
        <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-3">
          Diese Angaben bleiben hier. Sie erscheinen in keiner Bewerbung, erreichen keinen
          Arbeitgeber und gehören nicht zu deinem Karriereprofil. Alles ist freiwillig, und du
          kannst jederzeit alles löschen.
        </p>
      </div>

      {/*
        Die aktuelle Stelle steht VOR den Kosten.
        
        Ohne sie gibt es kein Netto, und ohne Netto rechnet die
        Kostenseite nichts — sie könnte nur sagen, was fehlt. Die
        Reihenfolge auf der Seite folgt der Reihenfolge, in der die
        Zahlen aufeinander aufbauen.
      */}
      <section className="grid gap-4">
        <div className="grid gap-1.5">
          <h3 className="text-base font-semibold">Deine aktuelle Stelle</h3>
          <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
            Die Seite, gegen die verglichen wird. Vier Zahlen genügen: Brutto, Arbeitsmodell,
            Bürotage, Arbeitsweg.
          </p>
        </div>
        <AktuelleStelleFormular gespeichert={stelle} />

        {/*
         * Die Zeit direkt unter den Feldern, aus denen sie entsteht.
         *
         * „35 Minuten" und „3 Bürotage" stehen im Formular; was sie
         * zusammen bedeuten, stand bisher nirgends. Beides
         * nebeneinander macht aus zwei Eingaben eine Auskunft.
         */}
        <Arbeitsweg minuten={stelle?.commuteMinutes ?? null} buerotage={stelle?.officeDaysPerWeek ?? null} />
      </section>

      <section className="grid gap-4 border-t border-line pt-8">
        <div className="grid gap-1.5">
          {/*
            Kosten und Nettorechnung in einem Abschnitt.
            
            Sie standen getrennt: hier die Kosten, der Rechner eine
            Seite weiter unter „Gehalt & Steuern". Wer wissen wollte,
            was am Monatsende übrig bleibt, musste seine Zahlen an einer
            Stelle eintragen und das Ergebnis an einer anderen ablesen —
            und dazwischen die Seite wechseln.
            
            Die Überschrift sagt jetzt, worum es geht: nicht um eine
            Liste von Ausgaben, sondern um die eine Zahl, die daraus
            folgt. `KostenFormular` rechnet sie bereits aus
            `nettoMonat` und den eingetragenen Kosten — es fehlte nur
            der Rahmen, der das als eine Sache zeigt.
          */}
          <h3 className="text-base font-semibold">Was am Monatsende bleibt</h3>
          <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
            Deine monatlichen Kosten, gegen dein Netto gerechnet. Alles freiwillig — vier
            Angaben ergeben eine gröbere Rechnung als elf, aber eine, die es vorher nicht
            gab. Die Zahlen bleiben hier und erscheinen in keiner Bewerbung.
          </p>
          {/* Der Weg zur Steuerseite gehört hierher: Das Netto in der
              Rechnung unten stammt von dort, und wer es genauer haben
              will, ändert es dort und nicht hier. */}
          <p className="text-2xs text-ink-3">
            Das Netto kommt aus deinen{" "}
            <Link href="/app/settings/gehalt" className="text-accent-text underline underline-offset-[3px]">
              Steuerangaben
            </Link>
            .
          </p>
        </div>
        <KostenFormular gespeichert={kosten} nettoMonat={nettoMonat} grund={grund} />
      </section>
    </div>
  );
}
