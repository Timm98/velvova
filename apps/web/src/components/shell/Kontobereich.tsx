"use client";

import { AccountMenu } from "./AccountMenu";
import { kontoEintraege, type KontoBeschriftungen } from "./kontoeintraege";

/**
 * Das Kontomenü, gebaut auf der Client-Seite.
 *
 * ── Warum diese Datei existiert ───────────────────────────────
 *
 * `kontoEintraege` liefert je Eintrag eine Lucide-Komponente. Eine
 * Komponente ist eine Funktion mit Eigenschaften — und Funktionen
 * lassen sich nicht von einer Server- an eine Client-Komponente
 * übergeben:
 *
 *     Only plain objects can be passed to Client Components from
 *     Server Components. Classes or other objects with methods are
 *     not supported.
 *     {href: …, label: …, icon: {$$typeof: …, render: …}}
 *
 * In `AppShell` fiel das nicht auf: Die ist selbst eine
 * Client-Komponente und baut die Liste dort, wo sie gebraucht wird.
 * `Kopfsitzung` ist es nicht — sie liest die Datenbank.
 *
 * Die Grenze verläuft deshalb hier: Über sie gehen nur Zeichenketten,
 * ein Wahrheitswert und ein fertiges React-Element für das
 * Abmeldeformular. Die Symbole entstehen dahinter.
 *
 * ── Warum nicht Symbolnamen durchreichen ──────────────────────
 *
 * Das wäre der andere Weg gewesen: `icon: "user"` statt der
 * Komponente, und eine Zuordnung auf der Client-Seite. Dann gäbe es
 * aber eine Tabelle von Namen auf Komponenten, die niemand prüft — ein
 * Tippfehler ergibt ein fehlendes Symbol, und zwar erst zur Laufzeit.
 * So bleibt es beim Typ, den der Übersetzer kennt.
 */
export function Kontobereich({
  userName,
  userEmail,
  bildKennung,
  labels,
  onLogout,
}: {
  userName: string | null;
  userEmail: string;
  bildKennung: string | null;
  labels: KontoBeschriftungen;
  onLogout: React.ReactNode;
}) {
  return (
    <AccountMenu
      userName={userName}
      userEmail={userEmail}
      bildKennung={bildKennung}
      items={kontoEintraege(labels)}
      onLogout={onLogout}
    />
  );
}
