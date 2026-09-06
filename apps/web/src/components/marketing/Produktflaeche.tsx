import { brand } from "@paycheck/config";
import { Erscheint } from "./Erscheint";

/**
 * Wie ein Vorschlag im Arbeitgeberbereich aussieht.
 *
 * ── Warum eine Produktfläche und keine Illustration ───────────
 *
 * Eine Zeichnung von „KI, die Menschen verbindet" sagt nichts darüber,
 * was man nach der Anmeldung tatsächlich vor sich hat. Diese Fläche
 * zeigt dieselben Angaben in derselben Reihenfolge wie die echte
 * Match-Karte unter `/business/matches` — wer sich anmeldet, findet
 * genau das wieder.
 *
 * ── Warum „Beispiel" ÜBER der Karte steht ─────────────────────
 *
 * Weil sie aussieht wie eine echte. Genau deshalb muss
 * unmissverständlich dastehen, dass sie keine ist: Es gibt weder die
 * Stelle noch die Person, und die Zahlen sind gesetzt, nicht
 * gerechnet.
 */
export function Produktflaeche() {
  return (
    <section>
      <div className="mx-auto grid w-full max-w-[1240px] gap-12 px-5 py-20 md:px-8 md:py-28 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
        <Erscheint className="grid content-start gap-5">
          <p className="text-2xs font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--ed-ink-3)" }}>
            So sieht ein Vorschlag aus
          </p>
          <h2 className="font-display text-[clamp(1.7rem,3vw,2.6rem)] font-semibold leading-[1.06] tracking-[-0.03em]">
            Eine Zahl, die ihre eigene Begründung mitbringt.
          </h2>
          <p className="max-w-[52ch] text-[clamp(1rem,1.3vw,1.1rem)] leading-[1.62]" style={{ color: "var(--ed-ink-2)" }}>
            {brand.assistantName} zeigt nicht nur, wie gut jemand passt, sondern woraus sich das
            ergibt — und was sie nicht beantworten kann. Der Rest sind Fragen fürs Gespräch.
          </p>
          <p className="text-sm leading-relaxed" style={{ color: "var(--ed-ink-3)" }}>
            Persönliche Daten sind erst sichtbar, wenn die Person ihr Profil freigegeben hat und
            beide Seiten Interesse gezeigt haben.
          </p>
        </Erscheint>

        {/* `Erscheint` nimmt keine eigenen Stile — die Fläche bekommt
            deshalb einen eigenen Kasten darin. */}
        <Erscheint>
          <div
            className="grid gap-5 rounded-(--radius-xl) p-6 md:p-8"
            style={{ background: "#12151f", boxShadow: "0 40px 120px rgba(0,0,0,.45)" }}
          >
          <div className="grid gap-1.5">
            <span className="flex flex-wrap items-center gap-2">
              <span
                className="rounded-full px-2 py-0.5 text-2xs font-semibold uppercase tracking-[0.12em]"
                style={{ background: "rgba(255,255,255,.14)", color: "#fff" }}
              >
                Beispiel
              </span>
              <span className="text-2xs font-semibold uppercase tracking-[0.14em]" style={{ color: "rgba(244,245,250,.6)" }}>
                Erfundene Stelle, erfundene Zahlen
              </span>
            </span>
            <h3 className="font-display text-[clamp(1.2rem,2vw,1.7rem)] font-semibold tracking-[-0.02em] text-white">
              Senior Controller (m/w/d)
            </h3>
          </div>

          <dl className="grid grid-cols-3 gap-4 border-y py-5" style={{ borderColor: "rgba(255,255,255,.09)" }}>
            {[
              ["14", "passende Menschen"],
              ["3", "neue Vorschläge"],
              ["2", "im Gespräch"],
            ].map(([zahl, label]) => (
              <div key={label} className="grid gap-1">
                <dd className="font-mono text-[clamp(1.4rem,2.6vw,2rem)] font-semibold tabular-nums text-white">
                  {zahl}
                </dd>
                <dt className="text-2xs leading-tight" style={{ color: "rgba(244,245,250,.6)" }}>
                  {label}
                </dt>
              </div>
            ))}
          </dl>

          {/* ── Die Match-Karte ──────────────────────────── */}
          <div className="grid gap-4 rounded-(--radius-md) p-5" style={{ background: "rgba(255,255,255,.05)" }}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="grid gap-0.5">
                <span className="font-mono text-sm font-semibold text-white">Vorschlag 7f3ac9d2</span>
                <span className="text-2xs" style={{ color: "rgba(244,245,250,.6)" }}>
                  Profilfreigabe offen
                </span>
              </div>
              <span className="font-mono text-2xl font-bold tabular-nums text-white">92</span>
            </div>

            <ul className="grid gap-2">
              {[
                ["Fähigkeiten", 96],
                ["Arbeitsweise", 91],
                ["Entwicklung", 84],
              ].map(([k, v]) => (
                <li key={String(k)} className="grid grid-cols-[6.5rem_minmax(0,1fr)_2.5rem] items-center gap-3">
                  <span className="text-[13px]" style={{ color: "rgba(244,245,250,.72)" }}>
                    {k}
                  </span>
                  <span aria-hidden className="h-1.5 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,.12)" }}>
                    <span className="block h-full rounded-full" style={{ width: `${v}%`, background: "var(--ed-violet)" }} />
                  </span>
                  <span className="text-right font-mono text-[13px] tabular-nums text-white">{v}</span>
                </li>
              ))}
            </ul>

            <dl className="grid gap-2.5 border-t pt-4" style={{ borderColor: "rgba(255,255,255,.09)" }}>
              {[
                ["Belegt", "Konzernkonsolidierung und Monatsabschluss stehen mit Nachweis im Profil."],
                ["Offen", "Zur Führungserfahrung liegt keine Angabe vor. Eine Frage fürs Gespräch."],
                ["Entwickelbar", "SAP S/4HANA fehlt — vorhandene ERP-Erfahrung macht es erreichbar."],
              ].map(([k, v]) => (
                <div key={String(k)} className="grid gap-0.5">
                  <dt className="text-2xs uppercase tracking-[0.1em]" style={{ color: "rgba(244,245,250,.6)" }}>
                    {k}
                  </dt>
                  <dd className="text-[13px] leading-relaxed" style={{ color: "rgba(244,245,250,.82)" }}>
                    {v}
                  </dd>
                </div>
              ))}
            </dl>

            <p className="border-t pt-3 text-2xs leading-relaxed" style={{ borderColor: "rgba(255,255,255,.09)", color: "rgba(244,245,250,.6)" }}>
              Datenbasis: <span className="font-mono">78 %</span> der Kriterien hatten Angaben.
              Name und Kontakt bleiben verborgen, bis beide Seiten zugestimmt haben.
            </p>
          </div>

          <p className="flex items-center gap-2 text-2xs" style={{ color: "rgba(244,245,250,.6)" }}>
            {/*
              Der Punkt pulsiert nicht. Ein blinkendes Signal auf einer
              Verkaufsseite behauptet Betrieb, den es hier nicht gibt —
              die Fläche ist ein Standbild.
            */}
            <span aria-hidden className="size-1.5 rounded-full" style={{ background: "var(--ed-mint, #8ff5d3)" }} />
            {brand.assistantName} prüft neue Profile fortlaufend weiter.
          </p>
          </div>
        </Erscheint>
      </div>
    </section>
  );
}
