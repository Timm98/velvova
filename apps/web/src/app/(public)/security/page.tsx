import type { Metadata } from "next";
import { Card, Stack } from "@/components/ui";

export const metadata: Metadata = { title: "Sicherheit" };

export default function SecurityPage() {
  const measures: [string, string][] = [
    ["Verschlüsselte Uebertragung", "TLS für jede Verbindung. Sitzungs-Cookies sind httpOnly, SameSite und in Produktion secure."],
    ["Passwörter", "Gespeichert wird ausschließlich ein scrypt-Hash mit zufälligem Salt. Der Vergleich läuft in konstanter Zeit. Verlangt werden mindestens acht Zeichen - Länge schützt besser als erzwungene Sonderzeichen."],
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

      {/*
        Was ein Arbeitgeber sieht — und was nicht.
        
        Diese Liste stand auf der Unternehmensseite, in zwei Kästen
        neben dem Absatz, der dasselbe in drei Sätzen sagt. Dort war
        sie acht Aufzählungspunkte lang für eine Frage, die auf einer
        Produktseite niemand so genau stellt.
        
        Hier ist sie richtig: Wer diese Seite öffnet, will es genau
        wissen — und die Zusage steht neben den übrigen, statt allein
        auf einer Verkaufsseite.
      */}
      <Card>
        <Stack gap={3}>
          <h2 style={{ fontSize: "var(--text-base)" }}>Was ein Arbeitgeber sieht</h2>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
            Ein Unternehmen sieht nie ein Profil, sondern ausschliesslich die Angaben, die jemand
            für genau diese Stelle freigegeben hat — entstanden im Moment der Bewerbung.
          </p>
          <div style={{ display: "grid", gap: "var(--space-4)", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <Stack gap={2}>
              <h3 style={{ fontSize: "var(--text-sm)" }}>Sichtbar</h3>
              <ul style={{ listStyle: "none", display: "grid", gap: "var(--space-2)", fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                <li>· Name und Kontaktadresse</li>
                <li>· die Kurzbeschreibung</li>
                <li>· das Anschreiben</li>
                <li>· freigegebene Unterlagen</li>
              </ul>
            </Stack>
            <Stack gap={2}>
              <h3 style={{ fontSize: "var(--text-sm)" }}>Nicht sichtbar</h3>
              <ul style={{ listStyle: "none", display: "grid", gap: "var(--space-2)", fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                <li>· das Gespräch mit Monday</li>
                <li>· das aktuelle Gehalt</li>
                <li>· Lebenshaltung und Steuerangaben</li>
                <li>· andere Bewerbungen</li>
              </ul>
            </Stack>
          </div>
          <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
            Auch nicht zusammengefasst, auch nicht auf Anfrage. Die Trennung liegt in den
            Zeilenrichtlinien der Datenbank, nicht in der Abfragedisziplin einzelner Stellen.
          </p>
        </Stack>
      </Card>

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
