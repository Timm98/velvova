import { getDb, schema, withUser } from "@paycheck/db";
import { and, desc, eq, isNull } from "drizzle-orm";
import {
  ARBEITSDIMENSIONEN,
  zusammenfassen,
  type Arbeitsdimension,
  type Arbeitsprofilwert,
} from "@paycheck/domain";

/**
 * Der Career Twin des Menschen — geladen und zusammengefasst.
 *
 * Mehrere Angaben zur selben Achse werden nach Herkunft gewichtet, nicht
 * nach Datum. Eine Beobachtung aus einem Check-in wiegt schwerer als
 * eine Selbstauskunft von heute; die Reihenfolge allein sagt nichts
 * über die Güte.
 */
export type Twin = Map<Arbeitsdimension, { wert: number; gewicht: number }>;

export async function twinLaden(userId: string): Promise<Twin> {
  const db = await getDb();
  const zeilen = await withUser(db, userId, (tx) =>
    tx.select().from(schema.arbeitsprofil).where(eq(schema.arbeitsprofil.userId, userId)),
  ).catch(() => []);

  const nachDimension = new Map<Arbeitsdimension, Arbeitsprofilwert[]>();
  for (const z of zeilen) {
    const d = z.dimension as Arbeitsdimension;
    if (!ARBEITSDIMENSIONEN.includes(d)) continue;
    const liste = nachDimension.get(d) ?? [];
    liste.push({
      dimension: d,
      wert: z.wert,
      herkunft: z.herkunft as Arbeitsprofilwert["herkunft"],
      beleg: z.beleg,
      bestaetigt: z.bestaetigt,
      erfasstAm: z.erfasstAm,
    });
    nachDimension.set(d, liste);
  }

  const twin: Twin = new Map();
  for (const [d, werte] of nachDimension) {
    const z = zusammenfassen(werte);
    if (z) twin.set(d, z);
  }
  return twin;
}

/**
 * Eine Angabe hinzufügen — nie eine bestehende ersetzen.
 *
 * Das ist Absicht. Wer heute etwas anderes sagt als vor drei Monaten,
 * hat nicht die alte Aussage widerrufen; beide zusammen ergeben ein
 * genaueres Bild als die jeweils letzte. `zusammenfassen()` gewichtet.
 */
export async function angabeErfassen(
  userId: string,
  dimension: Arbeitsdimension,
  wert: number,
  herkunft: Arbeitsprofilwert["herkunft"],
  beleg: string,
): Promise<void> {
  const db = await getDb();
  await withUser(db, userId, (tx) =>
    tx.insert(schema.arbeitsprofil).values({
      userId,
      dimension,
      wert: Math.min(1, Math.max(0, wert)),
      herkunft,
      beleg,
      /*
       * Nur Abgeleitetes wartet auf eine Bestätigung.
       *
       * Wer einen Regler bewegt, hat bereits geantwortet; ein Check-in
       * und eine Arbeitsprobe sind die Antwort selbst. Sie noch einmal
       * zu bestätigen wäre eine Frage nach der Frage.
       */
      bestaetigt: herkunft === "gespraech" ? null : true,
    }),
  ).catch((e) => console.error("[arbeitsprofil] nicht erfasst:", e));
}

export interface OffeneAchse {
  id: string;
  dimension: Arbeitsdimension;
  wert: number;
  beleg: string;
}

/**
 * Was Nina gelesen hat und noch niemand bestätigt hat.
 *
 * Je Achse nur die neueste: Drei Ableitungen zur Autonomie nacheinander
 * zu bestätigen wäre dieselbe Frage dreimal, und die dritte Antwort
 * würde die ersten beiden ohnehin überstimmen.
 */
export async function offeneAchsen(userId: string): Promise<OffeneAchse[]> {
  const db = await getDb();
  const zeilen = await withUser(db, userId, (tx) =>
    tx
      .select()
      .from(schema.arbeitsprofil)
      .where(and(eq(schema.arbeitsprofil.userId, userId), isNull(schema.arbeitsprofil.bestaetigt)))
      .orderBy(desc(schema.arbeitsprofil.erfasstAm)),
  ).catch(() => []);

  const gesehen = new Set<string>();
  const raus: OffeneAchse[] = [];
  for (const z of zeilen) {
    if (gesehen.has(z.dimension)) continue;
    gesehen.add(z.dimension);
    raus.push({
      id: z.id,
      dimension: z.dimension as Arbeitsdimension,
      wert: z.wert,
      beleg: z.beleg,
    });
  }
  return raus;
}
