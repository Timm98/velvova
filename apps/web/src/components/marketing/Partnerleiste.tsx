import Image from "next/image";

/**
 * Die Markenzeile unter dem Core.
 *
 * ══════════════════════════════════════════════════════════════
 * Dritter Anlauf, und diesmal lag es wieder an den Dateien
 * ══════════════════════════════════════════════════════════════
 *
 * Der erste stand auf fünf Vorschaubildern mit Seitenverhältnissen von
 * 1:1 bis 2,42 und drei verschiedenen Hintergründen — dagegen half
 * kein CSS. Der zweite auf Badge-Dateien, alle 16:9, aber mit
 * eingebranntem weissem beziehungsweise schwarzem Grund: einheitlich,
 * nur brachte jede Kachel ihre eigene Fläche mit und sass als Kasten
 * in einer Karte, die schon eine Fläche hat.
 *
 * Jetzt liegen alle Zeichen freigestellt vor, 3840 × 2160, gemessen
 * nur zu rund zehn Prozent deckend. Damit braucht es weder Rahmen
 * noch Fläche: Sie stehen auf der Karte, und was sie gleich gross
 * macht, ist der gleiche Platz.
 *
 * ── Der Zusatz `-frei` im Dateinamen ────────────────────────
 * Next legt optimierte Bilder unter Pfad und Breite ab. Die Pfade
 * `/marken/linkedin.png` und so weiter gab es in diesem Projekt
 * bereits — mit weissem Grund. Nach dem Austausch zeigte die Seite
 * weiter die alten: fünf Zeichen mit weissem und blauem Kasten,
 * obwohl in den Dateien nachweislich keiner steckt. Ein neuer Name
 * ist die einzige verlässliche Art, diesen Speicher zu umgehen.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum zwei Marken zwei Dateien haben und drei nicht
 * ══════════════════════════════════════════════════════════════
 *
 * Das OpenAI-Zeichen ist einfarbig: Schwarz verschwindet auf dunklem
 * Grund, Weiss auf hellem. Bei Claude gilt dasselbe für die Hälfte —
 * der Stern ist orange und überall sichtbar, der Schriftzug daneben
 * schwarz und auf dunklem Grund kaum zu lesen. Beide bekommen deshalb
 * je Seite ihre Fassung, so wie AMEX und die Überweisung bei den
 * Zahlungsarten.
 *
 * Die drei anderen tragen durchgehend ihre Markenfarbe: LinkedIn und
 * Indeed Blau, StepStone Blau mit Farbverlauf. Die sind auf beiden
 * Seiten sichtbar und bleiben eine Datei.
 *
 * ══════════════════════════════════════════════════════════════
 * Was die Zeile behauptet
 * ══════════════════════════════════════════════════════════════
 *
 * Der Satz darüber steht als Eigenschaft im Aufruf, nicht fest im
 * Bauteil. Er sagt eine Geschäftsbeziehung zu, und ob sie besteht,
 * entscheidet ein Vertrag und keine Komponente.
 *
 * Das Quellenregister führt LinkedIn, Indeed und StepStone unter
 * „Nicht freigegebene Plattformen". Das betrifft die Datennutzung und
 * sagt über eine Partnerschaft nichts — aber wer den Satz stehen
 * lässt, sagt sie öffentlich zu.
 */
type Marke = {
  name: string;
  /** Das freigestellte Zeichen. Gilt für beide Darstellungen … */
  datei: string;
  /** … ausser hier steht eine zweite Fassung für die dunkle Seite. */
  dateiDunkel?: string;
};

const MARKEN: Marke[] = [
  { name: "LinkedIn", datei: "/marken/linkedin-frei.png" },
  { name: "Indeed", datei: "/marken/indeed-frei.png" },
  { name: "StepStone", datei: "/marken/stepstone-frei.png" },
  { name: "OpenAI", datei: "/marken/openai-hell-frei.png", dateiDunkel: "/marken/openai-dunkel-frei.png" },
  {
    name: "Claude",
    datei: "/marken/claude-frei.png",
    dateiDunkel: "/marken/claude-dunkel-frei.png",
  },
];

/*
 * Die Höhe bindet, die Breite ergibt sich.
 *
 * Ein Zwischenstand gab jedem Zeichen ein Feld von 110 × 42. Das
 * klang nach gleicher Grösse und war zur Hälfte Luft: Die Dateien
 * sind 16:9, auf 42 Pixel Höhe gebracht also rund 75 breit. Die
 * restlichen 35 Pixel je Kachel waren durchsichtiger Rand — und zu
 * fünft ergab das 175 Pixel Lücke, die niemand gesetzt hatte.
 *
 * Deshalb steht hier nur noch die Höhe. Alle fünf Dateien haben
 * dasselbe Seitenverhältnis, also werden sie dadurch ohnehin gleich
 * gross; die Breite folgt und ist bei allen dieselbe. Der Abstand
 * dazwischen ist jetzt der Abstand der Liste und sonst nichts.
 */
const ZEICHEN_HOCH = 42;

export function Partnerleiste({
  titel = "Wir arbeiten mit diesen Partnern zusammen",
}: {
  titel?: string;
}) {
  return (
    <section
      aria-label={titel}
      /*
       * Ein eigenes Feld am Fuss der Karte.
       *
       * Bis eben standen die Zeichen direkt auf der Kartenfläche und
       * gehörten dadurch optisch zum Core — als wären sie Teil der
       * Darstellung statt eine Angabe darunter.
       *
       * Ein Rahmen allein hätte das nicht getrennt: Die Karte hat
       * selbst einen, und zwei gleiche Linien ineinander lesen sich
       * als Versehen. Deshalb zusätzlich ein Ton Unterschied —
       * `--ed-canvas` ist die Fläche der Seite, auf der die Karte
       * liegt. Sie ist in beiden Darstellungen eine Spur dunkler als
       * `--ed-surface`, und mehr braucht es nicht: Das Feld soll sich
       * abheben, nicht hervortreten.
       */
      className="rounded-(--radius-md) border border-line px-4 py-5"
      style={{ background: "var(--ed-canvas)" }}
    >
      <p className="text-center text-sm leading-relaxed text-ink-2">{titel}</p>

      {/*
        Umbruch statt Laufband.

        Eine automatisch scrollende Logoschlange zieht den Blick vom
        Einstieg weg und lässt sich nicht anhalten. Fünf Kacheln passen
        auf jeder Breite in eine oder zwei Zeilen — dafür braucht es
        keine Bewegung.
      */}
      <ul className="mt-4 flex flex-wrap items-center justify-center gap-x-7 gap-y-4">
        {MARKEN.map((m) => (
          <li
            key={m.name}
            title={m.name}
            /*
             * Kein Rahmen, keine Fläche, keine feste Breite.
             *
             * Rahmen und Fläche gab es in früheren Fassungen, und
             * beides war eine Antwort auf Dateien, die ihren eigenen
             * Grund mitbrachten. Freigestellte Zeichen brauchen weder
             * das eine noch das andere — und auch kein Feld, in dem
             * sie sitzen: Was sie gleich gross macht, ist die gleiche
             * Höhe.
             */
            className="markenbadge flex items-center justify-center"
            style={{ background: "transparent" }}
          >
            {/*
              Beide Fassungen stehen im Markup, umgeschaltet wird über
              CSS. Ein Wechsel per JavaScript käme erst nach der
              Hydratation und zeigte beim Laden für einen Moment die
              falsche — genauso läuft es bei den Zahlungsarten.
            */}
            <Image
              src={m.datei}
              alt={m.name}
              width={ZEICHEN_HOCH * 3}
              height={ZEICHEN_HOCH}
              style={{ height: ZEICHEN_HOCH, width: "auto", background: "transparent" }}
              className={m.dateiDunkel ? "fuer-hell object-contain" : "object-contain"}
            />
            {m.dateiDunkel ? (
              <Image
                src={m.dateiDunkel}
                alt=""
                aria-hidden
                width={ZEICHEN_HOCH * 3}
                height={ZEICHEN_HOCH}
                style={{ height: ZEICHEN_HOCH, width: "auto", background: "transparent" }}
                className="fuer-dunkel object-contain"
              />
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
