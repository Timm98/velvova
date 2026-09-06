import { getDb } from "@paycheck/db";
import { Balken } from "./Balken";
import { sql } from "drizzle-orm";

/**
 * Ein Balkendiagramm aus dem eigenen Bestand.
 *
 * ── Zwei Hälften, beide belegt ────────────────────────────────
 *
 * Oben eine echte Studie mit Auftraggeber, Institut, Stichprobe und
 * Zeitraum — nachschlagbar, verlinkt. Unten unsere eigenen Messwerte
 * mit genannter Grundgesamtheit und Datum, über die Suche nachzählbar.
 *
 * Zusammen ergeben sie das Argument: Die eine Hälfte zeigt, dass
 * Menschen bei der Berufswahl den Überblick verlieren. Die andere
 * zeigt, woran das im Bestand tatsächlich liegt.
 *
 * Keine der Zahlen ist geschätzt, gerundet oder ausgedacht. An der
 * Stelle, an der jemand nach Belegen sucht, wäre genau das der
 * teuerste Fehler.
 *
 * ── Warum die Zahlen vorberechnet kommen ──────────────────────
 *
 * `count(*) filter (...)` über 2,5 Mio. Zeilen dauert Minuten. Die
 * Werte stehen deshalb in `bestandsbefund`, das der Pflegelauf
 * stündlich schreibt. Fehlt die Tabelle oder ist sie leer, erscheint
 * der Abschnitt nicht — lieber kein Diagramm als ein leeres.
 */

type Balken = { label: string; anteil: number; erlaeuterung: string };

export async function Befund() {
  const db = await getDb();
  const ergebnis = (await db
    .execute(sql`select * from bestandsbefund order by gemessen_am desc limit 1`)
    .catch(() => ({ rows: [] }))) as {
    rows?: { grundgesamtheit?: number; ohne_gehalt?: number; alt?: number; ohne_kennung?: number; gemessen_am?: Date }[];
  };
  const roh = ergebnis.rows?.[0];
  if (!roh?.grundgesamtheit) return null;

  /*
   * Zahlen aus `db.execute` kommen als Zeichenketten zurück, wenn die
   * Spalte `bigint` ist — der Treiber gibt sie so weiter, weil ein
   * bigint nicht in eine JavaScript-Zahl passen muss.
   *
   * Ohne diese Umwandlung stand in der Quellenangabe „1022172" statt
   * „1.022.172": `toLocaleString` auf einer Zeichenkette gibt die
   * Zeichenkette zurück, ohne zu formatieren und ohne zu meckern.
   */
  const b = {
    grundgesamtheit: Number(roh.grundgesamtheit),
    ohne_gehalt: Number(roh.ohne_gehalt ?? 0),
    alt: Number(roh.alt ?? 0),
    ohne_kennung: Number(roh.ohne_kennung ?? 0),
    gemessen_am: roh.gemessen_am,
  };

  const anteil = (n?: number) => Math.round(((n ?? 0) / b.grundgesamtheit!) * 1000) / 10;

  /*
   * Die Studie.
   *
   * Bertelsmann Stiftung, erhoben von iconkids & youth: 1.666
   * Jugendliche zwischen 14 und 20, befragt vom 28. Januar bis
   * 6. März 2022 in persönlichen Interviews.
   *
   * Fest eingetragen und nicht aus einer Datenbank: Eine
   * veröffentlichte Studie ändert sich nicht. Was sich ändert, sind
   * unsere eigenen Zahlen — die stehen unten und kommen aus dem
   * Bestand.
   */
  const studie: Balken[] = [
    {
      label: "unklar, welche Richtung überhaupt",
      anteil: 38,
      erlaeuterung:
        "Die am häufigsten genannte grössere Schwierigkeit — vor zu geringer Vergütung und fehlenden Rückmeldungen mit je 34 %.",
    },
    {
      label: "genug Informationen, aber unübersichtlich",
      anteil: 51,
      erlaeuterung: "Das Problem ist nicht der Mangel an Auskunft, sondern die fehlende Ordnung darin.",
    },
    {
      label: "beruflich unklar orientiert (OECD, 15-Jährige)",
      anteil: 39,
      erlaeuterung: "Im OECD-Durchschnitt aus PISA 2022 — die Frage nach dem Beruf mit etwa 30.",
    },
  ];

  const balken: Balken[] = [
    {
      label: "Ohne Gehaltsangabe",
      anteil: anteil(b.ohne_gehalt),
      erlaeuterung: "Man bewirbt sich, ohne zu wissen, worüber man verhandelt.",
    },
    {
      label: "Älter als ein halbes Jahr",
      anteil: anteil(b.alt),
      erlaeuterung: "Die Stelle steht noch online — besetzt ist sie womöglich längst.",
    },
    {
      label: "Ohne amtliche Berufskennung",
      anteil: anteil(b.ohne_kennung),
      erlaeuterung: "Ohne sie lässt sich nicht vergleichen, was vergleichbar wäre.",
    },
  ];

  const stand = b.gemessen_am ? new Date(b.gemessen_am) : null;

  return (
    <figure /* Leicht abgesetzte Fläche statt Weiss auf Weiss: Auf dem hellen
         Seitengrund verschwand die Karte, und das Diagramm sah aus wie
         Text, der zufällig eingerückt ist. */
      className="grid gap-6 rounded-(--radius-lg) border border-line bg-[rgb(from_var(--color-ink)_r_g_b_/_0.04)] px-6 py-8 md:px-8 md:py-10">
      <figcaption className="grid gap-2">
        <p className="text-2xs font-semibold uppercase tracking-[0.16em] text-ink-3">
          Studien · Bertelsmann 2025 · OECD 2025
        </p>
        <p className="text-base font-semibold leading-snug text-ink">
Die grösste Hürde ist nicht die Bewerbung — es ist die Richtung
        </p>
      </figcaption>

      <ul className="grid gap-5">
        {studie.map((k) => (
          <Balken
            key={k.label}
            anteil={k.anteil}
            beschriftung={k.label}
            erlaeuterung={k.erlaeuterung}
          />
        ))}
      </ul>

      <p className="border-t border-line pt-4 text-2xs leading-relaxed text-ink-3">
        Bertelsmann Stiftung, „Ausbildungsperspektiven 2025": 1.755 Befragte zwischen 14 und 25
        Jahren, ausgewertet für 1.101 mit Sucherfahrung. OECD, „The State of Global Teenage Career
        Preparation" 2025, auf Grundlage von PISA 2022.
        <br />
        {/*
          Die Grenze gehört unter die Zahlen, nicht ins Kleingedruckte.

          Gemessen wurde berufliche Unklarheit bei jungen Menschen —
          nicht, dass Jobsuchende allgemein ihre Fähigkeiten nicht
          kennen. Diese zweite, weiter gehende Aussage wäre bequemer
          und ist durch die Quellen nicht gedeckt. Wer eine Studie
          zitiert, zitiert auch ihren Geltungsbereich.
        */}
        <span className="mt-1.5 inline-block">
          Erhoben unter jungen Menschen beim Berufseinstieg. Auf Jobsuchende insgesamt lassen sich
          die Anteile nicht übertragen.
        </span>
      </p>

      <p className="text-2xs font-semibold uppercase tracking-[0.16em] text-ink-3">
        Und woran es im Bestand liegt
      </p>

      <ul className="grid gap-5">
        {balken.map((k) => (
          <Balken
            key={k.label}
            anteil={k.anteil}
            beschriftung={k.label}
            erlaeuterung={k.erlaeuterung}
            nachkomma={1}
          />
        ))}
      </ul>

      <p className="text-2xs leading-relaxed text-ink-3">
        Grundgesamtheit: {b.grundgesamtheit.toLocaleString("de-DE")} deutsche Stellenanzeigen
        {stand ? `, Stand ${stand.toLocaleDateString("de-DE")}` : ""}. Jede Zahl lässt sich über
        die Suche nachzählen.
      </p>
    </figure>
  );
}
