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
 * Warum OpenAI zwei Dateien hat und die anderen nicht
 * ══════════════════════════════════════════════════════════════
 *
 * Das OpenAI-Zeichen ist einfarbig. Schwarz verschwindet auf dunklem
 * Grund, Weiss auf hellem — es braucht deshalb je Seite seine Fassung,
 * so wie AMEX und die Überweisung bei den Zahlungsarten.
 *
 * Die vier anderen tragen ihre Markenfarbe: LinkedIn und Indeed Blau,
 * StepStone Blau mit Farbverlauf, Claude Orange und Schwarz. Die sind
 * auf beiden Seiten sichtbar und bleiben eine Datei.
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
  { name: "Claude", datei: "/marken/claude-frei.png" },
];

/*
 * Zwei Masse, und beide sind Absicht.
 *
 * Der Platz je Marke ist 120 × 64 und überall gleich — daran liegt es,
 * dass die Zeile ruhig wirkt. Das Zeichen darin bekommt 110 × 42 und
 * `object-contain`: Es füllt diesen Rahmen nie ganz aus, sondern
 * passt sich hinein, und die 11 Pixel Luft ringsum verhindern, dass
 * eine breite Wortmarke an die nächste stösst.
 *
 * Die Dateien sind 16:9 mit dem Zeichen mittig im transparenten
 * Rahmen. In einem Feld von 110 × 42 — also deutlich flacher — bindet
 * deshalb die Höhe, und alle fünf werden auf dasselbe Mass gebracht.
 * Genau das ist der Grund, warum sie optisch gleich gross wirken,
 * obwohl LinkedIn ein breites Wort und Claude ein Zeichen plus Wort
 * ist.
 */
const FELD_BREIT = 120;
const FELD_HOCH = 64;
const ZEICHEN_BREIT = 110;
const ZEICHEN_HOCH = 42;

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
      <ul className="mt-4 flex flex-wrap items-center justify-center gap-0">
        {MARKEN.map((m) => (
          <li
            key={m.name}
            title={m.name}
            /*
             * Kein Rahmen und keine Fläche.
             *
             * Beides gab es in früheren Fassungen, und beides war eine
             * Antwort auf Dateien, die ihren eigenen Grund mitbrachten.
             * Freigestellte Zeichen brauchen weder das eine noch das
             * andere: Sie stehen auf der Fläche der Karte, und was sie
             * gleich gross macht, ist der gleiche Platz — nicht ein
             * Kasten darum.
             */
            className="markenbadge flex items-center justify-center"
            style={{ width: FELD_BREIT, height: FELD_HOCH, background: "transparent" }}
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
              width={ZEICHEN_BREIT}
              height={ZEICHEN_HOCH}
              style={{ width: ZEICHEN_BREIT, height: ZEICHEN_HOCH, background: "transparent" }}
              className={m.dateiDunkel ? "fuer-hell object-contain" : "object-contain"}
            />
            {m.dateiDunkel ? (
              <Image
                src={m.dateiDunkel}
                alt=""
                aria-hidden
                width={ZEICHEN_BREIT}
                height={ZEICHEN_HOCH}
                style={{ width: ZEICHEN_BREIT, height: ZEICHEN_HOCH, background: "transparent" }}
                className="fuer-dunkel object-contain"
              />
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
