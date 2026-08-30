"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Ninas Stimme im Browser.
 *
 * Der schwierige Teil ist nicht das Abspielen, sondern das Aufhören.
 *
 * Wenn jemand Nina unterbricht — Stopp drückt, das Mikrofon aktiviert,
 * eine neue Nachricht schickt oder die Seite wechselt — muss dreierlei
 * gleichzeitig passieren: der Ton verstummt, die Anfrage bricht ab, und
 * die alte Antwort darf nicht Sekunden später doch noch losreden.
 *
 * Das Letzte ist der Fehler, den man erst im Betrieb hört: eine
 * abgebrochene Antwort, deren Ton unterwegs war, kommt an und spielt
 * über die neue. Deshalb trägt jede Wiedergabe eine laufende Nummer,
 * und alles, was nicht die aktuelle ist, wird verworfen.
 */

export type SprachZustand = "still" | "lädt" | "spricht";

export function useNinaVoice() {
  const [zustand, setZustand] = useState<SprachZustand>("still");
  const [aktiveNachricht, setAktiveNachricht] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  const audio = useRef<HTMLAudioElement | null>(null);
  const objektUrl = useRef<string | null>(null);
  const abbruch = useRef<AbortController | null>(null);
  /* Die laufende Nummer. Alles Ältere ist ungültig. */
  const lauf = useRef(0);

  const stoppen = useCallback(() => {
    // Die Nummer hochzählen: alles, was noch unterwegs ist, erkennt sich
    // daran als veraltet und legt sich selbst still.
    lauf.current += 1;

    abbruch.current?.abort();
    abbruch.current = null;

    if (audio.current) {
      audio.current.pause();
      audio.current.src = "";
      audio.current = null;
    }
    if (objektUrl.current) {
      URL.revokeObjectURL(objektUrl.current);
      objektUrl.current = null;
    }

    setZustand("still");
    setAktiveNachricht(null);
  }, []);

  // Beim Verlassen der Komponente verstummt Nina. Ohne das läuft der Ton
  // nach einem Seitenwechsel weiter, während der Auslöser weg ist.
  useEffect(() => stoppen, [stoppen]);

  const vorlesen = useCallback(
    async (messageId: string) => {
      // Ein zweiter Klick auf dieselbe Nachricht schaltet ab.
      if (aktiveNachricht === messageId && zustand !== "still") {
        stoppen();
        return;
      }

      stoppen();
      const meinLauf = lauf.current;

      setFehler(null);
      setZustand("lädt");
      setAktiveNachricht(messageId);

      const controller = new AbortController();
      abbruch.current = controller;

      try {
        const antwort = await fetch("/api/nina/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({ messageId }),
        });

        if (lauf.current !== meinLauf) return;

        if (!antwort.ok) {
          const daten = await antwort.json().catch(() => null);
          setZustand("still");
          setAktiveNachricht(null);
          setFehler(daten?.message ?? "Die Sprachausgabe ist gerade nicht verfügbar.");
          return;
        }

        /*
         * Der Ton als Blob, nicht als Base64 im Zustand.
         *
         * Eine Minute Sprache sind rund 250 Kilobyte. Als Zeichenkette
         * in React-State wäre das ein Drittel mehr, es würde bei jedem
         * Rendern kopiert, und der Speicher bliebe belegt, bis die
         * Komponente verschwindet. Ein Objekt-URL zeigt auf den Puffer
         * und wird beim Stoppen wieder freigegeben.
         */
        const blob = await antwort.blob();
        if (lauf.current !== meinLauf) return;

        const url = URL.createObjectURL(blob);
        objektUrl.current = url;

        const element = new Audio(url);
        audio.current = element;

        element.onended = () => {
          if (lauf.current !== meinLauf) return;
          stoppen();
        };
        element.onerror = () => {
          if (lauf.current !== meinLauf) return;
          setZustand("still");
          setAktiveNachricht(null);
          setFehler("Der Ton konnte nicht abgespielt werden.");
        };

        /*
         * `play()` kann abgelehnt werden.
         *
         * Safari und mobile Browser erlauben Ton nur nach einer
         * Nutzerhandlung. Wird hier ohne Klick abgespielt — etwa beim
         * automatischen Vorlesen —, wirft `play()` einen
         * NotAllowedError. Das ist kein Fehler des Produkts, sondern
         * eine Regel des Browsers, und sie wird als solche behandelt.
         */
        await element.play();
        if (lauf.current !== meinLauf) return;
        setZustand("spricht");
      } catch (e) {
        if (lauf.current !== meinLauf) return;
        if (e instanceof DOMException && e.name === "AbortError") return;

        setZustand("still");
        setAktiveNachricht(null);
        setFehler(
          e instanceof DOMException && e.name === "NotAllowedError"
            ? "Tipp einmal auf „Vorlesen“ — dein Browser erlaubt Ton erst nach einer Berührung."
            : "Die Sprachausgabe ist gerade nicht verfügbar.",
        );
      }
    },
    [aktiveNachricht, zustand, stoppen],
  );

  return { zustand, aktiveNachricht, fehler, vorlesen, stoppen };
}
