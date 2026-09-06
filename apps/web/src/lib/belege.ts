import { getDb, schema, withUser } from "@paycheck/db";
import { and, desc, eq, isNull, like } from "drizzle-orm";
import {
  belegbilanz,
  belegstufe,
  berichteteAussagen,
  type Belegbilanz,
  type Belegstufe,
} from "@paycheck/domain";

/**
 * Belege mit echter Herkunft — die fehlende Hälfte.
 *
 * ── Die Asymmetrie, die uns selbst betraf ─────────────────────
 *
 * Wir halten Arbeitgeber an ihren Zusagen fest: mit Herkunft, Frist
 * und Nachprüfung. Auf der Bewerberseite stand bis hierher jeder Beleg
 * als „selbst gesagt" oder „von der KI vermutet" da — 348 Belege im
 * Bestand, kein einziger beobachtet.
 *
 * `source_type` kennt `work_sample` seit dem ersten Entwurf. Geschrieben
 * hat es nie jemand.
 *
 * ── Was daraus entsteht ───────────────────────────────────────
 *
 * Eine Arbeitsprobe kann schiefgehen. Genau deshalb bedeutet ein Beleg
 * daraus etwas — und genau deshalb bedeutet ein Lebenslauf wenig.
 */

export interface Beleg {
  id: string;
  aussage: string;
  stufe: Belegstufe;
  /** Woher — in einem Satz, lesbar. */
  herkunft: string;
  geteilt: boolean;
  bestaetigt: boolean;
}

/** Die eigenen Belege, nach Stärke geordnet. */
export async function belegeLaden(userId: string): Promise<{ belege: Beleg[]; bilanz: Belegbilanz }> {
  const db = await getDb();
  const zeilen = await withUser(db, userId, (tx) =>
    tx
      .select({
        id: schema.evidenceItems.id,
        statement: schema.evidenceItems.statement,
        sourceType: schema.evidenceItems.sourceType,
        sourceRef: schema.evidenceItems.sourceRef,
        userConfirmed: schema.evidenceItems.userConfirmed,
        geteilt: schema.evidenceItems.geteilt,
      })
      .from(schema.evidenceItems)
      .where(
        and(
          eq(schema.evidenceItems.userId, userId),
          eq(schema.evidenceItems.userRejected, false),
          isNull(schema.evidenceItems.deletedAt),
        ),
      )
      .orderBy(desc(schema.evidenceItems.createdAt)),
  ).catch(() => []);

  const belege: Beleg[] = zeilen.map((z) => ({
    id: z.id,
    aussage: z.statement,
    stufe: belegstufe(z.sourceType, z.userConfirmed, z.sourceRef),
    herkunft: herkunftstext(z.sourceType, z.sourceRef),
    geteilt: z.geteilt,
    bestaetigt: z.userConfirmed,
  }));

  /* Beobachtetes zuerst — es ist das, was jemand zeigen kann. */
  const rang: Record<Belegstufe, number> = { beobachtet: 0, bestaetigt: 1, berichtet: 2, behauptet: 3 };
  belege.sort((a, b) => rang[a.stufe] - rang[b.stufe]);

  return { belege, bilanz: belegbilanz(belege.map((b) => b.stufe)) };
}

function herkunftstext(sourceType: string, sourceRef: string | null): string {
  if (sourceType === "work_sample") {
    return sourceRef?.startsWith("probe:")
      ? `Arbeitsprobe „${sourceRef.slice(6)}“`
      : "In einer Arbeitsprobe gezeigt";
  }
  if (sourceRef?.startsWith("verlauf:")) return "Über Monate mehrfach gesagt";
  if (sourceType === "external_source") return sourceRef ?? "Von aussen bestätigt";
  if (sourceType === "document_extract") return "Aus einem Dokument gelesen";
  if (sourceType === "ai_hypothesis") return "Aus dem Gespräch abgeleitet";
  return "Im Gespräch gesagt";
}

/**
 * Die Belege, die durch Warten entstehen.
 *
 * ── Warum das keine neue Behauptung ist ───────────────────────
 *
 * Der Verlauf steht bereits in `arbeitsprofil` — mit Zeitpunkt und
 * Herkunft, seit dem ersten Gespräch. Was hier entsteht, ist keine
 * neue Aussage über den Menschen, sondern eine Auszählung dessen, was
 * er selbst über Monate mehrfach gesagt hat.
 *
 * ── Warum es NICHT beim Laden läuft ───────────────────────────
 *
 * Zuerst stand der Aufruf in `belegeLaden` — ein Schreiber in einem
 * Lesepfad. Heute wäre das folgenlos: Die längste Spanne im Bestand
 * ist null Tage, es entsteht nichts. Sobald aber echte Monate
 * zusammenkommen, zahlt der Seitenaufruf zwei zusätzliche
 * Rundläufe für eine Auszählung, auf die niemand wartet — und ein
 * gleichzeitiger zweiter Aufruf schriebe dieselbe Zeile doppelt.
 *
 * Läuft deshalb im Pflegelauf, wie die anderen Auszählungen.
 *
 * ── Warum je Dimension nur einer ──────────────────────────────
 *
 * `verlauf:<dimension>` ist der Schlüssel. Bei jedem Aufruf würde sonst
 * derselbe Beleg erneut entstehen, und ein Profil aus zwanzig Kopien
 * derselben Aussage sähe belegter aus, als es ist.
 */
export async function verlaufsbelegeSchreiben(userId: string): Promise<void> {
  const db = await getDb();
  const nennungen = await withUser(db, userId, (tx) =>
    tx
      .select({
        dimension: schema.arbeitsprofil.dimension,
        wert: schema.arbeitsprofil.wert,
        herkunft: schema.arbeitsprofil.herkunft,
        erfasstAm: schema.arbeitsprofil.erfasstAm,
      })
      .from(schema.arbeitsprofil)
      .where(eq(schema.arbeitsprofil.userId, userId)),
  );
  if (nennungen.length === 0) return;

  const aussagen = berichteteAussagen(nennungen);
  if (aussagen.length === 0) return;

  const vorhanden = await withUser(db, userId, (tx) =>
    tx
      .select({ sourceRef: schema.evidenceItems.sourceRef })
      .from(schema.evidenceItems)
      .where(
        and(
          eq(schema.evidenceItems.userId, userId),
          like(schema.evidenceItems.sourceRef, "verlauf:%"),
        ),
      ),
  );
  const bekannt = new Set(vorhanden.map((v) => v.sourceRef));

  const neu = aussagen
    .filter((a) => !bekannt.has(`verlauf:${a.dimension}`))
    .map((a) => ({
      userId,
      /* Eine Vorliebe, kein Können: Wiederholung belegt, was jemand will. */
      type: "preference" as const,
      statement: a.aussage,
      /*
       * Die Herkunft ist tatsächlich der Mensch selbst — was den Beleg
       * trägt, ist die Zeit. Die Stufe liest `belegstufe` deshalb am
       * `source_ref` ab, nicht am `source_type`.
       */
      sourceType: "user_stated" as const,
      sourceRef: `verlauf:${a.dimension}`,
      confidence: 0.75,
      userConfirmed: true,
      geteilt: false,
    }));
  if (neu.length === 0) return;

  await withUser(db, userId, (tx) => tx.insert(schema.evidenceItems).values(neu));
}
