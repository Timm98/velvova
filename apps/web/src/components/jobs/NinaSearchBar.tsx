"use client";

import { useState } from "react";
import { ArrowUp } from "lucide-react";
import { NinaSignal } from "@/components/nina/NinaSignal";
import { useNina } from "@/components/nina/NinaProvider";
import { cn } from "@/lib/cn";

/**
 * Suchen, indem man es sagt.
 *
 * „Zeig mir Jobs mit Kundenkontakt, aber ohne Kaltakquise“ ist eine
 * Bedingung, die kein Filterfeld abbildet — und genau deshalb steht
 * dieses Feld über der Filterleiste und nicht statt ihrer. Die Filter
 * bleiben sichtbar und bedienbar; das hier ist der Weg für alles, was
 * dazwischen liegt.
 *
 * Was Nina hier NICHT darf: Bedingungen stillschweigend lockern. Wer
 * 45.000 als Untergrenze nennt, bekommt keine Stelle für 38.000 mit dem
 * Hinweis, sie sei „sonst sehr passend“. Findet sich nichts, sagt sie
 * das und fragt, ob einmalig erweitert werden soll. Die Regel steht im
 * Systemprompt und im Seitenkontext — hier steht nur der Eingang.
 */

const BEISPIELE = [
  "Zeig mir Jobs mit Kundenkontakt, aber ohne Kaltakquise.",
  "Ich möchte rund um Karlsruhe arbeiten und höchstens zwei Tage ins Büro.",
  "Welche ungewöhnlichen Rollen passen zu meinem Profil?",
  "Nur Stellen ab 45.000 €, wenn das Gehalt angegeben ist.",
];

export function NinaSearchBar({ assistantName }: { assistantName: string }) {
  const nina = useNina();
  const [text, setText] = useState("");

  function fragen(frage: string) {
    const inhalt = frage.trim();
    if (!inhalt) return;
    // Der Drawer öffnet sich mit der Frage darin. Die Antwort gehört ins
    // Gespräch, nicht in ein Feld über der Liste: sie ist selten ein
    // Satz und fast immer eine Rückfrage.
    nina.setOpen(true);
    void nina.send(inhalt);
    setText("");
  }

  return (
    <div className="grid gap-3">
      <div
        className={cn(
          "flex items-center gap-2 rounded-(--radius-control) bg-soft py-1.5 pl-4 pr-1.5",
          "transition-[background-color,box-shadow] duration-(--duration-fast)",
          "focus-within:bg-raised focus-within:shadow-[0_0_0_2px_var(--primary),0_6px_20px_rgba(98,92,255,0.14)]",
        )}
      >
        <NinaSignal size="sm" state={nina.busy ? "thinking" : "idle"} />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              fragen(text);
            }
          }}
          placeholder={`Beschreibe ${assistantName}, wonach du suchst …`}
          aria-label={`Suche mit ${assistantName} beschreiben`}
          className="h-11 min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3"
        />
        <button
          type="button"
          onClick={() => fragen(text)}
          disabled={text.trim().length === 0 || nina.busy}
          aria-label="Fragen"
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-(--radius-control) transition-colors",
            text.trim().length > 0 && !nina.busy
              ? "bg-accent text-accent-on hover:bg-accent-hover"
              : "text-ink-3",
          )}
        >
          <ArrowUp className="size-[18px]" strokeWidth={2.2} />
        </button>
      </div>

      {/* Beispiele nur, solange nichts getippt wurde. Sie sind eine
          Starthilfe, keine Dauerdekoration. */}
      {text.length === 0 && (
        <ul className="flex flex-wrap gap-2">
          {BEISPIELE.map((beispiel) => (
            <li key={beispiel}>
              <button
                type="button"
                onClick={() => fragen(beispiel)}
                className="rounded-(--radius-control) bg-soft px-3.5 py-2 text-left text-sm text-ink-2 transition-colors hover:bg-soft-hover hover:text-ink"
              >
                {beispiel}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
