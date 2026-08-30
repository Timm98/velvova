"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/cn";
import { JobRow, type JobRowData } from "@/components/jobs/JobRow";

/**
 * Die geteilte Ansicht.
 *
 * Links eine Liste zum Überfliegen, rechts die ausgewählte Stelle. Der
 * Wechsel läuft über einen Suchparameter, nicht über Zustand im
 * Browser: so ist jede Auswahl verlinkbar, der Zurück-Knopf tut das
 * Erwartete, und ein Neuladen zeigt dieselbe Stelle.
 *
 * Auf schmalen Geräten gibt es kein Nebeneinander. Dort ist die Liste
 * die Seite, und die Auswahl schiebt die Einzelansicht darüber — mit
 * einem Weg zurück, der auch ohne Systemgeste funktioniert.
 */
export function JobSplitView({
  rows,
  selectedId,
  explicitSelection,
  detail,
  emptyState,
}: {
  rows: JobRowData[];
  selectedId: string | null;
  /**
   * Hat die Person eine Stelle ausgewählt, oder ist es die
   * Vorauswahl?
   *
   * Auf breiten Geräten ist die Vorauswahl richtig: die rechte Spalte
   * wäre sonst leer. Auf schmalen ist sie falsch — dort ist die Liste
   * die Seite, und wer sie öffnet, will die Liste sehen, nicht die
   * erste Stelle. Serverseitig lässt sich die Fensterbreite nicht
   * kennen; deshalb entscheidet der Suchparameter.
   */
  explicitSelection: boolean;
  detail: React.ReactNode;
  emptyState: React.ReactNode;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const listRef = useRef<HTMLDivElement>(null);

  function hrefFor(id: string): string {
    const next = new URLSearchParams(params.toString());
    next.set("job", id);
    return `/app/jobs?${next.toString()}`;
  }

  function backHref(): string {
    const next = new URLSearchParams(params.toString());
    next.delete("job");
    const search = next.toString();
    return search ? `/app/jobs?${search}` : "/app/jobs";
  }

  // Die Auswahl in den sichtbaren Bereich holen — aber nur, wenn sie
  // wirklich außerhalb liegt. Ein Sprung bei jedem Klick wäre unruhig.
  useEffect(() => {
    if (!selectedId || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-job-id="${selectedId}"]`);
    if (!(el instanceof HTMLElement)) return;

    const box = listRef.current.getBoundingClientRect();
    const item = el.getBoundingClientRect();
    if (item.top < box.top || item.bottom > box.bottom) {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [selectedId]);

  if (rows.length === 0) return <>{emptyState}</>;

  return (
    /*
     * Keine Außenumrandung, keine gemeinsame weiße Karte.
     *
     * Vorher lagen Liste und Detail in einem Rechteck mit 1-Pixel-Rand
     * — die klassische Datenbankoberfläche. Jetzt sind es zwei Flächen
     * nebeneinander, getrennt durch Abstand statt durch eine Linie: die
     * Liste liegt auf dem Seitengrund, das Detail auf einer eigenen
     * hellen Fläche.
     *
     * 40/60 statt 26rem fest: die Vorgabe verlangt, dass das Detail
     * mehr Raum bekommt als die Liste.
     */
    <div className="grid gap-4 lg:h-[calc(100dvh-12rem)] lg:grid-cols-[minmax(0,40fr)_minmax(0,60fr)]">
      {/* ── Liste ──────────────────────────────────────────── */}
      <div
        ref={listRef}
        className={cn(
          // `min-w-0` ist hier keine Feinheit: eine Rasterspalte hat
          // standardmäßig `min-width: auto` und wächst mit ihrem Inhalt.
          // Ein langer Jobtitel schob die Liste auf 881 Pixel in einem
          // 390 Pixel breiten Fenster — die ganze Seite scrollte seitlich.
          "min-w-0 lg:overflow-y-auto lg:pr-1",
          explicitSelection && "hidden lg:block",
        )}
      >
        <h2 className="sr-only">Gefundene Stellen</h2>
        {/* `min-w-0` auf Liste UND Eintrag: ein Rasterelement hat
              standardmäßig `min-width: auto` und wächst mit seinem
              Inhalt. Ein langer Jobtitel schob die Liste auf 881 Pixel
              in einem 390 Pixel breiten Fenster. */}
        <ul className="grid min-w-0 gap-1">
          {rows.map((row) => (
            <li key={row.id} data-job-id={row.id} className="min-w-0">
              <JobRow job={row} selected={row.id === selectedId} href={hrefFor(row.id)} />
            </li>
          ))}
        </ul>
      </div>

      {/* ── Auswahl ────────────────────────────────────────── */}
      <div className={cn("min-w-0 lg:overflow-y-auto", !explicitSelection && "hidden lg:block")}>
        {selectedId ? (
          <>
            <h2 className="sr-only">Ausgewählte Stelle</h2>
            <div className="sticky top-0 z-10 bg-page/90 px-4 py-2.5 backdrop-blur lg:hidden">
              <button
                type="button"
                onClick={() => router.push(backHref(), { scroll: false })}
                className="inline-flex min-h-9 items-center gap-1.5 text-sm text-ink-2"
              >
                <ArrowLeft className="size-4" strokeWidth={1.8} />
                Alle Stellen
              </button>
            </div>
            {detail}
          </>
        ) : (
          <div className="hidden h-full place-items-center p-10 lg:grid">
            <p className="max-w-[26rem] text-center text-sm leading-relaxed text-ink-3">
              Wähle links eine Stelle. Rechts steht dann, warum sie passt, was dagegen spricht und
              was die Anzeige verschweigt.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
