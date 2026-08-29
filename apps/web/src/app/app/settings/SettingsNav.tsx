"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Globe, Mic, Palette, Plug, ShieldCheck, User } from "lucide-react";
import { cn } from "@/lib/cn";

const ITEMS = [
  { href: "/app/settings", label: "Konto", icon: User, exact: true },
  { href: "/app/settings/language-region", label: "Sprache & Region", icon: Globe },
  { href: "/app/settings/appearance", label: "Erscheinungsbild", icon: Palette },
  { href: "/app/settings/voice", label: "Stimme & Gespräch", icon: Mic },
  { href: "/app/settings/notifications", label: "Benachrichtigungen", icon: Bell },
  { href: "/app/settings/privacy", label: "Datenschutz & Daten", icon: ShieldCheck },
  { href: "/app/settings/integrations", label: "Verbundene Dienste", icon: Plug },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Einstellungsbereiche" className="min-w-0">
      {/* Auf schmalen Geräten waagerecht scrollbar — mit Tastaturzugang,
          sonst ist der überstehende Teil ohne Maus unerreichbar. */}
      {/* Der scrollbare Bereich ist ein eigenes Element. Setzt man
          role="region" auf die <ul>, verliert sie ihre Listenrolle und
          die <li> stehen ohne Elternliste da. */}
      <div
        tabIndex={0}
        role="region"
        aria-label="Einstellungsbereiche"
        className="scroll-x pb-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent lg:pb-0"
      >
      <ul className="flex gap-1 lg:grid lg:gap-0.5">
        {ITEMS.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 whitespace-nowrap rounded-[--radius-md] px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "bg-inset font-medium text-ink"
                    : "text-ink-2 hover:bg-sunken hover:text-ink",
                )}
              >
                <Icon
                  className={cn("size-4 shrink-0", active ? "text-brand" : "text-ink-3")}
                  strokeWidth={1.9}
                />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
      </div>
    </nav>
  );
}
