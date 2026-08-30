import { cn } from "@/lib/cn";

/**
 * Die Produktvisualisierungen der Landingpage.
 *
 * Drei Stück, mehr nicht: Gespräch, Profil, Bewerbung. Alles als SVG
 * und CSS — kein Bild, kein Stockfoto, kein Roboterkopf, keine
 * erfundenen Menschen. Das ist keine Sparmaßnahme, sondern die einzige
 * ehrliche Möglichkeit: ein Stockfoto einer lächelnden Person neben
 * einem Karriereversprechen behauptet ein Ergebnis, das niemand
 * zusichern kann.
 *
 * Die Flächen zeigen die echte Oberfläche in ihrer eigenen Formsprache:
 * dieselben Radien, dieselben Farben, dieselbe Ruhe. Wer die Seite
 * öffnet, sieht danach nichts Neues — und genau das ist der Zweck einer
 * Produktansicht.
 *
 * Was später ersetzt werden soll: sobald es freigegebene Aufnahmen der
 * echten Oberfläche gibt, treten sie an die Stelle dieser drei
 * Bauteile. Bis dahin ist eine gezeichnete Ansicht ehrlicher als ein
 * gekauftes Foto.
 */

function Flaeche({
  className,
  children,
  tone = "surface",
}: {
  className?: string;
  children: React.ReactNode;
  tone?: "surface" | "lavender" | "ice";
}) {
  return (
    <div
      className={cn(
        "rounded-(--radius-canvas) p-6 shadow-lg",
        tone === "surface" && "bg-raised",
        tone === "lavender" && "bg-lavender",
        tone === "ice" && "bg-ice",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Eine Textzeile als Balken. Steht für Inhalt, ohne welchen zu erfinden. */
function Zeile({ w, dim = false }: { w: string; dim?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn("block h-2.5 rounded-full", dim ? "bg-soft" : "bg-soft-hover")}
      style={{ width: w }}
    />
  );
}

/**
 * Das Hero-Visual: ein Gespräch, ein Profil, drei Stellen.
 *
 * Überlappend statt nebeneinander. Vier Rechtecke in einer Reihe sehen
 * aus wie ein Vergleichsdiagramm; überlappende Flächen sehen aus wie
 * ein Produkt, in dem eines aus dem anderen folgt.
 */
export function HeroVisual({ assistantName }: { assistantName: string }) {
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-[880px]">
      {/* Das Licht dahinter. Sehr weit, sehr schwach. */}
      <div
        className="pointer-events-none absolute -inset-x-16 -top-16 h-[420px]"
        style={{ background: "var(--glow-nina)" }}
      />

      <div className="relative grid gap-4 sm:grid-cols-[1.25fr_1fr] sm:items-start">
        {/* Das Gespräch */}
        <Flaeche className="sm:mt-10">
          <div className="flex items-center gap-2.5">
            <span className="size-6 rounded-full" style={{ background: "var(--wash-lavender)" }} />
            <span className="text-sm font-medium">{assistantName}</span>
          </div>
          <p className="mt-5 max-w-[26ch] font-display text-[19px] leading-[1.4] tracking-[-0.01em]">
            Was soll sich durch deinen nächsten Schritt konkret verbessern?
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {["Mehr Entwicklung", "Passendere Aufgaben"].map((c) => (
              <span
                key={c}
                className="rounded-(--radius-chip) bg-soft px-3.5 py-2 text-xs text-ink-2"
              >
                {c}
              </span>
            ))}
          </div>
          <div className="mt-6 flex items-center gap-3 rounded-(--radius-textarea) bg-soft px-5 py-3.5">
            <span className="text-sm text-ink-3">Deine Antwort …</span>
            <span className="ml-auto size-8 rounded-full bg-accent" />
          </div>
        </Flaeche>

        <div className="grid gap-4">
          {/* Das Profil */}
          <Flaeche tone="lavender">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink-3">
              Dein Profil
            </p>
            <div className="mt-4 grid gap-2.5">
              <Zeile w="88%" />
              <Zeile w="64%" />
              <Zeile w="76%" dim />
            </div>
            <div className="mt-5 flex items-center gap-2">
              <span className="size-2 rounded-full bg-positive" />
              <span className="text-xs text-ink-2">4 von 6 Bereichen klar</span>
            </div>
          </Flaeche>

          {/* Drei Stellen */}
          <Flaeche tone="ice">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink-3">
              Passende Stellen
            </p>
            <ul className="mt-4 grid gap-3">
              {["sehr gut", "gut", "gut"].map((band, i) => (
                <li key={i} className="flex items-center gap-3">
                  <span className="size-8 shrink-0 rounded-full bg-raised" />
                  <span className="grid flex-1 gap-1.5">
                    <Zeile w={["82%", "68%", "74%"][i]!} />
                    <Zeile w="44%" dim />
                  </span>
                  <span className="rounded-(--radius-chip) bg-raised px-2.5 py-1 text-2xs text-ink-2">
                    {band}
                  </span>
                </li>
              ))}
            </ul>
          </Flaeche>
        </div>
      </div>
    </div>
  );
}

/** Das Profil-Visual: Belege, die auf Bestätigung warten. */
export function ProfileVisual() {
  return (
    <div aria-hidden className="relative w-full max-w-[460px]">
      <Flaeche tone="lavender">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink-3">
          Was verstanden wurde
        </p>
        <ul className="mt-5 grid gap-4">
          {[
            { text: "Führte ein Team von vier Personen", bestätigt: true },
            { text: "Löst Probleme lieber, als sie zu verwalten", bestätigt: true },
            { text: "Sucht rund um Karlsruhe, höchstens zwei Bürotage", bestätigt: false },
          ].map((e) => (
            <li key={e.text} className="flex items-start gap-3">
              <span
                className={cn(
                  "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold",
                  e.bestätigt ? "bg-positive-soft text-positive" : "bg-raised text-ink-3",
                )}
              >
                {e.bestätigt ? "✓" : "?"}
              </span>
              <span className="text-sm leading-relaxed text-ink-2">{e.text}</span>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-xs text-ink-3">
          Nichts zählt, bevor du es bestätigt hast.
        </p>
      </Flaeche>
    </div>
  );
}

/** Das Bewerbungs-Visual: vorbereitet, nicht verschickt. */
export function ApplyVisual() {
  return (
    <div aria-hidden className="relative w-full max-w-[460px]">
      <Flaeche>
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink-3">
          Bewerbung vorbereiten
        </p>
        <div className="mt-5 grid gap-3">
          {["Lebenslauf angepasst", "Anschreiben entworfen", "Screening-Fragen beantwortet"].map(
            (schritt) => (
              <div
                key={schritt}
                className="flex items-center gap-3 rounded-(--radius-input) bg-soft px-4 py-3"
              >
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-positive-soft text-[11px] font-bold text-positive">
                  ✓
                </span>
                <span className="text-sm text-ink-2">{schritt}</span>
              </div>
            ),
          )}
        </div>
        <div className="mt-5 rounded-(--radius-input) bg-ice px-4 py-3">
          <p className="text-xs leading-relaxed text-ink-2">
            Nichts wird verschickt, bevor du es freigegeben hast.
          </p>
        </div>
      </Flaeche>
    </div>
  );
}
