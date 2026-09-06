import "server-only";

import { and, eq } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";
import { entscheide, type Fakt, type Faktquelle } from "./faktenregeln";

/**
 * Vorlieben und Bedingungen der Person — strukturiert, nicht als Block.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum es diese Tabelle neben `user_constraints` gibt
 * ══════════════════════════════════════════════════════════════
 *
 * `user_constraints` ist ein jsonb-Block: alles, was die Person im
 * Formular gesetzt hat, in einem Feld. Das reicht, solange die Person
 * selbst tippt.
 *
 * Es reicht nicht mehr, sobald Nina zuhört. Aus einem Gespräch kommen
 * Angaben mit sehr verschiedener Qualität:
 *
 *   „Unter 60.000 mache ich es nicht"   → hart, sicher, vom Menschen
 *   „Homeoffice wäre schon schön"       → weich, mittel, vom Menschen
 *   dreimal wegen Pendelzeit abgelehnt  → weich, schwach, abgeleitet
 *
 * Ein jsonb-Block kann das nicht auseinanderhalten. Er hat für jede
 * Angabe genau ein Feld und keinen Platz für die Frage, woher sie kommt
 * und wie sicher sie ist. Genau die Frage entscheidet aber, ob eine
 * Stelle ausgeschlossen oder nur schlechter bewertet wird.
 *
 * ══════════════════════════════════════════════════════════════
 * Die Regel ist dieselbe wie beim Gedächtnis
 * ══════════════════════════════════════════════════════════════
 *
 * Jeder Schreibvorgang geht durch `entscheide` aus `faktenregeln.ts`.
 * Nicht, weil es hier zufällig passt, sondern weil es dieselbe Frage
 * ist: Darf eine neue, unsichere Angabe eine bestätigte ersetzen?
 *
 * Eine zweite Antwort darauf wäre eine zweite Regel — und eine davon
 * wäre irgendwann veraltet. Deshalb ruft diese Datei sie auf, statt
 * sie nachzubauen.
 */

export type Praeferenzzeile = typeof schema.preferences.$inferSelect;

export type Praeferenzwunsch = {
  /** Einer der Schlüssel aus `gespraechsextraktion.ts`. */
  kind: string;
  wert: string;
  harteBedingung: boolean;
  quelle: Faktquelle;
  /** 0 bis 100. */
  konfidenz: number;
  bestaetigt: boolean;
  /** 0 bis 100 — wie schwer sie wiegt, wenn sie nicht hart ist. */
  gewicht?: number;
};

/** Alles, was die Person an Vorlieben und Bedingungen hinterlegt hat. */
export async function praeferenzenLaden(userId: string): Promise<Praeferenzzeile[]> {
  const db = await getDb();
  return withUser(db, userId, (tx) =>
    tx.select().from(schema.preferences).where(eq(schema.preferences.userId, userId)),
  );
}

/**
 * Nur die Schlüssel, die eine Stelle ausschliessen dürfen.
 *
 * Getrennt von `praeferenzenLaden`, weil der Matcher nichts weiter
 * braucht und diese Abfrage in der heissen Schleife jeder Bewertung
 * steht — eine Zeile je harter Bedingung statt aller Vorlieben.
 *
 * `bestaetigt` ist Bedingung: Eine Vorliebe, die Nina aus drei
 * Ablehnungen abgeleitet hat, darf keine Stelle ausschliessen, solange
 * niemand sie bestätigt hat. Sonst wird aus einem Verdacht ein Filter,
 * den die Person nie gesetzt hat.
 */
export async function harteBedingungenLaden(userId: string): Promise<Set<string>> {
  const db = await getDb();
  const zeilen = await withUser(db, userId, (tx) =>
    tx
      .select({ kind: schema.preferences.kind })
      .from(schema.preferences)
      .where(
        and(
          eq(schema.preferences.userId, userId),
          eq(schema.preferences.harteBedingung, true),
          eq(schema.preferences.bestaetigt, true),
        ),
      ),
  );
  return new Set(zeilen.map((z) => z.kind));
}

/**
 * Wie schwer eine Vorliebe wiegt, wenn niemand ein Gewicht gesetzt hat.
 *
 * Sie folgt der Konfidenz. Der feste Vorgabewert 50 aus dem Schema
 * würde eine Ableitung mit 30 % Sicherheit genauso schwer wiegen lassen
 * wie eine ausdrückliche Angabe — das ist der Weg, auf dem stille
 * Vermutungen die Liste bestimmen.
 *
 * Der Faktor 0,8 statt 1,0 hält auch eine sehr sichere Ableitung unter
 * dem, was ein Mensch ausdrücklich sagt: Eine bestätigte Angabe bringt
 * ihr Gewicht selbst mit, eine gelesene bleibt darunter.
 */
export function gewichtAus(wunsch: Pick<Praeferenzwunsch, "konfidenz" | "gewicht">): number {
  if (wunsch.gewicht !== undefined) return wunsch.gewicht;
  return Math.round(wunsch.konfidenz * 0.8);
}

export type Schreibergebnis = {
  entscheidung: ReturnType<typeof entscheide>;
  /** Gesetzt, wenn ein Widerspruch zu einer bestätigten Angabe entstand. */
  frage: string | null;
};

/**
 * Eine Vorliebe schreiben — oder eben nicht.
 *
 * Die Rückgabe sagt, was passiert ist, statt es zu verschweigen: Der
 * Aufrufer muss wissen, ob eine Rückfrage entstanden ist, sonst geht
 * sie verloren.
 */
export async function praeferenzSchreiben(
  userId: string,
  wunsch: Praeferenzwunsch,
): Promise<Schreibergebnis> {
  const db = await getDb();

  return withUser(db, userId, async (tx) => {
    const [alt] = await tx
      .select()
      .from(schema.preferences)
      .where(and(eq(schema.preferences.userId, userId), eq(schema.preferences.kind, wunsch.kind)))
      .limit(1);

    const alsFakt = (z: Praeferenzzeile): Fakt => ({
      schluessel: z.kind,
      wert: z.value,
      quelle: z.quelle as Faktquelle,
      konfidenz: z.konfidenz,
      bestaetigt: z.bestaetigt,
    });

    const neu: Fakt = {
      schluessel: wunsch.kind,
      wert: wunsch.wert,
      quelle: wunsch.quelle,
      konfidenz: wunsch.konfidenz,
      bestaetigt: wunsch.bestaetigt,
    };

    const entscheidung = entscheide(alt ? alsFakt(alt) : null, neu);
    const frage = entscheidung.art === "nachfragen" ? entscheidung.frage : null;

    if (entscheidung.art !== "ersetzen") return { entscheidung, frage };

    const gewicht = gewichtAus(wunsch);

    const werte = {
      userId,
      kind: wunsch.kind,
      value: wunsch.wert,
      harteBedingung: wunsch.harteBedingung,
      gewicht,
      quelle: wunsch.quelle,
      konfidenz: wunsch.konfidenz,
      bestaetigt: wunsch.bestaetigt,
    };

    if (alt) {
      await tx.update(schema.preferences).set(werte).where(eq(schema.preferences.id, alt.id));
    } else {
      await tx.insert(schema.preferences).values(werte);
    }

    return { entscheidung, frage };
  });
}

/**
 * Eine abgeleitete Vorliebe bestätigen.
 *
 * Der eigene Weg dafür ist Absicht. Nina darf ableiten, aber nur ein
 * Mensch darf bestätigen — und erst ab dann darf die Vorliebe eine
 * Stelle ausschliessen. Ohne diese Trennung wäre `bestaetigt` ein Feld,
 * das die Ableitung selbst setzen könnte.
 */
export async function praeferenzBestaetigen(
  userId: string,
  kind: string,
  harteBedingung: boolean,
): Promise<void> {
  const db = await getDb();
  await withUser(db, userId, (tx) =>
    tx
      .update(schema.preferences)
      .set({ bestaetigt: true, harteBedingung, quelle: "nutzer", konfidenz: 100 })
      .where(and(eq(schema.preferences.userId, userId), eq(schema.preferences.kind, kind))),
  );
}
