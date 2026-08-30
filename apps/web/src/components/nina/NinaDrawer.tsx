"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Maximize2, MessageSquarePlus, Minus, ScrollText, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { NinaSignal } from "./NinaSignal";
import { Composer } from "./Composer";
import { JobSuggestions } from "./JobSuggestions";
import { useNina } from "./NinaProvider";

/**
 * Die schwebende Gesprächsfläche.
 *
 * Bewusst kein Modal über der ganzen Seite: Nina ist eine Begleitung,
 * kein Unterbrecher. Auf breiten Geräten sitzt sie unten rechts über
 * dem Inhalt, auf schmalen als Bogen von unten — dort, wo der Daumen
 * ist.
 *
 * Was hier NICHT steht: kein Anbieterhinweis, kein technischer Zustand,
 * keine Kennzeichnung. Läuft Nina, redet sie. Läuft sie nicht, steht da
 * ein Satz und kein Gespräch.
 */

export function NinaDrawer({ assistantName }: { assistantName: string }) {
  const nina = useNina();
  const [verlaufOffen, setVerlaufOffen] = useState(false);
  const [gespräche, setGespräche] = useState<
    { id: string; title: string | null; updatedAt: string; messageCount: number }[]
  >([]);

  const ende = useRef<HTMLDivElement>(null);
  const fläche = useRef<HTMLDivElement>(null);

  // Ans Ende scrollen, wenn etwas dazukommt. `smooth` nur, wenn niemand
  // reduzierte Bewegung eingestellt hat — sonst ruckt es für genau die
  // Leute, denen Bewegung Beschwerden macht.
  useEffect(() => {
    if (!nina.open) return;
    const ruhig = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ende.current?.scrollIntoView({ behavior: ruhig ? "auto" : "smooth", block: "end" });
  }, [nina.messages, nina.open]);

  // Escape schließt. Eine schwebende Fläche ohne Tastaturausweg ist eine
  // Falle.
  useEffect(() => {
    if (!nina.open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") nina.setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nina.open, nina]);

  // Beim Öffnen den Fokus hineinlegen.
  useEffect(() => {
    if (nina.open) fläche.current?.focus();
  }, [nina.open]);

  async function verlaufLaden() {
    setVerlaufOffen((v) => !v);
    if (gespräche.length > 0) return;
    const antwort = await fetch("/api/nina/conversations").catch(() => null);
    if (!antwort?.ok) return;
    const daten = await antwort.json();
    setGespräche(daten.conversations ?? []);
  }

  if (!nina.open) return null;

  return (
    <div
      className={cn(
        "fixed z-50 flex flex-col",
        // Auf schmalen Geräten ein Bogen von unten — dort ist der Daumen.
        "inset-x-0 bottom-0",
        // Auf breiten eine Fläche von rechts über die volle Höhe. Ein
        // kleines Fenster unten rechts sieht aus wie ein Support-Widget;
        // Nina ist kein Support-Widget.
        "sm:inset-y-3 sm:left-auto sm:right-3 sm:w-[440px]",
      )}
      role="dialog"
      aria-modal="false"
      aria-label={`Gespräch mit ${assistantName}`}
    >
      <div
        ref={fläche}
        tabIndex={-1}
        className={cn(
          "flex max-h-[85dvh] flex-col overflow-hidden bg-raised shadow-xl outline-none",
          "rounded-t-(--radius-sheet) sm:h-full sm:max-h-none sm:rounded-(--radius-sheet)",
          "motion-safe:animate-[nina-rise_240ms_cubic-bezier(0.16,1,0.3,1)]",
          "sm:motion-safe:animate-[nina-slide_240ms_cubic-bezier(0.16,1,0.3,1)]",
        )}
      >
        {/* ── Kopf ────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-5 pb-3 pt-4">
          <NinaSignal size="sm" state={nina.busy ? "thinking" : "active"} />
          <div className="grid min-w-0 flex-1">
            <span className="font-display text-[15px] font-semibold tracking-[-0.01em]">
              {assistantName}
            </span>
            {/* Erst der Seitenkontext, sonst die Statuszeile. Beides
                zugleich wäre eine Zeile zu viel für einen Kopf. */}
            {(nina.scopeLabel || nina.stageStatus) && (
              <span className="truncate text-xs text-ink-3">
                {nina.scopeLabel ?? nina.stageStatus}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={verlaufLaden}
            aria-label="Gespräche"
            aria-expanded={verlaufOffen}
            className="grid size-9 place-items-center rounded-(--radius-control) text-ink-3 transition-colors hover:bg-soft hover:text-ink"
          >
            <ScrollText className="size-[18px]" strokeWidth={1.7} />
          </button>
          <button
            type="button"
            onClick={nina.reset}
            aria-label="Neues Gespräch"
            className="grid size-9 place-items-center rounded-(--radius-control) text-ink-3 transition-colors hover:bg-soft hover:text-ink"
          >
            <MessageSquarePlus className="size-[18px]" strokeWidth={1.7} />
          </button>
          <Link
            href="/app/nina"
            onClick={() => nina.setOpen(false)}
            aria-label="Im Vollbild öffnen"
            className="grid size-9 place-items-center rounded-(--radius-control) text-ink-3 transition-colors hover:bg-soft hover:text-ink"
          >
            <Maximize2 className="size-[17px]" strokeWidth={1.7} />
          </Link>
          <button
            type="button"
            onClick={() => nina.setOpen(false)}
            aria-label="Minimieren"
            className="grid size-9 place-items-center rounded-(--radius-control) text-ink-3 transition-colors hover:bg-soft hover:text-ink"
          >
            <Minus className="size-[18px]" strokeWidth={1.9} />
          </button>
        </div>

        {/* ── Gesprächsliste ──────────────────────────────────── */}
        {verlaufOffen && (
          <div className="mx-3 mb-2 grid max-h-52 gap-0.5 overflow-y-auto rounded-(--radius-lg) bg-soft p-2">
            {gespräche.length === 0 ? (
              <p className="px-2 py-3 text-sm text-ink-3">Noch keine früheren Gespräche.</p>
            ) : (
              gespräche.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => {
                    void nina.loadConversation(g.id);
                    setVerlaufOffen(false);
                  }}
                  className={cn(
                    "grid gap-0.5 rounded-(--radius-sm) px-3 py-2 text-left transition-colors hover:bg-raised",
                    g.id === nina.conversationId && "bg-raised",
                  )}
                >
                  <span className="truncate text-sm">{g.title ?? "Gespräch"}</span>
                  <span className="text-xs text-ink-3">
                    {new Intl.DateTimeFormat("de-DE", {
                      day: "numeric",
                      month: "short",
                    }).format(new Date(g.updatedAt))}
                    {" · "}
                    {g.messageCount} Nachrichten
                  </span>
                </button>
              ))
            )}
          </div>
        )}

        {/* ── Verlauf ─────────────────────────────────────────── */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-2">
          {nina.messages.length === 0 && (
            <div className="grid gap-4 py-6">
              <p className="text-[15px] leading-relaxed text-ink-2">
                Frag mich, was dir gerade im Weg steht. Ich kenne dein Profil und diese Seite.
              </p>
              {nina.suggestions.length > 0 && (
                <ul className="grid gap-2">
                  {nina.suggestions.map((vorschlag) => (
                    <li key={vorschlag}>
                      <button
                        type="button"
                        onClick={() => void nina.send(vorschlag)}
                        className="w-full rounded-(--radius-lg) bg-soft px-4 py-2.5 text-left text-sm leading-relaxed transition-colors hover:bg-soft-hover"
                      >
                        {vorschlag}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Jobvorschläge auch im Drawer — höchstens drei. */}
          {nina.jobs.length > 0 && (
            <div className="py-2">
              <JobSuggestions jobs={nina.jobs} readiness={nina.readiness} />
            </div>
          )}

          <ol className="grid gap-4 py-2">
            {nina.messages.map((m) => (
              <li
                key={m.id}
                className={cn("grid gap-1.5", m.role === "user" && "justify-items-end")}
              >
                {m.role === "user" ? (
                  <p className="max-w-[85%] rounded-(--radius-lg) rounded-br-md bg-accent-soft px-4 py-2.5 text-[15px] leading-relaxed text-ink">
                    {m.content}
                  </p>
                ) : (
                  <div className="grid gap-2">
                    {m.tools && m.tools.length > 0 && (
                      <ul className="grid gap-1">
                        {m.tools.map((w) => (
                          <li
                            key={w.name}
                            className="flex items-center gap-2 text-xs text-ink-3"
                          >
                            <span
                              aria-hidden
                              className={cn(
                                "size-1.5 rounded-full",
                                w.ok === undefined
                                  ? "bg-accent motion-safe:animate-pulse"
                                  : w.ok
                                    ? "bg-positive"
                                    : "bg-critical",
                              )}
                            />
                            {w.label}
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink">
                      {m.content}
                      {m.streaming && (
                        <span
                          aria-hidden
                          className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 bg-accent motion-safe:animate-pulse"
                        />
                      )}
                    </p>
                  </div>
                )}
              </li>
            ))}
          </ol>

          {nina.error && (
            <p
              role="alert"
              className="my-2 rounded-(--radius-lg) bg-caution-soft px-4 py-3 text-sm leading-relaxed text-ink-2"
            >
              {nina.error}
            </p>
          )}

          <div ref={ende} />
        </div>

        {/* ── Composer ────────────────────────────────────────── */}
        <div className="px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1">
          <Composer
            onSend={(text, options) => void nina.send(text, options)}
            busy={nina.busy}
            placeholder={`${assistantName} fragen …`}
            className="shadow-none ring-0"
          />
        </div>
      </div>
    </div>
  );
}
