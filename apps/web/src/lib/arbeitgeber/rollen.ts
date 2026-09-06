/**
 * Die Rollen — ohne Server, ohne Datenbank.
 *
 * Eigene Datei aus demselben Grund wie `payroll/angaben.ts`: `zugang.ts`
 * importiert `@/lib/auth` und damit `next/headers`. Wer von dort etwas
 * in eine Client-Komponente holt — und sei es nur eine Beschriftung —
 * zieht die halbe Serverwelt ins Browser-Bündel. Der Build bricht dann
 * mit „Module not found: Can't resolve 'dns'" ab: eine Meldung, die
 * nichts mit der Ursache zu tun hat.
 *
 * Hier steht deshalb nur, was beide Seiten brauchen.
 */

export type Rolle = "owner" | "admin" | "recruiter" | "viewer";

/**
 * Die Rangfolge. Höher schliesst niedriger ein.
 *
 * `viewer` darf lesen, `recruiter` zusätzlich Stellen schreiben und
 * Bewerbungen bearbeiten, `admin` zusätzlich veröffentlichen und
 * einladen, `owner` zusätzlich Besitz übertragen.
 */
export const RANG: Record<Rolle, number> = { viewer: 1, recruiter: 2, admin: 3, owner: 4 };

export const ROLLENNAME: Record<Rolle, string> = {
  owner: "Besitzer",
  admin: "Verwaltung",
  recruiter: "Recruiting",
  viewer: "Nur Lesen",
};

export const ROLLENBESCHREIBUNG: Record<Rolle, string> = {
  owner: "Kann alles, auch die Organisation ändern und den Besitz übertragen.",
  admin: "Kann Stellen veröffentlichen und Kolleginnen einladen.",
  recruiter: "Kann Stellen schreiben und Bewerbungen bearbeiten.",
  viewer: "Kann alles sehen, aber nichts ändern.",
};

export interface Mitgliedschaft {
  organizationId: string;
  name: string;
  slug: string | null;
  rolle: Rolle;
  verifiziert: boolean;
}

/** Reine Prüfung — für die Oberfläche und für `verlangeRolle`. */
export function darf(rolle: Rolle, mindestens: Rolle): boolean {
  return RANG[rolle] >= RANG[mindestens];
}

/**
 * Eine unbekannte Rolle ist die niedrigste, nicht die höchste.
 *
 * In der Spalte steht `text`, und der Vorgabewert des alten Schemas war
 * „member" — ein Wert, den diese Rangfolge nicht kennt. Auf `viewer`
 * abzubilden ist die sichere Richtung: Wer durch einen Tippfehler oder
 * eine alte Zeile eine unbekannte Rolle trägt, darf lesen und sonst
 * nichts.
 */
export function alsRolle(wert: string): Rolle {
  return wert in RANG ? (wert as Rolle) : "viewer";
}
