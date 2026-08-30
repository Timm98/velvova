"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUp, Mic, SlidersHorizontal } from "lucide-react";
import { NinaSignal } from "@/components/nina/NinaSignal";
import { useNinaActions } from "@/components/nina/NinaProvider";
import { cn } from "@/lib/cn";

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
      const next = new URLSearchParams(params.toString());
      if (text.trim()) next.set("q", text.trim());
      else next.delete("q");
      if (next.toString() === params.toString()) return;
      startTransition(() => router.replace(`/app/jobs?${next.toString()}`, { scroll: false }));
    }, 350);
    return () => clearTimeout(timer);
    // `params` bewusst nicht in den Abhängigkeiten: sonst löst die
    // eigene Navigation den Effekt erneut aus und es entsteht eine
    // Schleife.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, router]);

  function anNinaSchicken(frage: string) {
    const inhalt = frage.trim();
    if (!inhalt) return;
    // Der Drawer öffnet mit der Frage darin. Die Antwort gehört ins
    // Gespräch: sie ist selten ein Satz und fast immer eine Rückfrage.
    nina.setOpen(true);
    void nina.send(inhalt);
  }

  return (
    <div className="grid gap-3">
      <div
        className={cn(
          "flex items-center gap-2 rounded-(--radius-pill) bg-raised py-2 pl-5 pr-2 shadow-sm",
          "transition-shadow duration-(--duration-fast)",
          "focus-within:shadow-[0_0_0_2px_var(--primary),0_10px_32px_rgba(101,93,255,0.16)]",
        )}
      >
        <NinaSignal size="sm" state="idle" />

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
          className="h-12 min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3"
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
