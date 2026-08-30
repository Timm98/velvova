"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bell,
  Compass,
  FileText,
  Globe,
  LayoutGrid,
  LifeBuoy,
  type LucideIcon,
  Palette,
  PanelLeft,
  Search,
  ShieldCheck,
  User,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { BrandMark, NinaSignal } from "@/components/nina/NinaSignal";
import { CommandPalette } from "./CommandPalette.tsx";
import { AccountMenu } from "./AccountMenu.tsx";

/**
 * Das Gerüst.
 *
 * Vier Entscheidungen, die den Charakter bestimmen:
 *
 * 1. Eine schmale Rail statt einer Sidebar. 76 Pixel im Ruhezustand,
 *    240 ausgeklappt. Eine dauerhaft breite Navigationsspalte lässt
 *    jedes Produkt nach Verwaltungssoftware aussehen — der Inhalt soll
 *    die Fläche bekommen, nicht das Menü.
 *
 * 2. Vier Hauptbereiche. Nicht zehn. Alles Weitere ist entweder ein
 *    Unterbereich oder gehört ins Kontomenü.
 *
 * 3. Nina ist kein Navigationseintrag, sondern eine Handlung. Sie steht
 *    als eigener Knopf in der Topbar und auf schmalen Geräten als
 *    zentrale Schaltfläche über der Navigation.
 *
 * 4. In der Topbar stehen KEINE Schalter für Sprache, Darstellung,
 *    Einstellungen oder Abmelden. Das sind Entscheidungen, die man
 *    einmal trifft; sie liegen im Kontomenü.
 */

export interface NavLabels {
  home: string;
  discover: string;
  applications: string;
  career: string;
  assistant: string;
  settings: string;
  logout: string;
  skipToContent: string;
  search: string;
  notifications: string;
  languageRegion: string;
  appearance: string;
  privacy: string;
  help: string;
  expand: string;
  collapse: string;
}

interface NavItem {
  key: "home" | "discover" | "applications" | "career";
  href: string;
  icon: LucideIcon;
}

/**
 * Vier Bereiche: Heute, Jobs, Bewerbungen, Profil.
 *
 * Nina steht bewusst NICHT dabei. Sie ist keine Seite, die man besucht,
 * sondern eine Handlung, die man auslöst — und zwar von überall. Sie
 * hätte als fünfter Eintrag denselben Rang wie „Bewerbungen“ und wäre
 * damit an vier von fünf Stellen der falsche Weg dorthin.
 */
const PRIMARY: NavItem[] = [
  { key: "home", href: "/app", icon: LayoutGrid },
  { key: "discover", href: "/app/jobs", icon: Compass },
  { key: "applications", href: "/app/applications", icon: FileText },
  { key: "career", href: "/app/profile", icon: User },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Der Kontexttitel. Eine Ortsangabe, kein Breadcrumb-Wildwuchs. */
function contextTitle(pathname: string, labels: NavLabels): string {
  if (pathname.startsWith("/app/nina")) return labels.assistant;
  if (pathname.startsWith("/app/settings")) return labels.settings;
  if (pathname.startsWith("/app/documents")) return "Dokumente";
  if (pathname.startsWith("/app/coaching")) return "Interview-Training";
  if (pathname.startsWith("/app/roles")) return "Rollen";
  if (pathname.startsWith("/app/notifications")) return labels.notifications;

  const match = [...PRIMARY]
    .sort((a, b) => b.href.length - a.href.length)
    .find((i) => isActive(pathname, i.href));
  return match ? labels[match.key] : labels.home;
}

export function AppShell({
  labels,
  brandName,
  assistantName,
  userEmail,
  userName,
  unreadCount,
  onLogout,
  children,
}: {
  labels: NavLabels;
  brandName: string;
  assistantName: string;
  userEmail: string;
  userName: string | null;
  unreadCount: number;
  onLogout: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Die Wahl überlebt den Seitenwechsel. Sie liegt bewusst nur im
  // Browser: eine ausgeklappte Rail ist eine Angewohnheit an diesem
  // Gerät, keine Kontoeinstellung.
  useEffect(() => {
    try {
      setExpanded(localStorage.getItem("paycheck.rail.expanded") === "1");
    } catch {
      /* Privater Modus: dann eben eingeklappt. */
    }
  }, []);

  function toggleRail() {
    setExpanded((v) => {
      const next = !v;
      try {
        localStorage.setItem("paycheck.rail.expanded", next ? "1" : "0");
      } catch {
        /* egal */
      }
      return next;
    });
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const accountItems = [
    { href: "/app/settings/profile", label: labels.settings, icon: User },
    { href: "/app/settings/language-region", label: labels.languageRegion, icon: Globe },
    { href: "/app/settings/appearance", label: labels.appearance, icon: Palette },
    { href: "/app/settings/privacy", label: labels.privacy, icon: ShieldCheck },
    { href: "/how-it-works", label: labels.help, icon: LifeBuoy },
  ];

  return (
    <div
      className={cn(
        "min-h-dvh bg-page md:grid",
        expanded ? "md:grid-cols-[240px_1fr]" : "md:grid-cols-[76px_1fr]",
      )}
    >
      <a href="#inhalt" className="skip-link">
        {labels.skipToContent}
      </a>

      {/* ══ Rail ══════════════════════════════════════════════ */}
      <div className="hidden bg-soft md:block">
        <aside className="sticky top-0 flex h-dvh flex-col">
          <div className={cn("flex h-14 items-center px-4", !expanded && "justify-center px-0")}>
            <Link
              href="/app"
              /* Das Zeichen ist 28 Pixel und ein schönes Logo. Die Fläche
                 darum trägt die geforderten 44 — ein Berührungsziel misst
                 sich an der Fläche, nicht am Bild darin. */
              className="grid min-h-11 min-w-11 place-items-center rounded-(--radius-control)"
              aria-label={brandName}
            >
              <BrandMark name={brandName} showName={expanded} size="md" />
            </Link>
          </div>

          <nav aria-label="Hauptbereiche" className="flex-1 px-3 pt-2">
            <ul className="grid gap-1">
              {PRIMARY.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      title={expanded ? undefined : labels[item.key]}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-(--radius-control) text-sm transition-colors duration-(--duration-fast)",
                        // Die aktive Fläche ist oval, nicht rechteckig:
                        // `rounded-control` ist 999 Pixel, und bei 44
                        // Pixel Höhe ergibt das genau die weiche Kapsel.
                        expanded ? "px-4 py-3" : "size-12 justify-center",
                        active
                          ? "bg-raised font-medium text-ink shadow-sm"
                          : "text-ink-2 hover:bg-raised/60 hover:text-ink",
                      )}
                    >
                      {/* Der aktive Zustand trägt zusätzlich eine
                          Lichtkante links — Farbe allein wäre zu wenig. */}
                      {active && (
                        <span
                          aria-hidden
                          className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-accent"
                        />
                      )}
                      <Icon
                        className={cn("size-[19px] shrink-0", active ? "text-accent" : "text-ink-3")}
                        strokeWidth={active ? 2 : 1.7}
                      />
                      {expanded && labels[item.key]}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="grid gap-1 p-3">
            <button
              type="button"
              onClick={toggleRail}
              aria-expanded={expanded}
              title={expanded ? labels.collapse : labels.expand}
              className={cn(
                "flex items-center gap-3 rounded-(--radius-control) text-sm text-ink-3 transition-colors hover:bg-raised/60 hover:text-ink",
                expanded ? "px-3 py-2.5" : "h-11 justify-center",
              )}
            >
              <PanelLeft
                className={cn(
                  "size-[18px] shrink-0 transition-transform duration-(--duration-base)",
                  expanded && "rotate-180",
                )}
                strokeWidth={1.7}
              />
              {expanded && labels.collapse}
            </button>
          </div>
        </aside>
      </div>

      {/* ══ Inhalt ════════════════════════════════════════════ */}
      <div className="grid min-h-dvh min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] md:block md:min-h-0">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 bg-page/85 px-4 backdrop-blur-xl md:px-6">
          {/* Ein 20 Pixel großes Zeichen ist ein schönes Logo und ein
              schlechtes Berührungsziel. Die Fläche darum trägt die
              geforderten 24 Pixel, das Zeichen bleibt klein. */}
          <Link
            href="/app"
            className="-ml-1.5 grid size-11 place-items-center rounded-(--radius-control) md:hidden"
            aria-label={brandName}
          >
            <NinaSignal size="sm" />
          </Link>

          <p className="truncate font-display text-sm font-semibold tracking-[-0.01em] md:text-[15px]">
            {contextTitle(pathname, labels)}
          </p>

          <div className="ml-auto flex items-center gap-1.5">
            {/* Suche: auf breiten Geräten mit Tastenkürzel, sonst als Symbol. */}
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="hidden h-10 items-center gap-2.5 rounded-(--radius-control) bg-soft px-4 text-sm text-ink-3 transition-colors hover:bg-soft-hover hover:text-ink-2 lg:flex"
            >
              <Search className="size-4" strokeWidth={1.7} />
              {labels.search}
              <kbd className="ml-6 rounded-(--radius-xs) bg-raised px-1.5 py-0.5 font-mono text-2xs text-ink-2">
                ⌘K
              </kbd>
            </button>
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              aria-label={labels.search}
              className="grid size-11 place-items-center rounded-(--radius-control) text-ink-2 transition-colors hover:bg-soft lg:hidden"
            >
              <Search className="size-[18px]" strokeWidth={1.7} />
            </button>

            <Link
              href="/app/notifications"
              aria-label={
                unreadCount > 0
                  ? `${labels.notifications}: ${unreadCount} ungelesen`
                  : labels.notifications
              }
              className="relative grid size-11 place-items-center rounded-(--radius-control) text-ink-2 transition-colors hover:bg-soft"
            >
              <Bell className="size-[18px]" strokeWidth={1.7} />
              {unreadCount > 0 && (
                <span className="absolute right-1.5 top-1.5 grid min-w-[15px] place-items-center rounded-full bg-accent px-1 font-mono text-[9px] font-semibold leading-[15px] text-accent-on">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>

            <AccountMenu
              userName={userName}
              userEmail={userEmail}
              items={accountItems}
              onLogout={onLogout}
            />
          </div>
        </header>

        <main
          id="inhalt"
          className="mx-auto w-full max-w-[1400px] overflow-y-auto px-4 py-7 md:overflow-visible md:px-6 md:py-9 lg:px-10"
        >
          {children}
        </main>

        {/* ══ Navigation unten, schmale Geräte ═══════════════ */}
        {/* Im Raster, nicht darüber: eine überlagernde Leiste verdeckt
            sonst Schaltflächen am Seitenende. */}
        <nav
          aria-label="Hauptbereiche"
          className="app-nav-bottom relative bg-raised shadow-[0_-1px_0_var(--border-subtle)] pb-[env(safe-area-inset-bottom)] md:hidden"
        >
          <ul className="flex">
            {PRIMARY.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <li key={item.key} className="flex-1">
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-[56px] flex-col items-center justify-center gap-1 text-2xs transition-colors",
                      active ? "font-medium text-accent-text" : "text-ink-3",
                    )}
                  >
                    <Icon className="size-[19px]" strokeWidth={active ? 2 : 1.7} />
                    {labels[item.key]}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        assistantName={assistantName}
        labels={labels}
      />
    </div>
  );
}
