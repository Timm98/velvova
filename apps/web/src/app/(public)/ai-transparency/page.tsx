import type { Metadata } from "next";
import { brand } from "@paycheck/config";
import { PageHeader } from "@/components/ui/states";

export const metadata: Metadata = { title: "KI-Transparenz" };

/**
 * Was die KI in diesem Produkt tut — und was nicht.
 *
 * Diese Seite ist keine Rechtsaussage, sondern eine Selbstauskunft:
 * jeder Satz hier lässt sich im Code nachschlagen. Deshalb darf sie
 * veröffentlicht werden, während Impressum und Datenschutz noch auf
 * eine juristische Prüfung warten.
 */
export default function AiTransparencyPage() {
  const n = brand.assistantName;

  return (
    <div className="mx-auto grid w-full max-w-[760px] gap-10 px-5 py-14 md:px-8">
      <PageHeader
        eyebrow="KI-Transparenz"
        title={`Was ${n} tut — und was nicht`}
        lead={`${n} ist ein Sprachmodell mit klaren Grenzen. Diese Seite sagt, welche.`}
      />

      <section className="grid gap-5">
        <h2 className="text-base font-semibold">Wobei KI beteiligt ist</h2>
        <ul className="grid gap-3">
          {[
            ["Das Gespräch", "Fragen stellen, nachfragen, zusammenfassen."],
            ["Aussagen ableiten", "Aus deinen Antworten entstehen Vorschläge — als unbestätigte Vermutung."],
            ["Texte entwerfen", "Anschreiben und Lebenslaufteile. Jeder Satz wird gegen deine Belege geprüft."],
          ].map(([titel, text]) => (
            <li key={titel} className="grid gap-1">
              <span className="text-sm font-medium">{titel}</span>
              <span className="text-sm leading-relaxed text-ink-2">{text}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-5 border-t border-line pt-6">
        <h2 className="text-base font-semibold">Wobei keine KI beteiligt ist</h2>
        <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
          Die Bewertung. Passung, Zuversicht, Anzeigenqualität und deine harten Bedingungen werden
          gerechnet, nicht geschätzt. Sie stimmen auch dann, wenn du der KI-Nutzung widersprichst —
          und genau deshalb ist dieser Widerspruch möglich, ohne dass du das Produkt verlierst.
        </p>
      </section>

      <section className="grid gap-5 border-t border-line pt-6">
        <h2 className="text-base font-semibold">Was {n} nie tut</h2>
        <ul className="grid gap-2.5">
          {[
            "Eine Einstellungswahrscheinlichkeit angeben.",
            "Etwas über Herkunft, Geschlecht, Alter, Religion, Gesundheit oder Behinderung schliessen.",
            "Stimme, Gesicht, Akzent oder Ehrlichkeit analysieren.",
            "Eine Bewerbung ohne deine ausdrückliche Bestätigung abschicken.",
            "Eine Erfahrung behaupten, für die du keinen Beleg bestätigt hast.",
            "Eine sichere Aussage über die Zukunft eines Berufs treffen.",
          ].map((s) => (
            <li key={s} className="text-sm leading-relaxed text-ink-2">
              {s}
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-5 border-t border-line pt-6">
        <h2 className="text-base font-semibold">Wo Fehler entstehen</h2>
        <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
          Ein Sprachmodell kann falsch liegen, und es klingt dabei genauso überzeugt wie sonst.
          Deshalb steht neben jeder Einschätzung eine Begründung: eine falsche Begründung erkennst
          du, eine falsche Zahl nicht.
        </p>
        <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
          Jede abgeleitete Aussage über dich ist zunächst unbestätigt und zählt nirgends mit, bis
          du sie bestätigst. Du kannst jede davon ändern, ablehnen oder löschen.
        </p>
      </section>

      <section className="grid gap-5 border-t border-line pt-6">
        <h2 className="text-base font-semibold">Wohin deine Daten gehen</h2>
        <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
          An den Modellanbieter geht ein Auszug: bestätigte Aussagen, offene Vermutungen, deine
          harten Bedingungen und die letzten Züge des Gesprächs. Nicht: dein Name, deine
          E-Mail-Adresse, der vollständige Verlauf oder deine Dokumente.
        </p>
        <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
          Wir behaupten nicht, dass deine Daten unsere Datenbank nie verlassen — bei einem externen
          Modell wäre das schlicht falsch. Was gilt, steht in der Datenschutzerklärung.
        </p>
      </section>
    </div>
  );
}
