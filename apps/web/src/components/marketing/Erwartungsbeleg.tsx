/**
 * Falsche Erwartungen — kurz belegt.
 *
 * ── Warum klein ───────────────────────────────────────────────
 *
 * Auf der Seite stehen bereits drei Belegblöcke: Orientierung,
 * Zukunft, Bewerbung. Ein vierter in gleicher Grösse machte aus der
 * Startseite eine Literaturliste.
 *
 * Drei Zeilen genügen, um die Aussage zu tragen: Erwartungen, die
 * nicht zutreffen, werden nach der Einstellung zu Unzufriedenheit —
 * und realistische Vorabinformationen wirken dagegen messbar.
 *
 * ── Was hier bewusst fehlt ────────────────────────────────────
 *
 * Die Gallup-Zahl von 11 Prozent stark gebundener Beschäftigter wäre
 * die dramatischste — und die unpassendste: Sie misst Bindung, nicht
 * falsche Erwartungen. Sie hier zu zeigen hiesse, aus einem
 * verwandten Befund einen Beleg zu machen.
 */

const BELEGE = [
  {
    zahl: "40",
    einheit: "Studien",
    text: "zeigen: Realistische Vorabinformationen machen Erwartungen genauer und senken freiwillige Kündigungen",
    quelle: "Phillips, Metaanalyse",
  },
  {
    zahl: "17.000",
    einheit: "Beschäftigte",
    text: "in 52 Untersuchungen — realistische Information wirkte vor allem, weil der Arbeitgeber als ehrlicher wahrgenommen wurde",
    quelle: "Earnest, Allen & Landis",
  },
  {
    zahl: "−0,41",
    einheit: "Zusammenhang",
    text: "zwischen empfundener Überqualifikation und Arbeitszufriedenheit — ein Job kann auch zu klein sein",
    quelle: "Harari et al., Metaanalyse",
  },
];

export function Erwartungsbeleg() {
  return (
    <figure
      className="grid gap-4 rounded-(--radius-md) px-5 py-5"
      style={{
        background: "color-mix(in oklab, var(--ed-ink) 4%, transparent)",
        border: "1px solid var(--ed-hairline)",
      }}
    >
      <figcaption
        className="text-2xs font-semibold uppercase tracking-[0.16em]"
        style={{ color: "var(--ed-ink-3)" }}
      >
        Falsche Erwartungen werden später zu Unzufriedenheit
      </figcaption>

      <ul className="grid gap-3">
        {BELEGE.map((b) => (
          /*
            Die Zahl bekommt eine eigene, feste Spalte.

            Mit `auto` war die Spalte so breit wie ihre Zahl — „40"
            schmal, „17.000" breit —, und der Text daneben fing in
            jeder Zeile woanders an. Bei drei Zeilen mit stark
            unterschiedlich langen Zahlen sah das nicht nach Tabelle
            aus, sondern nach Zahlen, die in den Satz hineinragen.

            Fest und mittig gesetzt steht die Zahl in ihrer eigenen
            Spalte, alle drei Texte fluchten links, und die Einheit
            darunter sagt, worauf sich die Zahl bezieht — ohne dass
            sie dafür im Satz stehen muss.
          */
          <li key={b.quelle} className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-baseline gap-x-4">
            <span className="grid justify-items-center gap-0.5 text-center">
              <span
                className="font-mono text-base font-bold tabular-nums"
                style={{ color: "var(--ed-violet-text)" }}
              >
                {b.zahl}
              </span>
              <span
                className="text-2xs leading-tight"
                style={{ color: "var(--ed-ink-3)" }}
              >
                {b.einheit}
              </span>
            </span>
            <span className="grid min-w-0 gap-0.5">
              <span
                className="text-[13px] leading-snug break-words"
                style={{ color: "var(--ed-ink-2)" }}
              >
                {b.text}
              </span>
              <span className="text-2xs break-words" style={{ color: "var(--ed-ink-3)" }}>
                {b.quelle}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
