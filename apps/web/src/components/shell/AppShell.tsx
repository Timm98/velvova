"use client";

import { useEffect, useState } from "react";
import { Globe, LifeBuoy, Palette, ShieldCheck, User } from "lucide-react";
import { CommandPalette } from "./CommandPalette.tsx";
import { AccountMenu } from "./AccountMenu.tsx";
import { BottomNav, TopNav } from "./TopNav.tsx";

/**
 * Das Gerüst.
 *
 * Vier Entscheidungen, die den Charakter bestimmen:
 *
 * 1. **Ein oberer Header statt einer linken Icon-Leiste.** Eine schmale
 *    Spalte aus unbeschrifteten Symbolen ist die Form, die
 *    Verwaltungssoftware benutzt — und sie bringt deren Anmutung mit.
 *    Der Header trägt fünf Bereiche mit Namen und lässt dem Inhalt die
 *    volle Breite.
 *
 * 2. **Fünf Bereiche. Nicht zehn.** Alles Weitere ist ein Unterbereich
 *    oder gehört ins Kontomenü.
 *
 * 3. **Nina ist eine Handlung, kein Ort.** Sie steht als Pille rechts
 *    im Header und öffnet den Drawer, ohne die Seite zu verlassen.
 *
 * 4. **Im Header stehen KEINE Schalter für Sprache, Darstellung oder
 *    Abmelden.** Das sind Entscheidungen, die man einmal trifft; sie
 *    liegen im Kontomenü.
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
  const [paletteOpen, setPaletteOpen] = useState(false);

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
    { href: "/app/settings", label: labels.settings, icon: User },
    { href: "/app/settings/language-region", label: labels.languageRegion, icon: Globe },
    { href: "/app/settings/appearance", label: labels.appearance, icon: Palette },
    { href: "/app/settings/privacy", label: labels.privacy, icon: ShieldCheck },
    { href: "/how-it-works", label: labels.help, icon: LifeBuoy },
  ];

  return (
    <div className="flex min-h-dvh flex-col bg-page">
      <a href="#inhalt" className="skip-link">
        {labels.skipToContent}
      </a>

      <TopNav
        brandName={brandName}
        assistantName={assistantName}
        userName={userName}
        userEmail={userEmail}
        unreadCount={unreadCount}
        onOpenSearch={() => setPaletteOpen(true)}
        accountMenu={
          <AccountMenu
            userName={userName}
            userEmail={userEmail}
            items={accountItems}
            onLogout={onLogout}
          />
        }
      />

      <main
        id="inhalt"
        className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-8 md:px-8 md:py-10"
      >
        {children}
      </main>

      <BottomNav />

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        assistantName={assistantName}
        labels={labels}
      />
    </div>
  );
}
