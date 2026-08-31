"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { START, weiter, type LiveEreignis, type LiveStand } from "@/lib/nina/live-voice";

/**
 * Das Live-Gespräch, verkabelt.
 *
 * Die Regeln stehen nebenan in `live-voice.ts` und sind dort geprüft.
 * Hier steht nur, was sich nicht prüfen lässt, ohne ein Mikrofon zu
 * haben: Verbindung, Tonspur, Wiedergabe.
 *
 * Der Weg ist der aus V7 §14.3, und zwar genau in dieser Reihenfolge:
 *
 *   Mikrofon → OpenAI Realtime (nur Transkription)
 *            → Ninas normale Textantwort
 *            → ElevenLabs → Lautsprecher
 *
 * Der Umweg über den eigenen Server für den Text ist Absicht. Eine
 * Realtime-Sitzung könnte direkt antworten und sprechen — dann käme
 * die Antwort aber an Ninas Systemprompt, ihrer Stufenmaschine und
 * ihrem Gedächtnis vorbei, und ihre Stimme wäre eine andere als im
 * Textmodus. Nina wäre im Sprachmodus jemand anderes.
 *
 * Was hier NICHT steht, ist ebenso wichtig: keine
 * `webkitSpeechRecognition`, keine `speechSynthesis`. Beides wäre in
 * zehn Zeilen zu haben und beides ist laut §14.3 ausgeschlossen — die
 * Systemstimme klingt auf jedem Gerät anders, und die Browsererkennung
 * schickt Audio an Anbieter, über die wir in der Datenschutzerklärung
 * nichts aussagen können.
 */

/*
 * Nur das, was der Browser wirklich braucht.
 *
 * Der Server liefert zusätzlich das Transkriptionsmodell und einen
 * Hinweistext — beides für Protokoll und Anzeige, nicht für den
 * Verbindungsaufbau. Was hier nicht steht, kann auch nicht versehentlich
 * in die Adresse geraten (siehe unten: genau daran ist der erste
 * Versuch gescheitert).
 */
interface Sitzung {
  clientSecret: string;
}

export interface LiveVoice {
  stand: LiveStand;
  starten: () => void;
  beenden: () => void;
  /** Ist im Browser überhaupt ein Mikrofon ansprechbar? */
  möglich: boolean;
}

export function useLiveVoice({
  send,
  fertigeAntwort,
}: {
  /** Schickt einen Redebeitrag in Ninas normalen Textweg. */
  send: (text: string) => Promise<void>;
  /** Die zuletzt fertig gestreamte Antwort, oder null. */
  fertigeAntwort: { id: string } | null;
}): LiveVoice {
  const [stand, setStand] = useState<LiveStand>(START);

  const pc = useRef<RTCPeerConnection | null>(null);
  const kanal = useRef<RTCDataChannel | null>(null);
  const spur = useRef<MediaStream | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const objektUrl = useRef<string | null>(null);
  const tonAbbruch = useRef<AbortController | null>(null);
  const gesprochen = useRef<string | null>(null);

  /*
   * Der Zustand zusätzlich als Ref.
   *
   * Die Ereignisse kommen aus Rückrufen, die beim Aufbau der Verbindung
   * einmal registriert werden. Läsen sie `stand` aus dem State, sähen
   * sie für immer den Wert von damals — der klassische veraltete
   * Abschluss. Die Ref ist immer aktuell.
   */
  const standRef = useRef(stand);
  standRef.current = stand;

  const tonStoppen = useCallback(() => {
    tonAbbruch.current?.abort();
    tonAbbruch.current = null;
    if (audio.current) {
      audio.current.pause();
      audio.current.src = "";
      audio.current = null;
    }
    if (objektUrl.current) {
      URL.revokeObjectURL(objektUrl.current);
      objektUrl.current = null;
    }
  }, []);

  const schliessen = useCallback(() => {
    kanal.current?.close();
    kanal.current = null;
    pc.current?.close();
    pc.current = null;
    // Ohne dieses Stoppen bleibt die Aufnahmeanzeige des Browsers an,
    // auch wenn längst niemand mehr zuhört. Das ist kein Schönheits-
    // fehler: es sieht aus, als würden wir heimlich weiter mithören.
    spur.current?.getTracks().forEach((t) => t.stop());
    spur.current = null;
  }, []);

  /** Ein Ereignis durch die Regeln schicken und die Wirkung ausführen. */
  const melde = useCallback(
    (e: LiveEreignis) => {
      const { stand: neu, wirkung } = weiter(standRef.current, e);
      standRef.current = neu;
      setStand(neu);

      if (wirkung.brichAb) tonStoppen();
      if (wirkung.schliesse) schliessen();
      if (wirkung.sende) {
        void send(wirkung.sende).catch(() => {
          melde({ art: "fehler", text: "Nina konnte nicht antworten." });
        });
      }
    },
    [send, tonStoppen, schliessen],
  );

  const starten = useCallback(() => {
    if (standRef.current.zustand !== "aus" && standRef.current.zustand !== "fehler") return;
    melde({ art: "verbinden" });

    void (async () => {
      try {
        // ── 1. Kurzlebiges Sitzungsgeheimnis vom eigenen Server ────
        const antwort = await fetch("/api/nina/realtime-session", { method: "POST" });
        if (!antwort.ok) {
          const daten = (await antwort.json().catch(() => null)) as { hinweis?: string } | null;
          melde({
            art: "fehler",
            text: daten?.hinweis ?? "Das Live-Gespräch ist gerade nicht verfügbar.",
          });
          return;
        }
        const sitzung = (await antwort.json()) as Sitzung;

        // ── 2. Mikrofon ───────────────────────────────────────────
        const strom = await navigator.mediaDevices.getUserMedia({
          audio: {
            // Ohne diese drei hört die Erkennung Nina aus dem eigenen
            // Lautsprecher und hält es für eine Unterbrechung — das
            // Gespräch würde sich selbst ins Wort fallen.
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        spur.current = strom;

        // ── 3. Verbindung ─────────────────────────────────────────
        const verbindung = new RTCPeerConnection();
        pc.current = verbindung;
        strom.getAudioTracks().forEach((t) => verbindung.addTrack(t, strom));

        const dc = verbindung.createDataChannel("oai-events");
        kanal.current = dc;
        dc.onopen = () => melde({ art: "verbunden" });
        dc.onmessage = (nachricht) => verarbeite(nachricht.data as string);

        const angebot = await verbindung.createOffer();
        await verbindung.setLocalDescription(angebot);

        /*
         * Ohne `model` in der Adresse — das ist kein Versehen.
         *
         * Bei einer Transkriptionssitzung steht das Modell bereits im
         * Sitzungsgeheimnis, das der Server geholt hat. Wird es hier
         * noch einmal mitgegeben, lehnt der Anbieter ab, und zwar
         * wörtlich mit: „You must not provide a model parameter for
         * transcription sessions." Mit dem Transkriptionsmodell im
         * Parameter kommt stattdessen „is not supported in
         * transcription mode" — beides 400, beides erst sichtbar, wenn
         * man die Antwort ausliest.
         */
        const sdp = await fetch("https://api.openai.com/v1/realtime/calls", {
          method: "POST",
          // Das kurzlebige Geheimnis, nicht der Projektschlüssel.
          headers: {
            authorization: `Bearer ${sitzung.clientSecret}`,
            "content-type": "application/sdp",
          },
          body: angebot.sdp ?? "",
        });
        if (!sdp.ok) {
          melde({ art: "fehler", text: "Die Sprachverbindung kam nicht zustande." });
          return;
        }
        await verbindung.setRemoteDescription({ type: "answer", sdp: await sdp.text() });
      } catch (fehler) {
        melde({
          art: "fehler",
          text:
            fehler instanceof DOMException && fehler.name === "NotAllowedError"
              ? "Ohne Mikrofonfreigabe geht es nicht. Du kannst weiter schreiben."
              : "Das Live-Gespräch konnte nicht gestartet werden. Der Textmodus läuft weiter.",
        });
      }
    })();

    /*
     * Die Ereignisse des Anbieters.
     *
     * Nur drei sind interessant. Alle anderen — Sitzungsdaten,
     * Pufferstände, Bestätigungen — werden bewusst ignoriert, statt
     * sie „für später" zu verarbeiten.
     */
    function verarbeite(roh: string) {
      let e: { type?: string; delta?: string; transcript?: string };
      try {
        e = JSON.parse(roh) as typeof e;
      } catch {
        return;
      }

      switch (e.type) {
        case "input_audio_buffer.speech_started":
          melde({ art: "sprache_beginnt" });
          break;
        case "conversation.item.input_audio_transcription.delta":
          if (e.delta) {
            melde({
              art: "teiltranskript",
              text: standRef.current.teiltranskript + e.delta,
            });
          }
          break;
        case "conversation.item.input_audio_transcription.completed":
          melde({ art: "redebeitrag_fertig", text: e.transcript ?? "" });
          break;
      }
    }
  }, [melde]);

  const beenden = useCallback(() => melde({ art: "beenden" }), [melde]);

  /*
   * Ninas Antwort vorlesen.
   *
   * Erst wenn sie fertig gestreamt ist. Satzweise zu sprechen, während
   * der Text noch läuft, wäre schneller — aber dann spricht Nina den
   * Anfang einer Antwort, die sie selbst noch korrigiert, und beim
   * Unterbrechen gibt es zwei Warteschlangen statt einer.
   */
  useEffect(() => {
    if (standRef.current.zustand !== "denkt") return;
    if (!fertigeAntwort || fertigeAntwort.id === gesprochen.current) return;

    gesprochen.current = fertigeAntwort.id;
    const meinZug = standRef.current.zug;
    const controller = new AbortController();
    tonAbbruch.current = controller;

    void (async () => {
      try {
        const antwort = await fetch("/api/nina/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({ messageId: fertigeAntwort.id }),
        });
        // Zwischen Anfrage und Antwort kann unterbrochen worden sein.
        if (!antwort.ok || meinZug !== standRef.current.zug) return;

        const url = URL.createObjectURL(await antwort.blob());
        if (meinZug !== standRef.current.zug) {
          URL.revokeObjectURL(url);
          return;
        }
        objektUrl.current = url;

        const element = new Audio(url);
        audio.current = element;
        element.onended = () => melde({ art: "ton_endet", zug: meinZug });
        element.onerror = () => melde({ art: "ton_endet", zug: meinZug });

        await element.play();
        melde({ art: "ton_beginnt", zug: meinZug });
      } catch (fehler) {
        if (fehler instanceof DOMException && fehler.name === "AbortError") return;
        // Ohne Stimme geht das Gespräch weiter — geschrieben steht die
        // Antwort ja da. Ein Abbruch wäre die schlechtere Antwort auf
        // einen Tonfehler.
        melde({ art: "ton_endet", zug: meinZug });
      }
    })();
  }, [fertigeAntwort, melde]);

  // Beim Verlassen der Seite: Mikrofon aus, Ton aus, Verbindung zu.
  useEffect(
    () => () => {
      tonStoppen();
      schliessen();
    },
    [tonStoppen, schliessen],
  );

  const [möglich, setMöglich] = useState(false);
  useEffect(() => {
    setMöglich(
      typeof navigator !== "undefined" &&
        !!navigator.mediaDevices?.getUserMedia &&
        typeof RTCPeerConnection !== "undefined",
    );
  }, []);

  return { stand, starten, beenden, möglich };
}
