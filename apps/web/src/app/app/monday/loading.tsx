import { ArrowDown } from "lucide-react";

/**
 * Was zu sehen ist, während das Gespräch lädt.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum es die Datei gibt
 * ══════════════════════════════════════════════════════════════
 *
 * Dasselbe wie bei `app/jobs/loading.tsx`, nur für den Rückweg.
 *
 * Ein Klick auf „Nach oben scrollen, um mit Monday zu sprechen"
 * brauchte gemessen 990 und 1034 Millisekunden bis zum Adresswechsel.
 * `startViewTransition` friert das Bild ein, solange es wartet — man
 * sah also erst eine Sekunde Standbild und dann die Bewegung. Der
 * Hinweg lief bei 274 ms; der Rückweg fühlte sich daneben kaputt an.
 *
 * Mit diesem Gerüst schaltet Next die Adresse sofort um. Die
 * Bewegung beginnt, wenn der Klick kommt, nicht wenn der Server
 * fertig ist.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum es der echten Seite folgt
 * ══════════════════════════════════════════════════════════════
 *
 * Die drei Flächen tragen dieselben `view-transition-name` wie im
 * echten Gespräch: Kopf, Strom, Eingabefeld. Der Browser bewegt sie
 * also hierher — und wo sie HIER stehen, endet die Bewegung. Deshalb
 * dieselbe Spaltenbreite, dieselben Abstände, dasselbe Feld unten.
 *
 * Wer in `InterviewRoom` etwas an Kopf oder Feld ändert, muss es hier
 * mitändern.
 */
export default function GespraechLaedt() {
  return (
    <div className="relative h-full">
      <div className="relative mx-auto flex h-full w-full max-w-[820px] flex-col">
        {/* Kopf: Monday, Titel, Untertitel — 72 Pixel Fläche, dazu
            derselbe Abstand oben und unten wie im Gespräch. */}
        <header className="uebergang-gespraech-kopf flex shrink-0 flex-wrap items-center gap-x-6 gap-y-3 pt-6 pb-5">
          {/* 120 Pixel hoch, nicht 72: So hoch ist Mondays Fläche im
              Gespräch gemessen — das Licht hinter ihr reicht über ihren
              Kreis hinaus. Mit 72 war der Kopf 116 statt 164 hoch, und
              der Nachrichtenstrom begann 48 Pixel zu weit oben. */}
          <div className="grid size-[120px] shrink-0 place-items-center">
            <div className="size-[72px] rounded-(--radius-full) bg-raised" />
          </div>
          {/*
            Name und Zeile darunter stehen als echter Text da, nicht als
            graue Balken.

            Sie hängen an keiner Abfrage — sie sind in jedem Gespräch
            dieselben. Als Balken zu zeigen, was man schon weiss, macht
            aus einer Seite, die gleich da ist, eine, die kaputt
            aussieht. Genau das war auf der Aufnahme zu sehen: ein
            grauer Kreis, zwei graue Striche, sonst nichts.
          */}
          <div className="grid min-w-0 flex-1 gap-1">
            <h1 className="font-display text-xl font-normal text-ink">Monday</h1>
            <p className="text-sm text-ink-2">Einen Moment, ich hole unser Gespräch.</p>
          </div>
        </header>

        {/* Der Nachrichtenstrom. Leer statt mit Platzhaltertext: Ein
            Gespräch vorzutäuschen, das es noch nicht gibt, ist etwas
            anderes als eine Fläche, die noch lädt. */}
        <div
          className="uebergang-gespraech-strom min-h-0 flex-1 pt-2 pr-1 pb-6"
          aria-busy="true"
          aria-live="polite"
        >
          <span className="sr-only">Gespräch wird geladen</span>
        </div>

        {/* Das Feld — hier endet die Bewegung vom Suchfeld der
            Stellenseite. Kein `<textarea>`: Eingaben, die beim
            Eintreffen der echten Seite verloren gingen, wären
            schlimmer als ein Feld, das sichtbar noch nicht bereit
            ist. Genau 70 Pixel hoch, wie das echte. */}
        <div className="relative shrink-0 -mx-2 px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          <div className="uebergang-sucheingabe flex h-[70px] items-center gap-2 rounded-(--radius-pill) border border-line bg-raised px-5">
            <span className="text-base text-ink-3">Schreib Monday oder sprich mit ihr …</span>
          </div>
          <div
            aria-hidden
            className="mx-auto mt-1 flex items-center gap-2 px-4 py-1.5 text-2xs text-ink-3 opacity-70"
          >
            <ArrowDown className="size-3.5" strokeWidth={2} />
            Weiter zu deinen Stellen
          </div>
        </div>
      </div>
    </div>
  );
}
