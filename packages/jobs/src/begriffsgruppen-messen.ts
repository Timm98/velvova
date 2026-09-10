import { sql } from "drizzle-orm";
import { getDb, withSystem } from "@paycheck/db";
import { gruppenlage, type Gruppenlage, type Gruppenzaehlung } from "@paycheck/domain";

/**
 * ══════════════════════════════════════════════════════════════════
 * Welche Berufsgruppen ein Suchbegriff trägt — aus dem Bestand
 * ══════════════════════════════════════════════════════════════════
 *
 * Gemessen, nicht gepflegt. Es gibt keine Tabelle, in der steht, dass
 * „Lager" zu Verkehr und Logistik gehört; es steht in 928.242
 * Anzeigen mit Berufskennung, und man muss nur die richtigen zählen.
 *
 * ── Warum nur der Titel zählt ───────────────────────────────────
 *
 * Der Titel ist die Aussage des Arbeitgebers darüber, was die Rolle
 * ist. Der Fliesstext ist alles, was sonst noch dazugehört — in
 * „Sachbearbeiter Debitorenbuchhaltung" steht „Lager", weil das
 * Unternehmen eines hat.
 *
 * Genau daran hing der Fehler, den diese Datei behebt: Elf von
 * sechzehn Treffern für sieben Menschen, die „Lager, Logistik"
 * suchten, kamen über den Fliesstext herein.
 *
 * ── Warum am Wortanfang ─────────────────────────────────────────
 *
 * `like '%lager%'` findet „Verlagerung" und „Schlagermusik". Dieselbe
 * Regel wie in der Vorauswahl, aus demselben Grund — und derselbe
 * Fehler, den ich heute im Fähigkeitskatalog schon einmal gemacht
 * habe.
 *
 * ── Warum zwischengespeichert ───────────────────────────────────
 *
 * Ein Nachtlauf hat wenige verschiedene Suchbegriffe und Tausende
 * Anzeigen. Die Zählung je Begriff einmal zu machen statt je Stelle
 * ist der Unterschied zwischen einer Abfrage und Tausenden.
 *
 * ── Warum eine Stichprobe und keine Vollzählung ─────────────────
 *
 * Die erste Fassung zählte alle 1,24 Millionen deutschen Anzeigen.
 * `' ' || lower(title) like '% lager%'` kann keinen Index benutzen,
 * also las die Datenbank die ganze Tabelle — gemessen am 10.09.2026
 * lief die Abfrage in die Zeitgrenze und lieferte nach 600 Sekunden
 * gar nichts. Genau der Defekt, vor dem CLAUDE.md unter
 * „Vollzählung" warnt.
 *
 * `tablesample system (2)` liest zwei Prozent der Datenseiten. Am
 * selben Tag gemessen:
 *
 *   lager      6,6 s   663 Titeltreffer   51 zu 90 %
 *   logistik  10,8 s   151 Titeltreffer   51 zu 78 %
 *   pflege    10,3 s   636 Titeltreffer   81 zu 46 %, 82 zu 45 %
 *
 * Alle drei liegen weit über `MINDESTSTICHPROBE`. Zehn Prozent
 * dauerten vier- bis sechsmal so lange und änderten an der Rangfolge
 * der Gruppen nichts.
 *
 * ── Was diese Stichprobe NICHT ist ──────────────────────────────
 *
 * Sie ist keine Zufallsauswahl über Zeilen, sondern über Seiten. Wer
 * dieselben Anzeigen am selben Tag eingelesen hat, liegt oft auf
 * denselben Seiten — die Auswahl ist also mit Quelle und Ladezeit
 * korreliert. Für die Frage „welche Berufsgruppen tragen dieses
 * Wort" ist das tragbar, weil die Verteilung eindeutig ist; für eine
 * Aussage über Anteile im Bestand wäre sie es nicht.
 *
 * ── Warum eine eigene Zeitgrenze ────────────────────────────────
 *
 * Ein seltener Begriff trifft in der Stichprobe wenig, und die
 * Datenbank liest trotzdem alle gezogenen Seiten. Nach zwanzig
 * Sekunden bricht sie ab, die Lage fällt auf „nicht belastbar", und
 * die Stellen werden nicht abgewertet. Ein Nachtlauf darf an einer
 * Messung nicht hängen bleiben.
 */

/** Anteil der Datenseiten, den die Zählung liest. */
const STICHPROBE_PROZENT = 2;

/** Nach so vielen Sekunden ist die Messung es nicht mehr wert. */
const ZEITGRENZE_SEKUNDEN = 20;

const speicher = new Map<string, Gruppenlage>();

/** Nur für Tests: den Zwischenspeicher leeren. */
export function speicherLeeren(): void {
  speicher.clear();
}

/**
 * Die Gruppenlage zu einem Suchbegriff.
 *
 * Fällt bei einem Fehler auf „nicht belastbar" zurück statt zu
 * werfen: Eine fehlende Messung darf keine Stelle abwerten, und der
 * ganze Nachtlauf soll daran nicht scheitern.
 */
export async function lageFuerBegriff(begriff: string): Promise<Gruppenlage> {
  const schluessel = begriff.trim().toLowerCase();
  const vorhanden = speicher.get(schluessel);
  if (vorhanden) return vorhanden;

  let lage: Gruppenlage = { tragend: [], stichprobe: 0, belastbar: false };
  try {
    const db = await getDb();
    const ergebnis = (await withSystem(db, async (tx) => {
      await tx.execute(sql.raw(`set local statement_timeout = '${ZEITGRENZE_SEKUNDEN}s'`));
      return tx.execute(sql`
        select left(kldb, 2) as gruppe, count(*)::int as titeltreffer
        from jobs tablesample system (${sql.raw(String(STICHPROBE_PROZENT))})
        where is_demo = false
          and country = 'DE'
          and kldb is not null
          and ' ' || lower(title) like ${`% ${schluessel}%`}
        group by 1
        order by 2 desc
        limit 20`);
    })) as unknown as { rows: Gruppenzaehlung[] };
    lage = gruppenlage(ergebnis.rows);
  } catch (fehler) {
    console.error(
      "[begriffsgruppen] nicht gemessen:",
      fehler instanceof Error ? fehler.message : fehler,
    );
  }

  speicher.set(schluessel, lage);
  return lage;
}

/**
 * Die Gruppenlage für mehrere Begriffe zusammengefasst.
 *
 * Wer „Lager" ODER „Logistik" sucht, meint beides — die tragenden
 * Gruppen sind die Vereinigung, nicht der Schnitt. Ein Schnitt würde
 * genau die Stellen ausschliessen, die nur zu einem der Begriffe
 * gehören, und das ist der häufigere Fall.
 */
export async function lageFuerBegriffe(begriffe: readonly string[]): Promise<Gruppenlage> {
  const einzeln = await Promise.all(begriffe.map((b) => lageFuerBegriff(b)));
  const belastbare = einzeln.filter((l) => l.belastbar);
  if (belastbare.length === 0) return { tragend: [], stichprobe: 0, belastbar: false };
  return {
    tragend: [...new Set(belastbare.flatMap((l) => l.tragend))],
    stichprobe: belastbare.reduce((a, l) => a + l.stichprobe, 0),
    belastbar: true,
  };
}
