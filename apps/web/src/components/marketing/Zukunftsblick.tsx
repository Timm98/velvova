import { isNotNull, sql } from "drizzle-orm";
import { brand } from "@paycheck/config";
import { getDb, schema } from "@paycheck/db";
import { Berufsszenario, type Szenario } from "./Berufsszenario";

/**
 * Wie es mit einem Beruf weitergeht — als Verteilung.
 *
 * ── Warum das hier steht ──────────────────────────────────────
 *
 * An dieser Stelle stand „Nina sucht nicht nach Schlagwörtern" mit
 * einer Liste aus Häkchen. Das beschrieb eine Technik. Was einen
 * Menschen bei der Berufswahl tatsächlich umtreibt, ist die Frage, ob
 * es den Beruf in zehn Jahren noch gibt.
 *
 * ── Warum die Quelle im Bild steht ────────────────────────────
 *
 * Die Bewertung ist eine *Einschätzung*, keine Messung — abgeleitet
 * aus WEF Future of Jobs, US BLS Employment Projections, Stanford,
 * ILO und zwei Fachaufsätzen. Sie so darzustellen, als hätte jemand
 * die Zukunft gezählt, wäre die bequemste und falscheste Variante.
 * Deshalb steht unter dem Diagramm, was sie ist und woraus sie kommt.
 */
export async function Zukunftsblick() {
  const db = await getDb();

  /*
   * Nach Hauptgruppe UND Stufe, nicht nur nach Stufe.
   *
   * Vorher stand hier eine Verteilung über alle 436 Berufsgruppen.
   * Sie ist richtig, aber sie beantwortet niemandes Frage: „58 %
   * voraussichtlich stabil" heisst für eine Pflegekraft etwas anderes
   * als für eine Sachbearbeiterin. Mit der Hauptgruppe dazu lässt
   * sich beides zeigen — das Ganze und die eigene Ecke darin.
   *
   * Eine Abfrage statt elf: Zehn Hauptgruppen mal fünf Stufen sind
   * fünfzig Zeilen, und die zu gruppieren kostet die Datenbank
   * nichts. Elf einzelne Abfragen wären elf Umläufe für dieselbe
   * Auskunft.
   */
  const zeilen = (await db
    .select({
      nummer: schema.iscoBerufe.hauptgruppeNummer,
      name: schema.iscoBerufe.hauptgruppe,
      stufe: schema.iscoBerufe.zukunftssicherheit,
      anzahl: sql<number>`count(*)::int`,
    })
    .from(schema.iscoBerufe)
    .where(isNotNull(schema.iscoBerufe.zukunftssicherheit))
    .groupBy(
      schema.iscoBerufe.hauptgruppeNummer,
      schema.iscoBerufe.hauptgruppe,
      schema.iscoBerufe.zukunftssicherheit,
    )
    .catch(() => [])) as { nummer: number; name: string; stufe: number | null; anzahl: number }[];

  if (zeilen.length === 0) return null;

  /**
   * Aus einer Menge Zeilen die drei Anteile machen.
   *
   * Gerundet wird erst am Schluss und nur einmal: Wer je Stufe rundet
   * und dann addiert, landet regelmässig bei 99 oder 101 Prozent —
   * und ein gestapelter Balken, der nicht ganz voll wird, sieht aus
   * wie ein Fehler.
   */
  const verteilung = (menge: typeof zeilen) => {
    const gesamt = menge.reduce((a, z) => a + z.anzahl, 0);
    if (gesamt === 0) return null;
    const anteil = (von: number, bis: number) =>
      Math.round(
        (menge
          .filter((z) => (z.stufe ?? 0) >= von && (z.stufe ?? 0) <= bis)
          .reduce((a, z) => a + z.anzahl, 0) /
          gesamt) *
          100,
      );
    return {
      gesamt,
      anteile: [
        { name: "Stark unter Druck", anteil: anteil(1, 2), ton: "bg-critical" },
        { name: "Im Wandel", anteil: anteil(3, 3), ton: "bg-caution" },
        { name: "Voraussichtlich stabil", anteil: anteil(4, 5), ton: "bg-positive" },
      ],
    };
  };

  const alle = verteilung(zeilen);
  if (!alle) return null;

  /*
   * Das Ganze zuerst, dann die Hauptgruppen der Reihe nach.
   *
   * Nach ISCO-Nummer sortiert und nicht nach Auffälligkeit: Eine
   * Reihenfolge, die mit der dramatischsten Gruppe beginnt, ist eine
   * Aussage über die Auswahl, keine über die Daten.
   */
  const nummern = [...new Set(zeilen.map((z) => z.nummer))].sort((a, b) => a - b);
  const szenarien: Szenario[] = [
    { name: "Alle Berufsgruppen", gruppen: alle.gesamt, anteile: alle.anteile },
  ];
  for (const n of nummern) {
    const menge = zeilen.filter((z) => z.nummer === n);
    const v = verteilung(menge);
    if (!v) continue;
    szenarien.push({ name: menge[0]!.name, gruppen: v.gesamt, anteile: v.anteile });
  }

  /*
   * Die Belege zur KI-Betroffenheit.
   *
   * Fest eingetragen, weil veröffentlichte Studien sich nicht ändern.
   * Jede Zeile nennt Zahl, Bezug und Herausgeber — eine Zahl ohne
   * Bezugsgrösse ist keine Auskunft, sondern eine Behauptung mit
   * Nachkommastelle.
   *
   * Die Auswahl ist bewusst die vorsichtige: Frey/Osborne mit ihren
   * viel zitierten 47 Prozent stehen nicht dabei. Die Untersuchung
   * stammt aus der Zeit vor generativer KI und misst
   * Automatisierbarkeit insgesamt — sie würde die Aussage dramatischer
   * machen und schwächer belegen.
   */
  const belege = [
    {
      zahl: "80 %",
      text: "der US-Beschäftigten könnten bei mindestens 10 % ihrer Aufgaben betroffen sein",
      quelle: "OpenAI / University of Pennsylvania, 2023",
    },
    {
      zahl: "19 %",
      text: "könnten bei mindestens der Hälfte ihrer Tätigkeiten betroffen sein",
      quelle: "OpenAI / University of Pennsylvania, 2023",
    },
    {
      zahl: "60 %",
      text: "der Beschäftigten in entwickelten Volkswirtschaften arbeiten in Berufen mit hoher KI-Exposition",
      quelle: "Internationaler Währungsfonds, 2024",
    },
    {
      zahl: "34 %",
      text: "der Arbeitsplätze in Ländern mit hohem Einkommen weisen eine GenAI-Exposition auf",
      quelle: "ILO und NASK, 2025",
    },
  ];

  return (
    <figure className="grid gap-6 rounded-(--radius-lg) border border-line bg-[rgb(from_var(--color-ink)_r_g_b_/_0.04)] px-6 py-8 md:px-8 md:py-10">
      <figcaption className="grid gap-2.5">
        <p className="text-2xs font-semibold uppercase tracking-[0.16em] text-ink-3">
          Was die Forschung sagt
        </p>
        <p className="text-lg font-semibold leading-snug text-ink">
          KI verändert fast jeden Beruf
        </p>
        {/*
          Die Einschränkung steht direkt unter der Aussage, nicht in
          einer Fussnote.

          „Betroffen" heisst in allen zitierten Untersuchungen: Ein
          Teil der Tätigkeiten lässt sich automatisieren oder
          unterstützen. Es heisst nicht, dass der Beruf verschwindet —
          und die meisten Studien unterscheiden das ausdrücklich. Wer
          die Zahl ohne diesen Satz zeigt, macht aus einer Prognose
          über Aufgaben eine über Existenzen.
        */}
        <p className="text-sm leading-relaxed text-ink-2">
          Betroffenheit bedeutet nicht den Wegfall eines Arbeitsplatzes. Die Untersuchungen
          unterscheiden zwischen einzelnen automatisierbaren Aufgaben und dem Verschwinden eines
          Berufs — das Zweite belegen sie nicht.
        </p>
      </figcaption>

      <ul className="grid gap-4">
        {belege.map((b) => (
          /*
            Feste Spaltenbreite statt `auto`.

            Mit `auto` bekam jede Zeile die Breite ihrer eigenen Zahl —
            „80 %" ist schmaler als „19 %" gesetzt wird, und der Text
            daneben begann in jeder Zeile ein paar Pixel woanders. Vier
            linke Kanten, die fast fluchten, lesen sich schlechter als
            vier, die es gar nicht versuchen.

            Und die Zahl ist kleiner: Bei 2xl neben 14-Pixel-Text sass
            sie eine halbe Zeile höher als der Satz, zu dem sie gehört.
            Auf gleicher Grundlinie und in ähnlicher Grösse liest man
            beides als eine Zeile.
          */
          <li key={`${b.zahl}-${b.quelle}`} className="grid grid-cols-[3.75rem_minmax(0,1fr)] items-baseline gap-x-4">
            <span className="text-right font-mono text-lg font-bold tabular-nums text-accent-text">
              {b.zahl}
            </span>
            <span className="grid min-w-0 gap-0.5">
              <span className="text-sm leading-snug text-ink break-words">{b.text}</span>
              <span className="text-2xs text-ink-3 break-words">{b.quelle}</span>
            </span>
          </li>
        ))}
      </ul>

      <p className="border-t border-line pt-4 text-2xs font-semibold uppercase tracking-[0.16em] text-ink-3">
        Und was das für einzelne Berufe heisst
      </p>

      <Berufsszenario szenarien={szenarien} />

      <p className="border-t border-line pt-4 text-2xs leading-relaxed text-ink-3">
        Einschätzung, keine Messung: abgeleitet aus WEF Future of Jobs 2025, US BLS Employment
        Projections 2024–2034, Stanford „Canaries in the Coal Mine", ILO GenAI-Index sowie Eloundou
        et al. (2023) und Felten AIOE. {brand.assistantName} nennt sie bei jeder Stelle mitsamt
        dieser Einordnung — nicht als Prognose, sondern als das, was die Forschung derzeit
        nahelegt.
      </p>
    </figure>
  );
}
