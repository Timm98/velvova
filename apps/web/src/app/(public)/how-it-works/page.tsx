import type { Metadata } from "next";
import Link from "next/link";
import { getPageContext } from "@/lib/locale";
import { buttonStyle, Card, Stack } from "@/components/ui";

export const metadata: Metadata = { title: "So funktioniert es" };

export default async function HowItWorksPage() {
  const { brand } = await getPageContext();

  const steps = [
    {
      title: "Ein Gespräch statt eines Formulars",
      body:
        `${brand.assistantName} fragt nach konkreten Situationen, nicht nach Selbsteinschätzungen. ` +
        `"Bist du gut im Organisieren?" liefert eine Meinung. "Erzähl von etwas, das du organisiert ` +
        `hast" liefert etwas, das man belegen und in eine Bewerbung schreiben kann.`,
    },
    {
      title: "Nichts zählt, bevor du es bestätigst",
      body:
        "Aus deinen Antworten entstehen einzelne Aussagen. Jede kannst du bestätigen, bearbeiten, " +
        "ablehnen oder löschen. Erst bestätigte Aussagen fliessen in Empfehlungen und Unterlagen " +
        "ein. Das ist der Unterschied zu einem Chatprofil.",
    },
    {
      title: "Wenige Vorschläge, jeder begründet",
      body:
        "Statt hunderter Anzeigen bekommst du eine Auswahl. Zu jeder steht, warum sie passt und was " +
        "dagegen spricht. Beides immer, auch bei einer guten Passung.",
    },
    {
      title: "Passung und Sicherheit stehen nebeneinander",
      body:
        "Eine Passung von 82 bei dünner Datenlage ist eine andere Aussage als dieselbe Zahl bei " +
        "guter. Deshalb siehst du beides getrennt - und wo die Datenbasis nicht reicht, gar keine " +
        "Zahl, sondern den Grund.",
    },
    {
      title: "Unterlagen aus deinen Belegen",
      body:
        "Jede prüfbare Aussage in einem erzeugten Dokument hängt an einer bestätigten Erfahrung. " +
        "Findet sich kein Beleg, wird die Aussage markiert und das Dokument lässt sich nicht " +
        "freigeben. Das ist keine Warnung, sondern eine Sperre.",
    },
    {
      title: "Du entscheidest, was hinausgeht",
      body:
        `${brand.assistantName} bereitet vor, erklärt und fragt nach. Versendet wird nichts ohne ` +
        `deine ausdrückliche Bestätigung - und es gibt keinen Massenversand.`,
    },
  ];

  return (
    <Stack gap={6}>
      <header>
        <h1 style={{ fontSize: "var(--text-3xl)", lineHeight: "var(--leading-3xl)" }}>
          So funktioniert es
        </h1>
        <p style={{ marginTop: "var(--space-4)", fontSize: "var(--text-lg)", color: "var(--text-secondary)" }}>
          Sechs Punkte, die erklären, warum das hier anders abläuft als auf einer Jobbörse.
        </p>
      </header>

      <ol style={{ listStyle: "none", display: "grid", gap: "var(--space-4)" }}>
        {steps.map((s, i) => (
          <Card as="li" key={s.title}>
            <Stack gap={3}>
              <span style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>{i + 1}</span>
              <h2 style={{ fontSize: "var(--text-lg)" }}>{s.title}</h2>
              <p style={{ color: "var(--text-secondary)" }}>{s.body}</p>
            </Stack>
          </Card>
        ))}
      </ol>

      <Card style={{ background: "var(--surface-sunken)", boxShadow: "none" }}>
        <Stack gap={3}>
          <h2 style={{ fontSize: "var(--text-base)" }}>Was hier ausdrücklich nicht passiert</h2>
          <ul style={{ listStyle: "none", display: "grid", gap: "var(--space-2)", fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
            <li>· Keine Bewertung von Stimme, Gesicht, Akzent, Emotion oder Ehrlichkeit.</li>
            <li>· Keine Ableitung von Gesundheit, Herkunft, Religion oder ähnlichem.</li>
            <li>· Kein Score, der als Einstellungswahrscheinlichkeit ausgegeben wird.</li>
            <li>· Keine Aussage, ein Beruf verschwinde in einer bestimmten Zeit.</li>
            <li>· Kein automatischer Massenversand von Bewerbungen.</li>
          </ul>
        </Stack>
      </Card>

      <p>
        <Link href="/register" style={buttonStyle("primary")}>Konto anlegen</Link>
      </p>
    </Stack>
  );
}
