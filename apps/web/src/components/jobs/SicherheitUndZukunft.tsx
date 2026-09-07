import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Zukunftsangabe } from "@/lib/jobs/zukunft";

/**
 * Kurzfassung: Wie sicher ist die Stelle, wie sicher der Beruf.
 *
 * ══════════════════════════════════════════════════════════════
 * Was hier vorher stand
 * ══════════════════════════════════════════════════════════════
 *
 * Drei Zeilen aus der Bewertung:
 *
 *   Dafür spricht: Sieht interessant aus — für eine belastbare
 *   Einschätzung kennt Monday dich noch nicht gut genug.
 *   Zu prüfen: Belegte Fähigkeiten und Qualifikationen ist unbekannt.
 *   Sicherheit gemindert durch: Dein Profil ist noch nicht vollständig …
 *
 * Alle drei sagten dasselbe, und zwar über UNS: dass zu wenig über die
 * Person bekannt ist. Bei jeder Stelle im selben Wortlaut. Wer drei
 * Sätze liest, die nichts über die Stelle sagen, liest beim vierten
 * Mal keinen mehr.
 *
 * ══════════════════════════════════════════════════════════════
 * Zwei Sicherheiten, die man nicht verwechseln darf
 * ══════════════════════════════════════════════════════════════
 *
 * `verlaesslich` — wie belastbar DIESE ANZEIGE ist: vollständige
 * Angaben, erkennbarer Arbeitgeber, keine Warnsignale.
 *
 * `zukunft` — wie es dem BERUF in den nächsten Jahren geht: Nachfrage
 * und Automatisierbarkeit, gemittelt über die Berufsgruppe.
 *
 * Eine tadellose Anzeige für einen schrumpfenden Beruf ist beides
 * zugleich, und beides gehört gesagt. Sie in eine Zahl zu mischen
 * ergäbe einen Mittelwert, der keine der beiden Fragen beantwortet.
 */
export function SicherheitUndZukunft({
  verlaesslichkeit,
  zukunft,
  vollstaendigeAnalyseHref,
}: {
  /** 0 bis 100 — Vertrauenswürdigkeit der Anzeige selbst. */
  verlaesslichkeit: number | null;
  zukunft: Zukunftsangabe | null;
  vollstaendigeAnalyseHref: string;
}) {
  return (
    <section aria-labelledby="sicherheit" className="grid gap-3 rounded-(--radius-md) bg-inset px-4 py-3.5">
      <h3 id="sicherheit" className="abschnitts-titel text-ink-3">
        Wie sicher ist das
      </h3>

      <dl className="grid gap-2.5">
        <Zeile
          begriff="Die Anzeige"
          wert={
            verlaesslichkeit === null
              ? null
              : verlaesslichkeit >= 70
                ? "Vollständig und nachvollziehbar"
                : verlaesslichkeit >= 45
                  ? "Brauchbar, mit Lücken"
                  : "Wenig belastbar — vieles fehlt"
          }
        />

        {/*
          Die Zukunft steht nur da, wenn es Daten gibt.
          
          Sie hängt an der amtlichen Berufskennung. Fehlt die, gibt es
          keine Berufsgruppe und keine Einschätzung — und dann steht
          hier nichts statt einer Vermutung.
        */}
        <Zeile
          begriff="Der Beruf"
          wert={
            zukunft
              ? `${zukunftswort(zukunft.bild.sicherheit)} · ${zukunft.nachfrage}`
              : null
          }
          fussnote={
            zukunft
              ? `Mittel über ${zukunft.bild.berufsgruppen} Berufsgruppen · ${zukunft.konfidenz === "mittel" ? "mittlere" : "geringe"} Sicherheit der Einschätzung`
              : "Ohne amtliche Berufskennung lässt sich das nicht sagen."
          }
        />
      </dl>

      {/*
        Der Weg in die Tiefe.
        
        Was hier steht, ist zwei Zeilen lang und soll es bleiben. Wer
        wissen will, woraus die Einschätzung entsteht — welche Anteile
        der Berufsgruppe wachsen, welche Angaben der Anzeige fehlen —,
        findet das in der vollständigen Analyse.
      */}
      <Link
        href={vollstaendigeAnalyseHref}
        className="inline-flex min-h-6 w-fit items-center gap-1.5 text-sm text-accent-text underline underline-offset-[3px]"
      >
        Ausführliche Einschätzung
        <ArrowRight aria-hidden className="size-3.5" strokeWidth={1.9} />
      </Link>
    </section>
  );
}

/**
 * Die Skala in Worte.
 *
 * 1 bis 5, gemittelt über die Berufsgruppe. Eine Zahl wie „3,4"
 * daneben wäre genauer und weniger verständlich — und die Genauigkeit
 * wäre falsch, weil der Mittelwert selbst über sehr verschiedene
 * Berufe streut.
 */
function zukunftswort(sicherheit: number): string {
  if (sicherheit >= 4.2) return "Sehr gefragt";
  if (sicherheit >= 3.4) return "Stabil";
  if (sicherheit >= 2.6) return "Im Wandel";
  return "Unter Druck";
}

function Zeile({
  begriff,
  wert,
  fussnote,
}: {
  begriff: string;
  wert: string | null;
  fussnote?: string;
}) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-sm text-ink-3">{begriff}</dt>
      <dd className="text-sm leading-relaxed">
        {wert ?? <span className="text-ink-3">Nicht einschätzbar</span>}
      </dd>
      {fussnote && <p className="text-xs leading-relaxed text-ink-3">{fussnote}</p>}
    </div>
  );
}
