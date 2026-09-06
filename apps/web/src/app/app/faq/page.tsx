import type { Metadata } from "next";
import Link from "next/link";
import { getPageContext } from "@/lib/locale";
import { HILFE, HILFE_BEREICHE, sucheHilfe } from "@/lib/content/hilfe";
import { HilfeSuche } from "../../(public)/help/HilfeSuche";
import { SupportChat } from "../../(public)/help/SupportChat";

/*
 * Das FAQ innerhalb der Anwendung.
 *
 * ── Warum es die Seite zweimal gibt ───────────────────────────
 *
 * `/help` liegt im öffentlichen Rahmen und bleibt dort: Wer noch kein
 * Konto hat, muss die Antworten lesen können.
 *
 * Für Angemeldete war der Weg dorthin aber ein Sprung aus der
 * Anwendung heraus — Kopfzeile weg, Wege weg, Nina weg. Wer beim
 * Bewerben nicht weiterweiss, verlässt dabei genau den Ort, an dem er
 * gerade arbeitet, und muss danach zurückfinden.
 *
 * Doppelt ist nur die Hülle. Inhalt (`lib/content/hilfe.ts`), Suche und
 * Supportchat sind dieselben Bausteine; es gibt keine zweite Wahrheit,
 * die auseinanderlaufen könnte.
 */
export const metadata: Metadata = { title: "FAQ" };
export const dynamic = "force-dynamic";

/*
 * Die Seitenleiste neben dem FAQ.
 *
 * ── Was hier bewusst fehlt ────────────────────────────────────
 *
 * Die Vorlage nannte „Privatverkäufer-AGB" und
 * „Zertifizierungsbedingungen". Beides sind Dokumente eines
 * Uhrenmarktplatzes; auf einem Stellenmarkt gibt es weder
 * Privatverkäufer noch zertifizierte Ware. Einen Menüpunkt dafür
 * anzulegen hiesse, ein Rechtsdokument zu erfinden — und ein
 * Rechtsmenü, dessen Hälfte ins Leere führt, ist schlimmer als ein
 * kurzes.
 *
 * Aufgeführt ist deshalb nur, was es gibt. Kommen später eigene
 * Bedingungen dazu, ist hier eine Zeile zu ergänzen.
 */
const RECHTSWEGE: { href: string; label: string }[] = [
  { href: "/app/faq", label: "Übersicht" },
  { href: "/app/faq#fragen", label: "Hilfe & FAQ" },
  { href: "/terms", label: "Plattformbedingungen" },
  { href: "/privacy", label: "Datenschutz" },
  { href: "/security", label: "Sicherheitsinfos" },
  { href: "/ai-transparency", label: "KI-Transparenz" },
  { href: "/methodology", label: "Methodik" },
  { href: "/imprint", label: "Impressum" },
  { href: "/contact", label: "Kontakt" },
];

export default async function AppFaqSeite({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { brand } = await getPageContext();
  const { q } = await searchParams;

  const treffer = q ? sucheHilfe(q) : HILFE;
  const gefiltert = Boolean(q?.trim());

  return (
    <div className="grid gap-10 py-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-12">
      {/*
        Die Leiste steht links und im Quelltext zuerst — so erreicht
        sie auch die Tastatur zuerst. Auf schmalen Geräten rutscht sie
        über den Text; ein Menü unter zwanzig Antworten findet niemand.
      */}
      <nav aria-label="Rechtliches und Hilfe" className="lg:sticky lg:top-6 lg:self-start">
        <ul className="grid gap-0.5">
          {RECHTSWEGE.map((w) => (
            <li key={w.href}>
              <Link
                href={w.href}
                className="inline-flex min-h-9 w-full items-center rounded-(--radius-sm) px-2.5 text-sm text-ink-2 transition-colors hover:bg-soft hover:text-ink"
              >
                {w.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="grid gap-12">
      <header className="grid gap-4">
        <p className="text-2xs font-medium uppercase tracking-[0.14em] text-ink-3">Hilfe</p>
        <h1 className="font-display text-4xl font-semibold tracking-[-0.03em]">
          Wobei können wir helfen?
        </h1>
        <p className="max-w-[var(--measure)] text-base leading-relaxed text-ink-2">
          Such nach einem Stichwort, lies die häufigen Fragen, oder frag {brand.assistantName}{" "}
          direkt. Sie antwortet hier aus der Produktdokumentation — nicht aus deinem
          Karriereprofil.
        </p>
      </header>

      <HilfeSuche defaultValue={q ?? ""} />

      {gefiltert && (
        <p className="-mt-8 text-sm text-ink-2" aria-live="polite">
          {treffer.length === 0
            ? `Zu „${q}“ steht hier nichts. Frag ${brand.assistantName} unten — oder schreib uns.`
            : `${treffer.length} ${treffer.length === 1 ? "Antwort" : "Antworten"} zu „${q}“.`}
        </p>
      )}

      <section id="fragen" className="grid gap-10 scroll-mt-6">
        {HILFE_BEREICHE.map((bereich) => {
          const eintraege = treffer.filter((e) => e.bereich === bereich);
          if (eintraege.length === 0) return null;
          return (
            <div key={bereich} className="grid gap-4">
              <h2 className="font-display text-xl font-semibold tracking-[-0.02em]">{bereich}</h2>
              <ul className="grid gap-2">
                {eintraege.map((e) => (
                  <li key={e.id}>
                    <details className="group rounded-(--radius-lg) bg-soft px-5 py-4 transition-colors hover:bg-soft-hover open:bg-lavender">
                      <summary className="cursor-pointer list-none text-base font-medium marker:content-none">
                        {e.frage}
                      </summary>
                      <p className="mt-3 max-w-[var(--measure)] text-base leading-relaxed text-ink-2">
                        {e.antwort}
                      </p>
                    </details>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>

      <SupportChat assistantName={brand.assistantName} angemeldet />

      <section className="grid gap-3 rounded-(--radius-lg) bg-ice px-6 py-6">
        <h2 className="font-display text-xl font-semibold tracking-[-0.02em]">Lieber ein Mensch?</h2>
        <p className="max-w-[var(--measure)] text-base leading-relaxed text-ink-2">
          Wenn {brand.assistantName} nicht weiterhilft, schreib uns. Wir antworten selbst — es gibt
          keine Warteschleife und kein Ticketsystem, das dich verwaltet.
        </p>
        <Link
          href="/contact"
          className="justify-self-start text-base font-medium text-accent-text underline underline-offset-[3px]"
        >
          Kontakt aufnehmen
        </Link>
      </section>
      </div>
    </div>
  );
}
