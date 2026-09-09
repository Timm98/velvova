import {
  Briefcase,
  FileText,
  FolderOpen,
  MessageSquare,
  Search,
  Sparkles,
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
 * Die vier Arbeitsbereiche.
 *
 * `Ausprobieren` und `FAQ` sind hier bewusst nicht: Das eine ist eine
 * Demonstration für Menschen ohne Konto, das andere gehört zur Hilfe.
 * Beide waren in der alten Kopfzeile gleichrangig neben „Bewerbungen“
 * — und damit stand eine Produktvorführung neben der eigenen Arbeit.
 */
export const ARBEITSBEREICHE: readonly Seitenleisteneintrag[] = [
  { href: "/app/monday", text: "Monday", icon: Sparkles },
  { href: "/app/jobs", text: "Jobs & Checks", icon: Briefcase },
  { href: "/app/applications", text: "Bewerbungen", icon: FileText },
  { href: "/app/documents", text: "Dokumente", icon: FolderOpen },
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
