/**
 * Der Nina Core — das Hero-Bild der Landingpage.
 *
 * ── Was hier vorher stand und warum es weg ist ────────────────
 *
 * Drei lose Karten und eine Kugel darüber. Jede Karte für sich war in
 * Ordnung; zusammen ergaben sie kein Bild, sondern drei angefangene.
 * Die Kugel schwebte darüber, ohne mit irgendetwas verbunden zu sein,
 * und das Ganze sah aus wie ein Mockup-Baukasten.
 *
 * Hier ist stattdessen EINE Komposition mit drei Stationen auf einer
 * durchgehenden Linie:
 *
 *   was jemand sagt  →  Nina  →  was dabei herauskommt
 *
 * Die Linie ist der Punkt. Sie behauptet einen Zusammenhang, und der
 * Zusammenhang ist die ganze Produktidee.
 *
 * ── Warum reines CSS und kein Canvas ──────────────────────────
 *
 * Das Hero muss sofort dastehen. Eine Animation, die erst rechnet,
 * bevor etwas sichtbar wird, kostet genau die Sekunden, in denen jemand
 * entscheidet, ob er bleibt.
 *
 * Deshalb: Das Markup ist der fertige Endzustand. Ohne CSS, ohne
 * JavaScript, mit abgeschalteten Animationen — immer dasselbe Bild. Die
 * Bewegung legt sich darüber und nimmt nichts weg.
 *
 * ── Warum es bei `prefers-reduced-motion` stillsteht ──────────
 *
 * Nicht aus Pflichtgefühl: Ein pulsierender Kreis am Bildrand ist für
 * Menschen mit vestibulären Störungen ein körperliches Problem. Die
 * Regeln stehen in `globals.css` bei den Keyframes.
 */
export function NinaCore() {
  return (
    <div
      className="nina-core relative isolate aspect-square w-full sm:aspect-[5/4]"
      /*
       * Hochkant auf dem Telefon, breiter am Schreibtisch.
       *
       * Bei 390 Pixeln blieben von 5:4 nur 280 Pixel Höhe — für drei
       * Signale, die Kugel und drei Treffer. Die Pillen brachen um, die
       * Karten schoben sich übereinander. Ein Verhältnis, das auf dem
       * Schreibtisch stimmt, stimmt deshalb noch lange nicht am Telefon.
       *
       * Als Utility und nicht als eigene Variable: Eine Gestaltungs-
       * variable, die nur an einer Stelle vorkommt, ist keine — und der
       * Abgleich gegen die Tokendatei meldet sie zu Recht als fehlend.
       *
       * Feste Verhältnisse statt fester Höhen: sonst springt das Layout,
       * sobald das Bild geladen ist.
       */
      aria-hidden
    >
      {/* ── Das Licht hinter allem ────────────────────────── */}
      <div
        className="nina-core__glow absolute left-[44%] top-1/2 -z-10 size-[72%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--ed-violet) 34%, transparent) 0%, " +
            "color-mix(in oklab, var(--ed-violet) 9%, transparent) 42%, transparent 70%)",
        }}
      />

      {/*
        Die Bahn.

        Ein `<svg>` über der ganzen Fläche, das die drei Stationen
        verbindet. Die Kurve ist zweimal gezeichnet: einmal blass als
        vollständige Bahn, einmal als kurzes helles Segment, das
        darüberwandert. So sieht man, dass etwas fliesst, ohne dass sich
        ein Element bewegt.
      */}
      <svg
        viewBox="0 0 500 400"
        className="absolute inset-0 size-full"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="core-bahn" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="var(--ed-violet)" stopOpacity=".05" />
            <stop offset=".5" stopColor="var(--ed-violet)" stopOpacity=".3" />
            <stop offset="1" stopColor="var(--ed-violet)" stopOpacity=".05" />
          </linearGradient>
        </defs>

        {[
          "M54 92 C130 92 150 176 218 190 C286 204 300 96 452 96",
          "M54 196 C130 196 154 198 218 200 C282 202 300 200 452 200",
          "M54 300 C130 300 150 216 218 210 C286 200 300 304 452 304",
        ].map((d) => (
          <path key={d} d={d} fill="none" stroke="url(#core-bahn)" strokeWidth="1.5" />
        ))}

        {[0, 1, 2].map((i) => (
          <path
            key={i}
            className="nina-core__puls"
            style={{ animationDelay: `${i * 1.9}s` }}
            d={
              [
                "M54 92 C130 92 150 176 218 190",
                "M54 196 C130 196 154 198 218 200",
                "M54 300 C130 300 150 216 218 210",
              ][i]
            }
            fill="none"
            stroke="var(--ed-violet)"
            strokeWidth="2"
            strokeLinecap="round"
            pathLength={100}
          />
        ))}
      </svg>

      {/* ── Links: was jemand sagt ────────────────────────── */}
      {/*
        Drei Spalten, die sich nicht überlappen.
        
        Die erste Fassung setzte die Signale auf 42 % und die Treffer auf
        46 % — zusammen 88 %, und die Kugel sass mittig bei 50 %, also
        mitten unter der rechten Spalte. Sie war halb verdeckt: ausgerechnet
        das Element, das der Mittelpunkt sein soll.
      */}
      <ul className="absolute left-0 top-[12%] grid w-[34%] gap-[8%] text-[clamp(11px,1.05vw,13px)]">
        {["mehr Kundenkontakt", "gut mit Organisation", "weniger körperlich"].map((s, i) => (
          <li
            key={s}
            /* Das dritte Signal erst ab `sm`. Auf dem Telefon ist die
               Aussage nach zwei Beispielen verstanden, und drei passen
               nicht ohne Umbruch. */
            className={
              "nina-core__signal w-fit rounded-(--radius-pill) px-3 py-1.5 " +
              (i === 2 ? "hidden sm:block" : "")
            }
            style={{
              animationDelay: `${i * 1.9}s`,
              background: "var(--ed-surface)",
              color: "var(--ed-ink-2)",
              boxShadow: "var(--ed-shadow-soft)",
            }}
          >
            {s}
          </li>
        ))}
      </ul>

      {/* ── Mitte: Nina ───────────────────────────────────── */}
      <div className="absolute left-[44%] top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
        <div
          className="nina-core__orb grid size-[clamp(84px,10vw,132px)] place-items-center rounded-full"
          style={{
            background:
              "conic-gradient(from 200deg, var(--ed-violet), var(--ed-ice), var(--ed-mint), var(--ed-violet))",
            boxShadow: "0 0 0 10px color-mix(in oklab, var(--ed-violet) 8%, transparent)",
          }}
        >
          <span
            className="grid size-[62%] place-items-center rounded-full font-display text-[clamp(13px,1.5vw,18px)] font-semibold"
            style={{ background: "var(--ed-surface)", color: "var(--ed-ink)" }}
          >
            N
          </span>
        </div>
      </div>

      {/* ── Rechts: was dabei herauskommt ─────────────────── */}
      <ul className="absolute right-0 top-[7%] grid w-[41%] gap-[5%]">
        {[
          {
            titel: "Operations Coordinator",
            geld: "53.000 – 59.000 €",
            herkunft: "vom Arbeitgeber angegeben",
            band: "Starker Fit",
            stark: true,
          },
          {
            titel: "Disposition",
            geld: "48.000 – 52.000 €",
            herkunft: "aus der Anzeige gelesen",
            band: "Interessant",
            stark: false,
          },
          {
            titel: "Kundenbetreuung Innendienst",
            geld: "Gehalt offen",
            herkunft: "keine Angabe",
            band: "Zu prüfen",
            stark: false,
          },
        ].map((j, i) => (
          <li
            key={j.titel}
            className={
              "nina-core__treffer grid gap-1 rounded-(--radius-lg) px-[5%] py-[4%] " +
              (i === 2 ? "hidden sm:grid" : "")
            }
            style={{
              animationDelay: `${0.9 + i * 1.9}s`,
              background: "var(--ed-surface)",
              boxShadow: i === 0 ? "var(--ed-shadow-lift)" : "var(--ed-shadow-soft)",
            }}
          >
            <span className="flex items-baseline justify-between gap-2">
              <span
                className="text-[clamp(11px,1.05vw,14px)] font-semibold"
                style={{ color: "var(--ed-ink)" }}
              >
                {j.titel}
              </span>
              <span
                className="shrink-0 rounded-(--radius-pill) px-2 py-0.5 text-[clamp(9px,0.75vw,11px)] font-medium"
                style={{
                  background: j.stark ? "var(--ed-violet-soft)" : "transparent",
                  color: j.stark ? "var(--ed-violet-text)" : "var(--ed-ink-3)",
                  boxShadow: j.stark ? "none" : "inset 0 0 0 1px var(--ed-hairline)",
                }}
              >
                {j.band}
              </span>
            </span>
            <span
              className="font-mono text-[clamp(10px,0.95vw,13px)]"
              style={{ color: "var(--ed-ink-2)" }}
            >
              {j.geld}
            </span>
            {/*
              Die Herkunft steht an der Zahl, nicht in einer Fussnote.

              Sie ist der Unterschied zwischen „67–88k" und „67–88k,
              geschätzt". Auf einer Seite, die Belegbarkeit verspricht,
              gehört sie ins Hero und nicht ins Kleingedruckte.
            */}
            <span
              className="text-[clamp(9px,0.78vw,11px)]"
              style={{ color: "var(--ed-ink-3)" }}
            >
              {j.herkunft}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
