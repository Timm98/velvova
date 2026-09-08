import Image from "next/image";

/**
 * Die Markenzeile unter dem Core.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum jedes Logo eine eigene Höhe bekommt
 * ══════════════════════════════════════════════════════════════
 *
 * Gleiche Pixelhöhe heisst nicht gleiche Wirkung. Die fünf Dateien
 * haben Seitenverhältnisse von 1,00 bis 2,42:
 *
 *     claude      600 × 600    1,00   quadratisch
 *     OpenAI     3840 × 2160   1,78
 *     indeed     1200 × 630    1,90
 *     stepstone   800 × 330    2,42   breite Wortmarke
 *
 * Auf dieselbe Höhe gesetzt wirkt das quadratische Zeichen doppelt
 * so schwer wie die breite Wortmarke — es füllt seine Fläche ganz
 * aus, sie nur einen Streifen davon. Deshalb steht bei jedem Eintrag
 * eine eigene Höhe: nicht Willkür, sondern der Ausgleich für das,
 * was das Auge tatsächlich sieht.
 *
 * `object-contain` sorgt dafür, dass nichts verzerrt oder
 * abgeschnitten wird. Die Breite ergibt sich aus dem Verhältnis.
 *
 * ══════════════════════════════════════════════════════════════
 * Was diese Zeile behauptet — und was nicht
 * ══════════════════════════════════════════════════════════════
 *
 * Die Überschrift steht als Eigenschaft im Aufruf, nicht fest im
 * Bauteil. Der Grund: Was diese Marken für Velvova sind, entscheidet
 * ein Vertrag, nicht eine Komponente.
 *
 * Das Quellenregister führt LinkedIn, Indeed und StepStone unter
 * „Nicht freigegebene Plattformen" — das betrifft die Datennutzung.
 * Über eine Geschäftsbeziehung sagt es nichts. Wer die Überschrift
 * setzt, muss wissen, was zutrifft.
 */
type Marke = {
  name: string;
  datei: string;
  /** Sichtbare Höhe in Pixeln — je Marke ausgeglichen, siehe oben. */
  hoehe: number;
  breite: number;
};

const MARKEN: Marke[] = [
  { name: "LinkedIn", datei: "/marken/linkedin.webp", hoehe: 22, breite: 88 },
  { name: "Indeed", datei: "/marken/indeed.png", hoehe: 22, breite: 42 },
  { name: "StepStone", datei: "/marken/stepstone.png", hoehe: 20, breite: 48 },
  /* Quadratisch, deshalb kleiner: Bei 22 Pixeln stünde es als Klotz
     zwischen den Wortmarken. */
  { name: "Claude", datei: "/marken/claude.png", hoehe: 18, breite: 18 },
  { name: "OpenAI", datei: "/marken/OpenAI.png", hoehe: 20, breite: 36 },
];

export function Partnerleiste({ titel = "Partner" }: { titel?: string }) {
  return (
    <section className="mx-auto w-full max-w-[1240px] px-5 pb-16 md:px-8 md:pb-24">
      <p className="text-center text-2xs font-medium uppercase tracking-[0.16em] text-ink-3">
        {titel}
      </p>

      {/*
        Umbruch statt Laufband.

        Eine automatisch scrollende Logoschlange zieht den Blick vom
        Einstieg weg und lässt sich nicht anhalten. Fünf Marken passen
        auf jeder Breite in eine oder zwei Zeilen — dafür braucht es
        keine Bewegung.
      */}
      <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-6 md:gap-x-14">
        {MARKEN.map((m) => (
          <li key={m.name} className="flex items-center">
            <Image
              src={m.datei}
              alt={m.name}
              width={m.breite}
              height={m.hoehe}
              style={{ height: `${m.hoehe}px`, width: "auto" }}
              className="object-contain opacity-70 transition-opacity hover:opacity-100"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
