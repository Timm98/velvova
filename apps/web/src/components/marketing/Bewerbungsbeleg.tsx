/**
 * Warum eine gute Bewerbung messbar etwas ändert.
 *
 * ── Was hier bewusst nicht steht ──────────────────────────────
 *
 * Kein Versprechen, Auswahlsysteme zu überlisten. Die Untersuchung
 * von Nilizadeh und anderen zeigt zwar, dass passende Begriffe aus
 * der Stellenanzeige einen Lebenslauf im Ranking um bis zu 16 Plätze
 * heben können — daraus „wir bringen dich durch jeden Filter" zu
 * machen, wäre eine Zusage, die niemand halten kann, und sie führte
 * zu Bewerbungen mit Fähigkeiten, die es nicht gibt.
 *
 * Was bleibt, ist die belegbare Aussage: Besser formuliert werden
 * vorhandene Fähigkeiten für Menschen und Systeme erkennbar. Genau
 * das zeigt das Feldexperiment von Van Inwegen und anderen — und
 * ausdrücklich, dass die Arbeitgeber mit den so Eingestellten nicht
 * unzufriedener waren.
 */

const BELEGE = [
  {
    zahl: "+8 %",
    text: "höhere Einstellungswahrscheinlichkeit durch algorithmische Schreibhilfe im Lebenslauf — bei fast 500.000 Arbeitssuchenden im Feldexperiment",
    quelle: "Van Inwegen, Munyikwa & Horton",
  },
  {
    zahl: "+10 %",
    text: "verdienten die so Eingestellten im Schnitt mehr; die Arbeitgeber waren nicht unzufriedener",
    quelle: "dieselbe Untersuchung",
  },
  {
    zahl: "fast 2×",
    text: "so hohe Rückrufquote bei sprachlich professionellerem Anschreiben — bei unverändertem Inhalt",
    quelle: "IZA, Feldexperiment",
  },
  {
    zahl: "16 Plätze",
    text: "besser im Ranking eines Auswahlsystems, wenn Begriffe der Stellenanzeige im Lebenslauf vorkommen",
    quelle: "Nilizadeh et al.",
  },
];

const ABLAUF = [
  ["Erkannt werden", "Vorhandene Erfahrung in die Sprache der Stelle übersetzen — nicht erfinden, sondern benennen."],
  ["Eingeladen werden", "Lebenslauf und Anschreiben auf die Stelle zuschneiden und auf Lesbarkeit prüfen, für Menschen wie für Systeme."],
  ["Vorbereitet überzeugen", "Wahrscheinliche Fragen ableiten, das Gespräch üben, Antworten nach Klarheit und Beispielen bewerten."],
];

export function Bewerbungsbeleg() {
  return (
    <div className="grid gap-6">
      <figure
        className="grid gap-6 rounded-(--radius-lg) px-6 py-8 md:px-8 md:py-10"
        style={{
          background: "color-mix(in oklab, var(--ed-ink) 4%, transparent)",
          border: "1px solid var(--ed-hairline)",
        }}
      >
        <figcaption className="grid gap-2.5">
          <p
            className="text-2xs font-semibold uppercase tracking-[0.16em]"
            style={{ color: "var(--ed-ink-3)" }}
          >
            Was die Forschung zeigt
          </p>
          <p className="text-lg font-semibold leading-snug" style={{ color: "var(--ed-ink)" }}>
            Du hast die Fähigkeiten. Es geht darum, dass sie gesehen werden.
          </p>
        </figcaption>

        <ul className="grid gap-4">
          {BELEGE.map((b) => (
            <li key={b.zahl} className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-4">
              <span
                className="whitespace-nowrap font-mono text-xl font-bold tabular-nums"
                style={{ color: "var(--ed-violet-text)" }}
              >
                {b.zahl}
              </span>
              <span className="grid min-w-0 gap-0.5">
                <span className="text-sm leading-snug break-words" style={{ color: "var(--ed-ink)" }}>
                  {b.text}
                </span>
                <span className="text-2xs break-words" style={{ color: "var(--ed-ink-3)" }}>
                  {b.quelle}
                </span>
              </span>
            </li>
          ))}
        </ul>

        <p
          className="border-t pt-4 text-2xs leading-relaxed"
          style={{ borderColor: "var(--ed-hairline)", color: "var(--ed-ink-3)" }}
        >
          Besser formuliert heisst: verständlicher, nicht grösser. Was in einer Bewerbung steht,
          muss belegt sein — eine Fähigkeit, die im Gespräch nicht trägt, kostet mehr als sie
          einbringt.
        </p>
      </figure>

      <ol className="grid gap-4">
        {ABLAUF.map(([titel, text], i) => (
          <li key={titel} className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-4">
            <span
              className="font-mono text-sm font-bold tabular-nums"
              style={{ color: "var(--ed-ink-3)" }}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="grid min-w-0 gap-0.5">
              <span className="text-[15px] font-semibold" style={{ color: "var(--ed-ink)" }}>
                {titel}
              </span>
              <span className="text-[15px] leading-relaxed" style={{ color: "var(--ed-ink-2)" }}>
                {text}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
