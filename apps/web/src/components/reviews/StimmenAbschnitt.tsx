import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Sterne } from "./Sterne";
import { Bewertungskarte } from "./Bewertungskarte";
import { BewertungAbgebenKnopf } from "./BewertungFormular";
import { fuerStartseite, kennzahlen } from "@/lib/reviews/lesen";

/**
 * „Das sagen unsere Nutzer" — auf der Startseite.
 *
 * Drei Entscheidungen, die diesen Bereich von einem eingebundenen
 * Bewertungs-Widget unterscheiden:
 *
 *   **Er verschwindet, wenn es nichts zu zeigen gibt.** Kein „Noch
 *   keine Bewertungen", kein Platzhalter, keine erfundenen Stimmen. Eine
 *   leere Vertrauensfläche schafft kein Vertrauen, sie kostet welches.
 *
 *   **Die Zahl steht vor den Karten.** Wer wissen will, ob das Produkt
 *   taugt, sucht zuerst den Durchschnitt und die Anzahl. Die einzelnen
 *   Stimmen liest, wer schon interessiert ist.
 *
 *   **Auf dem Telefon wird gewischt, nicht gestapelt.** Sechs Karten
 *   untereinander sind auf einem Telefon zwei Bildschirme Scrollen
 *   zwischen zwei Abschnitten. Waagerecht mit Einrastpunkten bleibt es
 *   ein Abschnitt — und man merkt, dass es mehrere sind.
 */
export async function StimmenAbschnitt() {
  const [zahlen, stimmen] = await Promise.all([kennzahlen(), fuerStartseite(6)]);

  // Nichts da: dann steht hier nichts. Siehe oben.
  if (stimmen.length === 0) return null;

  return (
    <section aria-labelledby="stimmen">
      <div className="mx-auto w-full max-w-[1180px] px-5 py-20 md:px-8 md:py-28">
        <div className="flex flex-wrap items-end justify-between gap-x-12 gap-y-6">
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--ed-violet-text)" }}>
              Stimmen
            </p>
            <h2
              id="stimmen"
              className="mt-4 max-w-[16ch] font-display text-[1.75rem] font-normal leading-[1.14] tracking-[-0.02em] md:text-[2.25rem]"
              style={{ color: "var(--ed-ink)" }}
            >
              Das sagen unsere Nutzer
            </h2>
          </div>

          {zahlen.schnitt !== null && (
            <div className="flex items-center gap-4">
              <span
                className="font-display text-[2.75rem] font-normal leading-none tracking-[-0.02em] tabular"
                style={{ color: "var(--ed-ink)" }}
              >
                {zahlen.schnitt.toLocaleString("de-DE", {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })}
              </span>
              <span className="grid gap-1">
                <Sterne wert={zahlen.schnitt} />
                <span className="text-sm" style={{ color: "var(--ed-ink-2)" }}>
                  {zahlen.anzahl === 1
                    ? "1 veröffentlichte Bewertung"
                    : `${zahlen.anzahl} veröffentlichte Bewertungen`}
                </span>
              </span>
            </div>
          )}
        </div>

        {/*
         * Waagerecht mit Einrastpunkten auf dem Telefon, Raster ab
         * Tablet.
         *
         * `snap-x` und `snap-start` geben dem Wischen den Halt, den es
         * ohne sie nicht hat — eine Karte bleibt dort stehen, wo man
         * losgelassen hat, statt irgendwo dazwischen. Der negative
         * Aussenabstand lässt die erste Karte am Seitenrand beginnen
         * und die letzte ganz hinausschieben.
         */}
        <ul className="-mx-5 mt-12 flex snap-x snap-mandatory gap-5 overflow-x-auto px-5 pb-2 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 lg:grid-cols-3">
          {stimmen.map((s) => (
            <li
              key={s.id}
              className="w-[84vw] max-w-[24rem] shrink-0 snap-start md:w-auto md:max-w-none"
            >
              <Bewertungskarte bewertung={s} editorial />
            </li>
          ))}
        </ul>

        <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3">
          <BewertungAbgebenKnopf />
          <Link
            href="/reviews"
            className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium"
            style={{ color: "var(--ed-violet-text)" }}
          >
            Alle Bewertungen ansehen
            <ArrowRight aria-hidden className="size-4" strokeWidth={2} />
          </Link>
        </div>
      </div>
    </section>
  );
}
