import { getDb, schema, withSystem } from "@paycheck/db";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { brauchtUebersetzung, type Sprache } from "@paycheck/domain";
import { route, selectProvider } from "@paycheck/ai";

/**
 * Eine Anzeige in der Sprache der Oberfläche.
 *
 * ── Warum überhaupt ───────────────────────────────────────────
 *
 * Gemessen an 400 zufälligen deutschen Stellen: 15 sind englisch
 * geschrieben — hochgerechnet rund 31.000 Anzeigen, die in einer
 * deutschen Oberfläche englisch dastehen. Für jemanden, der kein
 * Englisch liest, ist das keine Stelle, sondern eine Wand.
 *
 * ── Warum gespeichert ─────────────────────────────────────────
 *
 * Bei jedem Aufruf neu zu übersetzen kostet bei jedem Leser dasselbe
 * Geld für dasselbe Ergebnis — und wäre nicht reproduzierbar: Zwei
 * Menschen sähen zwei verschiedene Fassungen derselben Anzeige.
 *
 * ── Was nicht übersetzt wird ──────────────────────────────────
 *
 * Firmennamen, Produktnamen, Rechtsformen. „Quantum-Systems GmbH"
 * bleibt „Quantum-Systems GmbH"; eine übersetzte Firma findet niemand
 * wieder, und im Zweifel ist sie eine andere.
 *
 * Und nichts, dessen Sprache nicht sicher erkannt wurde. Eine deutsche
 * Anzeige durch die Übersetzung zu schicken kostet Geld und macht sie
 * schlechter.
 */

const UebersetzungSchema = z.object({
  titel: z.string(),
  beschreibung: z.string(),
});

const SYSTEM = `Du übersetzt Stellenanzeigen. Übersetze vollständig und wörtlich in die Zielsprache.

Regeln:
- Firmennamen, Produktnamen, Marken und Rechtsformen (GmbH, AG, Ltd., Inc.) bleiben unverändert.
- Programmiersprachen, Werkzeuge und Zertifikatsnamen bleiben unverändert.
- Zahlen, Beträge, Währungen und Daten bleiben unverändert.
- Die Gliederung bleibt erhalten: Absätze, Aufzählungen und Überschriften an derselben Stelle.
- Nichts hinzufügen, nichts weglassen, nichts zusammenfassen.
- Keine Anmerkung, keine Einleitung — nur der übersetzte Text.`;

export interface Uebersetzt {
  titel: string;
  beschreibung: string;
  /** Die Sprache, aus der übersetzt wurde. */
  ausSprache: string;
}

/**
 * Die übersetzte Fassung — NUR aus dem Speicher.
 *
 * ── Warum getrennt vom Erzeugen ───────────────────────────────
 *
 * Zuerst stand beides in einer Funktion: nachsehen, und wenn nichts da
 * ist, übersetzen. Gemessen im Browser: Die Stellenseite lud danach
 * über zwei Minuten und brach ab. Ein Modellaufruf im Renderpfad hält
 * die ganze Seite an, und zwar für jeden, der sie öffnet.
 *
 * Jetzt: Beim Aufbau wird nur nachgeschlagen — ein Nachschlag über
 * einen Primärschlüssel. Das Erzeugen läuft danach, ausserhalb der
 * Antwort. Der erste Besucher sieht das Original, der nächste die
 * Übersetzung.
 *
 * `null` heisst: nicht nötig, nicht vorhanden oder nicht möglich. Die
 * Oberfläche zeigt dann das Original ohne Hinweis.
 */
export async function uebersetzungAusSpeicher(
  job: { id: string; originalLanguage: string | null },
  zielsprache: string,
): Promise<Uebersetzt | null> {
  const erkannt = (job.originalLanguage ?? "unbekannt") as Sprache;
  if (!brauchtUebersetzung(erkannt, zielsprache)) return null;

  const ziel = zielsprache.slice(0, 2).toLowerCase();
  const db = await getDb();
  const [vorhanden] = await withSystem(db, (tx) =>
    tx
      .select()
      .from(schema.jobUebersetzungen)
      .where(
        and(eq(schema.jobUebersetzungen.jobId, job.id), eq(schema.jobUebersetzungen.sprache, ziel)),
      )
      .limit(1),
  ).catch(() => []);

  if (!vorhanden) return null;
  return { titel: vorhanden.titel, beschreibung: vorhanden.beschreibung, ausSprache: erkannt };
}

/**
 * Die Übersetzung erzeugen und speichern.
 *
 * Läuft NACH der Antwort — siehe `uebersetzungAusSpeicher`. Steht
 * schon eine da, passiert nichts.
 */
export async function uebersetzungErzeugen(
  job: { id: string; title: string; description: string; originalLanguage: string | null },
  zielsprache: string,
): Promise<void> {
  const erkannt = (job.originalLanguage ?? "unbekannt") as Sprache;
  if (!brauchtUebersetzung(erkannt, zielsprache)) return;

  const ziel = zielsprache.slice(0, 2).toLowerCase();
  const db = await getDb();

  const [vorhanden] = await withSystem(db, (tx) =>
    tx
      .select()
      .from(schema.jobUebersetzungen)
      .where(
        and(eq(schema.jobUebersetzungen.jobId, job.id), eq(schema.jobUebersetzungen.sprache, ziel)),
      )
      .limit(1),
  ).catch(() => []);

  if (vorhanden) return;

  /*
   * Sehr lange Anzeigen werden nicht übersetzt.
   *
   * Über zwölftausend Zeichen wird der Aufruf teuer und das Ergebnis
   * unzuverlässig — Modelle kürzen dann still. Eine halb übersetzte
   * Anzeige ist schlechter als eine unübersetzte, weil man ihr nicht
   * ansieht, wo sie aufhört.
   */
  if (job.description.length > 12_000) return;

  const routing = route("job_normalisation");

  try {
    /*
     * Der Anbieter wird INNERHALB des `try` geholt.
     *
     * Diese Zeile stand darüber, und damit war der Vorsatz im
     * `catch` — „ein Fehlschlag ist kein Grund, die Seite zu
     * verweigern" — für den häufigsten Fehlschlag ausser Kraft:
     * `selectProvider()` wirft, wenn kein Anbieter eingerichtet oder
     * erreichbar ist, und die Stellendetailseite antwortete dann mit
     * 500 statt mit der Anzeige im Original.
     *
     * Auffallen konnte das nie, solange ein Anbieter lief. Es hätte
     * sich an dem Tag gezeigt, an dem ohnehin schon etwas kaputt ist.
     */
    const provider = await selectProvider();

    const ergebnis = await provider.structuredGenerate({
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `ZIELSPRACHE: ${ziel === "de" ? "Deutsch" : "Englisch"}\n\nTITEL: ${job.title}\n\nBESCHREIBUNG:\n${job.description}`,
        },
      ],
      schema: UebersetzungSchema,
      schemaName: "job_uebersetzung",
      tier: routing.providerTier,
    });

    const titel = ergebnis.data.titel.trim() || job.title;
    const beschreibung = ergebnis.data.beschreibung.trim();
    /*
     * Eine auffällig kürzere Übersetzung wird verworfen.
     *
     * Unter der Hälfte der Originallänge hat das Modell
     * zusammengefasst statt übersetzt — und eine Zusammenfassung, die
     * als Anzeige durchgeht, verschweigt Bedingungen.
     */
    if (beschreibung.length < job.description.length * 0.5) return;

    await withSystem(db, (tx) =>
      tx
        .insert(schema.jobUebersetzungen)
        .values({
          jobId: job.id,
          sprache: ziel,
          titel,
          beschreibung,
          modell: routing.providerTier,
        })
        .onConflictDoNothing(),
    ).catch(() => undefined);

  } catch (fehler) {
    /*
     * Ein Fehlschlag ist kein Grund, die Seite zu verweigern. Die
     * Anzeige steht dann im Original da — lesbar für den, der die
     * Sprache kann, und für die anderen so wie bisher.
     */
    console.error("[uebersetzung] fehlgeschlagen:", fehler);
  }
}
