"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Globe, LifeBuoy, Palette, ShieldCheck, User } from "lucide-react";
import { CommandPalette } from "./CommandPalette.tsx";
import { AccountMenu } from "./AccountMenu.tsx";
import { BottomNav, TopNav } from "./TopNav.tsx";
import { cn } from "@/lib/cn";

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
  const pathname = usePathname();

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
    { href: "/help", label: labels.help, icon: LifeBuoy },
  ];

  /*
   * Seiten, die exakt das Fenster füllen und selbst scrollen.
   *
   * Die Liste steht hier und nicht in der Seite, weil die Rechnung dem
   * Rahmen gehört: nur er weiss, wie hoch Kopfzeile und untere Leiste
   * sind. Eine Seite, die sich das selbst ausrechnet, rechnet beim
   * nächsten Headerumbau falsch.
   */
  const fülltFenster = pathname === "/app/nina";

  return (
    <div className={cn("flex min-h-dvh flex-col bg-page", fülltFenster && "overflow-hidden")}>
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
        data-fuellt-fenster={fülltFenster ? "" : undefined}
        className={cn(
          "mx-auto w-full max-w-[1400px] px-4 md:px-8",
          fülltFenster
            ? /*
               * Genau der Rest des Fensters, keine Zeile mehr.
               *
               * Ein Gespräch ist kein Dokument. Scrollt der Seitenkörper
               * mit, wandern Kopf und Eingabefeld beim Tippen aus dem
               * Bild — und auf einem Telefon schiebt die Tastatur die
               * Eingabe zusätzlich weg. Deshalb bekommt diese Seite eine
               * feste Höhe, und nur der Nachrichtenstrom darin scrollt.
               *
               * `100dvh` und nicht `100vh`: auf mobilen Browsern wächst
               * und schrumpft die sichtbare Fläche mit der ein- und
               * ausfahrenden Adressleiste. `vh` kennt nur den grössten
               * Stand und ergibt darunter eine Seite, die immer ein
               * Stück zu hoch ist.
               */
              [
                /*
                 * `grow-0 shrink-0` ist der Teil, ohne den die Höhe
                 * wirkungslos bleibt.
                 *
                 * `main` liegt in einer Flex-Spalte. Ein Flex-Kind mit
                 * `flex-1` darf über seine `height` hinauswachsen —
                 * `flex-grow` schlägt die Höhe, und `min-height: auto`
                 * verhindert zusätzlich das Schrumpfen unter den
                 * Inhalt. Die feste Höhe stand also da und galt nicht:
                 * gemessen 687 Pixel, wo 484 stehen sollten.
                 *
                 * Die Unterstriche in der Rechnung sind übrigens nur
                 * Lesbarkeit, keine Notwendigkeit: Tailwind setzt die
                 * Leerzeichen um `+` und `-` in `calc()` von sich aus.
                 * Geprüft am erzeugten Stylesheet.
                 */
                "min-h-0 shrink-0 grow-0 overflow-hidden",
                "h-[calc(100dvh_-_var(--app-header-height)_-_var(--nav-bottom-h))]",
                "md:h-[calc(100dvh_-_var(--app-header-height))]",
              ]
            : /* Unten Platz für die feste Leiste — aber nur dort, wo es
                 sie gibt. Ab `md` verschwindet sie, und der Freiraum
                 mit ihr. */
              [
                "flex-1",
                "py-8 md:py-10",
                "pb-[calc(var(--nav-bottom-h)_+_env(safe-area-inset-bottom)_+_1rem)] md:pb-10",
              ],
        )}
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
