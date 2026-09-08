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
 * Warum drei Marken zwei Dateien haben und zwei nicht
 * ══════════════════════════════════════════════════════════════
 *
 * Das OpenAI-Zeichen ist einfarbig: Schwarz verschwindet auf dunklem
 * Grund, Weiss auf hellem. Bei Claude gilt dasselbe für die Hälfte —
 * der Stern ist orange und überall sichtbar, der Schriftzug daneben
 * schwarz und auf dunklem Grund kaum zu lesen. Beide bekommen deshalb
 * je Seite ihre Fassung, so wie AMEX und die Überweisung bei den
 * Zahlungsarten.
 *
 * Bei StepStone ist es der kleine Zusatz „group" unter der Wortmarke:
 * Er steht in einem gedeckten Blau, das auf hellem Grund liest und auf
 * dunklem nicht mehr.
 *
 * LinkedIn und Indeed tragen durchgehend ein kräftiges Blau und
 * bleiben deshalb je eine Datei — sie sind auf beiden Seiten sichtbar,
 * und eine zweite Fassung wäre eine Datei mehr ohne Unterschied.
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
  {
    name: "StepStone",
    datei: "/marken/stepstone-frei.png",
    dateiDunkel: "/marken/stepstone-dunkel-frei.png",
  },
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

/**
 * Der erklärende Satz unter der Zeile.
 *
 * Er steht hier und nicht im Aufruf, weil er nichts behauptet, was
 * nicht im Code steht — anders als die Überschrift darüber.
 *
 * ── Was er sagt und warum es stimmt ─────────────────────────
 *
 * LinkedIn, Indeed und StepStone stehen im Quellenregister als
 * `link_only` mit leeren `allowedOperations`: kein Abruf, kein
 * Zwischenspeichern, kein Umformulieren. Was Velvova mit ihnen macht,
 * ist genau das, was der Satz sagt — es nimmt entgegen, was jemand
 * mitbringt.
 *
 * OpenAI und Anthropic sind die beiden Anbieter, zwischen denen
 * `factory.ts` wählt. Auch das ist eine Tatsache über den Betrieb und
 * keine Aussage über einen Vertrag.
 *
 * ── Was er bewusst NICHT sagt ───────────────────────────────
 *
 * Nichts über eine Geschäftsbeziehung. Der Satz erklärt, was mit
 * diesen fünf Namen im Produkt geschieht; ob mit einem davon ein
 * Vertrag besteht, steht in keiner Datei, die ich lesen kann.
 */
const ERKLAERUNG =
  "Stellen von LinkedIn, Indeed und StepStone kannst du hier prüfen: Du bringst den Link " +
  "oder den Text mit, und Monday ordnet ein, was darin steht. Die Seiten selbst rufen wir " +
  "nicht ab und speichern sie nicht. Die Einordnung läuft über Sprachmodelle von OpenAI " +
  "und Anthropic — deine Angaben werden dabei nicht zum Training verwendet.";

export function Partnerleiste({
  titel = "Wir arbeiten mit diesen Partnern zusammen",
  erklaerung = ERKLAERUNG,
}: {
  titel?: string;
  /** Leerer String blendet den Satz aus. */
  erklaerung?: string;
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
      <ul className="mt-4 flex flex-wrap items-center justify-center gap-3">
        {MARKEN.map((m) => (
          <li
            key={m.name}
            title={m.name}
            /*
             * Jede Marke in ihrem eigenen Rahmen.
             *
             * Ein Zwischenstand fasste alle fünf in einen Kasten. Das
             * trennte die Zeile vom Core, machte aber aus fünf Angaben
             * einen Block — und der Block war das Auffällige, nicht das,
             * was darin steht.
             *
             * Einzeln gerahmt ist jede Marke wieder eine für sich. Der
             * Ton ist derselbe wie vorher, nur kleinteiliger:
             * `--ed-canvas` ist die Fläche der Seite und in beiden
             * Darstellungen eine Spur dunkler als die Karte. Mehr
             * Unterschied würde die Zeichen erschlagen, die ohnehin die
             * einzigen farbigen Dinge auf der Karte sind.
             *
             * Die Kacheln werden dabei unterschiedlich breit — jede
             * genau so breit, wie ihr Zeichen ist. Gleich gross sind
             * sie in der Höhe, und das ist die Achse, an der das Auge
             * eine Reihe misst.
             */
            className="markenbadge flex items-center justify-center rounded-(--radius-md) border border-line px-4 py-3"
            style={{ background: "var(--ed-canvas)" }}
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

      {erklaerung ? (
        <p className="mx-auto mt-5 max-w-[54ch] text-center text-2xs leading-relaxed text-ink-3">
          {erklaerung}
        </p>
      ) : null}
    </section>
  );
}
