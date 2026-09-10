import { getDb, schema, withSystem, withUser } from "@paycheck/db";
import { and, eq, gte, sql } from "drizzle-orm";
import {
  angebotAlsStelle,
  gruppieren,
  kriteriumPruefen,
  zulaessigkeitBestimmen,
  type Angebotszeile,
  type Kriteriumsergebnis,
} from "@paycheck/matching";

/**
 * ══════════════════════════════════════════════════════════════════
 * Angebote gegen die Absicht rechnen
 * ══════════════════════════════════════════════════════════════════
 *
 * Seit heute kann ein Betrieb auf `/business/bedarf` in einem Absatz
 * hinterlegen, wen er sofort nehmen würde — mit verbindlichen
 * Konditionen und einer Frist. Bis eben wurde das geschrieben und von
 * niemandem gelesen.
 *
 * Das ist der Defekt, der in CLAUDE.md als häufigster steht: Ein
 * Feld existiert, ist dokumentiert, und nichts ruft es auf. Diese
 * Datei ruft es auf.
 *
 * ── Warum live und nicht im Nachtlauf ───────────────────────────
 *
 * `auftrag_treffer` verlangt eine `job_id` — ein Angebot hat keine.
 * Es dort abzulegen bräuchte eine Schemaänderung, und die lohnt erst,
 * wenn es genug Angebote gibt, dass die Rechnung im Seitenaufruf
 * teuer wird. Heute sind es wenige, und ein aktueller Wert ist
 * ausserdem richtiger als ein über Nacht eingefrorener: Ein Angebot
 * kann seit dem Nachtlauf abgelaufen sein.
 *
 * Wenn das kippt — messbar daran, dass die Morgenseite spürbar
 * langsamer wird —, gehört es in denselben Lauf wie die Anzeigen.
 * Dann mit `job_id` nullbar und `angebot_id` daneben, nicht mit einer
 * zweiten Trefferkette.
 *
 * ── Warum dieselbe Prüfung ──────────────────────────────────────
 *
 * `kriteriumPruefen` und `zulaessigkeitBestimmen` sind dieselben
 * Funktionen, die über Anzeigen entscheiden. Ein Angebot bekommt
 * keine mildere Prüfung, weil es verbindlich ist — es bekommt nur
 * einen Vorteil, den es sich verdient hat: Sein Gehalt ist zugesagt,
 * und eine Zusage erfüllt ein Muss-Gehalt, wo ein „bis zu" es nicht
 * erfüllt.
 */

export interface Angebotstreffer {
  angebotId: string;
  /** Vor dem Aufdecken ein Umriss, nie ein Name. */
  beschreibung: string;
  rolle: string;
  ort: string | null;
  gehaltVon: number | null;
  gehaltBis: number | null;
  gueltigBis: string;
  /** eligible · needs_clarification · ineligible */
  zulaessigkeit: string;
  /** Welche Muss-Angabe fehlt. Leer heisst: nichts offen. */
  offenePunkte: string[];
}

/**
 * Die Angebote, die zur Absicht dieses Menschen passen.
 *
 * Gibt auch die zurück, bei denen eine Muss-Angabe fehlt — als
 * `needs_clarification`. Eine unbekannte Angabe ist weder erfüllt
 * noch verletzt, und sie wegzuwerfen hiesse, ein verbindliches
 * Angebot zu verschweigen, weil der Betrieb ein Feld nicht ausgefüllt
 * hat.
 */
export async function angebotstreffer(userId: string, grenze = 5): Promise<Angebotstreffer[]> {
  const db = await getDb();

  /* Die Muss-Kriterien der aktiven Profilfassung. */
  const kriterien = await withUser(db, userId, (tx) =>
    tx
      .select({
        id: schema.suchKriterien.id,
        kriterium: schema.suchKriterien.kriterium,
        wert: schema.suchKriterien.wert,
        einheit: schema.suchKriterien.einheit,
        operator: schema.suchKriterien.operator,
        staerke: schema.suchKriterien.staerke,
        gruppe: schema.suchKriterien.gruppe,
      })
      .from(schema.suchKriterien)
      .innerJoin(schema.suchProfile, eq(schema.suchProfile.id, schema.suchKriterien.profilId))
      .where(
        and(
          eq(schema.suchKriterien.userId, userId),
          eq(schema.suchProfile.zustand, "aktiv"),
        ),
      ),
  ).catch(() => []);

  /*
   * Ohne Kriterien keine Aussage.
   *
   * Alle Angebote zu zeigen, weil niemand etwas ausgeschlossen hat,
   * wäre eine Liste ohne Bezug — und sie sähe aus wie ein Ergebnis.
   */
  if (kriterien.length === 0) return [];

  /*
   * Über die Systemverbindung gelesen: Ein Angebot gehört einer
   * Organisation, und der suchende Mensch ist dort kein Mitglied. Die
   * Zeilenrichtlinie liesse ihn deshalb nichts sehen — richtig für
   * das Dashboard, falsch für den Abgleich.
   *
   * Was von hier zurückgeht, ist die anonyme Beschreibung, nie der
   * Name der Firma.
   */
  const angebote = await withSystem(db, (tx) =>
    tx
      .select({
        id: schema.angebote.id,
        rollenprofil: schema.angebote.rollenprofil,
        konditionen: schema.angebote.konditionen,
        anonymBeschreibung: schema.angebote.anonymBeschreibung,
        gueltigBis: schema.angebote.gueltigBis,
      })
      .from(schema.angebote)
      .where(
        and(
          eq(schema.angebote.status, "aktiv"),
          gte(schema.angebote.gueltigBis, sql`current_date`),
        ),
      )
      .limit(200),
  ).catch(() => []);

  const treffer: Angebotstreffer[] = [];
  for (const a of angebote) {
    const zeile: Angebotszeile = {
      rollenprofil: (a.rollenprofil ?? {}) as Angebotszeile["rollenprofil"],
      konditionen: (a.konditionen ?? {}) as Angebotszeile["konditionen"],
      anonymBeschreibung: a.anonymBeschreibung,
    };
    const angaben = angebotAlsStelle(zeile);
    const ergebnisse: Kriteriumsergebnis[] = kriterien.map((k) =>
      kriteriumPruefen(k as never, angaben),
    );
    const befund = zulaessigkeitBestimmen(gruppieren(ergebnisse));

    /* Ein verletztes Muss ist ein verletztes Muss — auch hier. */
    if (befund.zulaessigkeit === "ineligible") continue;

    treffer.push({
      angebotId: a.id,
      beschreibung: a.anonymBeschreibung,
      rolle: zeile.rollenprofil.rolle ?? "",
      ort: zeile.konditionen.ort ?? null,
      gehaltVon: zeile.konditionen.gehaltVon ?? null,
      gehaltBis: zeile.konditionen.gehaltBis ?? null,
      gueltigBis: a.gueltigBis,
      zulaessigkeit: befund.zulaessigkeit,
      offenePunkte: ergebnisse
        .filter((e) => e.staerke === "muss" && e.status === "unbekannt")
        .map((e) => e.kriterium),
    });
    if (treffer.length >= grenze) break;
  }
  return treffer;
}
