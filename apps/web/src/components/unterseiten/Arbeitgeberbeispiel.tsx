import { ANZEIGE, ARBEITGEBERSICHT, BEISPIEL_KENNZEICHEN } from "@/lib/unterseiten/beispiel";

/**
 * ══════════════════════════════════════════════════════════════════
 * Der Klarheits-Check — dieselbe Anzeige, andere Seite des Tisches
 * ══════════════════════════════════════════════════════════════════
 *
 * Hier stand eine Kandidatenkarte: eine Gesamtzahl 92, daneben
 * Teilwerte 96, 91 und 84, ein grüner Punkt „prüft fortlaufend" und
 * die Angabe, wie viele Menschen gerade passen. Direkt daneben der
 * Satz, es gebe „keinen einzelnen Wert".
 *
 * Beides zugleich geht nicht. Und der Wert ist auch als Vorschau
 * falsch: Er verspricht ein Produkt, das nach einer Zahl sortiert —
 * und genau das soll Velvova nicht sein.
 *
 * Jetzt steht hier, was ein Arbeitgeber tatsächlich bekommt: seine
 * eigene Anzeige, aufgeteilt in vorhanden, offen und widersprüchlich.
 * Kein Mensch kommt darin vor, also auch keine erfundene Person.
 *
 * ── Warum kein grüner Live-Punkt ────────────────────────────────
 *
 * Weil nichts fortlaufend prüft. Ein Punkt, der Betrieb anzeigt, wo
 * keiner läuft, ist die billigste Art, Vertrauen zu erschleichen.
 *
 * Ein Serverbauteil: Es gibt nichts umzuschalten und nichts zu
 * kopieren. Der Zustand, den die Vorschau auf „Lösungen" braucht,
 * wäre hier nur unbenutztes Javascript im Browser.
 */

const SPALTEN = [
  {
    titel: "In der Anzeige vorhanden",
    punkte: ARBEITGEBERSICHT.vorhanden,
    ton: "var(--color-accent)",
  },
  {
    titel: "Noch offen",
    punkte: ARBEITGEBERSICHT.offen,
    ton: "var(--color-ink-3)",
  },
  {
    titel: "Widersprüchlich",
    punkte: [ARBEITGEBERSICHT.widerspruch],
    ton: "var(--signal-violet-text, var(--color-ink))",
  },
] as const;

export function Arbeitgeberbeispiel() {
  return (
    <div
      className="grid gap-4 rounded-(--radius-lg) border border-line p-5 md:p-6"
      style={{ background: "var(--ed-surface)" }}
    >
      <span className="w-fit rounded-(--radius-pill) border border-line px-2.5 py-1 text-2xs uppercase tracking-[0.1em] text-ink-3">
        {BEISPIEL_KENNZEICHEN} · Stellenanzeige
      </span>

      <h3 className="text-[15px] font-semibold text-ink">{ANZEIGE.titel}</h3>

      <div className="grid gap-4">
        {SPALTEN.map((s) => (
          <div key={s.titel} className="grid gap-1.5">
            <div className="flex items-center gap-2">
              {/*
                Punkt UND Wort. Wer Farben nicht unterscheidet, sähe
                sonst drei gleich aussehende Listen untereinander.
              */}
              <span aria-hidden className="size-1.5 rounded-full" style={{ background: s.ton }} />
              <span className="text-2xs uppercase tracking-[0.08em] text-ink-3">{s.titel}</span>
            </div>
            <ul className="grid gap-1 pl-4 text-[14px] leading-[1.6] text-ink-2">
              {s.punkte.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div
        className="grid gap-1.5 rounded-(--radius-md) border border-line p-4"
        style={{ background: "var(--ed-canvas)" }}
      >
        <p className="text-2xs uppercase tracking-[0.08em] text-ink-3">Sinnvolle Ergänzung</p>
        <ul className="grid gap-1 text-[14px] leading-[1.6] text-ink-2">
          {ARBEITGEBERSICHT.ergaenzung.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
