"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { ANLAUF_MS, standJetzt } from "@/lib/jobs/zaehler";

/**
 * Ein Zähler für die ganze Seite.
 *
 * ── Warum ein gemeinsamer Zustand ─────────────────────────────
 *
 * Die Bestandszahl steht zweimal gleichzeitig im Bild: gross in der
 * Überschrift und klein im Platzhalter der Suche. Zwei getrennte
 * Zeitgeber, die dieselbe Formel rechnen, lesen `Date.now()` wenige
 * Millisekunden versetzt ab — und zeigen dadurch abwechselnd Werte,
 * die sich um eins unterscheiden.
 *
 * Gemessen war das kein Rundungsfehler, sondern ein Flackern: mal
 * gleich, mal eins auseinander. Auf demselben Bildschirm liest das
 * niemand als Genauigkeit.
 *
 * Ein Zeitgeber, ein Zustand, ein Wert — von beiden Stellen gelesen.
 */

type Bestand = {
  /** Der laufende Wert. */
  wert: number;
  /** Ob der Anlauf schon durch ist. */
  fertig: boolean;
};

const Kontext = createContext<Bestand | null>(null);

/** Der laufende Bestand, oder `null` ausserhalb des Rahmens. */
export function useBestand(): Bestand | null {
  return useContext(Kontext);
}

/**
 * Wie weit der Anlauf unter dem echten Stand beginnt.
 *
 * ── Warum 12.000 und nicht 1.800 ──────────────────────────────
 *
 * Der Anlauf ist die einzige Stelle, an der die Zahl schnell laufen
 * DARF. Danach steigt sie mit der gemessenen Rate — derzeit 2,4
 * Stellen je Sekunde, also alle 0,42 Sekunden um eins. Das ist der
 * echte Zuwachs; ihn zu erhöhen hiesse, eine Zahl anzuzeigen, die
 * innerhalb einer Minute nicht mehr stimmt.
 *
 * Mit 1.800 über zwei Sekunden war der Anlauf vorbei, bevor jemand
 * hingesehen hatte, und danach schien die Zahl zu stehen. Mit 12.000
 * über dreieinhalb Sekunden läuft sie sichtbar hoch — und wer dann
 * hinsieht, sieht sie weiterlaufen, statt sie anzuhalten.
 *
 * Die Zahl ist während des Anlaufs zu niedrig, nie zu hoch. Sie
 * nähert sich dem echten Stand von unten und erreicht ihn; sie
 * überschreitet ihn nicht.
 */
const ANLAUF = 12_000;

export function BestandProvider({
  genau,
  proSekunde,
  children,
}: {
  genau: number;
  proSekunde: number;
  children: React.ReactNode;
}) {
  const [wert, setWert] = useState(Math.max(0, genau - ANLAUF));
  const [fertig, setFertig] = useState(false);

  /* Der Anlauf: zwei Sekunden von unten auf den echten Stand. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setWert(genau);
      setFertig(true);
      return;
    }
    const beginn = Date.now();
    const uhr = setInterval(() => {
      const anteil = Math.min(1, (Date.now() - beginn) / ANLAUF_MS);
      /* Am Ende auslaufen, damit der Übergang in die langsame Rate
         kein Ruck ist. */
      const weich = 1 - Math.pow(1 - anteil, 3);
      setWert(Math.floor(genau - ANLAUF + ANLAUF * weich));
      if (anteil >= 1) {
        clearInterval(uhr);
        setFertig(true);
      }
      /* Alle 16 ms statt 30: Bei 12.000 Schritten in dreieinhalb
         Sekunden wären 30 ms sichtbare Sprünge von je 100. */
    }, 16);
    return () => clearInterval(uhr);
  }, [genau]);

  /* Danach mit der gemessenen Rate weiter. */
  useEffect(() => {
    if (!fertig || proSekunde <= 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const takt = Math.max(35, Math.round(1000 / proSekunde));
    const uhr = setInterval(() => setWert(standJetzt(genau, proSekunde)), takt);
    return () => clearInterval(uhr);
  }, [fertig, genau, proSekunde]);

  return <Kontext.Provider value={{ wert, fertig }}>{children}</Kontext.Provider>;
}
