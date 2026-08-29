import type { Metadata } from "next";
import Link from "next/link";
import { getPageContext } from "@/lib/locale";
import { Card, Stack } from "@/components/ui";

export const metadata: Metadata = { title: "Datenschutz" };
export const dynamic = "force-dynamic";

/**
 * Datenschutz.
 *
 * Der Zustand wird aus der Laufzeitkonfiguration gelesen, nicht behauptet:
 * ob gerade ein externer Anbieter verarbeitet, steht hier so, wie es
 * tatsächlich ist.
 */
export default async function PrivacyPage() {
  const { integrations, brand } = await getPageContext();
  const externalAi = integrations.ai === "connected";

  return (
    <Stack gap={7}>
      <header>
        <h1 style={{ fontSize: "var(--text-3xl)", lineHeight: "var(--leading-3xl)" }}>Datenschutz</h1>
        <p style={{ marginTop: "var(--space-4)", fontSize: "var(--text-lg)", color: "var(--text-secondary)" }}>
          Was gespeichert wird, wozu, wie lange - und wer es sonst noch sieht.
        </p>
      </header>

      <Card style={{ borderColor: externalAi ? "var(--caution)" : "var(--border-subtle)" }}>
        <Stack gap={3}>
          <h2 style={{ fontSize: "var(--text-lg)" }}>Aktueller Zustand dieser Installation</h2>
          <p style={{ color: "var(--text-secondary)" }}>
            {externalAi
              ? "Es ist ein externer KI-Anbieter verbunden. Texte werden zur Analyse dorthin übermittelt. Direkte Identifikatoren wie E-Mail-Adresse, Telefonnummer und Profillinks werden vorher entfernt."
              : "Es ist kein externer KI-Anbieter verbunden. Die Antworten stammen von einem lokalen Demo-Anbieter und verlassen dieses Gerät nicht."}
          </p>
          <p style={{ color: "var(--text-secondary)" }}>
            {integrations.mail === "draft-only"
              ? "Es ist kein Postfach verbunden. Bewerbungen werden als Entwurf erzeugt und niemals automatisch versendet."
              : "Ein Postfach ist verbunden. Versendet wird ausschließlich nach ausdrücklicher Bestätigung."}
          </p>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
            Wichtig und oft missverstanden: eine eigene Datenbank bedeutet nicht automatisch, dass
            keine Daten einen externen Anbieter erreichen. Deshalb steht der tatsächliche Zustand
            hier und nicht in einer Broschüre.
          </p>
        </Stack>
      </Card>

      <section>
        <h2 style={{ fontSize: "var(--text-xl)", marginBottom: "var(--space-4)" }}>Grundsätze</h2>
        <Stack gap={4}>
          {[
            ["Zweckbindung", "Jede Datenkategorie hat einen benannten Zweck. Wofuer sie nicht erhoben wurde, dafür wird sie nicht verwendet."],
            ["Datenminimierung", "Es wird nur erhoben, was für den benannten Zweck nötig ist. An einen externen Anbieter geht nur der Ausschnitt, den die konkrete Aufgabe braucht."],
            ["Getrennte Einwilligungen", "Karriereprofil, Dokumentanalyse, Spracheingabe, Transkriptspeicherung und externe Verarbeitung sind fünf getrennte Entscheidungen. Jede einzeln widerrufbar."],
            ["Kein Training ohne Zustimmung", "Deine Daten werden nicht für das Training von Modellen verwendet. Das ist standardmäßig aus und braucht eine ausdrückliche, gesonderte Zustimmung."],
            ["Keine stille Weitergabe", "Institutionelle Partner sehen standardmäßig ausschließlich aggregierte Zahlen. Ein individuelles Profil wird nie ohne ausdrückliche Freigabe geteilt."],
            ["Aufbewahrung", "Jede Angabe trägt eine Aufbewahrungsklasse: nur für die Sitzung, solange das Profil besteht, oder solange eine gesetzliche Pflicht besteht."],
          ].map(([title, body]) => (
            <Card key={title}>
              <Stack gap={2}>
                <h3 style={{ fontSize: "var(--text-base)" }}>{title}</h3>
                <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>{body}</p>
              </Stack>
            </Card>
          ))}
        </Stack>
      </section>

      <section>
        <h2 style={{ fontSize: "var(--text-xl)", marginBottom: "var(--space-4)" }}>Deine Rechte</h2>
        <Card>
          <Stack gap={3}>
            <p style={{ color: "var(--text-secondary)" }}>
              Einsehen, berichtigen, exportieren, löschen und jede Einwilligung widerrufen - alles
              im Privacy Center, ohne Anfrage per E-Mail.
            </p>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
              Zur Löschung: Inhalte werden sofort unzugänglich gemacht, die endgültige Entfernung
              erfolgt durch einen nachgelagerten Lauf. Wir nennen diesen Ablauf, statt
              &bdquo;sofort und unwiederbringlich&ldquo; zu behaupten.
            </p>
            <p style={{ fontSize: "var(--text-sm)" }}>
              <Link href="/app/settings" style={{ color: "var(--accent-text)" }}>Zum Privacy Center →</Link>
            </p>
          </Stack>
        </Card>
      </section>

      <section>
        <h2 style={{ fontSize: "var(--text-xl)", marginBottom: "var(--space-4)" }}>
          KI im Beschäftigungskontext
        </h2>
        <Card>
          <Stack gap={3}>
            <p style={{ color: "var(--text-secondary)" }}>
              {brand.name} ist als kandidatenkontrollierte Assistenz ausgelegt: {brand.assistantName}{" "}
              empfiehlt, erklärt und bereitet vor. Die Entscheidung trifft ein Mensch.
            </p>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
              Ausdrücklich nicht Teil des Produkts: ein Ranking von Personen für Arbeitgeber,
              automatische Ablehnung, automatisierte Auswahlentscheidungen, biometrische oder
              emotionale Bewertung und die Ableitung besonderer Kategorien personenbezogener Daten.
            </p>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
              Zweckbestimmung, Grenzen, menschliche Aufsicht, Datenquellen, Bewertungslogik,
              Testfälle und bekannte Risiken sind im Repository dokumentiert. Eine
              Konformitätsbewertung hat nicht stattgefunden, und wir behaupten sie nicht.
            </p>
          </Stack>
        </Card>
      </section>
    </Stack>
  );
}
