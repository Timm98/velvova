"use client";

import { useEffect, useRef, useState } from "react";
import { MessagesSquare, X } from "lucide-react";
import { SupportChat } from "@/app/(public)/help/SupportChat";

/**
 * Der Chatknopf unten rechts — für Besucher ohne Konto.
 *
 * ── Warum nicht das Nina-Dock ─────────────────────────────────
 *
 * Das Dock aus der Anwendung hängt am `NinaProvider`: Es führt ein
 * Karrieregespräch, liest den Profilstand und schreibt in eine
 * Unterhaltung, die einem Konto gehört. Ohne Anmeldung gibt es nichts
 * davon.
 *
 * Was es ohne Konto gibt, ist der Supportchat: Er beantwortet Fragen
 * zum Produkt aus der Dokumentation. Genau der steckt hier drin — kein
 * zweiter Chat, der dasselbe noch einmal baut.
 *
 * ── Warum er ehrlich beschriftet ist ──────────────────────────
 *
 * „Frag Nina" auf der Startseite würde ein Karrieregespräch
 * versprechen, das erst nach der Anmeldung beginnt. Hier steht
 * deshalb „Hilfe & Kontakt": Wer das öffnet, bekommt genau das.
 */
export function HilfeKnopf({ assistantName }: { assistantName: string }) {
  const [offen, setOffen] = useState(false);
  const feld = useRef<HTMLDivElement>(null);

  /* Escape schliesst, und der Fokus geht zurück auf den Knopf —
     sonst springt er an den Seitenanfang. */
  useEffect(() => {
    if (!offen) return;
    const beiTaste = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOffen(false);
        feld.current?.querySelector("button")?.focus();
      }
    };
    document.addEventListener("keydown", beiTaste);
    return () => document.removeEventListener("keydown", beiTaste);
  }, [offen]);

  return (
    <div ref={feld} className="fixed bottom-5 right-5 z-50 print:hidden">
      {offen && (
        <div
          role="dialog"
          aria-label="Hilfe und Kontakt"
          /* Wie eine Sprechblase, nicht wie ein Kasten.

             Vorher: Rahmen, Seitenfarbe, 8 Pixel Ecke — das las sich
             als angehefteter Ausschnitt der Seite. Eine Nachricht
             braucht keinen Rahmen; ihre Füllung IST ihre Grenze. Auf
             dunklem Grund ist `bg-page` unsichtbar ohne Rahmen,
             deshalb die erhöhte Fläche.

             18 Pixel: Der Radius der Vorlage liegt bei rund einem
             Fünftel der Blasenhöhe. */
          className="mb-3 max-h-[70vh] w-[min(92vw,26rem)] overflow-y-auto rounded-[18px] bg-raised p-4 shadow-lg"
        >
          <SupportChat nackt assistantName={assistantName} angemeldet={false} />
        </div>
      )}

      <button
        type="button"
        onClick={() => setOffen((v) => !v)}
        aria-expanded={offen}
        /* Ausdrücklich `rounded-full`, nicht das Formtoken.

           Der Rest der Oberfläche ist auf die eckige Sprache der
           Vorlage umgestellt; dieser Knopf bleibt eine Pille, weil
           er als schwebender Chat-Einstieg erkannt wird und nicht
           als Teil der Seite darunter. Auf Ansage. */
        className="ml-auto flex h-12 items-center gap-2.5 rounded-full bg-accent px-5 text-sm font-semibold text-accent-on shadow-lg transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {offen ? (
          <X aria-hidden className="size-[18px]" strokeWidth={2.2} />
        ) : (
          <MessagesSquare aria-hidden className="size-[18px]" strokeWidth={2} />
        )}
        {offen ? "Schliessen" : "Hilfe & Kontakt"}
      </button>
    </div>
  );
}
