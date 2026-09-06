"use client";

import { useEffect, useRef } from "react";
import { melde, spuelen } from "@/lib/proaktiv/melden";

/**
 * Was auf einer Stellenseite beobachtet wird.
 *
 * ══════════════════════════════════════════════════════════════
 * Vier Ereignisse, und keins mehr
 * ══════════════════════════════════════════════════════════════
 *
 *   job_viewed             die Seite wurde geöffnet
 *   job_view_duration      wie lange sie sichtbar war
 *   salary_opened          das Gehalt wurde aufgeklappt
 *   requirements_opened    die Anforderungen wurden aufgeklappt
 *
 * Keine Mausbewegungen, kein Scrollverhalten, keine Tippgeschwindigkeit.
 * Daraus liessen sich Persönlichkeitsvermutungen bauen, und dafür hat
 * uns niemand ein Mandat gegeben.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum die Dauer nur zählt, wenn die Seite sichtbar ist
 * ══════════════════════════════════════════════════════════════
 *
 * Ein Tab, der im Hintergrund offen bleibt, während jemand Kaffee
 * holt, ergäbe sonst „vier Minuten aufmerksam gelesen“. Das ist die
 * häufigste Art, wie aus einer Beobachtung eine falsche Behauptung
 * wird — und sie fiele niemandem auf.
 */
export function Beobachter({ jobId }: { jobId: string }) {
  const gemeldet = useRef(false);
  const sichtbarSeit = useRef<number | null>(null);
  const sekunden = useRef(0);

  useEffect(() => {
    if (gemeldet.current) return;
    gemeldet.current = true;

    melde("job_viewed", { jobId });
    sichtbarSeit.current = Date.now();

    const anhalten = () => {
      if (sichtbarSeit.current === null) return;
      sekunden.current += (Date.now() - sichtbarSeit.current) / 1000;
      sichtbarSeit.current = null;
    };
    const weiter = () => {
      if (sichtbarSeit.current === null) sichtbarSeit.current = Date.now();
    };

    const beiSichtbarkeit = () => (document.hidden ? anhalten() : weiter());
    document.addEventListener("visibilitychange", beiSichtbarkeit);

    return () => {
      document.removeEventListener("visibilitychange", beiSichtbarkeit);
      anhalten();
      const gerundet = Math.round(sekunden.current);
      /*
       * Unter fünf Sekunden ist kein Ansehen, sondern ein Verklicken.
       * Solche Zeilen zu schreiben hiesse, den Ereignisstrom mit
       * Zufall zu füllen.
       */
      if (gerundet >= 5) melde("job_view_duration", { jobId, kontext: { sekunden: gerundet } });
      /* Am Ende der Ansicht darf Nina einmal nachdenken. */
      spuelen(true);
    };
  }, [jobId]);

  return null;
}

/**
 * Ein aufgeklappter Abschnitt.
 *
 * Gehalt und Anforderungen sind die beiden, die zusammen etwas sagen:
 * Wer beides ansieht, prüft die Stelle ernsthaft. Einzeln sagt keins
 * von beiden viel.
 */
export function AbschnittBeobachter({
  jobId,
  abschnitt,
}: {
  jobId: string;
  abschnitt: "salary" | "requirements" | "company";
}) {
  const gemeldet = useRef(false);

  return (
    <span
      className="contents"
      onClickCapture={() => {
        if (gemeldet.current) return;
        gemeldet.current = true;
        const art =
          abschnitt === "salary"
            ? "salary_opened"
            : abschnitt === "requirements"
              ? "requirements_opened"
              : "company_opened";
        melde(art, { jobId });
      }}
    />
  );
}
