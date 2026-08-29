import type { Metadata } from "next";
import { Card, Stack } from "@/components/ui";

export const metadata: Metadata = { title: "Sicherheit" };

export default function SecurityPage() {
  const measures: [string, string][] = [
    ["Verschlüsselte Uebertragung", "TLS für jede Verbindung. Sitzungs-Cookies sind httpOnly, SameSite und in Produktion secure."],
    ["Passwörter", "Gespeichert wird ausschließlich ein scrypt-Hash mit zufälligem Salt. Der Vergleich läuft in konstanter Zeit. Verlangt werden mindestens zwölf Zeichen - Länge schützt besser als erzwungene Sonderzeichen."],
    ["Sitzungen", "Im Cookie steht ein zufälliges Token, in der Datenbank nur dessen Hash. Wer die Datenbank liest, kann sich damit nicht anmelden. Jede Sitzung ist einzeln widerrufbar."],
    ["Zugriffskontrolle in der Datenbank", "Row Level Security über eine eingeschränkte Anwendungsrolle. Jede Anfrage läuft in einer Transaktion, die zuerst die erhöhten Rechte ablegt und die Nutzerkennung setzt. Ohne diesen Rahmen sind keine Nutzerdaten sichtbar."],
    ["Trennung sensibler Inhalte", "Besonders schutzbedürftige Freitexte können verschlüsselt abgelegt werden; die Aufbewahrungsklasse steht an jeder Angabe."],
    ["Uploads", "Prüfung von Typ und Größe, Anbindung für einen Schadsoftware-Scan, verschlüsselter Objektspeicher, kurzlebige signierte Links statt öffentlicher Adressen."],
    ["Kein Personenbezug in Protokollen", "Chattexte, Dokumentinhalte und Freitexte erscheinen nicht in Logs oder in der Nutzungsmessung."],
    ["Nachvollziehbarkeit", "Supportzugriff auf Nutzerinhalte ist nur über einen begründeten, protokollierten Ausnahmezugriff möglich - nicht beiläufig."],
    ["Externe Texte", "Stellenanzeigen, Bewertungen und Lebensläufe werden als Daten behandelt, nie als Anweisungen. Auffällige Formulierungen werden markiert und angezeigt statt still entfernt."],
  ];

  return (
    <Stack gap={6}>
      <header>
        <h1 style={{ fontSize: "var(--text-3xl)", lineHeight: "var(--leading-3xl)" }}>Sicherheit</h1>
        <p style={{ marginTop: "var(--space-4)", fontSize: "var(--text-lg)", color: "var(--text-secondary)" }}>
          Welche Maßnahmen tatsächlich umgesetzt sind - und was noch aussteht.
        </p>
      </header>

      <ul style={{ listStyle: "none", display: "grid", gap: "var(--space-4)" }}>
        {measures.map(([title, body]) => (
          <Card as="li" key={title}>
            <Stack gap={2}>
              <h2 style={{ fontSize: "var(--text-base)" }}>{title}</h2>
              <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>{body}</p>
            </Stack>
          </Card>
        ))}
      </ul>

      <Card style={{ background: "var(--surface-sunken)", boxShadow: "none" }}>
        <Stack gap={3}>
          <h2 style={{ fontSize: "var(--text-base)" }}>Was noch aussteht</h2>
          <ul style={{ listStyle: "none", display: "grid", gap: "var(--space-2)", fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
            <li>· Mehrfaktor-Anmeldung ist vorbereitet, aber nicht aktiviert.</li>
            <li>· Der Schadsoftware-Scan ist als Schnittstelle vorhanden; ein Dienst ist nicht angebunden.</li>
            <li>· Ein externer Sicherheitstest hat nicht stattgefunden.</li>
            <li>· Ein Wiederherstellungstest der Sicherungen steht aus.</li>
          </ul>
          <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
            Diese Liste steht hier, weil eine Sicherheitsseite ohne offene Punkte unglaubwürdig ist.
          </p>
        </Stack>
      </Card>
    </Stack>
  );
}
