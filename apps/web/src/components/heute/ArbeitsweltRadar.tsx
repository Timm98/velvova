"use client";

import { ExternalLink, Sparkle } from "lucide-react";
import { useNinaActions } from "@/components/nina/NinaProvider";

/**
 * Der Arbeitswelt-Radar (§23.2).
 *
 * Titel, Quelle, Datum, Kurzbeschreibung — und ein Link zum Original.
 * Mehr steht hier nicht, und das ist keine Sparsamkeit, sondern die
 * Bedingung: der Artikel gehört dem Herausgeber, der Feed erlaubt die
 * Nennung, nicht die Übernahme.
 *
 * „Von Nina erklären lassen" gibt ihr genau das mit, was auf dem
 * Bildschirm steht — Titel, Quelle, Datum, Anriss — und die Frage, was
 * das für diese Person bedeutet. Nina holt den Artikel NICHT nach; sie
 * kann ihn nicht lesen, und sie soll auch nicht so tun. Was sie
 * beitragen kann, ist die Einordnung ins Profil, und dazu braucht sie
 * den Volltext nicht.
 */

export interface RadarAnzeige {
  id: string;
  titel: string;
  beschreibung: string;
  link: string;
  datumIso: string | null;
  quelleName: string;
}

export function ArbeitsweltRadar({
  beiträge,
  assistantName,
  locale,
}: {
  beiträge: RadarAnzeige[];
  assistantName: string;
  locale: string;
}) {
  const nina = useNinaActions();

  if (beiträge.length === 0) {
    return (
      <section aria-labelledby="radar" className="grid gap-3">
        <h2 id="radar" className="font-display text-xl font-semibold tracking-[-0.02em]">
          Arbeitswelt-Radar
        </h2>
        {/*
          Ehrlich leer statt gefüllt.

          Wenn keine Quelle erreichbar ist, steht hier nichts — kein
          Platzhalterartikel, keine erfundene Meldung. Ein Radar, der
          sich etwas ausdenkt, wenn er nichts sieht, ist schlimmer als
          ein leerer.
        */}
        <p className="max-w-[var(--measure)] text-base leading-relaxed text-ink-2">
          Gerade sind keine Beiträge abrufbar. Sobald die Quellen wieder antworten, stehen sie
          hier — nichts wird ersatzweise erfunden.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="radar" className="grid gap-4">
      <div className="grid gap-1.5">
        <h2 id="radar" className="font-display text-xl font-semibold tracking-[-0.02em]">
          Arbeitswelt-Radar
        </h2>
        <p className="max-w-[var(--measure)] text-base leading-relaxed text-ink-2">
          Was sich gerade in der Arbeitswelt bewegt. Titel und Anriss stammen von der Quelle, der
          Link führt zum Original.
        </p>
      </div>

      <ul className="grid gap-2">
        {beiträge.map((b) => (
          <li key={b.id} className="grid gap-2 rounded-(--radius-lg) bg-soft px-5 py-4">
            <a href={b.link} target="_blank" rel="noopener noreferrer" className="group grid gap-1.5">
              <span className="flex items-start gap-2 text-base font-medium leading-snug">
                <span className="min-w-0">{b.titel}</span>
                <ExternalLink
                  className="mt-1 size-4 shrink-0 text-ink-3 transition-colors group-hover:text-accent"
                  strokeWidth={1.8}
                  aria-hidden
                />
              </span>
              {b.beschreibung && (
                <span className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
                  {b.beschreibung}
                </span>
              )}
            </a>

            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-3">
              <span>{b.quelleName}</span>
              {b.datumIso && (
                <>
                  <span aria-hidden>·</span>
                  <time dateTime={b.datumIso}>
                    {new Intl.DateTimeFormat(locale, {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    }).format(new Date(b.datumIso))}
                  </time>
                </>
              )}
            </p>

            <button
              type="button"
              onClick={() => {
                nina.setOpen(true);
                void nina.send(
                  `Ordne mir diesen Beitrag ein:\n\n` +
                    `Titel: ${b.titel}\n` +
                    `Quelle: ${b.quelleName}\n` +
                    (b.datumIso ? `Datum: ${b.datumIso.slice(0, 10)}\n` : "") +
                    (b.beschreibung ? `Anriss: ${b.beschreibung}\n` : "") +
                    `\nWas verändert sich dadurch, ist das für mich relevant, und was bleibt ` +
                    `unsicher? Du kennst nur diese Angaben — den Artikel selbst hast du nicht ` +
                    `gelesen. Sag das, wenn es für die Einordnung wichtig ist.`,
                );
              }}
              className="inline-flex h-10 w-fit items-center gap-2 rounded-(--radius-pill) bg-raised px-4 text-sm font-medium transition-colors hover:bg-lavender"
            >
              <Sparkle className="size-4 text-accent" strokeWidth={1.8} aria-hidden />
              Von {assistantName} erklären lassen
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
