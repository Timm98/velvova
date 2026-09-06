"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Dieselbe Verteilung, wechselnde Berufsgruppen.
 *
 * ── Warum es wechselt ─────────────────────────────────────────
 *
 * Eine einzige Verteilung über alle 436 Berufsgruppen beantwortet die
 * Frage nicht, die jemand tatsächlich hat. „Achtundfünfzig Prozent
 * voraussichtlich stabil" heisst für eine Pflegekraft etwas völlig
 * anderes als für eine Sachbearbeiterin — und genau dieser
 * Unterschied ist die Aussage.
 *
 * Deshalb läuft hier eine Berufshauptgruppe nach der anderen durch.
 * Wer wartet, sieht seine eigene dabei.
 *
 * ── Warum die Balken laufen ───────────────────────────────────
 *
 * Nicht als Schmuck: Wenn beim Wechsel nur die Zahlen umspringen,
 * liest man zwei Standbilder. Laufen die Balken von der alten auf die
 * neue Länge, sieht man die Verschiebung — und die Verschiebung ist
 * das, was zwischen zwei Berufsgruppen wirklich anders ist.
 *
 * `prefers-reduced-motion` schaltet beides ab: keine Bewegung, kein
 * automatischer Wechsel. Dann steht die Gesamtverteilung, und man
 * blättert selbst.
 */

export type Szenario = {
  name: string;
  /** Wie viele Berufsgruppen dahinterstehen — die Bezugsgrösse. */
  gruppen: number;
  anteile: { name: string; anteil: number; ton: string }[];
};

const WECHSEL_MS = 5200;
const LAUF_MS = 900;

export function Berufsszenario({ szenarien }: { szenarien: Szenario[] }) {
  const feld = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [ruhig, setRuhig] = useState(false);
  const [sichtbar, setSichtbar] = useState(false);
  /* Die dargestellten Werte laufen den Zielwerten hinterher. */
  const [stand, setStand] = useState<number[]>(() => szenarien[0]!.anteile.map(() => 0));

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setRuhig(true);
      setStand(szenarien[0]!.anteile.map((a) => a.anteil));
      return;
    }
    const ziel = feld.current;
    if (!ziel || typeof IntersectionObserver === "undefined") {
      setSichtbar(true);
      return;
    }
    /*
     * Erst laufen lassen, wenn es jemand sehen kann.
     *
     * Ohne diese Bedingung wäre die Bewegung vorbei, bevor der
     * Abschnitt im Bild ist — und übrig bliebe ein Standbild, das
     * nach nichts aussieht. Der Beobachter wird nicht getrennt: Der
     * Wechsel soll pausieren, sobald der Abschnitt wieder aus dem Bild
     * läuft, sonst zählt er im Hintergrund weiter und man steigt
     * mitten in einer fremden Berufsgruppe wieder ein.
     */
    const beobachter = new IntersectionObserver(
      (eintraege) => setSichtbar(eintraege[0]?.isIntersecting === true),
      { threshold: 0.35 },
    );
    beobachter.observe(ziel);
    return () => beobachter.disconnect();
  }, [szenarien]);

  /* Weiterschalten. */
  useEffect(() => {
    if (ruhig || !sichtbar || szenarien.length < 2) return;
    const uhr = setInterval(() => setIndex((i) => (i + 1) % szenarien.length), WECHSEL_MS);
    return () => clearInterval(uhr);
  }, [ruhig, sichtbar, szenarien.length]);

  /* Die Balken auf die neuen Werte fahren. */
  useEffect(() => {
    if (ruhig || !sichtbar) return;
    const ziel = szenarien[index]!.anteile.map((a) => a.anteil);
    const von = stand;
    const beginn = performance.now();
    let anforderung = 0;

    const schritt = (jetzt: number) => {
      const t = Math.min(1, (jetzt - beginn) / LAUF_MS);
      /* Auslaufen statt abbrechen — die Balken rasten ein. */
      const weich = 1 - Math.pow(1 - t, 3);
      setStand(ziel.map((z, i) => (von[i] ?? 0) + (z - (von[i] ?? 0)) * weich));
      if (t < 1) anforderung = requestAnimationFrame(schritt);
    };
    anforderung = requestAnimationFrame(schritt);
    return () => cancelAnimationFrame(anforderung);
    /* `stand` bewusst nicht in den Abhängigkeiten: Es ist der
       Startwert dieser Fahrt, nicht ihr Auslöser. Stünde es hier,
       startete die Fahrt bei jedem Bild neu und käme nie an. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, ruhig, sichtbar, szenarien]);

  const jetzt = szenarien[index]!;
  const gesamt = stand.reduce((a, b) => a + b, 0) || 1;

  return (
    <div ref={feld} className="grid gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-sm font-semibold text-ink">{jetzt.name}</p>
        <p className="text-2xs text-ink-3">
          <span className="font-mono tabular-nums">{jetzt.gruppen}</span> Berufsgruppen
        </p>
      </div>

      {/*
        Ein gestapelter Balken statt dreier einzelner: Die drei Anteile
        ergeben zusammen das Ganze, und genau das soll man sehen —
        nicht drei Zahlen, die man selbst addieren muss.

        Die Breiten werden auf die laufende Summe normiert. Während der
        Fahrt ist die Summe nicht 100, und ohne Normierung klaffte am
        Ende des Balkens eine Lücke, die sich langsam schliesst.
      */}
      <div
        role="img"
        aria-label={jetzt.anteile.map((a) => `${a.name}: ${a.anteil} Prozent`).join(", ")}
        className="flex h-3 w-full overflow-hidden rounded-full bg-inset"
      >
        {jetzt.anteile.map((a, i) => (
          <div
            key={a.name}
            className={a.ton}
            style={{ width: `${((stand[i] ?? 0) / gesamt) * 100}%` }}
          />
        ))}
      </div>

      <ul className="grid gap-3">
        {jetzt.anteile.map((a, i) => (
          <li key={a.name} className="flex items-baseline justify-between gap-4">
            <span className="flex items-center gap-2.5 text-sm text-ink">
              <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${a.ton}`} />
              {a.name}
            </span>
            <span className="font-mono text-base font-bold tabular-nums text-ink">
              {Math.round(stand[i] ?? 0)} %
            </span>
          </li>
        ))}
      </ul>

      {/*
        Die Punkte sind eine Anzeige, kein Bedienelement.

        Wer weiterblättern will, hat dafür keinen Grund — es läuft
        ohnehin weiter. Sie beantworten nur die Frage, wie viele
        Gruppen es insgesamt sind und wo man gerade steht.
      */}
      {szenarien.length > 1 && !ruhig && (
        <div aria-hidden className="flex flex-wrap gap-1.5 pt-0.5">
          {szenarien.map((s, i) => (
            <span
              key={s.name}
              className="h-1 flex-1 rounded-full transition-colors duration-500"
              style={{
                background: i === index ? "var(--ed-violet)" : "var(--ed-hairline)",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
