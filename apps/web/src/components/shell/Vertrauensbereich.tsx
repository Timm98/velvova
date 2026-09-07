import { Check, ShieldCheck } from "lucide-react";

/**
 * Wofür Monday gebaut wird.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum hier die Vision steht und nicht eine Merkmalsliste
 * ══════════════════════════════════════════════════════════════
 *
 * Vorher standen hier fünf Produktmerkmale — Gehaltsherkunft,
 * Arbeitsprobe, Pendelrechner, Unsicherheitskennzeichnung. Alle wahr,
 * alle prüfbar, und zusammen beantworteten sie die Frage „was kann
 * das Ding" statt „warum gibt es das".
 *
 * Der Unterschied zu einer Stellenbörse liegt nicht in einzelnen
 * Funktionen. Er liegt darin, dass die Suche nicht aufhört, wenn man
 * den Browser schliesst, und dass niemand erfährt, wer man ist, bevor
 * man es selbst freigibt. Das sind zwei Sätze, und sie tragen mehr
 * als fünf Merkmale.
 *
 * ── Was hier nicht stehen darf ────────────────────────────────
 *
 * Nichts, was das Produkt noch nicht tut. Die Punkte unten sind
 * bewusst so formuliert, dass sie das beschreiben, was gebaut ist
 * oder gerade gebaut wird — nicht den Endausbau. Ein Versprechen auf
 * dieser Seite ist beim ersten Öffnen der Anwendung überprüfbar.
 *
 * ── Warum kein Bild ───────────────────────────────────────────
 *
 * Die Vorgabe wünscht rechts ein echtes Arbeitsbild aus der eigenen
 * Bibliothek. Die vorhandenen Motive sind abstrakte Berufsgrafiken
 * ohne Menschen — als grosse Fläche daneben sähen sie dekorativ aus,
 * und ein Stockfoto ist ausgeschlossen. Bis es ein passendes Motiv
 * gibt, steht rechts, worauf die Sätze beruhen.
 *
 * TODO: Wenn ein echtes Arbeitsbild vorliegt, tritt es an die Stelle
 * der rechten Spalte.
 */
const PUNKTE = [
  "Monday sucht weiter, wenn du nicht suchst — und zeigt dir morgens nur das, was wirklich zu dir passt.",
  "Jede Empfehlung wird erklärt: was passt, was noch offen ist und was dagegen spricht.",
  "Du bleibst anonym. Wer du bist, erfährt ein Unternehmen erst, wenn beide Seiten zugestimmt haben.",
  "Monday erkennt auch Chancen, die es als Anzeige noch gar nicht gibt.",
  "Sie merkt sich, was du abgelehnt hast, und fragt nicht zweimal dasselbe.",
];

/*
 * Der Satz, der die Grenze zieht.
 *
 * Er steht hervorgehoben und nicht in der Liste, weil er kein
 * Merkmal ist, sondern die Bedingung, unter der alle anderen gelten.
 */
const GRENZE =
  "Monday darf suchen, vergleichen und vorbereiten. Was sie veröffentlichen, " +
  "versenden oder verbindlich entscheiden darf, bestimmst immer du.";

const GRUNDLAGEN = [
  ["2,5 Mio.", "Stellen im Bestand, aus 28 Quellen"],
  ["82 %", "der deutschen Stellen mit Gehaltsorientierung"],
  ["436", "Berufsgruppen mit Zukunftseinschätzung"],
  ["33", "Berufsfelder mit einer Arbeitsprobe"],
] as const;

export function Vertrauensbereich() {
  return (
    <section aria-labelledby="vertrauen" className="grid gap-8 lg:grid-cols-2 lg:gap-12">
      <div className="grid content-start gap-5">
        <h2 id="vertrauen" className="max-w-[20ch] text-2xl font-semibold leading-tight text-ink">
          Andere zeigen dir Stellen. Monday arbeitet weiter.
        </h2>

        <p className="max-w-[var(--measure)] text-[15px] leading-relaxed text-ink-2">
          Bei einer Stellenbörse musst du immer wieder selbst suchen. Hier erklärst
          du einmal, was du kannst und erreichen willst — und Monday prüft von da an
          weiter, was sich verändert.
        </p>

        <ul className="grid gap-3">
          {PUNKTE.map((p) => (
            <li key={p} className="flex gap-3">
              <Check className="mt-1 size-4 shrink-0 text-accent" strokeWidth={2.2} />
              <span className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">{p}</span>
            </li>
          ))}
        </ul>

        <p className="flex max-w-[var(--measure)] gap-3 rounded-(--radius-md) border border-line bg-sunken px-4 py-3">
          <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-positive" />
          <span className="text-sm leading-relaxed text-ink">{GRENZE}</span>
        </p>
      </div>

      <div className="grid content-start gap-3 rounded-(--radius-lg) border border-line bg-raised p-7">
        <h3 className="abschnitts-titel text-ink-3">
          Worauf das beruht
        </h3>
        <dl className="grid gap-4">
          {GRUNDLAGEN.map(([zahl, was]) => (
            <div key={was} className="grid gap-0.5">
              <dt className="text-xl font-semibold tabular text-ink">{zahl}</dt>
              <dd className="text-sm leading-relaxed text-ink-2">{was}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
