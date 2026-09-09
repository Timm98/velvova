import "server-only";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import {
  selectProvider,
  zuordnungPruefen,
  ZIELERKENNUNG_ANWEISUNG,
  type Projektkurz,
  type Zuordnung,
} from "@paycheck/ai";
import { getDb, schema, withUser } from "@paycheck/db";

/**
 * ══════════════════════════════════════════════════════════════════
 * Aus einem Satz wird ein Arbeitsbereich — oder eben nicht
 * ══════════════════════════════════════════════════════════════════
 *
 * Diese Datei verbindet die reine Prüfung aus `@paycheck/ai` mit der
 * Datenbank. Die Entscheidung fällt dort, das Schreiben passiert hier.
 *
 * ── Warum das NEBEN der Antwort läuft ───────────────────────────
 *
 * Weil niemand auf eine Einordnung wartet. Wer schreibt „ich suche
 * einen Remote-Vertriebsjob", will eine Antwort — nicht erst eine
 * Datenbankrunde, die klärt, wie das intern abgelegt wird.
 *
 * Dasselbe Muster wie `antwortVerbuchen` in der Chat-Route: Es läuft
 * mit, und sein Ergebnis erscheint, wenn es da ist.
 *
 * ── Warum ein eigener, kleiner Aufruf ───────────────────────────
 *
 * Die Einordnung in den Hauptprompt zu legen wäre billiger und
 * schlechter: Sie käme als Nebenprodukt einer Antwort heraus, die auf
 * etwas anderes hin geschrieben wurde, und liesse sich nicht prüfen,
 * ohne die Antwort mitzuprüfen. Getrennt ist sie ein strukturiertes
 * Ergebnis, das die Anwendung annehmen oder verwerfen kann.
 */

const VorschlagSchema = z.object({
  art: z.enum(["neues_projekt", "verfeinern", "vorhandenes", "gespraech", "rueckfrage"]),
  projektId: z.string(),
  name: z.string(),
  ziel: z.string(),
  frage: z.string(),
  begruendung: z.string(),
});

export interface Zuordnungsergebnis extends Zuordnung {
  /** Die Kennung des angelegten oder geänderten Vorhabens. */
  projekt: { id: string; name: string } | null;
}

/** Offene Vorhaben der Person — die Lage für die Prüfung. */
async function offeneProjekte(userId: string): Promise<Projektkurz[]> {
  const db = await getDb();
  const zeilen = await withUser(db, userId, (tx) =>
    tx
      .select({ id: schema.projekte.id, name: schema.projekte.name, ziel: schema.projekte.ziel })
      .from(schema.projekte)
      .where(and(eq(schema.projekte.userId, userId), eq(schema.projekte.status, "aktiv"))),
  );
  return zeilen.map((z) => ({ id: z.id, name: z.name, ziel: z.ziel }));
}

/**
 * Eine Nachricht einordnen und, wenn nötig, ein Vorhaben anlegen.
 *
 * Wirft nicht. Scheitert die Einordnung, bleibt es beim Gespräch —
 * das ist der Zustand, in dem die Anwendung ohnehin die meiste Zeit
 * ist, und er kostet niemanden etwas.
 */
export async function projektZuordnen(
  userId: string,
  nachricht: string,
  offenesProjekt: string | null,
): Promise<Zuordnungsergebnis | null> {
  const text = nachricht.trim();
  /*
   * Kurze Nachrichten werden gar nicht erst eingeordnet.
   *
   * „danke", „ja", „und weiter?" — dafür ein Modell zu fragen kostet
   * bei jeder zweiten Nachricht Geld für eine Antwort, die immer
   * „gespraech" lautet.
   */
  if (text.length < 25) return null;

  try {
    const projekte = await offeneProjekte(userId);

    const provider = await selectProvider();
    const liste =
      projekte.length > 0
        ? projekte.map((p) => `- ${p.id}: ${p.name}${p.ziel ? ` (${p.ziel})` : ""}`).join("\n")
        : "(keine)";

    const a = await provider.structuredGenerate({
      system: ZIELERKENNUNG_ANWEISUNG,
      messages: [
        {
          role: "user",
          content:
            `OFFENE VORHABEN:\n${liste}\n\n` +
            `GERADE GEÖFFNET: ${offenesProjekt ?? "(keines)"}\n\n` +
            `NACHRICHT:\n${text}`,
        },
      ],
      schema: VorschlagSchema,
      schemaName: "monday_zielerkennung",
      /* `fast`: Eine Einordnung in fünf Kategorien braucht kein
         Denkmodell, und sie läuft bei jeder längeren Nachricht mit. */
      tier: "fast",
    });

    /*
     * Die Prüfung entscheidet, nicht das Modell.
     *
     * Leere Zeichenketten werden zu `null`: Das Schema verlangt alle
     * Felder, damit die strukturierte Ausgabe verlässlich ist — aber
     * „kein Name" heisst hier leer und nicht das Wort „null".
     */
    const zuordnung = zuordnungPruefen(
      {
        art: a.data.art,
        projektId: a.data.projektId || null,
        name: a.data.name || null,
        ziel: a.data.ziel || null,
        frage: a.data.frage || null,
        begruendung: a.data.begruendung || null,
      },
      { projekte, offenesProjekt },
    );

    return { ...zuordnung, projekt: await ausfuehren(userId, zuordnung, projekte) };
  } catch (fehler) {
    console.warn(
      "[monday/projekt] Einordnung fehlgeschlagen:",
      fehler instanceof Error ? fehler.message : String(fehler),
    );
    return null;
  }
}

/** Was die geprüfte Zuordnung in der Datenbank bewirkt. */
async function ausfuehren(
  userId: string,
  z: Zuordnung,
  projekte: readonly Projektkurz[],
): Promise<{ id: string; name: string } | null> {
  const db = await getDb();

  if (z.art === "neues_projekt" && z.name) {
    const [angelegt] = await withUser(db, userId, (tx) =>
      tx
        .insert(schema.projekte)
        .values({ userId, name: z.name!, ziel: z.ziel, status: "aktiv" })
        .returning({ id: schema.projekte.id, name: schema.projekte.name }),
    );
    return angelegt ?? null;
  }

  if (z.art === "verfeinern" && z.projektId && z.ziel) {
    /*
     * Das Ziel wird ergänzt, nicht ersetzt.
     *
     * „Höchstens zehn Prozent Reisetätigkeit" ist eine Bedingung
     * ZUM Vorhaben. Sie an die Stelle des Ziels zu setzen, löschte
     * alles, was vorher darin stand — und niemand hätte es gesehen,
     * weil die Zeile danach plausibel aussieht.
     */
    const vorher = projekte.find((p) => p.id === z.projektId);
    const neu = vorher?.ziel ? `${vorher.ziel} ${z.ziel}` : z.ziel;
    await withUser(db, userId, (tx) =>
      tx
        .update(schema.projekte)
        .set({ ziel: neu.slice(0, 1000) })
        .where(and(eq(schema.projekte.id, z.projektId!), eq(schema.projekte.userId, userId))),
    );
    return vorher ? { id: vorher.id, name: vorher.name } : null;
  }

  if (z.art === "vorhandenes" && z.projektId) {
    const p = projekte.find((x) => x.id === z.projektId);
    return p ? { id: p.id, name: p.name } : null;
  }

  return null;
}
