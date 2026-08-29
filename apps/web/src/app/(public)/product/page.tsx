import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getPageContext } from "@/lib/locale";

export const metadata: Metadata = { title: "Produkt" };

/**
 * Produktüberblick.
 *
 * Die Reihenfolge folgt der tatsächlichen Journey, nicht der Reihenfolge
 * der Funktionen im Code. Wer hier liest, will wissen, was mit ihm
 * passiert — nicht, welche Module es gibt.
 */
export default async function ProductPage() {
  const { brand } = await getPageContext();

  const stages = [
    {
      title: "Karriereanalyse",
      body: `${brand.assistantName} führt ein Gespräch über konkrete Situationen: was du gemacht hast, was dabei herauskam, was dir Energie gibt und was nicht. Jede Aussage bleibt in deinen Worten gespeichert.`,
    },
    {
      title: "Career Evidence Profile",
      body: "Aus dem Gespräch entsteht ein Profil, in dem jede Stärke an einer benannten Erfahrung hängt. Du bestätigst, korrigierst, gewichtest ab oder löschst — nichts steht dort ohne deine Zustimmung.",
    },
    {
      title: "Rollen entdecken",
      body: "Nicht ein „Traumberuf“, sondern mehrere plausible Richtungen — darunter angrenzende und ungewöhnliche, auf die man beim Suchen nach dem eigenen Jobtitel nie stößt.",
    },
    {
      title: "Echte Stellen, begründet sortiert",
      body: "Anzeigen aus offen angebotenen Quellen, mit Herkunft und Abrufdatum. Sortiert nach begründeter Passung, Jobqualität und Aktualität.",
    },
    {
      title: "Job Reality Check",
      body: "Was steht wirklich in der Anzeige, was fehlt, was solltest du im Gespräch prüfen. Getrennt danach, ob es aus der Anzeige, aus Bewertungen oder aus einem Register stammt.",
    },
    {
      title: "Application Studio",
      body: "Unterlagen entstehen aus deinen belegten Erfahrungen. Jeder Satz über Erfahrung oder Ergebnis braucht einen Beleg — ohne Beleg wird abgeschwächt oder nachgefragt, nie erfunden.",
    },
    {
      title: "Nach der Einstellung",
      body: `${brand.assistantName} hört nicht bei der Zusage auf: Check-ins nach 30, 60 und 90 Tagen, neue Aufgaben als Evidenz, ein Lebenslauf, der von selbst aktuell bleibt.`,
    },
  ];

  return (
    <div className="grid gap-12">
      <header className="grid gap-4">
        <p className="text-2xs font-medium uppercase tracking-[0.14em] text-brand">Produkt</p>
        <h1 className="font-display text-[2.5rem] font-medium leading-[1.08] tracking-[-0.02em]">
          Von der ersten Frage bis zum dritten Monat.
        </h1>
        <p className="max-w-[var(--measure)] text-lg leading-relaxed text-ink-2">
          {brand.name} ist keine Jobbörse mit Chatfenster. Es ist ein geführter Weg, der bei deinen
          Erfahrungen beginnt und nach der Einstellung weitergeht.
        </p>
      </header>

      <ol className="grid gap-px overflow-hidden rounded-[--radius-lg] border border-line bg-line">
        {stages.map((stage, index) => (
          <li key={stage.title} className="bg-raised px-6 py-6">
            <span aria-hidden className="font-mono text-2xs font-medium tracking-widest text-brand">
              {String(index + 1).padStart(2, "0")}
            </span>
            <h2 className="mt-2 text-lg font-semibold">{stage.title}</h2>
            <p className="mt-2 max-w-[var(--measure)] leading-relaxed text-ink-2">{stage.body}</p>
          </li>
        ))}
      </ol>

      <p>
        <Link
          href="/register"
          className="inline-flex h-12 items-center gap-2 rounded-[--radius-md] bg-accent px-6 text-base font-medium text-accent-on shadow-sm transition-colors hover:bg-accent-hover"
        >
          Mit {brand.assistantName} starten
          <ArrowRight className="size-4" strokeWidth={2} />
        </Link>
      </p>
    </div>
  );
}
