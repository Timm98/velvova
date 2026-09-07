import {
  Bell,
  BadgeCheck,
  Bookmark,
  CreditCard,
  FileText,
  FolderOpen,
  LifeBuoy,
  Radar,
  ShieldCheck,
  Sparkles,
  User,
  type LucideIcon,
} from "lucide-react";

/**
 * Die Kontonavigation — eine Liste für zwei Orte.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum zwei Gruppen und nicht eine
 * ══════════════════════════════════════════════════════════════
 *
 * Vorher standen hier sechs Einstellungen. Das Menü hiess „Konto",
 * enthielt aber nur Schalter — und alles, was man mit dem Konto
 * tatsächlich TUT (Gespräch, Bewerbungen, Suchaufträge, Belege), war
 * von dort nicht erreichbar.
 *
 * Die Vorlage teilt an derselben Stelle in zwei Gruppen, getrennt
 * durch eine Haarlinie: oben die Bereiche, in denen man arbeitet,
 * unten das Konto selbst und das Abmelden. Das ist keine Kosmetik —
 * es ist der Unterschied zwischen „wohin kann ich" und „was kann ich
 * einstellen".
 *
 * ══════════════════════════════════════════════════════════════
 * Warum EINE Liste
 * ══════════════════════════════════════════════════════════════
 *
 * Dieselben Einträge stehen an zwei Orten: rechts oben im Klappmenü
 * und links als Leiste. Zwei Listen desselben Menüs laufen beim
 * ersten neuen Eintrag auseinander — mit dem Ergebnis, dass ein
 * Bereich je nach Seite erreichbar ist oder nicht. Genau das ist hier
 * schon einmal passiert, als die Liste in `AppShell` lag.
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

export type Kontoeintrag = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Nur genau diese Route zählt als aktiv, nicht auch die darunter. */
  exakt?: boolean;
};

export type Kontogruppe = {
  /** Nur für Vorlesegeräte — sichtbar trennt die Linie. */
  titel: string;
  eintraege: Kontoeintrag[];
};

export function kontoGruppen(labels: KontoBeschriftungen, assistent: string): Kontogruppe[] {
  return [
    {
      titel: "Bereiche",
      eintraege: [
        /*
         * „Jobs" und „Mit {assistent} sprechen" stehen hier NICHT.
         *
         * Beide führt die Hauptzeile im Kopf, auf jeder Seite, immer
         * sichtbar. Ein Weg, der zwei Fingerbreit darüber schon steht,
         * gewinnt im Klappmenü nichts — er verschiebt nur die
         * Einträge nach unten, die es dort sonst nicht gibt.
         *
         * Was hier steht, ist das, was die Hauptzeile NICHT trägt:
         * Gespeichertes, Aufträge, Unterlagen, Konto.
         */
        { href: "/app/jobs?gespeichert=1", label: "Gespeicherte Jobs", icon: Bookmark },
        { href: "/app/suchauftraege", label: "Suchaufträge", icon: Radar },
        { href: "/app/applications", label: "Bewerbungen", icon: FileText },
        { href: "/app/career", label: "Karriereprofil", icon: Sparkles },
        { href: "/app/documents", label: "Dokumente", icon: FolderOpen },
        { href: "/app/belege", label: "Deine Belege", icon: BadgeCheck },
      ],
    },
    {
      titel: "Konto",
      eintraege: [
        { href: "/app/settings", label: labels.settings, icon: User, exakt: true },
        { href: "/app/settings/abo", label: "Abo & Zahlung", icon: CreditCard },
        { href: "/app/notifications", label: "Benachrichtigungen", icon: Bell },
        { href: "/app/settings/privacy", label: labels.privacy, icon: ShieldCheck },
        { href: "/help", label: labels.help, icon: LifeBuoy },
      ],
    },
  ];
}

/** Die alte flache Liste — für Stellen, die noch keine Gruppen können. */
export function kontoEintraege(labels: KontoBeschriftungen, assistent: string): Kontoeintrag[] {
  return kontoGruppen(labels, assistent).flatMap((g) => g.eintraege);
}
