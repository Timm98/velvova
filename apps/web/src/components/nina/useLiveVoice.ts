"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { START, weiter, type LiveEreignis, type LiveStand } from "@/lib/nina/live-voice";
import { STILLE } from "@/lib/nina/stille";


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
 *            → Mondays normale Textantwort
 *            → ElevenLabs → Lautsprecher
 *
 * Der Umweg über den eigenen Server für den Text ist Absicht. Eine
 * Realtime-Sitzung könnte direkt antworten und sprechen — dann käme
 * die Antwort aber an Mondays Systemprompt, ihrer Stufenmaschine und
 * ihrem Gedächtnis vorbei, und ihre Stimme wäre eine andere als im
 * Textmodus. Monday wäre im Sprachmodus jemand anderes.
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
  /** Schickt einen Redebeitrag in Mondays normalen Textweg. */
  send: (text: string) => Promise<void>;
  /** Die zuletzt fertig gestreamte Antwort, oder null. */
  fertigeAntwort: { id: string } | null;
}): LiveVoice {
  const [stand, setStand] = useState<LiveStand>(START);

  const pc = useRef<RTCPeerConnection | null>(null);
  const kanal = useRef<RTCDataChannel | null>(null);
  const spur = useRef<MediaStream | null>(null);
  /*
   * EIN Audioelement für das ganze Gespräch — nicht eines je Antwort.
   *
   * Das ist der Kern der Reparatur. Safari und die mobilen Browser
   * erlauben Tonwiedergabe nur, wenn sie aus einer Nutzerhandlung
   * heraus beginnt. Vorher entstand für jede Antwort ein frisches
   * `new Audio(url)`, und `play()` lief in einer asynchronen
   * Fortsetzung — also lange nachdem der Klick vorbei war.
   *
   * Das Ergebnis war der stillste aller Fehler: `play()` lehnte mit
   * `NotAllowedError` ab, der `catch` machte daraus „Ton zu Ende", die
   * Zustandsmaschine ging weiter, als hätte Monday gesprochen. Nichts
   * blinkte rot. Monday war einfach stumm.
   *
   * Ein einmal freigegebenes Element bleibt freigegeben: man darf ihm
   * später eine neue Quelle geben und erneut abspielen, ohne dass eine
   * weitere Geste nötig wäre. Deshalb entsteht es hier einmal, wird im
   * Klick freigeschaltet und danach immer wiederverwendet.
   */
  const audio = useRef<HTMLAudioElement | null>(null);
  const freigeschaltet = useRef(false);
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
      /*
       * `removeAttribute("src")` statt `src = ""`, und das Element
       * bleibt bestehen.
       *
       * `src = ""` setzt in manchen Browsern die Seiten-URL als Quelle
       * und löst dann einen Ladefehler aus. Und das Element auf `null`
       * zu setzen, wie vorher, würde beim nächsten Redebeitrag ein
       * neues erzwingen — ein nicht freigegebenes. Genau das war der
       * Grund, warum Monday nach der ersten Unterbrechung endgültig
       * verstummte.
       */
      audio.current.removeAttribute("src");
      audio.current.load();
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
          melde({ art: "fehler", text: "Monday konnte nicht antworten." });
        });
      }
    },
    [send, tonStoppen, schliessen],
  );

  /**
   * Den Ton freischalten — synchron, im Klick.
   *
   * Muss vor dem ersten `await` laufen. Danach ist die Nutzerhandlung
   * für den Browser vorbei, und alles Weitere gilt als „von selbst
   * angefangen".
   *
   * Abgespielt wird eine Zehntelsekunde Stille: ein winziges WAV als
   * Daten-URL, 44 Byte Kopf und ein einzelnes stummes Sample. Es ist
   * nicht zu hören und nicht zu sehen, aber der Browser verbucht es
   * als „dieses Element hat auf Wunsch der Person Ton abgespielt" —
   * und lässt es von da an gewähren.
   */
  const tonFreischalten = useCallback(() => {
    if (!audio.current) {
      const el = new Audio();
      el.preload = "auto";
      // Ohne das behandeln iOS-Browser die Wiedergabe wie ein Video und
      // verlangen den Vollbildmodus.
      el.setAttribute("playsinline", "");
      audio.current = el;
    }
    if (freigeschaltet.current) return;

    const el = audio.current;
    el.muted = true;
    el.src = STILLE;
    const versuch = el.play();
    if (versuch && typeof versuch.then === "function") {
      void versuch
        .then(() => {
          freigeschaltet.current = true;
          el.pause();
          el.muted = false;
          /*
           * Die Stille stehen lassen.
           *
           * Ein Element ohne Quelle neu zu laden löst ein
           * `error`-Ereignis aus — folgenlos, aber es steht als
           * Ladefehler im Protokoll, und beim nächsten echten
           * Sprachfehler hielte man ihn für die Ursache. Die 1,6
           * Kilobyte werden ohnehin bei der ersten Antwort
           * überschrieben.
           */
        })
        .catch(() => {
          /*
           * Bleibt der Browser dabei, geht das Gespräch trotzdem
           * weiter — geschrieben steht Mondays Antwort ja da. Gemerkt
           * wird nur, dass die Freigabe fehlt, damit die Oberfläche
           * es sagen kann statt still zu bleiben.
           */
          freigeschaltet.current = false;
          el.muted = false;
        });
    } else {
      freigeschaltet.current = true;
      el.muted = false;
    }
  }, []);

  const starten = useCallback(() => {
    if (standRef.current.zustand !== "aus" && standRef.current.zustand !== "fehler") return;

    // ZUERST. Alles darunter ist asynchron und damit ausserhalb der
    // Nutzerhandlung.
    tonFreischalten();
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
            // Ohne diese drei hört die Erkennung Monday aus dem eigenen
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
   * Mondays Antwort vorlesen.
   *
   * Erst wenn sie fertig gestreamt ist. Satzweise zu sprechen, während
   * der Text noch läuft, wäre schneller — aber dann spricht Monday den
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

        // Das im Klick freigegebene Element, nicht ein neues.
        const element = audio.current ?? new Audio();
        audio.current = element;
        element.onended = () => melde({ art: "ton_endet", zug: meinZug });
        element.onerror = () => melde({ art: "ton_endet", zug: meinZug });
        element.src = url;

        await element.play();
        melde({ art: "ton_beginnt", zug: meinZug });
      } catch (fehler) {
        if (fehler instanceof DOMException && fehler.name === "AbortError") return;
        /*
         * Eine verweigerte Wiedergabe ist kein Tonfehler, sondern eine
         * Regel des Browsers — und sie darf nicht länger stumm
         * durchgehen.
         *
         * Genau hier verschwand die Ursache vorher: `NotAllowedError`
         * wurde wie ein zu Ende gespieltes Stück behandelt. Jetzt geht
         * das Gespräch zwar weiter — Mondays Antwort steht geschrieben
         * da —, aber die Oberfläche erfährt davon.
         */
        if (fehler instanceof DOMException && fehler.name === "NotAllowedError") {
          freigeschaltet.current = false;
          melde({
            art: "ton_verweigert",
            zug: meinZug,
            text: "Dein Browser lässt Ton erst nach einer Berührung zu. Tipp einmal auf „Live sprechen“.",
          });
          return;
        }
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
