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
          {/*
           * Beispielinhalt statt grauer Balken.
           *
           * Hier standen `<Zeile>`-Platzhalter — abgerundete graue
           * Streifen, wie man sie in einem Ladezustand verwendet. Auf
           * der Startseite lesen sie sich aber nicht als „hier stünde
           * etwas", sondern als „hier steht nichts": ein Produkt, das
           * sich selbst noch nicht zeigen kann.
           *
           * Der Inhalt unten ist ein Beispiel und keine Behauptung über
           * eine bestimmte Person. Deshalb steht darunter auch
           * ausdrücklich „Beispiel" — eine Startseite darf zeigen, wie
           * das Produkt aussieht, aber keine Nutzerdaten erfinden.
           */}
          <Flaeche tone="lavender">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink-3">
              Dein Profil
            </p>
            <ul className="mt-4 flex flex-wrap gap-1.5">
              {["Kundenkontakt", "Schichtplanung", "Organisation", "weniger körperlich"].map((t) => (
                <li
                  key={t}
                  className="rounded-(--radius-chip) bg-raised px-2.5 py-1 text-2xs text-ink-2"
                >
                  {t}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-center gap-2">
              <span className="size-2 rounded-full bg-positive" />
              <span className="text-xs text-ink-2">4 von 6 Bereichen klar</span>
            </div>
          </Flaeche>

          <Flaeche tone="ice">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink-3">
              Passende Stellen
            </p>
            <ul className="mt-4 grid gap-3">
              {[
                {
                  titel: "Operations Coordinator",
                  ort: "Karlsruhe · Hybrid",
                  geld: "53.000–59.000 €",
                  band: "Starker Fit",
                  stark: true,
                },
                {
                  titel: "Disponent Logistik",
                  ort: "Karlsruhe · Vor Ort",
                  geld: "48.000–52.000 €",
                  band: "Interessant",
                },
                {
                  titel: "Customer Operations",
                  ort: "Remote",
                  geld: "Gehalt nicht angegeben",
                  band: "Zu prüfen",
                },
              ].map((j) => (
                /*
                 * Zwei Zeilen, nicht eine.
                 *
                 * Der erste Anlauf stellte Bild, Titel, Ort, Gehalt und
                 * Passung nebeneinander. In einer Spalte von etwa 230
                 * Pixeln reicht das für nichts: Der Titel brach auf zwei
                 * Zeilen um, der Ort auf drei, und die Passungsmarke
                 * legte sich über die Überschrift.
                 *
                 * Titel oben, darunter Gehalt und Passung — das passt in
                 * die Breite und bleibt lesbar. Der Ort entfällt hier;
                 * in einer Vorschau ist er das Verzichtbarste.
                 */
                <li key={j.titel} className="grid gap-1">
                  <span className="truncate text-sm font-semibold leading-tight text-ink">
                    {j.titel}
                  </span>
                  <span className="flex items-center justify-between gap-2">
                    <span
                      className={
                        j.geld.includes("€")
                          ? "text-2xs font-semibold text-positive"
                          : "text-2xs italic text-ink-3"
                      }
                    >
                      {j.geld.replace("Gehalt nicht angegeben", "ohne Angabe")}
                    </span>
                    <span
                      className={
                        "shrink-0 rounded-(--radius-chip) px-2 py-0.5 text-2xs " +
                        /*
                       * Die Klassen des Gestaltungssystems, keine
                       * eigenen.
                       *
                       * Hier stand `bg-accent/12 text-accent`: zwölf
                       * Prozent der Akzentfarbe, gemischt mit dem
                       * bläulichen Grund der Karte — und darauf die
                       * ROHE Akzentfarbe statt der textsicheren
                       * Variante. Ergebnis 3,64:1, gefordert sind 4,5.
                       *
                       * axe hat es auf allen fünf Breiten gemeldet,
                       * zehn Fehlschläge. Gesehen habe ich es nicht,
                       * weil ich Typprüfung, Unit-Tests und
                       * Bildschirmfotos hatte — aber die
                       * Barrierefreiheitsreihe nie laufen liess.
                       *
                       * `bg-accent-soft` mit `text-accent-text` ist die
                       * dafür vorgesehene Paarung und misst 5,20:1.
                       */
                      (j.stark
                        ? "bg-accent-soft font-medium text-accent-text"
                        : "bg-raised text-ink-2")
                      }
                    >
                      {j.band}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-2xs text-ink-3">Beispiel — so sieht eine Trefferliste aus.</p>
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

/**
 * Aus einer Erfahrung werden mehrere Richtungen.
 *
 * Das Beispiel aus der Vorgabe, als Fächer statt als Liste: links, was
 * jemand mitbringt, rechts, wohin das führen kann. Die Linien dazwischen
 * sind der Punkt — eine Aufzählung würde dieselben Wörter zeigen und die
 * Beziehung verschweigen.
 *
 * Alles SVG und CSS. Kein Bild, keine erfundenen Menschen.
 */
export function RoleFanVisual() {
  const mitbringen = [
    "Erfahrung im Kundenservice",
    "Prozesse organisiert",
    "Neue Mitarbeitende eingearbeitet",
  ];
  const führenZu = [
    { rolle: "Customer Success", art: "naheliegend" },
    { rolle: "Implementation", art: "angrenzend" },
    { rolle: "Operations", art: "angrenzend" },
    { rolle: "Onboarding", art: "ungewöhnlich" },
    { rolle: "Projektkoordination", art: "ungewöhnlich" },
  ];

  return (
    <div aria-hidden className="relative w-full max-w-[560px]">
      <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <ul className="grid gap-2.5">
          {mitbringen.map((m) => (
            <li
              key={m}
              className="rounded-(--radius-md) bg-soft px-4 py-3 text-sm leading-snug text-ink-2"
            >
              {m}
            </li>
          ))}
        </ul>

        {/* Der Fächer. Drei Linien, die sich auf fünf Ziele öffnen. */}
        <svg
          viewBox="0 0 48 200"
          className="hidden h-[200px] w-12 sm:block"
          fill="none"
          preserveAspectRatio="none"
        >
          {[26, 63, 100, 137, 174].map((y) => (
            <path
              key={y}
              d={`M0 100 C 24 100, 24 ${y}, 48 ${y}`}
              stroke="var(--primary)"
              strokeOpacity="0.28"
              strokeWidth="1.5"
            />
          ))}
        </svg>

        <ul className="grid gap-2">
          {führenZu.map((r) => (
            <li
              key={r.rolle}
              className={cn(
                "flex items-center justify-between gap-3 rounded-(--radius-md) px-4 py-2.5 text-sm",
                r.art === "ungewöhnlich" ? "bg-lavender" : "bg-raised shadow-sm",
              )}
            >
              <span className="font-medium">{r.rolle}</span>
              <span className="shrink-0 text-xs text-ink-3">{r.art}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
