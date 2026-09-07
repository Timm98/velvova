import { and, desc, eq, gte, isNotNull, isNull } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";
import {
  klaerungAntwort,
  naechsteNachricht,
  offeneKlaerungen,
  stellenlageLaden,
  type Antwortbefund,
} from "@paycheck/jobs";

/**
 * Was Monday im Gespräch über die Person weiss — und was sie fragt.
 *
 * ══════════════════════════════════════════════════════════════
 * Die Lücke, die diese Datei schliesst
 * ══════════════════════════════════════════════════════════════
 *
 * Die Intelligenzschicht rechnete Widersprüche, Wissenslücken und
 * Synthesen — und legte sie in Tabellen ab. Das Gespräch las sie
 * nicht. Monday stellte eine Frage über den proaktiven Weg, die Person
 * antwortete im Chat, und die Antwort war eine Nachricht wie jede
 * andere: Die Klärung blieb offen, dieselbe Frage kam wieder.
 *
 * Hier laufen beide zusammen. Ohne neue Oberfläche — die Antwort
 * geht durch denselben Chat, der ohnehin da ist.
 */

/**
 * Wie lange eine gestellte Frage als „gerade gestellt" gilt.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum es überhaupt eine Frist gibt
 * ══════════════════════════════════════════════════════════════
 *
 * Weil die nächste Nachricht der Person nicht zwangsläufig eine
 * Antwort ist. Wer Monday gestern eine Frage beantwortet bekommen hat
 * und heute „zeig mir Lagerjobs" schreibt, hat nicht geantwortet —
 * und diesen Satz als Aussage über die Arbeitszeit abzulegen wäre
 * ein erfundener Beleg.
 *
 * Dreissig Minuten sind der Rahmen, in dem ein Gespräch stattfindet.
 * Die Zahl ist eine Produktentscheidung, kein Messwert.
 */
export const ANTWORTFENSTER_MINUTEN = 30;

/**
 * Wie kurz eine Nachricht sein darf und trotzdem als Antwort zählt.
 *
 * „ja" ist eine Antwort auf „Soll ich Vertrieb weiter ausschliessen?".
 * Ein einzelnes Zeichen ist es nicht.
 */
const ANTWORT_MIN_ZEICHEN = 2;

export interface Offenefrage {
  handlungId: string;
  schluessel: string;
  frage: string;
  gestelltAm: Date;
}

/**
 * Die zuletzt gestellte, noch unbeantwortete Frage aus der
 * Intelligenzschicht.
 *
 * ── Warum `gezeigt_am` und nicht `erstellt_am` ────────────────
 *
 * Weil eine Frage, die Monday zwar vorbereitet, aber nie gesagt hat,
 * keine Frage ist. `erstellt_am` sagt, wann sie etwas zu fragen
 * hatte; `gezeigt_am`, wann die Person es gelesen hat.
 */
export async function zuletztGefragt(
  userId: string,
  jetzt = new Date(),
): Promise<Offenefrage | null> {
  const db = await getDb();
  const seit = new Date(jetzt.getTime() - ANTWORTFENSTER_MINUTEN * 60_000);

  const [zeile] = await withUser(db, userId, (tx) =>
    tx
      .select({
        id: schema.ninaHandlungen.id,
        schluessel: schema.ninaHandlungen.schluessel,
        nachricht: schema.ninaHandlungen.nachricht,
        gezeigtAm: schema.ninaHandlungen.gezeigtAm,
      })
      .from(schema.ninaHandlungen)
      .where(
        and(
          eq(schema.ninaHandlungen.userId, userId),
          eq(schema.ninaHandlungen.zustand, "vorgeschlagen"),
          isNull(schema.ninaHandlungen.entschiedenAm),
          isNotNull(schema.ninaHandlungen.schluessel),
          isNotNull(schema.ninaHandlungen.gezeigtAm),
          gte(schema.ninaHandlungen.gezeigtAm, seit),
        ),
      )
      .orderBy(desc(schema.ninaHandlungen.gezeigtAm))
      .limit(1),
  );

  if (!zeile?.schluessel || !zeile.gezeigtAm) return null;
  return {
    handlungId: zeile.id,
    schluessel: zeile.schluessel,
    frage: zeile.nachricht ?? "",
    gestelltAm: zeile.gezeigtAm,
  };
}

/**
 * Eine Nachricht als Antwort auf die offene Frage verbuchen.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum nicht jede Nachricht als Antwort zählt
 * ══════════════════════════════════════════════════════════════
 *
 * Weil eine Frage nicht verpflichtet. Wer stattdessen etwas anderes
 * wissen will, hat nicht geantwortet — und seinen Satz als Aussage
 * über sich selbst abzulegen wäre genau die Sorte erfundener Beleg,
 * gegen die die ganze Belegkette gebaut ist.
 *
 * Deshalb drei Bedingungen: Es gab eine Frage, sie ist frisch, und
 * die Nachricht ist keine Aufforderung an das Produkt.
 *
 * `null` heisst: war keine Antwort. Das ist der häufigere Fall.
 */
export async function antwortVerbuchen(
  userId: string,
  nachricht: string,
  optionen: { istBedienfrage?: boolean; jetzt?: Date } = {},
): Promise<(Antwortbefund & { schluessel: string }) | null> {
  const text = nachricht.trim();
  if (text.length < ANTWORT_MIN_ZEICHEN) return null;
  if (optionen.istBedienfrage) return null;

  const offen = await zuletztGefragt(userId, optionen.jetzt);
  if (!offen) return null;

  const db = await getDb();
  const befund = await klaerungAntwort(db, userId, offen.schluessel, text, {
    jetzt: optionen.jetzt,
  });
  if (!befund) return null;

  /*
   * Die Handlung gilt damit als beantwortet, nicht als zugestimmt.
   *
   * „Zugestimmt" hiesse, die Person hätte einer Änderung zugestimmt.
   * Sie hat eine Frage beantwortet — was daraus folgt, entscheidet
   * die nächste Synthese anhand des neuen Belegs.
   */
  await withUser(db, userId, (tx) =>
    tx
      .update(schema.ninaHandlungen)
      .set({ zustand: "zugestimmt", entschiedenAm: optionen.jetzt ?? new Date() })
      .where(
        and(
          eq(schema.ninaHandlungen.id, offen.handlungId),
          eq(schema.ninaHandlungen.userId, userId),
        ),
      ),
  ).catch(() => undefined);

  return { ...befund, schluessel: offen.schluessel };
}

/* ═══════════════════════════════════════════════════════════════
   Was das Gespräch mitgibt
   ═══════════════════════════════════════════════════════════════ */

export interface Intelligenzstand {
  profileSynthesis: { ergebnis: Record<string, unknown>; modell: string; erstelltAm: string } | null;
  careerAnalysis: {
    ergebnis: Record<string, unknown>;
    modell: string;
    zweitmodell: string | null;
    einig: boolean | null;
    erstelltAm: string;
  } | null;
  /** Aus der Synthese, 0 bis 1 — `null`, solange keine gerechnet wurde. */
  confidence: number | null;
  nextBestQuestion: { schluessel: string; frage: string } | null;
  contradictions: { schluessel: string; frage: string; staerke: number | null }[];
  hardConflicts: { jobId: string; titel: string; einwand: string; passung: number }[];
  /** Höchstens einer — und nur, wenn der Moment passt. */
  proactiveInsight: {
    handlungId: string;
    handlung: string;
    text: string;
    brauchtZustimmung: boolean;
  } | null;
}

/**
 * Alles, was Monday über die Person weiss, in einer Form für den Client.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das schon jetzt hinausgeht, obwohl es niemand anzeigt
 * ══════════════════════════════════════════════════════════════
 *
 * Weil die Oberfläche später gebaut wird und dann nichts am Server
 * fehlen soll. Ein Feld, das erst mit dem Bildschirm entsteht, wird
 * zweimal entworfen — einmal nach dem, was die Daten hergeben, und
 * einmal nach dem, was ins Layout passt.
 *
 * ── Warum höchstens ein proaktiver Hinweis ────────────────────
 *
 * Weil Monday eine Assistentin ist und kein Postfach. Drei Hinweise
 * gleichzeitig sind keine Aufmerksamkeit, sondern eine Liste — und
 * eine Liste liest man später, also nie.
 */
export async function intelligenzstand(
  userId: string,
  optionen: { momentPasst?: boolean; jetzt?: Date } = {},
): Promise<Intelligenzstand> {
  const db = await getDb();
  const jetzt = optionen.jetzt ?? new Date();

  const [synthesen, klaerungen] = await Promise.all([
    withUser(db, userId, (tx) =>
      tx
        .select()
        .from(schema.profilSynthesen)
        .where(eq(schema.profilSynthesen.userId, userId))
        .orderBy(desc(schema.profilSynthesen.erstelltAm))
        .limit(6),
    ),
    offeneKlaerungen(db, userId),
  ]);

  const synthese = synthesen.find((s) => s.art === "profilsynthese") ?? null;
  const karriere = synthesen.find((s) => s.art === "karriereanalyse") ?? null;

  const stellen = await stellenlageLaden(
    db,
    userId,
    new Date(jetzt.getTime() - 24 * 60 * 60 * 1000),
  ).catch(() => ({ harteKonflikte: [], starkeTreffer: [] }));

  /*
   * Der Hinweis wird geholt UND als gezeigt vermerkt — in einer
   * Anweisung. Getrennt läge dazwischen ein Fenster, in dem zwei
   * offene Tabs denselben Hinweis holen und die Person ihn zweimal
   * liest.
   *
   * Passt der Moment nicht, wird gar nicht erst geholt: `beschaeftigt`
   * schiebt auf, statt zu verwerfen.
   */
  const hinweis = await naechsteNachricht(db, userId, jetzt, {
    beschaeftigt: optionen.momentPasst === false,
  }).catch(() => null);

  const frage = klaerungen.find((k) => k.art === "frage") ?? null;

  return {
    profileSynthesis: synthese
      ? {
          ergebnis: synthese.ergebnis,
          modell: synthese.modell,
          erstelltAm: synthese.erstelltAm.toISOString(),
        }
      : null,
    careerAnalysis: karriere
      ? {
          ergebnis: karriere.ergebnis,
          modell: karriere.modell,
          zweitmodell: karriere.zweitmodell,
          einig: karriere.einig,
          erstelltAm: karriere.erstelltAm.toISOString(),
        }
      : null,
    confidence: synthese?.konfidenz ?? null,
    nextBestQuestion: frage ? { schluessel: frage.schluessel, frage: frage.frage } : null,
    contradictions: klaerungen
      .filter((k) => k.art === "widerspruch")
      .map((k) => ({ schluessel: k.schluessel, frage: k.frage, staerke: k.staerke })),
    hardConflicts: [...stellen.harteKonflikte],
    proactiveInsight: hinweis
      ? {
          handlungId: hinweis.handlungId,
          handlung: hinweis.handlung,
          text: hinweis.text,
          brauchtZustimmung: hinweis.brauchtZustimmung,
        }
      : null,
  };
}
