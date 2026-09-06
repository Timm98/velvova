"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

/**
 * Die zweite Zeile im Arbeitgeberbereich.
 *
 * ── Warum sie NEBEN dem normalen Kopf steht und nicht statt ihm ──
 *
 * Hier lag eine eigene Kopfzeile: eigenes Zeichen, eigene Marke
 * („Velvova für Arbeitgeber"), eigene Wege, andere Höhe, andere
 * Breite. Wer aus der Startseite in den Arbeitgeberbereich wechselte,
 * wechselte damit die ganze Anwendung — und auf einer Fläche, auf der
 * jemand über Bewerbungsdaten entscheidet, ist das das falsche Signal:
 * Es sieht aus wie ein zweites Produkt, dem man ein zweites Mal
 * vertrauen muss.
 *
 * Der Velvova-Kopf bleibt deshalb unverändert stehen, mit Suche,
 * Wegen und Konto. Diese Zeile kommt darunter — sie sagt, in welchem
 * Bereich man ist und was es dort gibt, und nicht, wo man ist.
 *
 * ── Warum als Client-Komponente ───────────────────────────────
 *
 * Wegen `usePathname`. Der aktive Punkt muss stimmen; eine Navigation,
 * in der nichts hervorgehoben ist, zwingt zum Lesen aller Einträge,
 * um herauszufinden, wo man steht.
 */

const WEGE = [
  { href: "/business", label: "Übersicht", exakt: true },
  /* Vor „Stellen“, weil das Gespräch der Weg zu einer Stelle ist und
     nicht ein Werkzeug daneben. */
  { href: "/business/onboarding", label: "Stelle einrichten" },
  { href: "/business/stellen", label: "Stellen" },
  { href: "/business/matches", label: "Matches" },
  { href: "/business/bewerbungen", label: "Gespräche" },
  { href: "/business/unternehmensseite", label: "Unternehmensseite" },
  { href: "/business/analysen", label: "Analysen" },
  { href: "/business/team", label: "Team" },
  { href: "/business/einstellungen", label: "Einstellungen" },
];

export function BusinessNav({ organisation }: { organisation: string | null }) {
  const pfad = usePathname();

  return (
    <div className="border-b border-line bg-surface">
      <div className="mx-auto flex w-full max-w-(--breite-inhalt) items-center gap-4 px-5 md:px-8">
        {organisation && (
          <span className="hidden shrink-0 py-3 text-sm font-semibold text-ink lg:block">
            {organisation}
          </span>
        )}

        {/*
          Waagerecht scrollbar statt umbrechend.

          Acht Wege passen auf dem Telefon nicht in eine Zeile. Ein
          Umbruch machte daraus zwei Zeilen und schob den Inhalt nach
          unten; scrollbar bleibt die Zeile eine Zeile, und man sieht
          am angeschnittenen letzten Eintrag, dass es weitergeht.
        */}
        <nav aria-label="Arbeitgeberbereich" className="min-w-0 flex-1 overflow-x-auto">
          <ul className="flex items-center gap-1">
            {WEGE.map((w) => {
              const aktiv = w.exakt ? pfad === w.href : pfad.startsWith(w.href);
              return (
                <li key={w.href}>
                  <Link
                    href={w.href}
                    aria-current={aktiv ? "page" : undefined}
                    className={cn(
                      "inline-flex min-h-11 items-center whitespace-nowrap border-b-2 px-3 text-sm transition-colors",
                      aktiv
                        ? "border-accent font-medium text-ink"
                        : "border-transparent text-ink-2 hover:text-ink",
                    )}
                  >
                    {w.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}
