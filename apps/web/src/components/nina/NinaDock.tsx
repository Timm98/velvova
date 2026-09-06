"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { MessagesSquare } from "lucide-react";
import { NinaDrawer } from "./NinaDrawer";
import { NinaHinweis } from "./NinaHinweis";
import { useNina } from "./NinaProvider";

/**
 * Nina auf jeder Seite — Knopf und Gesprächsfläche.
 *
 * Die eine Ausnahme: auf der Vollbildseite des Gesprächs erscheint
 * beides nicht. Nina zweimal gleichzeitig auf demselben Bildschirm wäre
 * kein Angebot, sondern eine Verdopplung — und die schwebende Fläche
 * würde ausgerechnet den Composer verdecken, den sie ersetzen soll.
 *
 * ── Warum der Knopf wieder da ist ─────────────────────────────
 *
 * Hier stand: „Nur der Drawer, kein schwebender Knopf mehr. Nina steht
 * seit dem Umbau als Pille im Header." Dann wurde die Pille entfernt —
 * und damit war die Fläche auf keiner Seite mehr zu öffnen. Der Drawer
 * existierte weiter, unerreichbar.
 *
 * Das ist die Sorte Fehler, die kein Test findet: nichts ist kaputt,
 * nichts wirft, die Komponente rendert. Nur kommt niemand mehr hin.
 *
 * Der Knopf ist deshalb bewusst leise: klein, am Rand, ohne Beschriftung
 * und ohne Signalfarbe. Er soll erreichbar sein, nicht auffordern — der
 * Unterschied zwischen einem Zugang und einem Support-Widget.
 */
export function NinaDock({ assistantName }: { assistantName: string }) {
  const pathname = usePathname();
  const nina = useNina();

  if (pathname.startsWith("/app/nina")) return null;

  return (
    <>
      <button
        type="button"
        /* Umschalten, nicht nur öffnen: Seit die Karte kein Kreuz
           mehr trägt, ist die Blase der Weg hinaus. */
        onClick={() => nina.setOpen(!nina.open)}
        aria-expanded={nina.open}
        aria-label={nina.open ? "Schliessen" : `${assistantName} fragen`}
        title={`${assistantName} fragen`}
        /*
         * Über der unteren Leiste auf schmalen Geräten.
         *
         * `calc(var(--nav-bottom-h) + 1rem)` statt eines festen Werts:
         * die Leiste ist 64 Pixel hoch, und ein Knopf darunter wäre auf
         * dem Telefon nicht zu treffen. Ab `md` gibt es keine untere
         * Leiste, dort genügt der normale Abstand.
         */
        className={
          /*
           * Klein, unten rechts, sonst nirgends.
           *
           * Vorher 48 Pixel mit kräftigem Schatten — das ist die Grösse
           * eines Support-Widgets, und genau so las es sich. Nina ist
           * kein Widget, sondern ein Zugang: erreichbar, nicht
           * auffordernd.
           *
           * Jetzt 36 Pixel, ein zurückgenommener Rand statt Schatten.
           * Auf dem Telefon bleibt der Abstand zur unteren Leiste —
           * ein Knopf darunter wäre nicht zu treffen.
           */
          cn(
            "fixed right-5 z-40 grid size-9 place-items-center rounded-full",
            "bg-surface text-ink-3 ring-1 ring-line-2",
            "transition-colors hover:bg-soft hover:text-ink-2",
            "bottom-[calc(var(--nav-bottom-h)+1rem)] md:bottom-5",
            /*
             * Kurzes Blinken, wenn jemand von woanders herkommt.
             *
             * Ein Knopf mitten auf der Seite öffnet die Fläche unten
             * rechts — ohne Hinweis sucht man sie. Der Ring blinkt
             * zweieinhalb Sekunden und zeigt, wohin man geschickt
             * wurde.
             *
             * `motion-safe`: Wer Bewegung abgeschaltet hat, bekommt
             * den Ring in Akzentfarbe, aber ohne Pulsieren.
             */
            nina.puls && "ring-2 ring-accent text-accent motion-safe:animate-[puls-ring_800ms_ease-in-out_infinite]",
          )
        }
      >
        <MessagesSquare className="size-4" strokeWidth={1.8} />
      </button>

      <NinaHinweis assistantName={assistantName} />
      <NinaDrawer assistantName={assistantName} />
    </>
  );
}
