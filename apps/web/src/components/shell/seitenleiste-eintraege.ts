import {
  Briefcase,
  FileText,
  FolderOpen,
  MessageSquare,
  Plug,
  Search,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * ══════════════════════════════════════════════════════════════════
 * Was links steht — und was ausdrücklich nicht
 * ══════════════════════════════════════════════════════════════════
 *
 * Die Kopfzeile der Anwendung trug bisher sieben Bereiche, davon zwei
 * Marketingseiten (`/for-business`, `/security`). Sie standen dort,
 * weil dieselbe Leiste die öffentliche Seite trägt — nicht, weil
 * jemand sie beim Arbeiten braucht.
 *
 * Die Seitenleiste trennt das: Hier stehen nur Orte, an denen man
 * etwas tut. Alles, was erklärt, wirbt oder einmal eingestellt wird,
 * liegt im Kontomenü unten oder auf velvova.com.
 *
 * ── Die Reihenfolge ist die Reihenfolge der Arbeit ──────────────
 *
 * Gespräch, dann Stellen, dann Bewerbungen, dann Unterlagen. Das ist
 * der Weg, den jemand tatsächlich geht: Man redet, bevor man sucht,
 * und man sucht, bevor man sich bewirbt. Eine alphabetische oder nach
 * Wichtigkeit sortierte Liste wäre kürzer zu begründen und beim
 * Benutzen schlechter.
 */

export interface Seitenleisteneintrag {
  href: string;
  text: string;
  icon: LucideIcon;
  /** Nur bei exakter Übereinstimmung aktiv — sonst wäre `/app` immer aktiv. */
  exakt?: boolean;
}

/**
 * Die Arbeitsbereiche.
 *
 * `Ausprobieren` und `FAQ` sind hier bewusst nicht: Das eine ist eine
 * Demonstration für Menschen ohne Konto, das andere gehört zur Hilfe.
 * Beide waren in der alten Kopfzeile gleichrangig neben „Bewerbungen“
 * — und damit stand eine Produktvorführung neben der eigenen Arbeit.
 *
 * ── Warum „Monday“ hier nicht mehr steht ────────────────────────
 *
 * Weil „+ Neuer Chat“ darüber genau dorthin führt. Zwei Wege zum
 * selben Ort, zehn Pixel auseinander, sind keine Auswahl — der
 * zweite sieht aus, als führte er woandershin, und man probiert ihn
 * einmal, um es herauszufinden.
 *
 * ── Plugins ist eine eigene Seite ───────────────────────────────
 *
 * Zuerst zeigte der Eintrag auf `/app/settings/integrations`. Die
 * gibt es — sie ist aber eine Betreiber-Sicht auf Supabase, den
 * KI-Anbieter und den Mailversand, mit den Namen der
 * Umgebungsvariablen daneben. Wer wissen will, ob sein Postfach
 * verbunden ist, fand dort seinen Schlüsselnamen und keine Antwort.
 *
 * `/app/plugins` liest dieselbe Tabelle `integrations`, die das
 * Datenmodell dafür vorsieht — kein Parallelsystem, nur die Sicht,
 * die zu der Person gehört, die davorsitzt.
 */
export const ARBEITSBEREICHE: readonly Seitenleisteneintrag[] = [
  { href: "/app/jobs", text: "Jobs & Checks", icon: Briefcase },
  { href: "/app/applications", text: "Bewerbungen", icon: FileText },
  { href: "/app/documents", text: "Dokumente", icon: FolderOpen },
  { href: "/app/plugins", text: "Plugins", icon: Plug },
  /*
   * Benachrichtigungen stehen NICHT hier.
   *
   * Sie haben in der Leiste eine eigene Zeile, weil sie als einzige
   * eine Zahl tragen — die ungelesenen. Hier eingetragen erschienen
   * sie zweimal untereinander, einmal mit Zähler und einmal ohne.
   * Beim Bauen nicht aufgefallen, beim ersten Blick auf den
   * Bildschirm sofort.
   */
];

/** Eigene Zeile, weil sie kein Ort ist, sondern ein Werkzeug. */
export const SUCHE = { text: "Suchen", icon: Search } as const;

export const NEUES_GESPRAECH = { href: "/app/monday", text: "Neuer Chat", icon: MessageSquare } as const;

/**
 * Ist dieser Eintrag der aktuelle Ort?
 *
 * Präfixvergleich mit Grenze: `/app/jobs` ist auch auf
 * `/app/jobs/abc-123` aktiv, aber `/app/job` macht `/app/jobs` nicht
 * aktiv. Ohne den Schrägstrich am Ende wäre jeder Eintrag aktiv,
 * dessen Pfad zufällig der Anfang eines anderen ist.
 */
export function istHier(pfad: string, eintrag: { href: string; exakt?: boolean }): boolean {
  if (eintrag.exakt) return pfad === eintrag.href;
  return pfad === eintrag.href || pfad.startsWith(`${eintrag.href}/`);
}
