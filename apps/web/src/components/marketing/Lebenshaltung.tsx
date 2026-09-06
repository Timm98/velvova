/**
 * Was von einem Gehalt tatsächlich übrig bleibt — mit Quellen.
 *
 * ── Warum diese Aussage und keine stärkere ────────────────────
 *
 * Naheliegend wäre gewesen: „Die meisten wissen nicht, wie viel Geld
 * ihnen bleibt." Das klingt gut und ist durch keine dieser Quellen
 * gedeckt — dafür bräuchte es eine eigene repräsentative Befragung.
 *
 * Die Quellen belegen zwei getrennte Dinge: Die Lebenshaltung frisst
 * einen grossen Teil des Einkommens, und ein erheblicher Teil der
 * Menschen beschäftigt sich nicht regelmässig mit den eigenen
 * Finanzen. Beides zusammen trägt die Aussage — mehr nicht, aber das
 * belastbar.
 */

const BELEGE = [
  {
    zahl: "3.257 €",
    text: "geben deutsche Haushalte im Monat durchschnittlich für den privaten Konsum aus",
    quelle: "Statistisches Bundesamt, Laufende Wirtschaftsrechnungen 2024",
  },
  {
    zahl: "32,2 %",
    text: "leben in Haushalten, die eine unerwartete grössere Ausgabe nicht aus eigenen Mitteln bezahlen könnten",
    quelle: "Statistisches Bundesamt / EU-SILC 2024",
  },
  {
    zahl: "4 von 10",
    text: "beschäftigen sich regelmässig mit den eigenen Finanzen",
    quelle: "Bundesverband deutscher Banken",
  },
  {
    zahl: "−14.500 €",
    text: "sank das mittlere Nettovermögen inflationsbereinigt zwischen 2021 und 2023 — von 90.500 auf 76.000 €",
    quelle: "Deutsche Bundesbank, „Private Haushalte und ihre Finanzen“ 2023",
  },
];

export function Lebenshaltung() {
  return (
    <figure
      /* Derselbe dunkle Kasten wie Rechnung und Routenrechner daneben
         — die drei gehören zur selben Stelle und sollen als ein
         Werkzeug gelesen werden. `data-theme="dark"` löst alle Token
         darin auf die dunkle Palette auf. */
      data-theme="dark"
      className="grid gap-6 rounded-(--radius-lg) bg-sunken px-6 py-8 text-ink md:px-8 md:py-10"
    >
      <figcaption className="grid gap-2.5">
        <p className="text-2xs font-semibold uppercase tracking-[0.16em] text-ink-3">
          Amtliche Zahlen · Deutschland
        </p>
        <p className="text-lg font-semibold leading-snug text-ink">
          Viele Ausgaben. Wenig Überblick. Kaum Spielraum.
        </p>
      </figcaption>

      {/*
        Zahl über dem Text, nicht daneben.

        Nebeneinander schnitt „−14.500 €" in den Satz, sobald dieser
        umbrach: Eine Spalte mit `auto` gibt der Zahl so viel Raum, wie
        sie braucht, und dem Text den Rest — bei vier unterschiedlich
        langen Zahlen ergibt das vier unterschiedlich breite
        Textspalten und einen unruhigen Block.

        Untereinander steht jede Zahl gleich, und der Text hat immer
        die volle Breite.
      */}
      <ul className="grid gap-4">
        {BELEGE.map((b) => (
          <li key={b.quelle} className="grid gap-1">
            <span className="font-mono text-lg font-bold tabular-nums text-accent-text sm:text-xl">
              {b.zahl}
            </span>
            <span className="grid min-w-0 gap-0.5">
              <span className="text-sm leading-snug text-ink break-words">{b.text}</span>
              <span className="text-2xs text-ink-3 break-words">{b.quelle}</span>
            </span>
          </li>
        ))}
      </ul>

      {/*
        Die Grenze der Aussage gehört dazu.

        Die Quellen zeigen hohe Kosten und wenig Befassung mit den
        eigenen Finanzen. Dass Menschen ihr verfügbares Einkommen
        falsch einschätzen, zeigen sie nicht — das wäre die bequemere
        Behauptung.
      */}
      <p className="border-t border-line pt-4 text-2xs leading-relaxed text-ink-3">
        Die Zahlen belegen hohe Lebenshaltungskosten und eine geringe regelmässige Befassung mit
        den eigenen Finanzen. Dass Menschen ihr verfügbares Einkommen falsch einschätzen, belegen
        sie nicht.
      </p>
    </figure>
  );
}
