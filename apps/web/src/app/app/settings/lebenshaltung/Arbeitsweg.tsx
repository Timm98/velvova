import { pendelrechnung, beiBuerotagen } from "@/lib/lebenswert/pendelzeit";

/**
 * Was der Arbeitsweg an Zeit kostet.
 *
 * ── Die Umrechnung, die niemand im Kopf macht ─────────────────
 *
 * „35 Minuten" klingt erträglich. Zweimal täglich, drei Tage die Woche,
 * ein Arbeitsjahr lang — das sind rund 160 Stunden, also zwanzig
 * Arbeitstage. Dieselbe Angabe, zwei völlig verschiedene Auskünfte, und
 * die zweite ist die, nach der man entscheidet.
 *
 * Deshalb steht sie neben dem Geld und nicht in einer Fussnote: Ein
 * Wechsel, der zweihundert Euro mehr bringt und vierzig Stunden mehr
 * Weg kostet, ist keine reine Gehaltsfrage.
 *
 * ── Warum die Bürotage einzeln aufgeführt sind ────────────────
 *
 * Bei einer Hybridstelle ist die Zahl der Bürotage die grösste
 * Stellschraube — und die verhandelbarste. Was ein Tag mehr oder
 * weniger im Jahr ausmacht, sieht man erst, wenn es nebeneinander
 * steht.
 */
export function Arbeitsweg({
  minuten,
  buerotage,
}: {
  minuten: number | null;
  buerotage: number | null;
}) {
  /*
   * Ohne beide Angaben wird nicht gerechnet.
   *
   * Fünf Bürotage anzunehmen, weil das Feld leer ist, verdoppelt bei
   * einer Hybridstelle das Ergebnis — und die Zahl sähe genauso
   * seriös aus.
   */
  if (minuten === null || minuten <= 0 || buerotage === null || buerotage <= 0) return null;

  const r = pendelrechnung(minuten, buerotage);
  const varianten = beiBuerotagen(minuten, [1, 2, 3, 4, 5]).filter(
    (v) => v.buerotageJeWoche !== buerotage,
  );

  return (
    <div className="grid gap-3 rounded-(--radius-surface) bg-soft p-5">
      <h4 className="text-sm font-semibold">Was dein Arbeitsweg an Zeit kostet</h4>

      <p className="max-w-[var(--measure)] text-[15px] leading-relaxed text-ink">
        {minuten} Minuten je Richtung, {buerotage} {buerotage === 1 ? "Tag" : "Tage"} die Woche —
        das sind <span className="font-mono font-semibold tabular">{zahl(r.monatlichStunden)}</span>{" "}
        Stunden im Monat und{" "}
        <span className="font-mono font-semibold tabular">{zahl(r.jaehrlichStunden)}</span> Stunden
        im Jahr, also rund{" "}
        <span className="font-mono font-semibold tabular">{zahl(r.jaehrlichArbeitstage)}</span>{" "}
        Arbeitstage.
      </p>

      {varianten.length > 0 && (
        <div className="grid gap-1.5">
          <p className="text-2xs text-ink-3">Zum Vergleich, je Bürotag im Jahr:</p>
          <ul className="flex flex-wrap gap-1.5">
            {varianten.map((v) => (
              <li
                key={v.buerotageJeWoche}
                className="rounded-(--radius-pill) bg-inset px-2.5 py-0.5 font-mono text-2xs text-ink-3"
              >
                {v.buerotageJeWoche} {v.buerotageJeWoche === 1 ? "Tag" : "Tage"} ·{" "}
                {zahl(v.jaehrlichStunden)} Std.
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="max-w-[var(--measure)] text-2xs leading-relaxed text-ink-3">
        Gerechnet mit 46 Arbeitswochen im Jahr — Urlaub und Feiertage sind abgezogen. Mit 52 wäre
        die Zahl systematisch zu hoch, und zwar in die Richtung, die dramatischer klingt.
      </p>
    </div>
  );
}

function zahl(n: number): string {
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(n);
}
