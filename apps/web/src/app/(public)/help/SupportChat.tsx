"use client";

import { useRef, useState } from "react";
import { ArrowUp, MessagesSquare } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Ninas Supportchat.
 *
 * Bewusst NICHT der globale Nina-Drawer. Der trägt das Karrieregespräch
 * mit sich — Stufe, Belege, Profil — und genau das darf hier nicht
 * mitkommen (§24.3, §29). Ein gemeinsamer Zustand für beides wäre eine
 * Einladung, die Trennung eines Tages zu verlieren, ohne dass es
 * jemandem auffällt.
 *
 * Deshalb ein eigener, kleiner Chat mit eigener Route und eigener
 * Gesprächsart. Für Gäste funktioniert er ohne Konto; angemeldet darf
 * Nina zusätzlich den eigenen Kontostand einbeziehen, aber niemals
 * Daten anderer.
 */

interface Zeile {
  rolle: "user" | "assistant";
  text: string;
}

export function SupportChat({
  assistantName,
  angemeldet,
}: {
  assistantName: string;
  angemeldet: boolean;
}) {
  const [zeilen, setZeilen] = useState<Zeile[]>([]);
  const [text, setText] = useState("");
  const [läuft, setLäuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const feld = useRef<HTMLInputElement>(null);

  async function frage(eingabe: string) {
    const inhalt = eingabe.trim();
    if (!inhalt || läuft) return;

    setText("");
    setFehler(null);
    setZeilen((z) => [...z, { rolle: "user", text: inhalt }]);
    setLäuft(true);

    try {
      const antwort = await fetch("/api/nina/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frage: inhalt }),
      });

      const daten = (await antwort.json().catch(() => null)) as
        | { antwort?: string; hinweis?: string }
        | null;

      if (!antwort.ok || !daten?.antwort) {
        setFehler(
          daten?.hinweis ??
            "Die Antwort ist gerade nicht verfügbar. Die häufigen Fragen oben helfen vielleicht weiter.",
        );
        return;
      }
      setZeilen((z) => [...z, { rolle: "assistant", text: daten.antwort! }]);
    } catch {
      setFehler("Keine Verbindung. Die häufigen Fragen oben stehen auch offline zur Verfügung.");
    } finally {
      setLäuft(false);
      feld.current?.focus();
    }
  }

  return (
    <section className="grid gap-4 rounded-(--radius-lg) bg-lavender px-6 py-6">
      <div className="flex items-center gap-2.5">
        <MessagesSquare className="size-[18px] shrink-0 text-accent" strokeWidth={1.9} aria-hidden />
        <h2 className="font-display text-xl font-semibold tracking-[-0.02em]">
          {assistantName} fragen
        </h2>
      </div>

      <p className="max-w-[var(--measure)] text-base leading-relaxed text-ink-2">
        {angemeldet
          ? `Hier antwortet ${assistantName} zum Produkt und zu deinem Konto. Dein Karrieregespräch bleibt davon unberührt — es ist ein eigener Faden.`
          : `Hier antwortet ${assistantName} zum Produkt. Ohne Konto, ohne Daten von dir.`}
      </p>

      {zeilen.length > 0 && (
        <ol className="grid gap-4">
          {zeilen.map((z, i) => (
            <li
              key={i}
              className={cn("grid", z.rolle === "user" && "justify-items-end")}
            >
              <p
                className={cn(
                  "max-w-[85%] whitespace-pre-wrap text-base leading-relaxed",
                  z.rolle === "user"
                    ? "rounded-(--radius-lg) rounded-br-md bg-raised px-5 py-3"
                    : "text-ink",
                )}
              >
                {z.text}
              </p>
            </li>
          ))}
        </ol>
      )}

      {läuft && (
        <p className="text-base text-ink-3" aria-live="polite">
          {assistantName} denkt nach …
        </p>
      )}

      {fehler && (
        <p role="alert" className="text-base leading-relaxed text-ink-2">
          {fehler}
        </p>
      )}

      <div className="flex items-center gap-2 rounded-(--radius-pill) bg-raised py-2 pl-5 pr-2 shadow-sm focus-within:shadow-[0_0_0_2px_var(--primary)]">
        <input
          ref={feld}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void frage(text);
            }
          }}
          disabled={läuft}
          placeholder="Deine Frage"
          aria-label={`${assistantName} zur Hilfe fragen`}
          className="h-11 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-3 disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => void frage(text)}
          disabled={läuft || text.trim().length === 0}
          aria-label="Frage senden"
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-(--radius-pill) transition-colors",
            text.trim().length > 0 && !läuft
              ? "bg-accent text-accent-on hover:bg-accent-hover"
              : "bg-soft text-ink-3",
          )}
        >
          <ArrowUp className="size-[18px]" strokeWidth={2.2} />
        </button>
      </div>
    </section>
  );
}
