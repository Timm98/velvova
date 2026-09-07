import { and, desc, eq, inArray } from "drizzle-orm";
import { schema, withUser, type Database } from "@paycheck/db";
import { naechsteFrage, widersprueche, type Widerspruchsbeleg } from "@paycheck/matching";
import { belegeAlsText, belegstandLaden, type Belegstand } from "./belege.ts";

/**
 * Die Profilsynthese — und was daraus für das Gespräch folgt.
 *
 * ══════════════════════════════════════════════════════════════
 * Drei Schritte, und nur einer kostet Geld
 * ══════════════════════════════════════════════════════════════
 *
 *   1. Belege laden, Fingerabdruck bilden      kostenlos
 *   2. Widersprüche und nächste Frage rechnen  kostenlos
 *   3. Synthese durch das tiefe Modell         kostet
 *
 * Schritt 2 vor Schritt 3, weil er ohne Modell auskommt und weil
 * seine Ergebnisse in den Prompt gehören: Ein Modell, das die
 * erkannten Widersprüche kennt, muss sie nicht noch einmal suchen.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum ein unveränderter Belegstand keinen Lauf auslöst
 * ══════════════════════════════════════════════════════════════
 *
 * Weil dieselbe Eingabe dieselbe Ausgabe ergibt — für Geld und
 * Sekunden. Der Fingerabdruck sagt, ob sich etwas geändert hat;
 * ein Zeitstempel könnte das nicht.
 */

export interface Syntheseauftrag {
  userId: string;
  /**
   * Der Modellaufruf. Fehlt er, entsteht keine Synthese — und die
   * Widersprüche und die nächste Frage stehen trotzdem.
   */
  rufer?: (fakten: string) => Promise<{ ergebnis: Record<string, unknown>; modell: string; konfidenz: number }>;
  promptFassung?: string;
  /** Den Zwischenspeicher übergehen. */
  frisch?: boolean;
  jetzt?: Date;
}

export interface Synthesebefund {
  belegstand: Belegstand;
  /** Die gespeicherte oder frisch gerechnete Synthese. */
  synthese: Record<string, unknown> | null;
  modell: string | null;
  /** Ob dieser Aufruf gerechnet hat oder eine gespeicherte fand. */
  neuGerechnet: boolean;
  grund: string;
  /** Die offenen Klärungen — Fragen und Widersprüche. */
  klaerungen: { art: string; schluessel: string; frage: string; staerke: number | null }[];
}

/**
 * Die Synthese holen oder rechnen.
 */
export async function profilsynthese(
  db: Database,
  auftrag: Syntheseauftrag,
): Promise<Synthesebefund> {
  const jetzt = auftrag.jetzt ?? new Date();
  const belegstand = await belegstandLaden(db, auftrag.userId);

  /* ── 1. Klärungen — ohne Modell ───────────────────────────── */
  const alsWiderspruch: Widerspruchsbeleg[] = belegstand.belege.map((b) => ({
    id: b.id,
    text: b.aussage,
    quelle: b.quelle,
    konfidenz: b.konfidenz,
  }));

  const gefundene = widersprueche(alsWiderspruch);
  const frage = naechsteFrage(
    belegstand.belege.map((b) => ({ text: b.aussage, quelle: b.quelle, konfidenz: b.konfidenz })),
    await bereitsGefragt(db, auftrag.userId),
  );

  await klaerungenSchreiben(db, auftrag.userId, gefundene, frage, jetzt);

  /* ── 2. Gespeicherte Synthese, wenn der Stand passt ───────── */
  const [gespeichert] = await withUser(db, auftrag.userId, (tx) =>
    tx
      .select()
      .from(schema.profilSynthesen)
      .where(
        and(
          eq(schema.profilSynthesen.userId, auftrag.userId),
          eq(schema.profilSynthesen.art, "profilsynthese"),
        ),
      )
      .orderBy(desc(schema.profilSynthesen.erstelltAm))
      .limit(1),
  );

  const klaerungen = await offeneKlaerungen(db, auftrag.userId);

  if (!auftrag.frisch && gespeichert && gespeichert.belegStand === belegstand.stand) {
    return {
      belegstand,
      synthese: gespeichert.ergebnis,
      modell: gespeichert.modell,
      neuGerechnet: false,
      grund: "Belegstand unverändert.",
      klaerungen,
    };
  }

  if (!auftrag.rufer) {
    return {
      belegstand,
      synthese: gespeichert?.ergebnis ?? null,
      modell: gespeichert?.modell ?? null,
      neuGerechnet: false,
      grund: "Kein Modell angebunden — Klärungen stehen trotzdem.",
      klaerungen,
    };
  }

  /*
   * Zu wenige Belege ergeben keine Synthese, sondern eine
   * Aneinanderreihung von Vermutungen. Dann ist die nächste Frage
   * das Nützlichere.
   */
  if (belegstand.anzahl < 3) {
    return {
      belegstand,
      synthese: null,
      modell: null,
      neuGerechnet: false,
      grund: `Nur ${belegstand.anzahl} Belege — zu wenig für eine Zusammenfassung.`,
      klaerungen,
    };
  }

  /* ── 3. Der Modellaufruf ──────────────────────────────────── */
  const fakten = [
    belegeAlsText(belegstand.belege),
    gefundene.length > 0
      ? `\nBereits erkannte Widersprüche:\n${gefundene.map((w) => `- ${w.frage}`).join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const a = await auftrag.rufer(fakten);

  await withUser(db, auftrag.userId, (tx) =>
    tx.insert(schema.profilSynthesen).values({
      userId: auftrag.userId,
      art: "profilsynthese",
      ergebnis: a.ergebnis,
      belegStand: belegstand.stand,
      belegAnzahl: belegstand.anzahl,
      modell: a.modell,
      promptFassung: auftrag.promptFassung ?? "unbekannt",
      konfidenz: a.konfidenz,
      erstelltAm: jetzt,
    }),
  );

  return {
    belegstand,
    synthese: a.ergebnis,
    modell: a.modell,
    neuGerechnet: true,
    grund: gespeichert ? "Belegstand geändert." : "Erste Synthese.",
    klaerungen: await offeneKlaerungen(db, auftrag.userId),
  };
}

/* ═══════════════════════════════════════════════════════════════
   Klärungen
   ═══════════════════════════════════════════════════════════════ */

async function bereitsGefragt(db: Database, userId: string): Promise<string[]> {
  const zeilen = await withUser(db, userId, (tx) =>
    tx
      .select({ schluessel: schema.profilKlaerungen.schluessel })
      .from(schema.profilKlaerungen)
      .where(
        and(eq(schema.profilKlaerungen.userId, userId), eq(schema.profilKlaerungen.art, "frage")),
      ),
  );
  return zeilen.map((z) => z.schluessel);
}

export async function offeneKlaerungen(
  db: Database,
  userId: string,
): Promise<Synthesebefund["klaerungen"]> {
  const zeilen = await withUser(db, userId, (tx) =>
    tx
      .select()
      .from(schema.profilKlaerungen)
      .where(
        and(
          eq(schema.profilKlaerungen.userId, userId),
          eq(schema.profilKlaerungen.zustand, "offen"),
        ),
      )
      .orderBy(desc(schema.profilKlaerungen.staerke)),
  );
  return zeilen.map((z) => ({
    art: z.art,
    schluessel: z.schluessel,
    frage: z.frage,
    staerke: z.staerke,
  }));
}

async function klaerungenSchreiben(
  db: Database,
  userId: string,
  gefundene: ReturnType<typeof widersprueche>,
  frage: ReturnType<typeof naechsteFrage>,
  jetzt: Date,
): Promise<void> {
  await withUser(db, userId, async (tx) => {
    /*
     * ══════════════════════════════════════════════════════════════
     * Was einmal entschieden ist, wird nicht neu gefragt
     * ══════════════════════════════════════════════════════════════
     *
     * Der eindeutige Index verhindert nur zwei OFFENE Klärungen zum
     * selben Schlüssel. Eine beantwortete steht auf `beantwortet` —
     * und der nächste Lauf legte fröhlich eine neue offene daneben.
     *
     * Für die Person sah das so aus: Sie beantwortet die Frage nach
     * dem Vertrieb, und zehn Minuten später fragt Monday wieder. Genau
     * der Eindruck, den die ganze Belegkette vermeiden soll — dass
     * das Gesagte nirgends ankommt.
     */
    const entschieden = new Set(
      (
        await tx
          .select({ schluessel: schema.profilKlaerungen.schluessel })
          .from(schema.profilKlaerungen)
          .where(
            and(
              eq(schema.profilKlaerungen.userId, userId),
              inArray(schema.profilKlaerungen.zustand, ["beantwortet", "uebergangen"]),
            ),
          )
      ).map((z) => z.schluessel),
    );

    for (const w of gefundene) {
      if (entschieden.has(w.gesagt.id)) continue;
      await tx
        .insert(schema.profilKlaerungen)
        .values({
          userId,
          art: "widerspruch",
          /* Der Schlüssel ist der Beleg, um den es geht — so entsteht
             nicht bei jedem Lauf derselbe Widerspruch neu. */
          schluessel: w.gesagt.id,
          frage: w.frage,
          grund: `${w.entgegen.length} Gegenbelege`,
          belege: [w.gesagt.id, ...w.entgegen.map((e) => e.id)],
          staerke: w.staerke,
          erstelltAm: jetzt,
        })
        /* Ein bereits offener Widerspruch bleibt, wie er ist —
           samt seiner Geschichte. */
        .onConflictDoNothing();
    }

    /*
     * Höchstens eine offene Frage.
     *
     * ══════════════════════════════════════════════════════════
     * Was hier zuerst falsch war
     * ══════════════════════════════════════════════════════════
     *
     * Jeder Lauf legte die nächste offene Frage an. Nach zwei Läufen
     * standen zwei, nach zehn Läufen zehn — und genau das ist das
     * Formular, das eine Frage vermeiden soll.
     *
     * Die nächste Frage entsteht erst, wenn die vorige beantwortet
     * oder übergangen ist. Bis dahin steht sie und wartet.
     *
     * Widersprüche sind davon ausgenommen: Sie entstehen nicht, weil
     * Monday etwas wissen will, sondern weil etwas nicht zusammenpasst.
     * Zwei unabhängige Widersprüche sind zwei Sachverhalte.
     */
    if (frage && !entschieden.has(frage.schluessel)) {
      const [offeneFrage] = await tx
        .select({ id: schema.profilKlaerungen.id })
        .from(schema.profilKlaerungen)
        .where(
          and(
            eq(schema.profilKlaerungen.userId, userId),
            eq(schema.profilKlaerungen.art, "frage"),
            eq(schema.profilKlaerungen.zustand, "offen"),
          ),
        )
        .limit(1);

      if (!offeneFrage) {
        await tx
          .insert(schema.profilKlaerungen)
          .values({
            userId,
            art: "frage",
            schluessel: frage.schluessel,
            frage: frage.frage,
            grund: frage.grund,
            erstelltAm: jetzt,
          })
          .onConflictDoNothing();
      }
    }
  });
}

/** Eine Klärung als beantwortet vermerken. */
export async function klaerungBeantwortet(
  db: Database,
  userId: string,
  schluessel: string,
  antwortBeleg: string | null,
  jetzt = new Date(),
): Promise<void> {
  await withUser(db, userId, (tx) =>
    tx
      .update(schema.profilKlaerungen)
      .set({ zustand: "beantwortet", antwortBeleg, entschiedenAm: jetzt })
      .where(
        and(
          eq(schema.profilKlaerungen.userId, userId),
          eq(schema.profilKlaerungen.schluessel, schluessel),
          eq(schema.profilKlaerungen.zustand, "offen"),
        ),
      ),
  );
}
