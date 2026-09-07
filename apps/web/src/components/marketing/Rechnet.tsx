"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Eine Zahl, die beim Erscheinen sichtbar errechnet wird.
 *
 * ── Warum das kein Selbstzweck ist ────────────────────────────
 *
 * Die Beispielrechnung auf der Startseite zeigt, was Monday bei jeder
 * Stelle tut: Brutto, Steuern, Fixkosten, Fahrweg — und was am Ende
 * übrig bleibt. Als fertige Tabelle liest sich das wie ein Screenshot.
 * Läuft sie beim Heranscrollen einmal durch, sieht man, dass gerechnet
 * wird.
 *
 * ── Warum die Ziffern zappeln und dann einrasten ──────────────
 *
 * Ein reines Hochzählen von null wirkt wie ein Zähler. Zufällige
 * Zwischenwerte, die sich auf den Endwert zubewegen, sehen aus wie
 * eine laufende Rechnung — und genau das ist es.
 *
 * Der Endwert steht von Anfang an fest und wird nicht erfunden: Er
 * kommt als `wert` herein. Die Zwischenschritte sind Darstellung,
 * das Ergebnis ist die Angabe.
 *
 * `prefers-reduced-motion` überspringt das Ganze.
 */
export function Rechnet({
  wert,
  einheit = " €",
  className,
  verzoegerung = 0,
}: {
  wert: number;
  einheit?: string;
  className?: string;
  /**
   * Millisekunden, bevor diese Zeile zu rechnen beginnt.
   *
   * Damit läuft die Rechnung von oben nach unten durch, statt dass
   * alle Zeilen gleichzeitig zappeln. Man sieht dann, dass vom Brutto
   * das Netto kommt, davon die Fixkosten abgehen und was übrig
   * bleibt — die Reihenfolge ist die Aussage.
   */
  verzoegerung?: number;
}) {
  const feld = useRef<HTMLSpanElement>(null);
  const [zeige, setZeige] = useState<number | null>(null);

  useEffect(() => {
    const ziel = feld.current;
    if (!ziel) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setZeige(wert);
      return;
    }
    if (typeof IntersectionObserver === "undefined") {
      setZeige(wert);
      return;
    }

    const beobachter = new IntersectionObserver(
      (eintraege) => {
        if (!eintraege[0]?.isIntersecting) return;
        beobachter.disconnect();

        const dauer = 900;
        const beginn = performance.now() + verzoegerung;
        let anforderung = 0;
        const schritt = (jetzt: number) => {
          /* Vor dem eigenen Einsatz bleibt die Zeile leer statt auf
             null zu stehen — eine Null wäre eine Zahl, und die stimmt
             nicht. */
          if (jetzt < beginn) {
            anforderung = requestAnimationFrame(schritt);
            return;
          }
          const anteil = Math.min(1, (jetzt - beginn) / dauer);
          if (anteil < 1) {
            /*
             * Die Streuung nimmt ab: am Anfang springt die Zahl weit,
             * gegen Ende nur noch wenig. So rastet sie ein, statt
             * abrupt stehenzubleiben.
             */
            const streuung = (1 - anteil) ** 2;
            const zufall = (Math.random() - 0.5) * 2 * streuung * wert * 0.35;
            setZeige(Math.max(0, Math.round(wert * (0.35 + 0.65 * anteil) + zufall)));
            anforderung = requestAnimationFrame(schritt);
          } else {
            setZeige(wert);
          }
        };
        anforderung = requestAnimationFrame(schritt);
        return () => cancelAnimationFrame(anforderung);
      },
      { threshold: 0.4 },
    );
    beobachter.observe(ziel);
    return () => beobachter.disconnect();
  }, [wert, verzoegerung]);

  return (
    <span ref={feld} className={className} suppressHydrationWarning>
      {zeige === null ? "—" : `${zeige.toLocaleString("de-DE")}${einheit}`}
    </span>
  );
}
