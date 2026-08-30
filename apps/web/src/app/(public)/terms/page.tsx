import type { Metadata } from "next";
import { getPageContext } from "@/lib/locale";

export const metadata: Metadata = { title: "Nutzungsbedingungen" };

/**
 * Nutzungsbedingungen.
 *
 * Noch kein Vertragswerk — das Produkt wird nicht öffentlich angeboten.
 * Was hier steht, sind die Zusagen, die im Code bereits durchgesetzt
 * werden. Erfundene Paragraphen wären hier nicht bloß unschön, sondern
 * rechtlich irreführend.
 */
export default async function TermsPage() {
  const { brand } = await getPageContext();

  const promises = [
    {
      title: "Du bist die Kundin, nicht das Produkt",
      body: `${brand.name} arbeitet für die suchende Person. Es gibt keine Arbeitgeberseite, keine Kandidatensuche und keine Weitergabe deines Profils. Reihenfolgen in der Trefferliste sind nicht käuflich.`,
    },
    {
      title: "Nichts wird ohne deine Freigabe versendet",
      body: "Bewerbungen, Nachrichten und Unterlagen verlassen das System ausschließlich nach einer ausdrücklichen Bestätigung durch dich. Es gibt keinen automatischen Versand.",
    },
    {
      title: "Keine erfundenen Angaben",
      body: `Jede Tatsachenbehauptung in einer erzeugten Bewerbung hängt an einem Beleg aus deinem Profil oder an deiner ausdrücklichen Bestätigung. ${brand.assistantName} erfindet keine Erfahrung, keine Zahl und keinen Abschluss.`,
    },
    {
      title: "Keine Bewertung geschützter Merkmale",
      body: "Herkunft, Religion, Gesundheit, Orientierung, Gewerkschaftszugehörigkeit und Familienstand werden weder abgeleitet noch gespeichert noch bewertet — auch nicht mittelbar aus Name, Stimme oder Schreibstil.",
    },
    {
      title: "Keine Einstellungswahrscheinlichkeit",
      body: "Der Passungswert ist eine nachvollziehbare Produktschätzung über die Übereinstimmung mit belegten Angaben. Er ist keine Aussage darüber, wie ein Arbeitgeber entscheiden wird.",
    },
    {
      title: "Deine Daten gehören dir",
      body: "Du kannst alles einsehen, einzeln ändern, exportieren und löschen. Jede Einwilligung ist einzeln widerrufbar, und ein Widerruf wirkt sofort.",
    },
  ];

  return (
    <div className="grid gap-10">
      <header className="grid gap-4">
        <p className="font-mono text-2xs uppercase tracking-[0.16em] text-accent-text">
          Nutzungsbedingungen
        </p>
        <h1 className="font-display text-[2.5rem] font-semibold leading-[1.06] tracking-[-0.03em]">
          Was wir zusagen.
        </h1>
      </header>

      <div
        role="note"
        className="grid gap-3 rounded-(--radius-lg) border border-caution/30 bg-caution-soft p-5"
      >
        <p className="text-sm font-medium text-caution">Noch kein Vertragswerk</p>
        <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
          {brand.name} wird noch nicht öffentlich angeboten. Vollständige Nutzungsbedingungen
          entstehen mit dem Betriebsstart. Die folgenden Punkte sind keine Absichtserklärung — sie
          sind im Code durchgesetzt und durch Tests abgesichert.
        </p>
      </div>

      <ul className="grid divide-y divide-line border-y border-line">
        {promises.map((promise) => (
          <li key={promise.title} className="grid gap-2 py-6 sm:grid-cols-[16rem_minmax(0,1fr)] sm:gap-8">
            <h2 className="text-[15px] font-medium">{promise.title}</h2>
            <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
              {promise.body}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
