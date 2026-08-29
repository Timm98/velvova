"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Briefcase,
  ChevronDown,
  FileText,
  LayoutDashboard,
  LogOut,
  type LucideIcon,
  Settings,
  Sparkles,
  User,
} from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Das Gerüst der Anwendung.
 *
 * Drei Entscheidungen, die den alten Aufbau ersetzen:
 *
 * 1. Auf dem Desktop eine ruhige Seitenleiste statt einer vollgestellten
 *    Topbar. Die Navigation steht dann links stabil an einem Ort, und der
 *    Inhaltsbereich bekommt die volle Breite und Aufmerksamkeit.
 *
 * 2. KEINE Sprachumschaltung in der Kopfzeile. Sprache und Region gehören
 *    ins Onboarding und in die Kontoeinstellungen — es sind Entscheidungen,
 *    die man einmal trifft, nicht mehrmals täglich.
 *
 * 3. Auf schmalen Geräten eine Navigation unten, die NICHT über dem Inhalt
 *    liegt: das Gerüst ist dort ein Raster mit drei Zeilen, und der
 *    Inhaltsbereich scrollt in sich. Eine überlagernde Leiste verdeckt
 *    sonst Schaltflächen.
 */

export interface NavLabels {
  home: string;
  assistant: string;
  jobs: string;
  applications: string;
  profile: string;
  settings: string;
  logout: string;
  skipToContent: string;
}

interface NavItem {
  key: keyof NavLabels;
  href: string;
  icon: LucideIcon;
}

const PRIMARY: NavItem[] = [
  { key: "home", href: "/app", icon: LayoutDashboard },
  { key: "assistant", href: "/app/nina", icon: Sparkles },
  { key: "jobs", href: "/app/jobs", icon: Briefcase },
  { key: "applications", href: "/app/applications", icon: FileText },
  { key: "profile", href: "/app/profile", icon: User },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/app") return pathname === "/app";
  return pathname.startsWith(href);
}

export function AppShell({
  labels,
  brandName,
  userEmail,
  userName,
  demoMode,
  onLogout,
  children,
}: {
  labels: NavLabels;
  brandName: string;
  userEmail: string;
  userName: string | null;
  demoMode: boolean;
  onLogout: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const initials = (userName ?? userEmail).slice(0, 1).toUpperCase();

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[248px_1fr]">
      <a href="#inhalt" className="skip-link">
        {labels.skipToContent}
      </a>

      {/* ---- Seitenleiste, ab Tablet ---- */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-raised/60 backdrop-blur-sm md:flex">
        <div className="px-5 py-6">
          <Link
            href="/app"
            className="flex items-center gap-2.5 rounded-[--radius-sm] text-[15px] font-semibold tracking-tight"
          >
            <span
              aria-hidden
              className="grid size-7 place-items-center rounded-[--radius-sm] bg-accent text-accent-on text-xs font-bold"
            >
              P
            </span>
            {brandName}
          </Link>
        </div>

        <nav aria-label="Hauptbereiche" className="flex-1 px-3">
          <ul className="grid gap-0.5">
            {PRIMARY.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group flex items-center gap-3 rounded-[--radius-md] px-3 py-2.5 text-sm transition-colors duration-[--duration-fast]",
                      active
                        ? "bg-inset font-medium text-ink"
                        : "text-ink-2 hover:bg-sunken hover:text-ink",
                    )}
                  >
                    <Icon
                      className={cn("size-[18px] shrink-0", active ? "text-accent" : "text-ink-3")}
                      strokeWidth={active ? 2.1 : 1.8}
                    />
                    {labels[item.key]}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {demoMode && (
          <div className="mx-3 mb-3 rounded-[--radius-md] border border-caution/25 bg-caution-soft px-3 py-2.5">
            <p className="text-xs leading-relaxed text-ink-2">
              <span className="font-medium text-caution">Demo-Modus</span> — es wird nichts
              versendet.
            </p>
          </div>
        )}

        {/* ---- Konto unten, mit Ausklappmenü ---- */}
        <div className="relative border-t border-line p-3">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            className="flex w-full items-center gap-2.5 rounded-[--radius-md] px-2 py-2 text-left transition-colors hover:bg-sunken"
          >
            <span
              aria-hidden
              className="grid size-8 shrink-0 place-items-center rounded-[--radius-full] bg-assistant-soft text-sm font-medium text-assistant-text"
            >
              {initials}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{userName ?? "Konto"}</span>
              <span className="block truncate text-xs text-ink-3">{userEmail}</span>
            </span>
            <ChevronDown
              className={cn(
                "size-4 shrink-0 text-ink-3 transition-transform duration-[--duration-fast]",
                menuOpen && "rotate-180",
              )}
            />
          </button>

          {menuOpen && (
            <div className="absolute inset-x-3 bottom-[calc(100%-0.25rem)] grid gap-0.5 rounded-[--radius-md] border border-line bg-overlay p-1.5 shadow-lg animate-fade-in">
              <Link
                href="/app/settings"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 rounded-[--radius-sm] px-2.5 py-2 text-sm text-ink-2 transition-colors hover:bg-sunken hover:text-ink"
              >
                <Settings className="size-4 text-ink-3" strokeWidth={1.8} />
                {labels.settings}
              </Link>
              <div className="[&_button]:flex [&_button]:w-full [&_button]:items-center [&_button]:gap-2.5 [&_button]:rounded-[--radius-sm] [&_button]:px-2.5 [&_button]:py-2 [&_button]:text-sm [&_button]:text-ink-2 [&_button]:transition-colors hover:[&_button]:bg-sunken hover:[&_button]:text-ink">
                {onLogout}
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ---- Inhalt ---- */}
      <div className="grid min-h-dvh grid-rows-[auto_minmax(0,1fr)_auto] md:block md:min-h-0">
        {/* Kopfzeile nur auf schmalen Geräten */}
        <header className="flex items-center justify-between gap-3 border-b border-line bg-raised px-4 py-3 md:hidden">
          <Link href="/app" className="flex items-center gap-2 text-[15px] font-semibold">
            <span
              aria-hidden
              className="grid size-6 place-items-center rounded-[--radius-xs] bg-accent text-accent-on text-[10px] font-bold"
            >
              P
            </span>
            {brandName}
          </Link>
          <Link
            href="/app/settings"
            aria-label={labels.settings}
            className="grid size-10 place-items-center rounded-[--radius-md] text-ink-2 transition-colors hover:bg-sunken"
          >
            <Settings className="size-[18px]" strokeWidth={1.8} />
          </Link>
        </header>

        <main
          id="inhalt"
          className="mx-auto w-full max-w-[1120px] overflow-y-auto px-4 py-6 md:overflow-visible md:px-8 md:py-10"
        >
          {children}
        </main>

        {/* Navigation unten — im Raster, nicht darüber */}
        <nav
          aria-label="Hauptbereiche"
          className="border-t border-line bg-raised pb-[env(safe-area-inset-bottom)] md:hidden"
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
                      "flex min-h-[58px] flex-col items-center justify-center gap-1 border-t-2 text-2xs transition-colors",
                      active
                        ? "border-accent font-medium text-accent-text"
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

      <p className="sr-only">Angemeldet als {userEmail}</p>
    </div>
  );
}
