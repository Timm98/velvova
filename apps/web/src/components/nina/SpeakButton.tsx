"use client";

import { Loader2, Square, Volume2 } from "lucide-react";
import { useNina } from "./NinaProvider";
import { cn } from "@/lib/cn";

/**
 * „Vorlesen".
 *
 * Klein, unaufdringlich, an Ninas Antwort. Er erscheint nur bei
 * gespeicherten Nachrichten: eine Antwort, die gerade erst einläuft,
 * hat noch keine Kennung, und ohne Kennung gäbe es nichts vorzulesen.
 *
 * Im Textchat ist Vorlesen ausdrücklich eine Handlung, keine
 * Voreinstellung. Ton, der ungefragt losgeht, ist im Büro, im Zug und
 * im Wartezimmer ein Problem — und wer einen Job sucht, sitzt oft an
 * genau solchen Orten.
 */
export function SpeakButton({
  messageId,
  className,
}: {
  messageId: string;
  className?: string;
}) {
  const nina = useNina();

  // Lokale Kennungen (`lokal-…`) gehören zu Nachrichten, die noch
  // strömen. Für die gibt es serverseitig nichts abzuholen.
  if (!messageId || messageId.startsWith("lokal-")) return null;

  const aktiv = nina.speakingMessageId === messageId;
  const lädt = aktiv && !nina.isSpeaking;
  const spricht = aktiv && nina.isSpeaking;

  return (
    <button
      type="button"
      onClick={() => nina.speak(messageId)}
      aria-label={spricht ? "Vorlesen beenden" : "Vorlesen"}
      aria-pressed={aktiv}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-(--radius-pill) px-3 text-xs transition-colors",
        aktiv ? "bg-accent-soft text-ink" : "text-ink-3 hover:bg-soft hover:text-ink-2",
        className,
      )}
    >
      {lädt ? (
        <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
      ) : spricht ? (
        <Square className="size-3 fill-current" strokeWidth={0} />
      ) : (
        <Volume2 className="size-3.5" strokeWidth={1.9} />
      )}
      {/* Der Zustand steht auch als Wort da — Farbe und Symbol allein
          tragen keine Information. */}
      {spricht ? "Stopp" : lädt ? "…" : "Vorlesen"}
    </button>
  );
}
