"use client";

import { useEffect, useRef, useState } from "react";
import { Badge, buttonClass } from "@/components/ui";

/**
 * Sprachmodus.
 *
 * Zwei Wege stehen zur Verfügung, und beide werden ehrlich benannt:
 * die Spracherkennung des Browsers, sofern vorhanden, oder gar keine.
 * Ein serverseitiger Anbieter ist vorgesehen, aber nicht verbunden -
 * das steht dann auch da, statt einen Knopf anzubieten, der nichts tut.
 *
 * Ausdrücklich nicht enthalten und auch nicht geplant: Auswertung von
 * Stimme, Betonung, Akzent oder Emotion. Aus einer Stimme wird hier
 * ausschließlich Text.
 */

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function getRecognition(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

export function VoicePanel({
  serverVoiceAvailable,
  labels,
  onTranscript,
  onSubmit,
  currentText,
}: {
  serverVoiceAvailable: boolean;
  labels: Record<"listening" | "pause" | "resume" | "interrupt" | "liveTranscript" | "voiceUnavailable" | "send", string>;
  onTranscript: (text: string) => void;
  onSubmit: (text: string) => void;
  currentText: string;
}) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    const r = getRecognition();
    setSupported(r !== null);
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  function start() {
    setError(null);
    const recognition = getRecognition();
    if (!recognition) {
      setSupported(false);
      return;
    }
    recognition.lang = "de-DE";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]!;
        if (result.isFinal) finalText += result[0].transcript;
        else interimText += result[0].transcript;
      }
      setInterim(interimText);
      if (finalText) {
        onTranscript(finalText.trim());
        setInterim("");
      }
    };

    recognition.onerror = (event) => {
      setListening(false);
      setError(
        event.error === "not-allowed"
          ? "Der Zugriff auf das Mikrofon wurde nicht erlaubt. Du kannst stattdessen schreiben."
          : "Die Spracherkennung hat abgebrochen. Du kannst stattdessen schreiben.",
      );
    };

    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  function stop() {
    recognitionRef.current?.stop();
    setListening(false);
    setInterim("");
  }

  // Kein Anbieter und kein Browser-Weg: ehrlich sagen, nicht kaschieren.
  if (supported === false && !serverVoiceAvailable) {
    return (
      <div
        role="note"
        style={{
          background: "var(--surface-sunken)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-md)",
          padding: "var(--space-4)",
          fontSize: "var(--text-sm)",
          color: "var(--text-secondary)",
        }}
      >
        <strong style={{ display: "block", marginBottom: "var(--space-2)" }}>
          Sprachmodus nicht verfügbar
        </strong>
        {labels.voiceUnavailable} Dein Browser bietet ausserdem keine eigene Spracherkennung an.
      </div>
    );
  }

  return (
    <div
      style={{
        background: "var(--assistant-subtle)",
        border: "1px solid var(--assistant-border)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-5)",
        display: "grid",
        gap: "var(--space-4)",
        justifyItems: "center",
      }}
    >
      {/* Der ruhige Kern. Bewegt sich nur, wenn wirklich zugehört wird. */}
      <div
        aria-hidden
        style={{
          width: 72,
          height: 72,
          borderRadius: "var(--radius-full)",
          background: "radial-gradient(circle at 35% 30%, var(--assistant), var(--assistant-text))",
          opacity: listening ? 1 : 0.45,
          animation: listening ? "pulse-soft 2.4s ease-in-out infinite" : "none",
          transition: "opacity var(--duration-base) var(--ease)",
        }}
      />

      <p aria-live="polite" style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
        {listening ? labels.listening : "Bereit"}
      </p>

      {!serverVoiceAvailable && supported && (
        <Badge tone="caution">Spracherkennung des Browsers</Badge>
      )}

      {/* Live-Mitschrift: was verstanden wird, ist immer sichtbar. */}
      <div style={{ width: "100%" }}>
        <h3 style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "var(--space-2)" }}>
          {labels.liveTranscript}
        </h3>
        <div
          aria-live="polite"
          style={{
            minHeight: 60,
            padding: "var(--space-3)",
            background: "var(--surface-raised)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-md)",
            fontSize: "var(--text-sm)",
            lineHeight: 1.6,
          }}
        >
          {currentText}
          {interim && <span style={{ color: "var(--text-muted)" }}> {interim}</span>}
          {!currentText && !interim && (
            <span style={{ color: "var(--text-muted)" }}>Noch nichts aufgenommen.</span>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" style={{ fontSize: "var(--text-sm)", color: "var(--critical)", textAlign: "center" }}>
          {error}
        </p>
      )}

      <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", justifyContent: "center" }}>
        {!listening ? (
          <button type="button" onClick={start} className={buttonClass("primary")}>
            {labels.resume}
          </button>
        ) : (
          <button type="button" onClick={stop} className={buttonClass("secondary")}>
            {labels.pause}
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            stop();
            onSubmit(currentText);
          }}
          disabled={currentText.trim().length === 0}
          className={buttonClass("secondary")}
        >
          Antwort absenden
        </button>
      </div>

      <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", textAlign: "center", maxWidth: "48ch" }}>
        Aus deiner Stimme wird ausschließlich Text. Es findet keine Auswertung von Betonung,
        Akzent oder Stimmung statt.
      </p>
    </div>
  );
}
