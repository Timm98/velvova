"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Die Suche über der Hilfe.
 *
 * Der Text steht in der Adresse, nicht nur im Zustand — dadurch lässt
 * sich ein Suchergebnis verlinken, die Zurück-Taste tut das Erwartete,
 * und ein Neuladen verliert nichts.
 *
 * Ohne Javascript bleibt es ein gewöhnliches Formular mit GET. Das ist
 * bei einer Hilfeseite mehr als Prinzipientreue: wer hier landet, hat
 * womöglich gerade ein Problem, und ein hängengebliebenes Skript darf
 * nicht auch noch die Suche kosten.
 */
export function HilfeSuche({ defaultValue }: { defaultValue: string }) {
  const router = useRouter();
  const [text, setText] = useState(defaultValue);
  const [, starte] = useTransition();
  const ersterLauf = useRef(true);

  useEffect(() => {
    if (ersterLauf.current) {
      ersterLauf.current = false;
      return;
    }
    // Dieselbe Entprellung wie in der Jobsuche: ohne sie ist jeder
    // Tastendruck eine Navigation.
    const timer = setTimeout(() => {
      const ziel = text.trim() ? `/help?q=${encodeURIComponent(text.trim())}` : "/help";
      starte(() => router.replace(ziel, { scroll: false }));
    }, 300);
    return () => clearTimeout(timer);
  }, [text, router]);

  return (
    <form
      action="/help"
      method="get"
      className={cn(
        "flex items-center gap-3 rounded-(--radius-pill) bg-raised py-2 pl-5 pr-3 shadow-sm",
        "focus-within:shadow-[0_0_0_2px_var(--primary),0_10px_32px_rgba(101,93,255,0.16)]",
      )}
    >
      <Search className="size-[18px] shrink-0 text-ink-3" strokeWidth={1.8} aria-hidden />
      <input
        type="search"
        name="q"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Wonach suchst du?"
        aria-label="Hilfe durchsuchen"
        className="h-12 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-3"
      />
      <noscript>
        <button type="submit" className="h-10 rounded-(--radius-pill) bg-accent px-4 text-sm text-accent-on">
          Suchen
        </button>
      </noscript>
    </form>
  );
}
