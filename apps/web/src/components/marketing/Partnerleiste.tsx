import Image from "next/image";

/**
 * Die Markenzeile unter dem Core.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum Kacheln und keine frei stehenden Logos
 * ══════════════════════════════════════════════════════════════
 *
 * Die fünf Dateien sind keine Logo-Assets, sondern Vorschaubilder:
 *
 *     OpenAI      3840 × 2160   Alpha
 *     linkedin    1024 × 1024   ohne Alpha
 *     indeed      1200 × 630    Alpha
 *     stepstone    800 × 330    ohne Alpha
 *     claude       600 × 600    ohne Alpha
 *
 * Drei von fünf haben keinen Alphakanal, tragen also ihren eigenen
 * farbigen Grund mit. Frei nebeneinandergestellt sieht das aus wie ein
 * Versehen: zwei Logos schweben, drei sitzen in einem Kasten.
 *
 * Eine Kachel dreht das um. Wenn jedes Zeichen in derselben runden
 * Fläche sitzt, ist der mitgebrachte Grund kein Fehler mehr, sondern
 * der Inhalt der Kachel — und die Zeile wirkt gewollt statt schlampig.
 * Das ist auch der Grund für `object-cover` mit quadratischem
 * Zuschnitt: Bei einem 16:9-Vorschaubild mit kleinem Zeichen in der
 * Mitte schneidet es die leeren Ränder weg, statt das Zeichen auf
 * Briefmarkengrösse zu schrumpfen.
 *
 * Sobald eng beschnittene Dateien mit Transparenz vorliegen — die
 * gibt es auf den Presseseiten der Marken —, kann `KACHEL` entfallen
 * und die Zeile auf frei stehende Zeichen umgestellt werden.
 *
 * ══════════════════════════════════════════════════════════════
 * Was die Überschrift behauptet
 * ══════════════════════════════════════════════════════════════
 *
 * Sie steht als Eigenschaft im Aufruf, nicht fest im Bauteil. Der
 * Grund ist keine Bequemlichkeit: Was diese Marken für Velvova sind,
 * entscheidet ein Vertrag, nicht eine Komponente.
 *
 * Das Quellenregister führt LinkedIn, Indeed und StepStone unter
 * „Nicht freigegebene Plattformen". Das betrifft die Datennutzung und
 * sagt über eine Geschäftsbeziehung nichts — aber wer hier „Partner"
 * setzt, behauptet eine solche Beziehung öffentlich. Wer die
 * Überschrift setzt, muss wissen, was zutrifft.
 */
type Marke = {
  name: string;
  datei: string;
};

const MARKEN: Marke[] = [
  { name: "LinkedIn", datei: "/marken/linkedin.webp" },
  { name: "Indeed", datei: "/marken/indeed.png" },
  { name: "StepStone", datei: "/marken/stepstone.png" },
  { name: "OpenAI", datei: "/marken/OpenAI.png" },
  { name: "Claude", datei: "/marken/claude.png" },
];

/*
 * Querformat, nicht quadratisch.
 *
 * Der erste Versuch waren quadratische Kacheln mit `object-cover`.
 * Das schnitt genau die Wortmarken an, um die es geht: Aus StepStone
 * wurde „psto", aus OpenAI „Open". Ein angeschnittener Markenname
 * sieht kaputt aus, egal wie sauber die Kachel ist.
 *
 * `object-contain` in einem Querformat zeigt jedes Bild ganz. Vier
 * der fünf Vorlagen sind breiter als hoch; das quadratische
 * Claude-Zeichen bekommt links und rechts Luft und wirkt dadurch
 * nicht schwerer als die Wortmarken.
 */
const KACHEL_BREIT = 84;
const KACHEL_HOCH = 44;

export function Partnerleiste({ titel = "Partner" }: { titel?: string }) {
  return (
    <section aria-label={titel}>
      <p className="text-center text-2xs font-medium uppercase tracking-[0.16em] text-ink-3">
        {titel}
      </p>

      {/*
        Umbruch statt Laufband.

        Eine automatisch scrollende Logoschlange zieht den Blick vom
        Einstieg weg und lässt sich nicht anhalten. Fünf Kacheln passen
        auf jeder Breite in eine oder zwei Zeilen — dafür braucht es
        keine Bewegung.
      */}
      <ul className="mt-4 flex flex-wrap items-center justify-center gap-3 md:gap-4">
        {MARKEN.map((m) => (
          <li
            key={m.name}
            title={m.name}
            className="overflow-hidden rounded-(--radius-md) border border-line opacity-80 transition-opacity hover:opacity-100"
            style={{ width: KACHEL_BREIT, height: KACHEL_HOCH }}
          >
            <Image
              src={m.datei}
              alt={m.name}
              width={KACHEL_BREIT}
              height={KACHEL_HOCH}
              className="h-full w-full object-contain"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
