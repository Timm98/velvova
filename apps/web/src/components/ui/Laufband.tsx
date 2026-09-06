"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Ein waagerechtes Band, das von selbst läuft und sich bedienen lässt.
 *
 * ── Warum beides ─────────────────────────────────────────────
 *
 * Ein reines Laufband zeigt, dass es weitergeht, lässt sich aber nicht
 * anhalten und nicht durchsuchen — wer eine Karte genauer lesen will,
 * muss warten, bis sie wiederkommt.
 *
 * Ein reiner Schieber bewegt sich nicht und sieht deshalb aus wie eine
 * Liste, die zufällig abgeschnitten ist.
 *
 * Hier läuft es von selbst, hält an, sobald jemand mit der Maus
 * darübergeht oder mit der Tastatur hineinspringt, und lässt sich mit
 * Pfeilen um jeweils eine Bildschirmbreite weiterschieben. Nach einer
 * Bedienung ruht es fünf Sekunden — sonst zöge das automatische Laufen
 * die Karte gleich wieder weg, die man gerade geholt hat.
 *
 * ── Warum kein CSS-Keyframe wie zuvor ────────────────────────
 *
 * Eine `transform`-Animation und ein Scrollbereich schliessen einander
 * aus: Was verschoben ist, lässt sich nicht scrollen. Hier bewegt
 * deshalb ein Zeitgeber die Scrollposition — dieselbe Grösse, die auch
 * die Pfeile und der Finger verändern.
 */
export function Laufband({
  children,
  beschriftung,
  /** Pixel je Sekunde. Null hält das Band an. */
  tempo = 26,
}: {
  children: React.ReactNode;
  beschriftung: string;
  tempo?: number;
}) {
  const spur = useRef<HTMLDivElement>(null);
  const [ruhtBis, setRuhtBis] = useState(0);
  const [links, setLinks] = useState(false);
  const [rechts, setRechts] = useState(true);

  const pruefePfeile = useCallback(() => {
    const el = spur.current;
    if (!el) return;
    setLinks(el.scrollLeft > 4);
    setRechts(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  /* Das automatische Laufen. */
  useEffect(() => {
    const el = spur.current;
    if (!el || tempo <= 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let letzte = 0;
    let anforderung = 0;
    const schritt = (jetzt: number) => {
      anforderung = requestAnimationFrame(schritt);
      const delta = letzte === 0 ? 0 : Math.min((jetzt - letzte) / 1000, 0.05);
      letzte = jetzt;
      if (Date.now() < ruhtBis) return;
      if (el.matches(":hover") || el.contains(document.activeElement)) return;

      el.scrollLeft += tempo * delta;
      /* Am Ende zurück an den Anfang — ohne weiche Bewegung, sonst
         sähe man den Rücklauf als Ruck durch das ganze Band. */
      if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 1) el.scrollLeft = 0;
      pruefePfeile();
    };
    anforderung = requestAnimationFrame(schritt);
    return () => cancelAnimationFrame(anforderung);
  }, [tempo, ruhtBis, pruefePfeile]);

  useEffect(pruefePfeile, [pruefePfeile, children]);

  const schieben = (richtung: -1 | 1) => {
    const el = spur.current;
    if (!el) return;
    setRuhtBis(Date.now() + 5000);
    el.scrollBy({ left: richtung * Math.round(el.clientWidth * 0.8), behavior: "smooth" });
  };

  return (
    <div className="relative">
      <div
        ref={spur}
        onScroll={pruefePfeile}
        role="group"
        aria-label={beschriftung}
        tabIndex={0}
        className="laufband flex gap-3 overflow-x-auto scroll-smooth pb-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {children}
      </div>

      {/*
        Die Pfeile liegen über dem Band, nicht daneben — sonst
        verlöre das Band auf schmalen Geräten Platz an zwei Knöpfe,
        die dort ohnehin niemand braucht: Dort wird gewischt.
      */}
      {[-1, 1].map((r) => {
        const sichtbar = r === -1 ? links : rechts;
        const Zeichen = r === -1 ? ChevronLeft : ChevronRight;
        return (
          <button
            key={r}
            type="button"
            onClick={() => schieben(r as -1 | 1)}
            aria-label={r === -1 ? "Zurück" : "Weiter"}
            className={`absolute top-1/2 hidden size-10 -translate-y-1/2 place-items-center rounded-full border border-line bg-surface text-ink shadow-sm transition-opacity hover:bg-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:grid ${
              r === -1 ? "left-0 -translate-x-1/2" : "right-0 translate-x-1/2"
            } ${sichtbar ? "opacity-100" : "pointer-events-none opacity-0"}`}
          >
            <Zeichen aria-hidden className="size-5" strokeWidth={2} />
          </button>
        );
      })}
    </div>
  );
}
