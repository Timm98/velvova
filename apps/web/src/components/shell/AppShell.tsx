"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bell,
  Briefcase,
  ChevronLeft,
  FileText,
  Globe,
  LayoutDashboard,
  LifeBuoy,
  type LucideIcon,
  Palette,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  User,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { CommandPalette } from "./CommandPalette.tsx";
import { AccountMenu } from "./AccountMenu.tsx";

/**
 * Das Gerüst der Anwendung.
 *
 * Vier Entscheidungen, die den alten Aufbau ersetzen:
 *
 * 1. Auf dem Desktop eine ruhige, einklappbare Seitenleiste statt einer
 *    vollgestellten Topbar. Navigation steht links stabil an einem Ort;
 *    der Inhalt bekommt Breite und Aufmerksamkeit.
 *
 * 2. KEINE Sprach- und keine Darstellungsumschaltung in der Kopfzeile.
 *    Beides sind Entscheidungen, die man einmal trifft — sie gehören ins
 *    Onboarding und ins Kontomenü, nicht in die Dauernavigation.
 *
 * 3. KEIN dauerhaftes Demo-Warnband. Eine Warnleiste, die immer da ist,
 *    wird nach zwei Minuten unsichtbar und macht die Oberfläche billig.
 *    Demo-Daten werden dort gekennzeichnet, wo sie stehen.
 *
 * 4. Auf schmalen Geräten liegt die untere Navigation IM Raster, nicht
 *    darüber: drei Zeilen, Inhalt scrollt in sich. Eine überlagernde
 *    Leiste verdeckt sonst Schaltflächen.
 */

export interface NavLabels {
  home: string;
  assistant: string;
  jobs: string;
  applications: string;
  profile: string;
  growth: string;
  settings: string;
  logout: string;
  skipToContent: string;
  search: string;
  notifications: string;
  languageRegion: string;
  appearance: string;
  privacy: string;
  help: string;
}

interface NavItem {
  key: keyof NavLabels;
  href: string;
  icon: LucideIcon;
  /** Auf schmalen Geräten sichtbar? Höchstens fünf Einträge. */
  mobile: boolean;
}

const PRIMARY: NavItem[] = [
  { key: "home", href: "/app", icon: LayoutDashboard, mobile: true },
  { key: "assistant", href: "/app/nina", icon: Sparkles, mobile: true },
  { key: "jobs", href: "/app/jobs", icon: Briefcase, mobile: true },
  { key: "applications", href: "/app/applications", icon: FileText, mobile: true },
  { key: "profile", href: "/app/profile", icon: User, mobile: true },
  { key: "growth", href: "/app/growth", icon: TrendingUp, mobile: false },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Der Kontexttitel in der oberen Leiste. Kein Breadcrumb-Wildwuchs. */
function contextTitle(pathname: string, labels: NavLabels): string {
  const match = [...PRIMARY]
    .sort((a, b) => b.href.length - a.href.length)
    .find((i) => isActive(pathname, i.href));
  if (pathname.startsWith("/app/settings")) return labels.settings;
  if (pathname.startsWith("/app/coaching")) return "Interview-Coaching";
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
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Die Wahl überlebt den Seitenwechsel. Sie liegt bewusst nur im
  // Browser: eine eingeklappte Leiste ist eine Angewohnheit an diesem
  // Gerät, keine Kontoeinstellung.
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("paycheck.nav.collapsed") === "1");
    } catch {
      /* Privater Modus: dann eben ausgeklappt. */
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((v) => {
      const next = !v;
      try {
        localStorage.setItem("paycheck.nav.collapsed", next ? "1" : "0");
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
    { href: "/app/profile", label: labels.profile, icon: User },
    { href: "/app/settings/language-region", label: labels.languageRegion, icon: Globe },
    { href: "/app/settings/appearance", label: labels.appearance, icon: Palette },
    { href: "/app/settings/privacy", label: labels.privacy, icon: ShieldCheck },
    { href: "/how-it-works", label: labels.help, icon: LifeBuoy },
  ];

  return (
    <div
      className={cn(
        "min-h-dvh md:grid",
        collapsed ? "md:grid-cols-[68px_1fr]" : "md:grid-cols-[244px_1fr]",
      )}
    >
      <a href="#inhalt" className="skip-link">
        {labels.skipToContent}
      </a>

      {/* ── Seitenleiste, ab Tablet ─────────────────────────────── */}
      {/* Die Fläche liegt auf der Rasterzelle, nicht auf dem klebenden
          Element: sonst endet der Hintergrund nach einer Bildschirmhöhe
          und die Spalte reißt bei langen Seiten sichtbar ab. */}
      <div className="hidden border-r border-line bg-sunken/60 md:block">
      <aside className="sticky top-0 flex h-dvh flex-col">
        <div className={cn("flex items-center gap-2 px-4 py-5", collapsed && "justify-center px-2")}>
          <Link
            href="/app"
            className="flex min-w-0 items-center gap-2.5 rounded-[--radius-sm] text-[15px] font-semibold tracking-tight"
          >
            <span
              aria-hidden
              className="grid size-7 shrink-0 place-items-center rounded-[--radius-sm] bg-brand text-xs font-bold text-white"
            >
              P
            </span>
            {!collapsed && <span className="truncate">{brandName}</span>}
          </Link>
        </div>

        <nav aria-label="Hauptbereiche" className="flex-1 px-2.5">
          <ul className="grid gap-0.5">
            {PRIMARY.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    title={collapsed ? labels[item.key] : undefined}
                    className={cn(
                      "group flex items-center gap-3 rounded-[--radius-md] px-3 py-2.5 text-sm transition-colors duration-[--duration-fast]",
                      collapsed && "justify-center px-0",
                      active
                        ? "bg-raised font-medium text-ink shadow-xs"
                        : "text-ink-2 hover:bg-raised/60 hover:text-ink",
                    )}
                  >
                    <Icon
                      className={cn("size-[18px] shrink-0", active ? "text-brand" : "text-ink-3")}
                      strokeWidth={active ? 2.1 : 1.8}
                    />
                    {!collapsed && labels[item.key]}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-2.5">
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-expanded={!collapsed}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-[--radius-md] px-3 py-2 text-sm text-ink-3 transition-colors hover:bg-raised/60 hover:text-ink",
              collapsed && "justify-center px-0",
            )}
          >
            <ChevronLeft
              className={cn(
                "size-4 shrink-0 transition-transform duration-[--duration-base]",
                collapsed && "rotate-180",
              )}
              strokeWidth={1.9}
            />
            {!collapsed && "Einklappen"}
          </button>
        </div>
      </aside>
      </div>

      {/* ── Inhalt ──────────────────────────────────────────────── */}
      <div className="grid min-h-dvh grid-rows-[auto_minmax(0,1fr)_auto] md:block md:min-h-0">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-page/85 px-4 py-2.5 backdrop-blur-md md:px-7 md:py-3">
          {/* Marke nur schmal — auf dem Desktop steht sie in der Leiste. */}
          <Link href="/app" className="flex items-center gap-2 md:hidden">
            <span
              aria-hidden
              className="grid size-6 place-items-center rounded-[--radius-xs] bg-brand text-[10px] font-bold text-white"
            >
              P
            </span>
            <span className="sr-only">{brandName}</span>
          </Link>

          <h1 className="truncate text-sm font-medium md:text-[15px]">
            {contextTitle(pathname, labels)}
          </h1>

          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="hidden h-9 items-center gap-2.5 rounded-[--radius-md] border border-line-2 bg-raised px-3 text-sm text-ink-3 shadow-xs transition-colors hover:border-line-3 hover:text-ink-2 lg:flex"
            >
              <Search className="size-4" strokeWidth={1.8} />
              {labels.search}
              <kbd className="ml-4 rounded-[--radius-xs] border border-line-2 bg-sunken px-1.5 py-0.5 font-mono text-2xs text-ink-3">
                ⌘K
              </kbd>
            </button>
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              aria-label={labels.search}
              className="grid size-9 place-items-center rounded-[--radius-md] text-ink-2 transition-colors hover:bg-sunken lg:hidden"
            >
              <Search className="size-[18px]" strokeWidth={1.8} />
            </button>

            <Link
              href="/app/notifications"
              aria-label={
                unreadCount > 0
                  ? `${labels.notifications}: ${unreadCount} ungelesen`
                  : labels.notifications
              }
              className="relative grid size-9 place-items-center rounded-[--radius-md] text-ink-2 transition-colors hover:bg-sunken"
            >
              <Bell className="size-[18px]" strokeWidth={1.8} />
              {unreadCount > 0 && (
                <span className="absolute right-1.5 top-1.5 grid min-w-[15px] place-items-center rounded-full bg-brand px-1 text-[9px] font-semibold leading-[15px] text-white">
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
          className="mx-auto w-full max-w-[1320px] overflow-y-auto px-4 py-7 md:overflow-visible md:px-7 md:py-10 lg:px-10"
        >
          {children}
        </main>

        {/* Navigation unten — im Raster, nicht darüber */}
        <nav
          aria-label="Hauptbereiche"
          className="border-t border-line bg-raised pb-[env(safe-area-inset-bottom)] md:hidden"
        >
          <ul className="flex">
            {PRIMARY.filter((i) => i.mobile).map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <li key={item.key} className="flex-1">
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-[58px] flex-col items-center justify-center gap-1 border-t-2 text-2xs transition-colors",
                      active
                        ? "border-brand font-medium text-accent-text"
                        : "border-transparent text-ink-3",
                    )}
                  >
                    <Icon className="size-[19px]" strokeWidth={active ? 2.1 : 1.8} />
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
