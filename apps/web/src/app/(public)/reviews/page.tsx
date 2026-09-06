import type { Metadata } from "next";
import Link from "next/link";
import { Sterne } from "@/components/reviews/Sterne";
import { Bewertungskarte } from "@/components/reviews/Bewertungskarte";
import { BewertungAbgebenKnopf } from "@/components/reviews/BewertungFormular";
import { alleOeffentlichen, kennzahlen, type Sortierung } from "@/lib/reviews/lesen";

export const metadata: Metadata = {
  title: "Bewertungen",
  description: "Was Menschen über Velvova schreiben — vollständig und ungefiltert.",
};
export const dynamic = "force-dynamic";

/**
 * Alle veröffentlichten Bewertungen.
 *
 * Die Startseite zeigt eine Auswahl; hier steht alles. Der Unterschied
 * ist wichtiger, als er klingt: eine Seite, die nur die schönsten
 * Stimmen zeigt, ist Werbung. Eine, auf der man nach einem Stern
 * filtern kann, ist eine Auskunft.
 *
 * Deshalb steht die Verteilung ganz oben und ist anklickbar — auch die
 * Zeile mit einem Stern. Wer wissen will, was die Unzufriedenen
 * schreiben, soll das in einem Klick können und nicht suchen müssen.
 */

const SORTIERUNGEN: { key: Sortierung; label: string }[] = [
  { key: "neueste", label: "Neueste" },
  { key: "beste", label: "Beste" },
  { key: "hilfreichste", label: "Hilfreichste" },
];

export default async function BewertungenPage({
  searchParams,
}: {
  searchParams: Promise<{ sterne?: string; sortierung?: string; seite?: string }>;
}) {
  const params = await searchParams;
  const sterne = params.sterne ? Number(params.sterne) : null;
  const sortierung = (SORTIERUNGEN.find((s) => s.key === params.sortierung)?.key ??
    "neueste") as Sortierung;
  const seite = Math.max(1, Number(params.seite) || 1);

  const [zahlen, ergebnis] = await Promise.all([
    kennzahlen(),
    alleOeffentlichen({ sterne, sortierung, seite }),
  ]);

  const adresse = (aenderung: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const werte = {
      sterne: sterne ? String(sterne) : null,
      sortierung: sortierung === "neueste" ? null : sortierung,
      seite: seite > 1 ? String(seite) : null,
      ...aenderung,
    };
    for (const [k, v] of Object.entries(werte)) if (v) p.set(k, v);
    const q = p.toString();
    return q ? `/reviews?${q}` : "/reviews";
  };

  /*
   * Kein eigenes `<main>`.
   *
   * Das öffentliche Layout bringt bereits eines mit, samt `id="inhalt"`
   * für die Sprungmarke. Ein zweites daneben ergäbe eine doppelte
   * Kennung und ein verschachteltes Hauptelement — für ein Vorlesegerät
   * heisst das: zwei Hauptbereiche, und die Sprungmarke landet je nach
   * Browser im falschen.
   *
   * Die grössere Breite kommt über einen negativen Aussenabstand: das
   * Layout begrenzt auf 760 Pixel, eine zweispaltige Bewertungsliste
   * braucht mehr.
   */
  return (
    <div className="mx-auto w-full max-w-[1000px] lg:-mx-[120px] lg:w-[calc(100%+240px)] lg:max-w-none">
      <h1 className="font-display text-[2rem] font-semibold leading-[1.12] tracking-[-0.03em] md:text-[2.75rem]">
        Bewertungen
      </h1>

      {zahlen.anzahl === 0 ? (
        <div className="mt-8 grid max-w-[var(--measure)] gap-5">
          {/*
           * Kein Platzhalter, keine erfundene Stimme.
           *
           * Es gibt noch keine Bewertung, und das steht hier. Alles
           * andere wäre der Anfang einer Sammlung von Behauptungen,
           * die niemand aufgestellt hat.
           */}
          <p className="text-lg leading-relaxed text-ink-2">
            Hier steht noch nichts. Sobald die ersten Bewertungen geprüft sind, erscheinen sie an
            dieser Stelle — vollständig und ungekürzt.
          </p>
          <BewertungAbgebenKnopf className="justify-self-start" />
        </div>
      ) : (
        <>
          {/* ── Gesamtbild ─────────────────────────────────── */}
          <div className="mt-8 grid gap-8 rounded-(--radius-surface) bg-inset p-6 md:grid-cols-[auto_minmax(0,1fr)] md:gap-12 md:p-8">
            <div className="grid content-start gap-2">
              <span className="font-display text-[3.5rem] font-semibold leading-none tracking-[-0.03em] tabular">
                {zahlen.schnitt!.toLocaleString("de-DE", {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })}
              </span>
              <Sterne wert={zahlen.schnitt!} groesse="lg" />
              <span className="text-sm text-ink-2">
                aus {zahlen.anzahl} {zahlen.anzahl === 1 ? "Bewertung" : "Bewertungen"}
              </span>
            </div>

            {/* Die Verteilung, anklickbar — auch die schlechten Noten. */}
            <ul className="grid content-center gap-1.5">
              {[5, 4, 3, 2, 1].map((n) => {
                const wieviele = zahlen.verteilung[n - 1] ?? 0;
                const anteil = zahlen.anzahl > 0 ? (wieviele / zahlen.anzahl) * 100 : 0;
                const aktiv = sterne === n;
                return (
                  <li key={n}>
                    <Link
                      href={adresse({ sterne: aktiv ? null : String(n), seite: null })}
                      aria-pressed={aktiv}
                      className="flex items-center gap-3 rounded-(--radius-sm) px-2 py-1 transition-colors hover:bg-soft"
                    >
                      <span className="w-14 shrink-0 text-sm text-ink-2">
                        {n} {n === 1 ? "Stern" : "Sterne"}
                      </span>
                      <span
                        aria-hidden
                        className="h-2 flex-1 overflow-hidden rounded-full bg-surface"
                      >
                        <span
                          className="block h-full rounded-full bg-caution"
                          style={{ width: `${anteil}%` }}
                        />
                      </span>
                      <span className="w-8 shrink-0 text-right font-mono text-sm tabular text-ink-3">
                        {wieviele}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* ── Filter und Sortierung ──────────────────────── */}
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              {sterne && (
                <Link
                  href={adresse({ sterne: null, seite: null })}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-(--radius-pill) bg-lavender px-3.5 text-sm"
                >
                  Nur {sterne} {sterne === 1 ? "Stern" : "Sterne"}
                  <span aria-hidden>×</span>
                  <span className="sr-only">Filter entfernen</span>
                </Link>
              )}
            </div>

            <nav aria-label="Sortierung" className="flex flex-wrap items-center gap-1">
              {SORTIERUNGEN.map((s) => (
                <Link
                  key={s.key}
                  href={adresse({ sortierung: s.key === "neueste" ? null : s.key, seite: null })}
                  aria-current={sortierung === s.key ? "true" : undefined}
                  className={`inline-flex min-h-9 items-center rounded-(--radius-pill) px-3.5 text-sm transition-colors ${
                    sortierung === s.key ? "bg-lavender font-medium text-ink" : "text-ink-2 hover:bg-soft"
                  }`}
                >
                  {s.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* ── Die Bewertungen ────────────────────────────── */}
          {ergebnis.zeilen.length === 0 ? (
            <p className="mt-10 text-base text-ink-2">
              Mit diesem Filter gibt es nichts. {" "}
              <Link href={adresse({ sterne: null, seite: null })} className="text-accent-text underline underline-offset-[3px]">
                Alle anzeigen
              </Link>
            </p>
          ) : (
            <ul className="mt-8 grid gap-5 md:grid-cols-2">
              {ergebnis.zeilen.map((b) => (
                <li key={b.id}>
                  <Bewertungskarte bewertung={b} />
                </li>
              ))}
            </ul>
          )}

          {ergebnis.seiten > 1 && (
            <nav aria-label="Seiten" className="mt-10 flex items-center justify-center gap-2">
              {Array.from({ length: ergebnis.seiten }, (_, i) => i + 1).map((n) => (
                <Link
                  key={n}
                  href={adresse({ seite: n === 1 ? null : String(n) })}
                  aria-current={n === seite ? "page" : undefined}
                  className={`grid size-10 place-items-center rounded-(--radius-pill) font-mono text-sm tabular transition-colors ${
                    n === seite ? "bg-accent text-accent-on" : "text-ink-2 hover:bg-soft"
                  }`}
                >
                  {n}
                </Link>
              ))}
            </nav>
          )}

          <div className="mt-14 border-t border-line-2 pt-10">
            <BewertungAbgebenKnopf />
          </div>
        </>
      )}
    </div>
  );
}
