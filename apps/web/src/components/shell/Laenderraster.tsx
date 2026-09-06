import Link from "next/link";
import Image from "next/image";
import type { Landzeile } from "@/lib/jobs/laenderbestand";

/**
 * Die Märkte, in denen wir Stellen haben — mit Flagge und Anzahl.
 *
 * Jede Kachel führt in die Suche mit gesetztem Land, und die Zahl
 * daneben ist dieselbe, die die Suche dort zeigt. Damit ist das Raster
 * eine Auskunft und keine Behauptung: Wer misstraut, klickt und zählt.
 *
 * Länder ohne Stellen stehen gar nicht drin — sie werden schon beim
 * Zählen entfernt.
 */
export function Laenderraster({ laender }: { laender: Landzeile[] }) {
  if (laender.length === 0) return null;

  return (
    <section aria-labelledby="maerkte" className="grid gap-4">
      <h2 id="maerkte" className="font-mono text-2xs uppercase tracking-[0.14em] text-ink-3">
        Märkte
      </h2>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {laender.map((l) => (
          <li key={l.code}>
            <Link
              href={`/jobs?land=${l.code}`}
              className="group flex min-h-11 items-center gap-2.5 rounded-(--radius-sm) text-sm text-ink-2 transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {l.flagge ? (
                /*
                  `alt` bleibt leer: Der Ländername steht direkt daneben
                  im Text. Ein Screenreader läse sonst „Flagge
                  Deutschland, Deutschland".
                */
                <Image
                  src={l.flagge}
                  alt=""
                  width={24}
                  height={18}
                  /*
                    Der feine helle Rand kommt aus CSS, nicht aus dem
                    Bild. Im Bogen war er schwarz eingebrannt — als
                    Bildinhalt liess er sich weder umfärben noch dem
                    Farbschema anpassen und sass im dunklen Modus als
                    schwarzer Kasten auf blauem Grund.
                    `scripts/flaggen-schneiden.py` schneidet ihn weg.
                  */
                  /*
                    24×18, nicht 24×16 — und das ist kein Geschmack.

                    Die Dateien sind 128×96, also 4:3. Bei `w-6` und
                    `h-auto` rechnet der Browser daraus 24×18. Standen
                    in den Attributen 24×16, wich das Ergebnis vom
                    angekündigten Seitenverhältnis ab, und Next meldete
                    das — einmal pro Flagge, also neunzehnmal:

                      Image with src ".../de.webp" has either width or
                      height modified, but not the other.

                    Aufgefallen ist es erst beim Themenwechsel: Da
                    zeichnet der Fussbereich neu, und die Meldungen
                    erschienen auf einen Schlag. Ein alter Kommentar
                    hier nannte die Dateien 160×105 — nachgemessen sind
                    es 128×96.

                    `h-auto` bleibt: Ohne die zweite Angabe warnt Next
                    unabhängig vom Verhältnis.
                  */
                  className="h-auto w-6 shrink-0 rounded-[2px] ring-1 ring-white/25"
                  unoptimized
                />
              ) : (
                <span aria-hidden className="size-4 shrink-0 rounded-[2px] bg-inset" />
              )}
              <span className="truncate">{l.name}</span>
              <span className="ml-auto shrink-0 font-mono text-2xs tabular-nums text-ink-3">
                {l.stellen.toLocaleString("de-DE")}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
