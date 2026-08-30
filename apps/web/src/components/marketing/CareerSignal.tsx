"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Der Weg von einer Erfahrung zu einer Bewerbung.
 *
 * Sieben Stationen — und ausdrücklich keine sieben Rechtecke. Boxen
 * nebeneinander zeigen eine Aufzählung; hier geht es um eine Bewegung,
 * und die Form soll das schon sagen, bevor jemand liest.
 *
 * Deshalb eine durchgehende Linie, an der die Stationen sitzen wie
 * Haltepunkte. Sie zeichnet sich beim Erscheinen einmal, von oben nach
 * unten, in etwa vier Sekunden. Danach steht sie still.
 *
 * Bei `prefers-reduced-motion` ist sie sofort vollständig da. Nicht als
 * Notlösung: die Linie ist die Information, die Bewegung nur ihre
 * Betonung.
 */

export interface Station {
  label: string;
  detail: string;
}

export function CareerSignal({ stationen }: { stationen: Station[] }) {
  const STATIONEN = stationen;

  const ref = useRef<HTMLOListElement>(null);

  /*
   * Sichtbar ist der Ausgangszustand, nicht das Ziel.
   *
   * Die erste Fassung begann bei `opacity: 0` und wartete auf den
   * IntersectionObserver. Feuert der nie — beim Drucken, in einer
   * Vollseitenaufnahme, ohne JavaScript —, bleibt der ganze Abschnitt
   * unsichtbar. Der Inhalt hing damit an einer Animation.
   *
   * Jetzt umgekehrt: die Linie steht. Die Bewegung wird erst
   * eingeschaltet, wenn JavaScript sie führen kann.
   */
  const [animiert, setAnimiert] = useState(false);
  const [sichtbar, setSichtbar] = useState(true);
  const [sofort, setSofort] = useState(true);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const el = ref.current;
    if (!el) return;

    // Erst ab hier darf verborgen und dann gezeichnet werden.
    setAnimiert(true);
    setSofort(false);
    setSichtbar(false);

    // Erst zeichnen, wenn die Linie tatsächlich im Bild ist. Eine
    // Animation, die oberhalb der Falz abläuft, sieht niemand — und
    // dann ist sie nur Rechenzeit.
    const beobachter = new IntersectionObserver(
      (eintraege) => {
        if (eintraege.some((e) => e.isIntersecting)) {
          setSichtbar(true);
          beobachter.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    beobachter.observe(el);

    // Notbremse: feuert der Beobachter aus irgendeinem Grund nicht,
    // steht die Linie nach zwei Sekunden trotzdem da.
    const notbremse = setTimeout(() => setSichtbar(true), 2000);

    return () => {
      beobachter.disconnect();
      clearTimeout(notbremse);
    };
  }, []);

  return (
    <ol ref={ref} className="relative grid gap-0 py-2">
      {/* Die Linie selbst. Sie liegt hinter den Stationen und wächst
          von oben nach unten. */}
      <span
        aria-hidden
        className="ed-signal-line absolute left-[7px] top-2 w-px origin-top md:left-[9px]"
        style={{
          bottom: "0.5rem",
          transform: `scaleY(${!animiert || sichtbar ? 1 : 0})`,
          transition: sofort ? "none" : "transform 3.6s cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      />

      {STATIONEN.map((station, i) => (
        <li
          key={station.label}
          className="relative grid grid-cols-[auto_1fr] items-start gap-x-5 gap-y-1 py-4 md:gap-x-7 md:py-5"
          /*
           * Nur die Position bewegt sich, nicht die Deckkraft.
           *
           * Eine Einblendung über `opacity` verändert währenddessen den
           * tatsächlichen Farbkontrast — mitten in der Bewegung lag der
           * Text bei 1,43:1. Eine Prüfung, die zufällig in diesem Moment
           * misst, schlägt fehl; ein Mensch, der zufällig dann liest,
           * kann es nicht lesen. Die Linie trägt die Bewegung, der Text
           * steht.
           */
          style={{
            transform: !animiert || sichtbar ? "none" : "translateY(7px)",
            transition: sofort ? "none" : `transform 0.55s ease ${0.2 + i * 0.42}s`,
          }}
        >
          {/* Der Haltepunkt. Der letzte ist gefüllt: dort endet der Weg. */}
          <span
            aria-hidden
            className="relative mt-[7px] block size-[15px] shrink-0 rounded-full md:size-[19px]"
            style={{
              background: "var(--ed-canvas)",
              boxShadow: `inset 0 0 0 1.5px ${
                i === STATIONEN.length - 1 ? "var(--ed-mint)" : "var(--ed-hairline-strong)"
              }`,
            }}
          >
            {i === STATIONEN.length - 1 && (
              <span
                className="absolute inset-[4px] rounded-full"
                style={{ background: "var(--ed-mint)" }}
              />
            )}
          </span>

          <div className="min-w-0">
            <p
              className="font-display text-[1.0625rem] font-semibold leading-tight tracking-[-0.015em] md:text-xl"
              style={{ color: "var(--ed-ink)" }}
            >
              {station.label}
            </p>
            <p
              className="mt-1.5 max-w-[46ch] text-sm leading-relaxed"
              style={{ color: "var(--ed-ink-2)" }}
            >
              {station.detail}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
