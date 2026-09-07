"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { NinaVisual } from "@/components/nina/NinaVisual";

/**
 * Der Monday-Streifen unter der Kopfzeile.
 *
 * ── Warum er hier steht ───────────────────────────────────────
 *
 * Monday war bisher ein Punkt in der Navigation wie jeder andere —
 * ein Wort zwischen fünf Wörtern. Sie ist aber nicht ein Bereich der
 * Anwendung, sondern die Art, wie man sie bedient. Ein eigener
 * Streifen direkt unter dem Kopf sagt das, ohne eine Seite dafür zu
 * verbrauchen.
 *
 * ── Warum mit Namen ───────────────────────────────────────────
 *
 * „Willkommen zurück" ohne Namen ist eine Höflichkeitsfloskel, die
 * jede Software sagt. Mit Namen ist es eine Feststellung: Wir wissen,
 * wer du bist, und das Gespräch von gestern läuft weiter.
 *
 * ── Warum nicht auf Mondays eigener Seite ───────────────────────
 *
 * Dort steht Monday bereits in voller Grösse. Ein zweites, kleineres
 * Abbild derselben Figur direkt darüber ist keine Wiedererkennung,
 * sondern ein Doppelbild.
 */
export function NinaStreifen({
  assistantName,
  userName,
  gespraechBegonnen = false,
}: {
  assistantName: string;
  userName: string | null;
  /**
   * Ob es schon ein Gespräch gibt.
   *
   * Der Knopf hiess erst „Sprich weiter mit Monday" — unabhängig davon,
   * ob je ein Wort gefallen war. „Weiter" zu jemandem zu sagen, mit
   * dem man noch nie gesprochen hat, ist die Art Freundlichkeit, die
   * sofort als Automatismus auffliegt.
   *
   * Dieselbe Unterscheidung traf die Heute-Seite bereits („Gespräch
   * fortsetzen" / „Gespräch beginnen"). Zwei Knöpfe mit derselben
   * Aufgabe und verschiedenen Beschriftungen sind einer zu viel;
   * dieser hier trägt sie jetzt und steht auf jeder Seite.
   */
  gespraechBegonnen?: boolean;
}) {
  /*
   * Nur auf der Startseite, sonst nirgends.
   *
   * Zuerst stand der Streifen auf jeder Seite ausser Mondays eigener.
   * Das war einer zu viel: Wer bereits in der Trefferliste steht oder
   * eine Bewerbung schreibt, hat sich für eine Tätigkeit entschieden —
   * ein dauerhaft blinkender Knopf daneben, der ihn woanders hinruft,
   * ist keine Hilfe, sondern eine Unterbrechung.
   *
   * Auf der Seite, auf der man nach dem Anmelden landet, ist er genau
   * richtig: Dort entscheidet sich, was man als Nächstes tut.
   */
  const pfad = usePathname();
  if (pfad !== "/app") return null;

  const vorname = userName?.trim().split(/\s+/)[0];
  const anrede = gespraechBegonnen
    ? vorname
      ? `Willkommen zurück, ${vorname}.`
      : "Willkommen zurück."
    : vorname
      ? `Schön, dass du da bist, ${vorname}.`
      : `Schön, dass du da bist.`;

  const knopf = gespraechBegonnen
    ? `Gespräch mit ${assistantName} fortsetzen`
    : `Gespräch mit ${assistantName} beginnen`;
  const knopfKurz = gespraechBegonnen ? "Gespräch fortsetzen" : "Gespräch beginnen";

  return (
    <div className="border-b border-line bg-sunken">
      <div className="mx-auto flex min-h-[72px] w-full max-w-(--breite-inhalt) items-center gap-4 px-5 py-2 md:gap-5 md:px-8">
        {/*
          Klein, aber das echte Modell — nicht ein Ersatzkreis.
          `beiInteresse` lädt es erst, wenn jemand bleibt: 9,7 MB sind
          viel für einen, der nach zwei Sekunden weiterklickt.
        */}
        <NinaVisual size="sm" strategie="beiInteresse" className="shrink-0" />

        <p className="min-w-0 flex-1 truncate text-[15px] text-ink-2">
          <span className="font-semibold text-ink">{anrede}</span>{" "}
          <span className="hidden sm:inline">
            {gespraechBegonnen
              ? `${assistantName} kennt deinen Stand und macht dort weiter, wo ihr aufgehört habt.`
              : `${assistantName} lernt dich in einem Gespräch kennen — danach passt jede Empfehlung zu dir.`}
          </span>
        </p>

        <Link
          href="/app/monday"
          className="nina-streifen__knopf inline-flex h-12 shrink-0 items-center gap-2.5 rounded-(--radius-pill) bg-accent px-6 text-base font-semibold text-accent-on transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <span className="hidden md:inline">{knopf}</span>
          <span className="md:hidden">{knopfKurz}</span>
          <ArrowRight aria-hidden className="size-[18px]" strokeWidth={2.2} />
        </Link>
      </div>
    </div>
  );
}
