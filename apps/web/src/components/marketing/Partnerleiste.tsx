import Image from "next/image";

/**
 * Die Markenzeile unter dem Core.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum hier nichts mehr ausgeglichen werden muss
 * ══════════════════════════════════════════════════════════════
 *
 * Ein erster Anlauf stand auf fünf Vorschaubildern mit
 * Seitenverhältnissen von 1:1 bis 2,42 und drei verschiedenen
 * Hintergründen. Dagegen half nichts: Gleich grosse Kacheln wirkten
 * unterschiedlich schwer, `object-cover` schnitt die Wortmarken an
 * („psto", „Open"), und `object-contain` liess drei Marken in einem
 * Kasten sitzen, während zwei schwebten.
 *
 * Die eigentliche Lösung lag nicht im CSS, sondern in den Dateien.
 * Die richtigen lagen bereits vor — `*_Badge_4K_White.png`, alle
 * 3840 × 2160, alle mit dem Zeichen mittig auf weissem Grund. Ich
 * hatte sie als „zu gross" aussortiert und die Vorschaubilder
 * behalten; das war der Fehler, nicht die Darstellung.
 *
 * Der Zusatz `-badge` im Dateinamen ist kein Schmuck: Next legt
 * optimierte Bilder unter Pfad und Breite ab. Beim ersten Austausch
 * blieben die Namen gleich, und die Seite zeigte weiter die alten
 * Dateien — sichtbar nur daran, dass „the stepstone group" rechts
 * angeschnitten war, wo im neuen Bild Platz ist.
 *
 * Jetzt haben alle fünf dasselbe Seitenverhältnis wie die Kachel.
 * Damit ist `object-contain` gleich `object-cover`: Es wird nichts
 * beschnitten und nichts eingepasst, weil es nichts auszugleichen
 * gibt. Auf 480 Pixel Breite verkleinert wiegt jede Datei rund 20 KB
 * statt einem halben Megabyte.
 *
 * ══════════════════════════════════════════════════════════════
 * Was die Zeile behauptet
 * ══════════════════════════════════════════════════════════════
 *
 * Der Satz darüber steht als Eigenschaft im Aufruf, nicht fest im
 * Bauteil. Er behauptet eine Geschäftsbeziehung, und ob sie besteht,
 * entscheidet ein Vertrag und keine Komponente.
 *
 * Das Quellenregister führt LinkedIn, Indeed und StepStone unter
 * „Nicht freigegebene Plattformen". Das betrifft die Datennutzung und
 * sagt über eine Partnerschaft nichts — aber wer den Satz stehen
 * lässt, sagt sie öffentlich zu.
 */
type Marke = {
  name: string;
  datei: string;
};

const MARKEN: Marke[] = [
  { name: "LinkedIn", datei: "/marken/linkedin-badge.png" },
  { name: "Indeed", datei: "/marken/indeed-badge.png" },
  { name: "StepStone", datei: "/marken/stepstone-badge.png" },
  { name: "OpenAI", datei: "/marken/openai-badge.png" },
  { name: "Claude", datei: "/marken/claude-badge.png" },
];

/*
 * 16:9 — dasselbe Verhältnis wie die Dateien.
 *
 * Genau deshalb sitzt jedes Zeichen gleich gross und gleich mittig,
 * ohne dass irgendwo ein Ausgleich nötig wäre.
 */
const KACHEL_BREIT = 112;
const KACHEL_HOCH = 63;

export function Partnerleiste({
  titel = "Wir arbeiten mit diesen Partnern zusammen",
}: {
  titel?: string;
}) {
  return (
    <section aria-label={titel}>
      <p className="text-center text-sm leading-relaxed text-ink-2">{titel}</p>

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
            className="overflow-hidden rounded-(--radius-md) border border-line opacity-90 transition-opacity hover:opacity-100"
            /* Weiss unter der Kachel: Vier Dateien bringen ihren weissen
               Grund mit, die von OpenAI ist transparent und stünde
               sonst als einzige dunkel zwischen vier hellen. */
            style={{ width: KACHEL_BREIT, height: KACHEL_HOCH, background: "#ffffff" }}
          >
            <Image
              src={m.datei}
              alt={m.name}
              width={KACHEL_BREIT}
              height={KACHEL_HOCH}
              className="h-full w-full object-cover"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
