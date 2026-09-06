"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Diktat mit Live-Transkription.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum hier diktiert und nicht gesprochen wird
 * ══════════════════════════════════════════════════════════════
 *
 * `useLiveVoice` schickt jeden fertigen Redebeitrag sofort ab. Das ist
 * im Gespräch mit Nina richtig — dort sind Redebeiträge kurz.
 *
 * Hier beschreibt jemand eine Stelle. Der Satz „Wir suchen einen
 * Controller … ähm … also jemanden, der die Monatsabschlüsse macht"
 * enthält eine Pause, und die Pause ist das Ende eines Redebeitrags.
 * Automatisch abgeschickt entstünden daraus zwei Züge, von denen der
 * erste die Hälfte der Auskunft enthält — und Nina fragte nach etwas,
 * das im nächsten Atemzug gekommen wäre.
 *
 * Deshalb füllt das Diktat das Textfeld, und der Mensch drückt ab.
 * Er sieht dabei, was ankommt, und kann korrigieren, bevor irgendetwas
 * gespeichert wird.
 *
 * ══════════════════════════════════════════════════════════════
 * Was hier bewusst nicht steht
 * ══════════════════════════════════════════════════════════════
 *
 * Keine `webkitSpeechRecognition`. Dieselbe Begründung wie in
 * `useLiveVoice`: Die Browsererkennung schickt Ton an Anbieter, über
 * die in der Datenschutzerklärung nichts steht.
 */

export type Diktatzustand = "aus" | "verbindet" | "hört" | "fehler";

export interface Diktat {
  zustand: Diktatzustand;
  /** Was gerade erkannt wird, noch nicht abgeschlossen. */
  teiltext: string;
  fehler: string | null;
  starten: () => void;
  beenden: () => void;
  möglich: boolean;
}

export function useDiktat({
  /** Bekommt jeden fertig erkannten Abschnitt — zum Anhängen ans Feld. */
  aufAbschnitt,
}: {
  aufAbschnitt: (text: string) => void;
}): Diktat {
  const [zustand, setZustand] = useState<Diktatzustand>("aus");
  const [teiltext, setTeiltext] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [möglich, setMöglich] = useState(false);

  const pc = useRef<RTCPeerConnection | null>(null);
  const spur = useRef<MediaStream | null>(null);
  const kanal = useRef<RTCDataChannel | null>(null);
  const teilRef = useRef("");

  /* Der Rückruf in einer Referenz: Sonst hinge `starten` an ihm und
     würde bei jedem Tastendruck neu erzeugt — mitten in einer
     laufenden Verbindung. */
  const rueckruf = useRef(aufAbschnitt);
  useEffect(() => {
    rueckruf.current = aufAbschnitt;
  }, [aufAbschnitt]);

  useEffect(() => {
    setMöglich(
      typeof navigator !== "undefined" &&
        typeof navigator.mediaDevices?.getUserMedia === "function" &&
        typeof RTCPeerConnection !== "undefined",
    );
  }, []);

  const aufraeumen = useCallback(() => {
    kanal.current?.close();
    kanal.current = null;
    /* Die Spuren einzeln stoppen. Nur die Verbindung zu schliessen
       lässt die Aufnahmeanzeige des Browsers an — und dann glaubt
       jemand zu Recht, es werde weiter mitgehört. */
    spur.current?.getTracks().forEach((t) => t.stop());
    spur.current = null;
    pc.current?.close();
    pc.current = null;
  }, []);

  const beenden = useCallback(() => {
    aufraeumen();
    /* Ein angefangener Satz beim Beenden ist trotzdem gesagt worden.
       Ihn wegzuwerfen hiesse, dass ein zu früher Klick eine Auskunft
       vernichtet. */
    if (teilRef.current.trim().length > 0) {
      rueckruf.current(teilRef.current.trim());
      teilRef.current = "";
      setTeiltext("");
    }
    setZustand("aus");
  }, [aufraeumen]);

  useEffect(() => aufraeumen, [aufraeumen]);

  const starten = useCallback(() => {
    if (zustand !== "aus" && zustand !== "fehler") return;
    setZustand("verbindet");
    setFehler(null);

    void (async () => {
      try {
        const antwort = await fetch("/api/nina/realtime-session", { method: "POST" });
        if (!antwort.ok) {
          const daten = (await antwort.json().catch(() => null)) as { hinweis?: string } | null;
          setFehler(daten?.hinweis ?? "Das Diktat ist gerade nicht verfügbar.");
          setZustand("fehler");
          return;
        }
        const { clientSecret } = (await antwort.json()) as { clientSecret: string };

        const strom = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        spur.current = strom;

        const verbindung = new RTCPeerConnection();
        pc.current = verbindung;
        strom.getAudioTracks().forEach((t) => verbindung.addTrack(t, strom));

        const dc = verbindung.createDataChannel("oai-events");
        kanal.current = dc;
        dc.onopen = () => setZustand("hört");
        dc.onmessage = (n) => verarbeite(n.data as string);

        const angebot = await verbindung.createOffer();
        await verbindung.setLocalDescription(angebot);

        /* Ohne `model` in der Adresse — bei einer Transkriptions-
           sitzung steht es im Sitzungsgeheimnis, und mitgegeben lehnt
           der Anbieter mit 400 ab. Siehe useLiveVoice. */
        const sdp = await fetch("https://api.openai.com/v1/realtime/calls", {
          method: "POST",
          headers: {
            authorization: `Bearer ${clientSecret}`,
            "content-type": "application/sdp",
          },
          body: angebot.sdp ?? "",
        });
        if (!sdp.ok) {
          setFehler("Die Sprachverbindung kam nicht zustande.");
          setZustand("fehler");
          return;
        }
        await verbindung.setRemoteDescription({ type: "answer", sdp: await sdp.text() });
      } catch (f) {
        aufraeumen();
        setFehler(
          f instanceof DOMException && f.name === "NotAllowedError"
            ? "Ohne Mikrofonfreigabe geht es nicht. Du kannst weiter schreiben."
            : "Das Diktat konnte nicht gestartet werden. Schreiben geht weiter.",
        );
        setZustand("fehler");
      }
    })();

    function verarbeite(roh: string) {
      let e: { type?: string; delta?: string; transcript?: string };
      try {
        e = JSON.parse(roh) as typeof e;
      } catch {
        return;
      }

      switch (e.type) {
        case "conversation.item.input_audio_transcription.delta":
          if (e.delta) {
            teilRef.current += e.delta;
            setTeiltext(teilRef.current);
          }
          break;
        case "conversation.item.input_audio_transcription.completed": {
          /*
           * Das fertige Transkript ersetzt die Teilstücke.
           *
           * Es ist die korrigierte Fassung — die Teilstücke sind ein
           * laufender Zwischenstand und enthalten gelegentlich ein
           * Wort, das der Anbieter danach zurücknimmt. Beides
           * aneinanderzuhängen verdoppelte den Satz.
           */
          const fertig = (e.transcript ?? teilRef.current).trim();
          teilRef.current = "";
          setTeiltext("");
          if (fertig.length > 0) rueckruf.current(fertig);
          break;
        }
      }
    }
  }, [zustand, aufraeumen]);

  return { zustand, teiltext, fehler, starten, beenden, möglich };
}
