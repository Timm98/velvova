"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CreditCard, Globe, Mic, Palette, Plug, ShieldCheck, SlidersHorizontal, User, Calculator, Wallet } from "lucide-react";
import { cn } from "@/lib/cn";

/*
 * Zwei Gruppen, nicht elf Zeilen.
 *
 * Die Vorlage teilt ihre Seitenleiste mit einer Haarlinie: oben, was
 * man täglich benutzt, unten Konto und Abmelden. Elf gleichrangige
 * Zeilen liest niemand — man sucht die eine, die man braucht, und
 * eine Gruppe halbiert dabei das Suchfeld.
 *
 * Die Trennlinie sagt hier etwas Wahres: Oben stehen Einstellungen,
 * die BEEINFLUSSEN, WAS MONDAY FINDET — Gehalt, Lebenshaltung,
 * Abgleich, Region. Unten stehen die, die das Konto betreffen und
 * an den Ergebnissen nichts ändern.
 */
const GRUPPEN: { titel: string; eintraege: Eintrag[] }[] = [
  {
    titel: "Was Monday findet",
    eintraege: [
      { href: "/app/settings/matching", label: "Abgleich & Bedingungen", icon: SlidersHorizontal },
      { href: "/app/settings/gehalt", label: "Gehalt & Steuern", icon: Calculator },
      { href: "/app/settings/lebenshaltung", label: "Lebenshaltung", icon: Wallet },
      { href: "/app/settings/language-region", label: "Sprache & Region", icon: Globe },
      { href: "/app/settings/notifications", label: "Benachrichtigungen", icon: Bell },
      { href: "/app/settings/voice", label: "Stimme & Gespräch", icon: Mic },
    ],
  },
  {
    titel: "Dein Konto",
    eintraege: [
      { href: "/app/settings", label: "Konto", icon: User, exact: true },
      { href: "/app/settings/abo", label: "Plan & Abrechnung", icon: CreditCard },
      { href: "/app/settings/appearance", label: "Erscheinungsbild", icon: Palette },
      { href: "/app/settings/privacy", label: "Datenschutz & Daten", icon: ShieldCheck },
      { href: "/app/settings/integrations", label: "Verbundene Dienste", icon: Plug },
    ],
  },
];

type Eintrag = {
  href: string;
  label: string;
  icon: typeof User;
  /** Nur genau diese Route, nicht auch die darunter. */
  exact?: boolean;
};

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
        className="scroll-x pb-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent lg:overflow-visible lg:pb-0"
      >
      {/*
        Auf schmalen Geräten bleibt es EINE rollbare Zeile: Zwei
        Gruppen nebeneinander zu rollen hiesse, dass die zweite
        hinter dem Rand beginnt und niemand sie findet. Erst ab `lg`,
        wo die Leiste steht, tragen die Gruppen.
      */}
      <div className="flex gap-1 lg:block lg:space-y-6">
        {GRUPPEN.map((gruppe, i) => (
          <div key={gruppe.titel} className="flex gap-1 lg:block">
            <h2
              className={cn(
                "hidden text-2xs font-semibold uppercase tracking-[0.12em] text-ink-3 lg:block",
                i > 0 && "mt-1 border-t border-line pt-6",
              )}
            >
              {gruppe.titel}
            </h2>

            <ul className="flex gap-1 lg:mt-2 lg:grid lg:gap-0.5">
              {gruppe.eintraege.map((item) => {
                const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href} className="shrink-0">
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex min-h-11 items-center gap-2.5 whitespace-nowrap rounded-(--radius-control) px-4 text-sm transition-colors",
                        active
                          ? "bg-soft font-medium text-ink"
                          : "text-ink-2 hover:bg-soft hover:text-ink",
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
        ))}
      </div>
      </div>
    </nav>
  );
}
