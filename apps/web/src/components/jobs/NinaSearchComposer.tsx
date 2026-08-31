"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUp, Mic, MessagesSquare, SlidersHorizontal } from "lucide-react";
import { useNinaActions } from "@/components/nina/NinaProvider";
import { cn } from "@/lib/cn";
import { deuteSuchintention, erklärung } from "@/lib/jobs/suchintention";

/**
 * Eine Eingabe für die Jobsuche.
 *
 * Vorher standen hier zwei, direkt untereinander:
 *
 *   „Beschreibe Nina, wonach du suchst …"
 *   „Beschreib in eigenen Worten, was du suchst …"
 *
 * Zwei Felder, die dasselbe versprechen, sind nicht doppelt so
 * hilfreich — sie sind eine Frage, die man nicht beantworten kann: in
 * welches tippe ich? Die Antwort war unterschiedlich (das eine sprach
 * mit Nina, das andere setzte einen Filter), und genau das war von
 * außen nicht zu sehen.
 *
 * Jetzt eine Eingabe, die beides tut:
 *
 *   1. Der Text geht als Filter in die URL — die Liste aktualisiert
 *      sich sofort, ohne auf ein Modell zu warten.
 *   2. Derselbe Text geht an Nina, die ihn deutet und erklärt, wonach
 *      jetzt gesucht wird.
 *
 * Die schnelle Hälfte darf nicht auf die langsame warten. Wer „Berlin"
 * tippt, soll Berliner Stellen sehen, bevor ein Sprachmodell den Satz
 * gelesen hat.
 */

const BEISPIELE = [
  "Jobs mit Kundenkontakt, aber ohne Kaltakquise.",
  "Maximal zwei Bürotage rund um Karlsruhe.",
  "Welche ungewöhnlichen Rollen passen zu mir?",
  "Nur Stellen ab 45.000 €, wenn das Gehalt angegeben ist.",
];

export function NinaSearchComposer({
  assistantName,
  onOpenFilters,
  activeFilterCount,
}: {
  assistantName: string;
  onOpenFilters?: () => void;
  activeFilterCount?: number;
}) {
  const nina = useNinaActions();
  const router = useRouter();
  const params = useSearchParams();

  const [text, setText] = useState(params.get("q") ?? "");
  const [, startTransition] = useTransition();
  const feld = useRef<HTMLInputElement>(null);

  /*
   * Die Liste folgt dem Tippen mit 350 ms Verzögerung.
   *
   * Ohne Entprellung löst jeder Tastendruck eine Navigation aus — bei
   * „Kundenbetreuung" sind das siebzehn Serveranfragen für ein Wort.
   * 350 ms ist die Spanne, in der eine Pause nach Absicht aussieht und
   * nicht nach Zögern.
   */
  const ersterLauf = useRef(true);
  useEffect(() => {
    if (ersterLauf.current) {
      ersterLauf.current = false;
      return;
    }
    const timer = setTimeout(() => {
      startTransition(() => router.replace(`/app/jobs?${alsAdresse(text, params)}`, { scroll: false }));
    }, 350);
    return () => clearTimeout(timer);
    // `params` bewusst nicht in den Abhängigkeiten: sonst löst die
    // eigene Navigation den Effekt erneut aus und es entsteht eine
    // Schleife.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, router]);

  /*
   * Der Satz wird zu einer Adresse.
   *
   * Die von Nina gesetzten Bedingungen sind Filter, keine Suchwörter —
   * sie stehen einzeln in der URL und damit sichtbar in den Filtern
   * (§16.3). Was keine Regel erkennt, bleibt Volltext.
   *
   * Erst alle eigenen Schlüssel löschen, dann neu setzen: sonst bleibt
   * ein Filter aus dem vorigen Satz stehen, den niemand mehr im Text
   * sieht — der stille Filter, der die Liste unerklärlich leer hält.
   */
  function alsAdresse(eingabe: string, aktuell: URLSearchParams): string {
    const next = new URLSearchParams(aktuell.toString());
    /*
     * `seite` gehört mit gelöscht.
     *
     * Eine neue Bedingung ergibt eine neue, meist kürzere Liste. Die
     * Seitenzahl von vorhin passt dann auf nichts mehr. Die Seite
     * klammert das inzwischen zusätzlich ab — beides ist richtig: hier
     * steht die Absicht, dort die Sicherung.
     */
    for (const k of ["q", "nicht", "ort", "remote", "contract", "gehaltAb", "salary", "since", "seite"]) {
      next.delete(k);
    }
    const { filter } = deuteSuchintention(eingabe);
    for (const [k, v] of Object.entries(filter)) {
      if (v !== undefined && v !== "") next.set(k, String(v));
    }
    return next.toString();
  }

  function anNinaSchicken(frage: string) {
    const inhalt = frage.trim();
    if (!inhalt) return;

    /*
     * Die Liste zuerst, Nina danach.
     *
     * Beides bekommt denselben Satz, aber die Liste wartet nicht: die
     * Filter stehen sofort, während Nina noch liest. Andersherum wäre
     * jede Suche so langsam wie ein Sprachmodell.
     */
    setText(inhalt);
    startTransition(() =>
      router.replace(`/app/jobs?${alsAdresse(inhalt, params)}`, { scroll: false }),
    );

    // Der Drawer öffnet mit der Frage darin. Die Antwort gehört ins
    // Gespräch: sie ist selten ein Satz und fast immer eine Rückfrage.
    nina.setOpen(true);
    void nina.send(inhalt);
  }

  // Was aus dem Satz als Filter wurde, in einem Satz. Steht unter dem
  // Feld, damit niemand raten muss, warum die Liste sich geändert hat.
  const verstanden = erklärung(deuteSuchintention(text));

  return (
    /* Auch hier `minmax(0,1fr)`: ein Raster mit Vorgabespur wächst auf
       die Mindestbreite seines breitesten Kindes. Bei 360 Pixeln waren
       das 351 — und die ganze Seite lief über. */
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <div
        className={cn(
          "flex items-center gap-2 rounded-(--radius-pill) bg-raised py-2 pl-5 pr-2 shadow-sm",
          "transition-shadow duration-(--duration-fast)",
          "focus-within:shadow-[0_0_0_2px_var(--primary),0_10px_32px_rgba(101,93,255,0.16)]",
        )}
      >
        {/* Ein Gesprächssymbol, keine zweite Nina. Die echte Nina hat
            ein Modell; ein Ring davor wäre eine konkurrierende
            Darstellung derselben Figur. */}
        <MessagesSquare className="size-[18px] shrink-0 text-accent" strokeWidth={1.9} aria-hidden />

        <input
          ref={feld}
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              anNinaSchicken(text);
            }
          }}
          placeholder={`Frag ${assistantName} oder beschreibe deinen nächsten Job …`}
          aria-label={`Frag ${assistantName} oder beschreibe deinen nächsten Job`}
          className="h-12 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-3"
        />

        {onOpenFilters && (
          <button
            type="button"
            onClick={onOpenFilters}
            className="hidden h-11 items-center gap-2 rounded-(--radius-pill) px-4 text-sm text-ink-2 transition-colors hover:bg-soft hover:text-ink sm:flex"
          >
            <SlidersHorizontal className="size-4" strokeWidth={1.8} />
            Filter
            {activeFilterCount ? (
              <span className="grid size-5 place-items-center rounded-full bg-accent text-2xs font-semibold text-accent-on">
                {activeFilterCount}
              </span>
            ) : null}
          </button>
        )}

        <button
          type="button"
          aria-label="Diktieren"
          onClick={() => feld.current?.focus()}
          className="grid size-11 shrink-0 place-items-center rounded-(--radius-pill) text-ink-2 transition-colors hover:bg-soft hover:text-ink"
        >
          <Mic className="size-[18px]" strokeWidth={1.8} />
        </button>

        <button
          type="button"
          onClick={() => anNinaSchicken(text)}
          disabled={text.trim().length === 0}
          aria-label={`${assistantName} fragen`}
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-(--radius-pill) transition-colors",
            text.trim().length > 0
              ? "bg-accent text-accent-on hover:bg-accent-hover"
              : "bg-soft text-ink-3",
          )}
        >
          <ArrowUp className="size-[18px]" strokeWidth={2.2} />
        </button>
      </div>

      {verstanden && (
        <p className="px-5 text-sm text-ink-2" aria-live="polite">
          {verstanden}
        </p>
      )}

      {/* Beispiele nur, solange nichts getippt wurde. Starthilfe, keine
          Dauerdekoration. */}
      {text.length === 0 && (
        <ul className="flex flex-wrap gap-2">
          {BEISPIELE.map((b) => (
            <li key={b}>
              <button
                type="button"
                onClick={() => anNinaSchicken(b)}
                className="rounded-(--radius-pill) bg-soft px-4 py-2 text-left text-sm text-ink-2 transition-colors hover:bg-soft-hover hover:text-ink"
              >
                {b}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
