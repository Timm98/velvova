import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { schema, withUser, type Database } from "@paycheck/db";
import { WISSENSFELDER } from "@paycheck/matching";
import { klaerungBeantwortet } from "./synthese.ts";
import { syntheseFaellig, type Faelligkeit } from "./hintergrund.ts";

/**
 * Die Antwort der Person — und was sie im System bewirkt.
 *
 * ══════════════════════════════════════════════════════════════
 * Der Kreis, den diese Datei schliesst
 * ══════════════════════════════════════════════════════════════
 *
 *   beobachten  →  verstehen  →  Unsicherheit bemerken  →  fragen
 *        ↑                                                    ↓
 *   besser empfehlen  ←  neu rechnen  ←  lernen  ←────────────┘
 *
 * Ohne diese Datei endete der Kreis bei „fragen". Monday stellte eine
 * Frage, die Person antwortete — und die Antwort war eine
 * Chatnachricht wie jede andere. Die Klärung blieb offen, dieselbe
 * Frage kam beim nächsten Lauf wieder, und das Profil wusste nichts
 * davon.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum die Antwort ein Beleg wird und keine Profiländerung
 * ══════════════════════════════════════════════════════════════
 *
 * Weil ein Beleg widerrufbar ist und eine Profiländerung nicht — und
 * weil die Belegkette die einzige Stelle ist, an der später steht,
 * WARUM etwas im Profil steht.
 *
 * Und weil die Konfidenzordnung dann von selbst das Richtige tut:
 * `user_stated` steht bei 0,95, `ai_hypothesis` bei höchstens 0,74.
 * Die alte Vermutung verliert an Gewicht, ohne dass sie jemand
 * löschen muss — sie wird überstimmt, nicht gestrichen. Das ist der
 * Unterschied zwischen „Monday hat sich geirrt" und „Monday hat nie
 * etwas vermutet".
 */

export interface Antwortbefund {
  /** Der neue Beleg. */
  belegId: string;
  /** Ob die Klärung dadurch geschlossen wurde. */
  geschlossen: boolean;
  /** Ob jetzt eine neue Synthese ansteht. */
  faelligkeit: Faelligkeit;
}

/**
 * Welche Belegart zu einer Antwort gehört.
 *
 * ── Warum nicht alles `preference` ist ────────────────────────
 *
 * Weil „mindestens 45.000" eine Bedingung ist und keine Vorliebe.
 * Der Unterschied entscheidet später, ob eine Stelle heruntergestuft
 * oder ausgeschlossen wird — und eine Bedingung, die als Vorliebe
 * abgelegt ist, wird lautlos verhandelbar.
 */
const BELEGART: Record<string, string> = {
  arbeitsort: "constraint",
  gehalt: "constraint",
  arbeitszeit: "constraint",
  taetigkeit: "preference",
  umfeld: "work_environment",
  erfahrung: "experience_episode",
  fuehrung: "preference",
  entwicklung: "motive",
};

function belegartFuer(schluessel: string): string {
  if (BELEGART[schluessel]) return BELEGART[schluessel]!;
  /* Ein Widerspruch dreht sich immer um eine Vorliebe oder ihr Gegenteil. */
  return "preference";
}

/**
 * Eine Antwort auf eine Klärung verarbeiten.
 *
 * ── Warum die Reihenfolge Beleg → Klärung ist ─────────────────
 *
 * Weil die Klärung auf den Beleg zeigt. Andersherum stünde für einen
 * Moment eine beantwortete Klärung ohne Antwort da — und wenn der
 * zweite Schritt fehlschlägt, dauerhaft.
 */
export async function klaerungAntwort(
  db: Database,
  userId: string,
  schluessel: string,
  antwort: string,
  optionen: { jetzt?: Date; bestaetigt?: boolean } = {},
): Promise<Antwortbefund | null> {
  const jetzt = optionen.jetzt ?? new Date();
  const text = antwort.trim();
  if (text.length === 0) return null;

  const [klaerung] = await withUser(db, userId, (tx) =>
    tx
      .select()
      .from(schema.profilKlaerungen)
      .where(
        and(
          eq(schema.profilKlaerungen.userId, userId),
          eq(schema.profilKlaerungen.schluessel, schluessel),
          eq(schema.profilKlaerungen.zustand, "offen"),
        ),
      )
      .limit(1),
  );
  if (!klaerung) return null;

  const [beleg] = await withUser(db, userId, (tx) =>
    tx
      .insert(schema.evidenceItems)
      .values({
        userId,
        type: belegartFuer(schluessel) as never,
        statement: text,
        /*
         * `user_stated`, nicht `user_confirmed`.
         *
         * Bestätigt ist etwas, das die Person GEPRÜFT und für richtig
         * erklärt hat. Hier hat sie geantwortet — das ist eine
         * Aussage, keine Prüfung. Der Unterschied sind fünf
         * Hundertstel Konfidenz und die Ehrlichkeit der Kette.
         */
        sourceType: optionen.bestaetigt ? "user_confirmed" : "user_stated",
        sourceRef: `klaerung:${klaerung.id}`,
        confidence: optionen.bestaetigt ? 1 : 0.95,
        userConfirmed: optionen.bestaetigt ?? false,
        contentHash: createHash("sha256").update(text.toLowerCase()).digest("hex"),
        createdAt: jetzt,
        updatedAt: jetzt,
      })
      .returning({ id: schema.evidenceItems.id }),
  );

  if (!beleg) return null;

  await klaerungBeantwortet(db, userId, schluessel, beleg.id, jetzt);

  /*
   * Und die Frage nach der Fälligkeit gleich mit.
   *
   * Der Aufrufer soll nicht selbst entscheiden müssen, ob jetzt neu
   * gerechnet werden muss — sonst entscheidet der Chat es anders als
   * der Hintergrund, und dieselbe Antwort führt an zwei Stellen zu
   * zwei verschiedenen Folgen.
   */
  const faelligkeit = await syntheseFaellig(db, userId, { jetzt });

  return { belegId: beleg.id, geschlossen: true, faelligkeit };
}

/**
 * Eine Klärung übergehen, ohne sie zu beantworten.
 *
 * ── Warum das nicht dasselbe ist wie ablehnen ─────────────────
 *
 * Weil es Fragen gibt, die man weder beantworten noch bestreiten
 * will. Ohne diesen dritten Weg bliebe die Frage stehen, bis jemand
 * urteilt — und das ist eine Nötigung in einem Produkt, dessen
 * Versprechen die eigene Verfügung ist.
 *
 * Die Klärung kommt danach nicht wieder. Das ist der Unterschied zu
 * „später": Wer eine Frage weglegt, hat eine Entscheidung getroffen.
 */
export async function klaerungUebergehen(
  db: Database,
  userId: string,
  schluessel: string,
  jetzt = new Date(),
): Promise<boolean> {
  const zeilen = await withUser(db, userId, (tx) =>
    tx
      .update(schema.profilKlaerungen)
      .set({ zustand: "uebergangen", entschiedenAm: jetzt })
      .where(
        and(
          eq(schema.profilKlaerungen.userId, userId),
          eq(schema.profilKlaerungen.schluessel, schluessel),
          eq(schema.profilKlaerungen.zustand, "offen"),
        ),
      )
      .returning({ id: schema.profilKlaerungen.id }),
  );
  return zeilen.length > 0;
}

/** Die bekannten Wissensfelder — damit Aufrufer Schlüssel prüfen können. */
export const WISSENSSCHLUESSEL: readonly string[] = WISSENSFELDER.map((f) => f.schluessel);
