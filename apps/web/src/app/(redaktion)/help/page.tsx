import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { getPageContext } from "@/lib/locale";
import { currentUser } from "@/lib/auth";
import { HILFE, HILFE_BEREICHE, sucheHilfe } from "@/lib/content/hilfe";
import { HilfeSuche } from "./HilfeSuche";
import { SupportChat } from "./SupportChat";

export const metadata: Metadata = { title: "Hilfe" };
export const dynamic = "force-dynamic";

/**
 * Die Hilfeseite.
 *
 * Sie liegt im öffentlichen Bereich und ist genau deshalb der Ort, an
 * dem der gemeldete Fehler entstand: „Die Hilfe loggt mich aus."
 *
 * Sie tat es nie. Die Sitzung blieb gültig, das Cookie unberührt — aber
 * der öffentliche Rahmen bot jedem Besucher „Anmelden / Konto anlegen"
 * an, ohne nachzusehen, ob schon jemand angemeldet ist. Wer aus der
 * Anwendung auf Hilfe klickte, sah den Anmeldeknopf und zog den einzig
 * naheliegenden Schluss.
 *
 * Behoben ist das im Rahmen selbst (`(public)/layout.tsx`), nicht hier:
 * es betraf jede öffentliche Seite, nicht nur diese. Hier steht nur der
 * sichtbare Beweis — wer angemeldet ist, bekommt einen Weg zurück
 * statt einer Aufforderung, sich anzumelden.
 */
export default async function HelpPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { brand } = await getPageContext();
  const { q } = await searchParams;
  const user = await currentUser();

  const treffer = q ? sucheHilfe(q) : HILFE;
  const gefiltert = Boolean(q?.trim());

  return (
    <div className="grid gap-14">
      <header className="grid gap-4">
        <p className="text-2xs font-medium uppercase tracking-[0.14em] text-ink-3">Hilfe</p>
        <h1 className="font-display text-4xl font-normal tracking-[-0.02em]">
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

      {/* ── FAQ ─────────────────────────────────────────────── */}
      <section className="grid gap-10">
        {HILFE_BEREICHE.map((bereich) => {
          const eintraege = treffer.filter((e) => e.bereich === bereich);
          if (eintraege.length === 0) return null;
          return (
            <div key={bereich} className="grid gap-2">
              <h2 className="font-display text-xl font-normal tracking-[-0.02em]">{bereich}</h2>
              {/*
                Zeilen mit Haarlinie, keine Kästen — dieselbe Form wie
                im FAQ innerhalb der Anwendung. Zwanzig gefüllte Kästen
                untereinander liest man ab; Zeilen an einer Kante
                überfliegt man.
              */}
              <ul className="grid">
                {eintraege.map((e) => (
                  <li key={e.id} className="border-b border-line">
                    {/*
                      `<details>` statt eines eigenen Aufklappers.
                      Es ist von Haus aus tastaturbedienbar, wird von
                      Vorlesegeräten korrekt angesagt, funktioniert ohne
                      Javascript und lässt sich vom Browser durchsuchen.
                      Ein nachgebauter Aufklapper kann all das auch —
                      aber nur, wenn man an alles denkt.
                    */}
                    <details className="group">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-base transition-colors marker:content-none hover:text-accent-text">
                        {e.frage}
                        <ChevronDown
                          aria-hidden
                          className="size-4 shrink-0 text-ink-3 transition-transform group-open:rotate-180"
                          strokeWidth={1.8}
                        />
                      </summary>
                      <p className="max-w-[var(--measure)] pb-5 text-base leading-relaxed text-ink-2">
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

      {/* ── Monday ────────────────────────────────────────────── */}
      <SupportChat assistantName={brand.assistantName} angemeldet={Boolean(user)} />

      {/* ── Mensch ──────────────────────────────────────────── */}
      <section className="grid gap-3 rounded-(--radius-lg) bg-ice px-6 py-6">
        <h2 className="font-display text-xl font-normal tracking-[-0.02em]">
          Lieber ein Mensch?
        </h2>
        <p className="max-w-[var(--measure)] text-base leading-relaxed text-ink-2">
          Wenn {brand.assistantName} nicht weiterhilft, schreib uns. Wir antworten selbst — es
          gibt keine Warteschleife und kein Ticketsystem, das dich verwaltet.
        </p>
        <p>
          <Link
            href="/contact"
            className="inline-flex h-11 items-center rounded-(--radius-pill) bg-accent px-5 text-sm font-medium text-accent-on transition-colors hover:bg-accent-hover"
          >
            Zum Kontakt
          </Link>
        </p>
      </section>
    </div>
  );
}
