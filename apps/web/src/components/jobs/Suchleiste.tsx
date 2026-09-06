import { Search, MapPin } from "lucide-react";

/**
 * Die Stellensuche als Formular — ohne JavaScript funktionsfähig.
 *
 * Bewusst ein `GET`-Formular und keine Client-Komponente mit
 * `router.push`: Das Ergebnis bekommt dadurch eine eigene Adresse, die
 * man verschicken, als Lesezeichen ablegen und mit dem Zurück-Knopf
 * verlassen kann. Eine Suche, deren Ergebnis keine Adresse hat, ist
 * für den Nutzer nicht wiederauffindbar.
 *
 * Und sie arbeitet, bevor irgendein Bündel geladen ist — auf der
 * Startseite ist das die erste Handlung, die jemand ausführen will.
 */
export function Suchleiste({
  q = "",
  ort = "",
  gross = false,
  kompakt = false,
}: {
  q?: string;
  ort?: string;
  /** Für den Hero der Startseite: grösser, mit kräftigerem Knopf. */
  gross?: boolean;
  /** Für die Kopfzeile: ein Feld statt drei, ohne eigenen Knopf. */
  kompakt?: boolean;
}) {
  const feld = gross ? "h-14 text-base" : "h-11 text-sm";

  /*
   * In der Kopfzeile bleibt ein einziges Feld.
   *
   * Drei nebeneinander passen dort bei 1024 Pixeln nicht mehr neben
   * Logo, Navigation und Anmeldeknopf, ohne dass die Zeile umbricht.
   * Der Ort wird auf der Ergebnisseite nachgereicht — dort steht die
   * volle Leiste.
   */
  if (kompakt) {
    return (
      <form action="/jobs" method="get" role="search" aria-label="Stellensuche" className="relative">
        <label htmlFor="kopf-suche" className="sr-only">
          Beruf, Tätigkeit oder Unternehmen
        </label>
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3"
        />
        <input
          id="kopf-suche"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Jobs suchen"
          autoComplete="off"
          className="h-9 w-full min-w-[9rem] rounded-(--radius-md) border border-line bg-surface pl-9 pr-3 text-sm placeholder:text-ink-3 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
        />
      </form>
    );
  }

  return (
    <form
      action="/jobs"
      method="get"
      role="search"
      aria-label="Stellensuche"
      className={`grid gap-2 sm:grid-cols-[1fr_1fr_auto] ${gross ? "sm:gap-2.5" : ""}`}
    >
      <div className="relative">
        <label htmlFor="suche-q" className="sr-only">
          Beruf, Tätigkeit oder Unternehmen
        </label>
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3"
        />
        <input
          id="suche-q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Beruf oder Tätigkeit"
          autoComplete="off"
          className={`w-full rounded-(--radius-md) border border-line bg-surface pl-10 pr-3 ${feld} placeholder:text-ink-3 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent`}
        />
      </div>

      <div className="relative">
        <label htmlFor="suche-ort" className="sr-only">
          Ort
        </label>
        <MapPin
          aria-hidden
          className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3"
        />
        <input
          id="suche-ort"
          name="ort"
          type="search"
          defaultValue={ort}
          placeholder="Ort"
          autoComplete="off"
          className={`w-full rounded-(--radius-md) border border-line bg-surface pl-10 pr-3 ${feld} placeholder:text-ink-3 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent`}
        />
      </div>

      <button
        type="submit"
        className={`rounded-(--radius-md) bg-accent px-6 font-semibold text-on-accent transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${feld}`}
      >
        Jobs finden
      </button>
    </form>
  );
}
