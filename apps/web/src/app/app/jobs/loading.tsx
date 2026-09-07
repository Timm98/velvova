import { ArrowUp, MessagesSquare } from "lucide-react";
import { PageHeader } from "@/components/ui/states";
import { Skeleton } from "@/components/ui";

/**
 * Was zu sehen ist, während die Stellenseite lädt.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum diese Datei den Übergang überhaupt erst möglich macht
 * ══════════════════════════════════════════════════════════════
 *
 * Ohne sie gab es keine Bewegung vom Gespräch hierher — nur einen
 * Schnitt. Gemessen: Ein Klick auf „Jobs" wechselte die Adresse erst
 * nach 3414, 3636 und 3839 Millisekunden, weil die Seite `dynamic`
 * ist und der Server erst die ganze Liste rechnet, bevor irgendetwas
 * ankommt.
 *
 * `startViewTransition` friert das Bild ein, solange es auf die neue
 * Seite wartet, und Chromium bricht nach vier Sekunden ab. Genau das
 * geschah: „View transition update callback timed out." Der Browser
 * verwarf den Übergang, und übrig blieb der harte Wechsel.
 *
 * Mit dieser Datei schaltet Next die Adresse sofort um und zeigt
 * dieses Gerüst, während die echten Daten nachlaufen. Der Übergang
 * hat damit eine Zielseite, die in Millisekunden dasteht — und kann
 * das, wofür er gebaut ist.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das Gerüst der echten Seite bis auf den Pixel folgt
 * ══════════════════════════════════════════════════════════════
 *
 * Das Suchfeld trägt denselben `view-transition-name` wie das Feld im
 * Gespräch. Der Browser bewegt es von dort hierher — also entscheidet
 * die Stelle, an der es HIER steht, wo die Bewegung endet. Steht es
 * im Gerüst hundert Pixel zu hoch, endet die Bewegung hundert Pixel
 * zu hoch und die echte Seite ruckt danach zurecht.
 *
 * Deshalb stehen Überschrift, Hinweiskasten und Hinweiszeile hier in
 * derselben Reihenfolge und mit denselben Abständen wie in
 * `page.tsx`. Wer dort etwas über dem Suchfeld ändert, muss es hier
 * mitändern.
 *
 * Der Hinweiskasten ist eine Wette: Er steht auf der echten Seite
 * nur, solange das Profil nicht bestätigt ist. Wer aus dem Gespräch
 * hierher geführt wird, hat es gerade erst begonnen — dann steht er
 * da. Bei bestätigtem Profil rückt die Liste beim Eintreffen der
 * Daten um seine Höhe nach oben. Die Alternative wäre, ihn nie zu
 * reservieren und den Sprung bei ALLEN zu haben.
 */
export default function StellenseiteLaedt() {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <PageHeader className="uebergang-stellen-titel" title="Deine besten Möglichkeiten" />

      {/* Platz des Hinweiskastens „Diese Reihenfolge ist noch nicht auf
          dich zugeschnitten" — px-5 py-4 um zwei Zeilen `text-sm
          leading-relaxed`. */}
      <div className="uebergang-stellen-hinweis rounded-(--radius-surface) bg-accent-soft px-5 py-4">
        <div className="grid max-w-[var(--measure)] gap-2.5">
          <Skeleton className="h-3.5" />
          <Skeleton className="h-3.5 w-2/5" />
        </div>
      </div>

      {/* Die Hinweiszeile „Nach oben scrollen …". Auf der echten Seite
          ist sie meist unsichtbar, hält aber ihren Platz — hier
          genauso, mit denselben Massen. */}
      <div
        aria-hidden
        className="mx-auto flex items-center gap-2 px-4 py-1.5 text-2xs opacity-0"
      >
        <ArrowUp className="size-3.5" strokeWidth={2} />
        Nach oben scrollen
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
        {/*
          Dasselbe Feld wie im Gespräch — derselbe Name, dieselben
          Masse. Hier endet die Bewegung.

          Es ist bewusst kein `<input>`: Ein Feld, in das man tippen
          kann, dessen Eingabe aber verloren geht, sobald die echte
          Seite es ersetzt, ist schlimmer als eines, das sichtbar noch
          nicht bereit ist.
        */}
        <div className="uebergang-sucheingabe flex items-center gap-2 rounded-(--radius-pill) bg-raised py-2 pl-5 pr-2 shadow-sm">
          <MessagesSquare className="size-[18px] shrink-0 text-accent" strokeWidth={1.9} aria-hidden />
          {/* Der echte Platzhaltertext, kein grauer Balken: Er hängt
              an keiner Abfrage, und was man schon weiss, als Balken zu
              zeigen lässt eine Seite kaputt aussehen, die gleich da
              ist. */}
          <div className="flex h-12 min-w-0 flex-1 items-center">
            <span className="truncate text-base text-ink-3">
              Frag Monday oder beschreibe deinen nächsten Job …
            </span>
          </div>
          <div className="size-9 shrink-0 rounded-(--radius-full) bg-soft" />
        </div>
      </div>

      {/* Die Liste. Vier Zeilen sind genug, damit die Seite als Liste
          lesbar ist; mehr wäre ein Versprechen über die Zahl der
          Treffer, das wir hier nicht geben können. */}
      <div className="uebergang-stellen-liste grid gap-2" aria-busy="true" aria-live="polite">
        <span className="sr-only">Stellen werden geladen</span>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="grid gap-2.5 rounded-(--radius-surface) border border-line p-4">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3.5 w-1/4" />
            <Skeleton className="h-3.5 w-3/5" />
          </div>
        ))}
      </div>
    </div>
  );
}
