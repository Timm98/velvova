"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, Briefcase, FileText, Home, MessagesSquare, Search, User } from "lucide-react";
import { cn } from "@/lib/cn";
import { useNinaActions } from "@/components/nina/NinaProvider";

/**
 * Der obere Header.
 *
 * Er ersetzt die permanente linke Icon-Leiste. Der Grund ist nicht
 * Geschmack: eine schmale Spalte aus Symbolen ohne Beschriftung ist die
 * Form, die Verwaltungssoftware seit zwanzig Jahren benutzt, und sie
 * bringt genau deren Anmutung mit. Wer einen Job sucht, arbeitet nicht
 * in einem Admin-Panel.
 *
 * Fünf Bereiche mit Namen, mittig. Aktiv ist eine weiche Kapsel, keine
 * Unterstreichung und kein Rechteck.
 *
 * Der Nina-Knopf steht rechts als Pille. Er öffnet den Drawer, ohne die
 * Seite neu zu laden — der Zustand liegt im Provider, der über der
 * Route sitzt.
 *
 * Hier steht bewusst KEINE Nina.
 *
 * Vorher trug der Header an drei Stellen den Signalring: als Marke, im
 * Bereich „Nina" und auf der Pille. Daneben stand auf der Gesprächs-
 * seite die echte Nina aus nina.glb — und damit sahen Menschen zwei
 * verschiedene Ninas gleichzeitig. Genau das verbietet die Vorgabe.
 *
 * Der naheliegende Ausweg wäre gewesen, auch in den Header das Modell
 * zu setzen. Er ist falsch, und zwar aus derselben Vorgabe: „Das Modell
 * darf nicht als unlesbare kleine Kugel erscheinen." Bei 28 Pixeln wäre
 * es genau das — dazu ein zweiter WebGL-Kontext und 12 MB auf jeder
 * Seite, auf der niemand Nina sehen will.
 *
 * Also die Trennung: die GLB-Nina zeigt Nina als Gegenüber. Der Header
 * zeigt WEGE — und ein Weg zu einem Gespräch wird durch ein
 * Gesprächssymbol beschrieben, nicht durch ein Gesicht. Links steht die
 * Marke Paycheck, nicht Nina.
 */

const BEREICHE = [
  { href: "/app", label: "Heute", icon: Home, exact: true },
  { href: "/app/nina", label: "Nina", icon: MessagesSquare },
  { href: "/app/jobs", label: "Jobs", icon: Briefcase },
  { href: "/app/applications", label: "Bewerbungen", icon: FileText },
  { href: "/app/profile", label: "Profil", icon: User },
] as const;

function istAktiv(pathname: string, href: string, exact?: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function TopNav({
  brandName,
  assistantName,
  userName,
  userEmail,
  unreadCount,
  accountMenu,
  onOpenSearch,
}: {
  brandName: string;
  assistantName: string;
  userName: string | null;
  userEmail: string;
  unreadCount: number;
  accountMenu: React.ReactNode;
  onOpenSearch: () => void;
}) {
  const pathname = usePathname();
  /*
   * Nur die Handlungen.
   *
   * Der Header steht auf jeder Seite. Läse er den Gesprächszustand,
   * liefe er bei jedem gestreamten Zeichen neu durch — und mit ihm die
   * gesamte Navigation.
   */
  const nina = useNinaActions();
  const [gescrollt, setGescrollt] = useState(false);

  /*
   * Der Schatten kommt erst beim Scrollen.
   *
   * Ganz oben braucht ein Header keine Kante — die Seite beginnt dort.
   * Erst wenn Inhalt darunter durchläuft, muss man sehen, dass etwas
   * darüber liegt. Ein dauerhaft sichtbarer Rahmen wäre eine Linie zu
   * viel.
   *
   * `passive: true`, weil dieser Zuhörer nie scrollen verhindert — ohne
   * das Flag wartet der Browser bei jedem Rad-Ereignis darauf, ob wir
   * vielleicht doch abbrechen.
   */
  useEffect(() => {
    const beiScroll = () => setGescrollt(window.scrollY > 4);
    beiScroll();
    window.addEventListener("scroll", beiScroll, { passive: true });
    return () => window.removeEventListener("scroll", beiScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 h-[76px] bg-page/85 backdrop-blur-xl",
        "transition-shadow duration-(--duration-base)",
        gescrollt && "shadow-[0_1px_0_rgba(16,18,26,0.06),0_8px_24px_rgba(16,18,26,0.04)]",
      )}
    >
      <div className="mx-auto flex h-full w-full max-w-[1400px] items-center gap-4 px-4 md:px-8">
        {/* ── Marke ─────────────────────────────────────────── */}
        <Link
          href="/app"
          /* Auf schmalen Geräten fällt die Wortmarke weg — dann bliebe
             ein 36-Pixel-Ziel. Die Fläche trägt die geforderten 44. */
          className="flex min-h-11 min-w-11 shrink-0 items-center gap-2.5 rounded-(--radius-pill) px-2"
          aria-label={brandName}
        >
          <span
            aria-hidden
            className="grid size-8 shrink-0 place-items-center rounded-(--radius-sm) bg-accent text-sm font-bold text-accent-on"
          >
            {brandName.slice(0, 1)}
          </span>
          <span className="hidden font-display text-lg font-semibold tracking-[-0.02em] sm:block">
            {brandName}
          </span>
        </Link>

        {/* ── Bereiche ──────────────────────────────────────── */}
        <nav aria-label="Hauptbereiche" className="hidden min-w-0 flex-1 justify-center md:flex">
          <ul className="flex items-center gap-1">
            {BEREICHE.map((b) => {
              const aktiv = istAktiv(pathname, b.href, "exact" in b ? b.exact : false);
              const Icon = b.icon;
              return (
                <li key={b.href}>
                  <Link
                    href={b.href}
                    aria-current={aktiv ? "page" : undefined}
                    className={cn(
                      "flex h-11 items-center gap-2 rounded-(--radius-pill) px-4 text-sm transition-colors duration-(--duration-fast)",
                      aktiv
                        ? "bg-lavender font-medium text-ink"
                        : "text-ink-2 hover:bg-soft hover:text-ink",
                    )}
                  >
                    <Icon
                      className={cn("size-[18px]", aktiv ? "text-accent" : "text-ink-3")}
                      strokeWidth={aktiv ? 2 : 1.7}
                    />
                    {b.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* ── Rechte Seite ──────────────────────────────────── */}
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onOpenSearch}
            aria-label="Suchen"
            className="grid size-11 place-items-center rounded-(--radius-pill) text-ink-2 transition-colors hover:bg-soft hover:text-ink"
          >
            <Search className="size-[18px]" strokeWidth={1.7} />
          </button>

          {/* Nina als Handlung, nicht als Ort. Sie öffnet den Drawer;
              die Seite bleibt stehen. */}
          <button
            type="button"
            onClick={() => nina.setOpen(true)}
            className="hidden h-11 items-center gap-2 rounded-(--radius-pill) bg-lavender pl-3.5 pr-4 text-sm font-medium text-ink transition-colors hover:bg-soft-hover sm:flex"
          >
            <MessagesSquare className="size-[18px] text-accent" strokeWidth={1.9} />
            {assistantName} fragen
          </button>

          <Link
            href="/app/notifications"
            aria-label={
              unreadCount > 0
                ? `Benachrichtigungen: ${unreadCount} ungelesen`
                : "Benachrichtigungen"
            }
            className="relative grid size-11 place-items-center rounded-(--radius-pill) text-ink-2 transition-colors hover:bg-soft"
          >
            <Bell className="size-[18px]" strokeWidth={1.7} />
            {unreadCount > 0 && (
              /* 9px waren hier vorher — kleiner als jede Stufe der Skala
                 und schlicht nicht lesbar. Die Zahl steht zusätzlich im
                 Aria-Label, aber wer sie sieht, soll sie auch lesen
                 können. */
              <span className="absolute right-1.5 top-1.5 grid min-w-[18px] place-items-center rounded-full bg-accent px-1 font-mono text-[12px] font-semibold leading-[18px] text-accent-on">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Link>

          <div className="ml-0.5">{accountMenu}</div>
          <span className="sr-only">{userName ?? userEmail}</span>
        </div>
      </div>
    </header>
  );
}

/**
 * Die untere Leiste auf schmalen Geräten.
 *
 * Fünf Bereiche mit Beschriftung, weiche Kapsel für den aktiven.
 *
 * Sie liegt fest am unteren Rand, nicht im Textfluss. Vorher tat sie
 * das nicht — die Klasse `app-nav-bottom` sollte das regeln, war aber
 * nirgends definiert. Kein Fehler, keine Warnung: eine Klasse, die es
 * nicht gibt, ist im HTML nicht von einer zu unterscheiden, die nichts
 * bewirkt. Die Leiste rutschte damit ans Dokumentende und war erst
 * nach dem Durchscrollen einer langen Jobliste erreichbar — also genau
 * dann nicht, wenn man sie braucht.
 *
 * Damit sie nichts verdeckt, hält `--nav-bottom-h` unten im
 * Inhaltsbereich denselben Platz frei. Die Höhe steht an einer Stelle,
 * nicht an zweien, sonst laufen Leiste und Freiraum auseinander.
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Hauptbereiche"
      className={cn(
        /*
         * `app-nav-bottom` steht hier als Kennzeichen, nicht als Stil.
         *
         * Die Klasse war einmal für CSS gedacht, das es nie gab — und
         * genau deshalb hatte die Leiste lange gar keine Positionierung.
         * Sie ist aber der Griff, an dem die Testreihe die untere
         * Navigation findet. Als sie verschwand, fiel eine Prüfung aus,
         * die nichts mit dem Fehler zu tun hatte.
         */
        "app-nav-bottom",
        "fixed inset-x-0 bottom-0 z-40 md:hidden",
        "bg-raised/95 backdrop-blur-xl",
        "pb-[env(safe-area-inset-bottom)]",
        "shadow-[0_-1px_0_rgba(16,18,26,0.06),0_-8px_24px_rgba(16,18,26,0.05)]",
      )}
    >
      <ul className="flex h-(--nav-bottom-h) items-stretch px-1 py-1.5">
        {BEREICHE.map((b) => {
          const aktiv = istAktiv(pathname, b.href, "exact" in b ? b.exact : false);
          const Icon = b.icon;
          return (
            <li key={b.href} className="flex-1">
              <Link
                href={b.href}
                aria-current={aktiv ? "page" : undefined}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-1 rounded-(--radius-sm) text-2xs transition-colors",
                  aktiv ? "bg-lavender font-medium text-ink" : "text-ink-3",
                )}
              >
                <Icon className="size-[19px]" strokeWidth={aktiv ? 2 : 1.7} />
                {b.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
