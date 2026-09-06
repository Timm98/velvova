import { CreditCard, Globe, LifeBuoy, Palette, ShieldCheck, User, type LucideIcon } from "lucide-react";

/**
 * Was im Kontomenü steht.
 *
 * Die Liste lag in `AppShell` — dort, wo das Menü zusammengebaut wird.
 * Das ging, solange es genau eine Stelle gab, die ein Kontomenü zeigt.
 * Seit die Startseite angemeldet dasselbe Menü trägt, sind es zwei,
 * und zwei Listen desselben Menüs laufen beim ersten neuen Eintrag
 * auseinander — mit dem Ergebnis, dass eine Einstellung je nach Seite
 * erreichbar ist oder nicht.
 *
 * Die Beschriftungen kommen von aussen: Sie sind übersetzt, und die
 * Übersetzung hängt an der Sitzung, nicht an dieser Datei.
 */
export type KontoBeschriftungen = {
  settings: string;
  languageRegion: string;
  appearance: string;
  privacy: string;
  help: string;
};

export function kontoEintraege(
  labels: KontoBeschriftungen,
): { href: string; label: string; icon: LucideIcon }[] {
  return [
    { href: "/app/settings", label: labels.settings, icon: User },
    { href: "/app/settings/abo", label: "Abo & Zahlung", icon: CreditCard },
    { href: "/app/settings/language-region", label: labels.languageRegion, icon: Globe },
    { href: "/app/settings/appearance", label: labels.appearance, icon: Palette },
    { href: "/app/settings/privacy", label: labels.privacy, icon: ShieldCheck },
    { href: "/help", label: labels.help, icon: LifeBuoy },
  ];
}
