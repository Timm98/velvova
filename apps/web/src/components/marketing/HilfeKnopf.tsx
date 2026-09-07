"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { brand } from "@paycheck/config";
import { SupportChat } from "@/app/(public)/help/SupportChat";

/**
 * Der Chatknopf unten rechts — für Besucher ohne Konto.
 *
 * ── Warum nicht das Monday-Dock ─────────────────────────────────
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
 * „Frag Monday" auf der Startseite würde ein Karrieregespräch
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

          {/*
            ══════════════════════════════════════════════════════
            Ein Weg zu einem Menschen, immer sichtbar
            ══════════════════════════════════════════════════════

            Das Fenster heisst „Hilfe & Kontakt" und bot bisher nur
            das eine: ein Gespräch mit einer Maschine. Wer damit nicht
            weiterkommt — und das ist der Fall, in dem man diesen
            Knopf drückt —, stand vor keiner zweiten Tür.

            Die Adresse steht deshalb fest unter dem Gespräch, nicht
            erst nach einer Fehlermeldung. Sie kommt aus `brand`, wie
            überall sonst: Eine zweite, hier hingeschriebene Adresse
            liefe beim nächsten Wechsel auseinander.
          */}
          <div className="mt-4 border-t border-line pt-3.5">
            <p className="text-xs leading-relaxed text-ink-3">
              Kommst du nicht weiter? Schreib uns:{" "}
              <a
                href={`mailto:${brand.supportEmail}`}
                className="text-accent-text underline underline-offset-[3px]"
              >
                {brand.supportEmail}
              </a>
            </p>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOffen((v) => !v)}
        aria-expanded={offen}
        /*
          ══════════════════════════════════════════════════════════
          Die Vorlage, jetzt richtig gelesen
          ══════════════════════════════════════════════════════════

          Beim ersten Versuch hatte ich die Ecken gemessen und 24
          Pixel herausbekommen. Das war ein Messfehler an der Kante:
          Vergrössert man den Ausschnitt, ist es eine PILLE — voll
          gerundet, 60 Pixel hoch.

          Und das Zeichen sitzt nicht frei neben der Schrift, sondern
          in einem eigenen, etwas helleren Kreis am linken Rand. Das
          ist der Grund, warum der Knopf trotz dunkler Fläche als
          Knopf gelesen wird: Der Kreis gibt ihm einen Anfang.

            Breite    184 CSS      Höhe      60
            Füllung   #181c25      Kante     #545f78
            Kreis     ~44, etwas heller als die Fläche
            Schrift   #e1e4ea

          Nicht blau: Blau ist die Farbe des Hauptwegs, und der ist
          auf jeder Seite etwas anderes als „Hilfe". Zwei blaue Knöpfe
          streiten um dieselbe Bedeutung.
        */
        style={{ background: "#181c25" }}
        className="ml-auto flex h-16 items-center gap-3 rounded-full border border-line-3 py-2 pl-2 pr-7 text-[15px] text-ink shadow-lg transition-colors hover:bg-inset focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {/*
          Der Kreis um das Zeichen — heller als die Fläche, damit er
          sich abhebt, aber ohne eigene Kante: Zwei Ränder ineinander
          sind einer zu viel.
        */}
        {/*
          Der Kreis in der Farbe der Vorlage, nicht in der Akzentfarbe.

          Ich hatte ihn kurz blau gemacht, weil er grau in grau wie
          abgeschaltet aussah. Am Bild nachgemessen ist er das aber
          nicht: #282e3f, also die Knopffläche eine Stufe heller —
          genug, um sich abzuheben, ohne eine zweite Aussage zu
          machen.

          Das Zeichen darin steht in #e1e4ea, derselben Helligkeit
          wie die Schrift daneben. Dieser Unterschied trägt den Kreis:
          nicht seine Farbe, sondern der Sprung von der Fläche zum
          Zeichen.
        */}
        <span
          aria-hidden
          style={{ background: "#282e3f" }}
          className="grid size-12 shrink-0 place-items-center rounded-full text-ink"
        >
          {offen ? (
            <X className="size-5" strokeWidth={2} />
          ) : (
            <Fragezeichenblase className="size-6" />
          )}
        </span>
        {offen ? "Schliessen" : "Hilfe & Kontakt"}
      </button>
    </div>
  );
}

/**
 * Zwei eckige Sprechblasen, in der vorderen ein Fragezeichen.
 *
 * Der Symbolsatz hat das nicht: `MessageCircleQuestion` ist rund und
 * einzeln, `MessagesSquare` hat zwei Blasen aber kein Fragezeichen.
 * Die Vorlage zeigt beides zusammen — und beides trägt Bedeutung:
 * Das Fragezeichen sagt „Hilfe", die zweite Blase sagt „Gespräch".
 *
 * Deshalb hier gezeichnet statt zusammengesetzt. Zwei übereinander
 * gelegte Symbole hätten doppelte Striche an den Überschneidungen.
 */
function Fragezeichenblase({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {/* Die hintere Blase — nur ihr sichtbarer Teil rechts. */}
      <path d="M16.5 8.5h2.6a1.9 1.9 0 0 1 1.9 1.9v4.2a1.9 1.9 0 0 1-1.9 1.9h-.6v2.6l-2.6-2.6h-2.4" />

      {/* Die vordere Blase mit Zipfel unten links. */}
      <path d="M4.9 3h9.2a1.9 1.9 0 0 1 1.9 1.9v5.7a1.9 1.9 0 0 1-1.9 1.9H8.2L5.6 15.1v-2.6h-.7A1.9 1.9 0 0 1 3 10.6V4.9A1.9 1.9 0 0 1 4.9 3Z" />

      {/* Das Fragezeichen. */}
      <path d="M7.9 6.2a1.7 1.7 0 0 1 3.3.6c0 1.1-1.6 1.4-1.6 2.5" />
      <path d="M9.6 11.1h.01" />
    </svg>
  );
}
