import "server-only";

import { and, asc, eq, sql } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";
import type { Angabe } from "./bewertung";

/**
 * Angaben lesen und schreiben.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum eine Korrektur die Herkunft überschreibt
 * ══════════════════════════════════════════════════════════════
 *
 * Wenn ein Mensch einen Wert ändert, wird aus „von der Website
 * gefunden, 70 % sicher" ein „vom Nutzer, bestätigt, 100 %". Der alte
 * Fund bleibt nicht daneben stehen.
 *
 * Das ist Absicht: Zwei Werte zum selben Feld sind kein Verlauf,
 * sondern eine offene Frage — und die Oberfläche müsste entscheiden,
 * welchen sie zeigt. Wer den Fund später noch braucht, findet ihn im
 * Gesprächsverlauf; der bleibt vollständig.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum `konfidenz` bei Nutzereingaben nicht verhandelbar ist
 * ══════════════════════════════════════════════════════════════
 *
 * Sie wird hier gesetzt, nicht übergeben. Käme sie vom Aufrufer,
 * liesse sich eine Nutzereingabe mit 40 % speichern — und dann stünde
 * neben einer Angabe, die jemand selbst gemacht hat, „unsicher".
 */

export type Gespraech = typeof schema.onboardingGespraeche.$inferSelect;

/** Das laufende Gespräch einer Organisation — oder ein neues. */
export async function gespraechHolen(opt: {
  organizationId: string;
  userId: string;
  postingId?: string | null;
}): Promise<Gespraech> {
  const db = await getDb();

  const [offen] = await withUser(db, opt.userId, (tx) =>
    tx
      .select()
      .from(schema.onboardingGespraeche)
      .where(
        and(
          eq(schema.onboardingGespraeche.organizationId, opt.organizationId),
          eq(schema.onboardingGespraeche.status, "entwurf"),
        ),
      )
      .orderBy(asc(schema.onboardingGespraeche.erstelltAm))
      .limit(1),
  );

  if (offen) return offen;

  const [neu] = await withUser(db, opt.userId, (tx) =>
    tx
      .insert(schema.onboardingGespraeche)
      .values({
        organizationId: opt.organizationId,
        postingId: opt.postingId ?? null,
        begonnenVon: opt.userId,
      })
      .returning(),
  );

  return neu!;
}

export async function angabenLaden(
  gespraechId: string,
  userId: string,
): Promise<Angabe[]> {
  const db = await getDb();
  const zeilen = await withUser(db, userId, (tx) =>
    tx
      .select({
        bereich: schema.onboardingAngaben.bereich,
        feld: schema.onboardingAngaben.feld,
        wert: schema.onboardingAngaben.wert,
        quelle: schema.onboardingAngaben.quelle,
        quelleDetail: schema.onboardingAngaben.quelleDetail,
        konfidenz: schema.onboardingAngaben.konfidenz,
        status: schema.onboardingAngaben.status,
      })
      .from(schema.onboardingAngaben)
      .where(eq(schema.onboardingAngaben.gespraechId, gespraechId)),
  );
  return zeilen as Angabe[];
}

export type NeueAngabe = {
  bereich: string;
  feld: string;
  wert: unknown;
  quelle: Angabe["quelle"];
  quelleDetail?: string | null;
  konfidenz?: number;
  status?: Angabe["status"];
};

/**
 * Angaben schreiben — als Satz, nicht einzeln.
 *
 * Aus einer freien Antwort entstehen zehn bis zwanzig Angaben auf
 * einmal. Einzeln geschrieben wären das zwanzig Umläufe zur Datenbank,
 * und ein Abbruch dazwischen liesse die Hälfte stehen.
 */
export async function angabenSchreiben(opt: {
  gespraechId: string;
  organizationId: string;
  userId: string;
  angaben: NeueAngabe[];
}): Promise<number> {
  if (opt.angaben.length === 0) return 0;
  const db = await getDb();
  const jetzt = new Date();

  const zeilen = opt.angaben.map((a) => {
    /* Vom Menschen heisst bestätigt und sicher — beides wird hier
       gesetzt und nicht übernommen. */
    const vomMenschen = a.quelle === "nutzer";
    return {
      gespraechId: opt.gespraechId,
      organizationId: opt.organizationId,
      bereich: a.bereich,
      feld: a.feld,
      wert: a.wert,
      quelle: a.quelle,
      quelleDetail: a.quelleDetail ?? null,
      konfidenz: vomMenschen ? 100 : Math.min(100, Math.max(0, a.konfidenz ?? 50)),
      status: vomMenschen ? ("bestaetigt" as const) : (a.status ?? ("gefunden" as const)),
      erfasstAm: jetzt,
      ...(vomMenschen ? { bestaetigtAm: jetzt, bestaetigtVon: opt.userId } : {}),
    };
  });

  await withUser(db, opt.userId, (tx) =>
    tx
      .insert(schema.onboardingAngaben)
      .values(zeilen)
      .onConflictDoUpdate({
        target: [
          schema.onboardingAngaben.gespraechId,
          schema.onboardingAngaben.bereich,
          schema.onboardingAngaben.feld,
        ],
        set: {
          wert: sqlAus("wert"),
          quelle: sqlAus("quelle"),
          quelleDetail: sqlAus("quelle_detail"),
          konfidenz: sqlAus("konfidenz"),
          status: sqlAus("status"),
          erfasstAm: sqlAus("erfasst_am"),
          bestaetigtAm: sqlAus("bestaetigt_am"),
          bestaetigtVon: sqlAus("bestaetigt_von"),
        },
      }),
  );

  await withUser(db, opt.userId, (tx) =>
    tx
      .update(schema.onboardingGespraeche)
      .set({ aktualisiertAm: jetzt })
      .where(eq(schema.onboardingGespraeche.id, opt.gespraechId)),
  );

  return zeilen.length;
}

/**
 * `excluded.<spalte>` — der Wert, der gerade eingefügt werden sollte.
 *
 * Drizzle bietet dafür `sql.raw`; als Hilfsfunktion steht der Name
 * einmal da statt achtmal, und ein Tippfehler in einem Spaltennamen
 * fällt beim ersten Aufruf auf statt bei dem einen Feld, das niemand
 * testet.
 */
function sqlAus(spalte: string) {
  return sql.raw(`excluded.${spalte}`);
}


/**
 * Eine Angabe bestätigen — oder als „nicht angegeben“ vermerken.
 *
 * Der zweite Fall ist wichtiger, als er aussieht: Er unterscheidet
 * „danach wurde gefragt und es kam nichts" von „danach hat nie jemand
 * gefragt". Ohne ihn fragt Monday im nächsten Gespräch wieder.
 */
export async function angabeBestaetigen(opt: {
  gespraechId: string;
  userId: string;
  bereich: string;
  feld: string;
  status: "bestaetigt" | "nicht_angegeben";
}): Promise<void> {
  const db = await getDb();
  await withUser(db, opt.userId, (tx) =>
    tx
      .update(schema.onboardingAngaben)
      .set({
        status: opt.status,
        konfidenz: opt.status === "bestaetigt" ? 100 : 0,
        bestaetigtAm: new Date(),
        bestaetigtVon: opt.userId,
      })
      .where(
        and(
          eq(schema.onboardingAngaben.gespraechId, opt.gespraechId),
          eq(schema.onboardingAngaben.bereich, opt.bereich),
          eq(schema.onboardingAngaben.feld, opt.feld),
        ),
      ),
  );
}

/** Eine Nachricht an den Verlauf hängen. */
export async function nachrichtSchreiben(opt: {
  gespraechId: string;
  organizationId: string;
  userId: string;
  rolle: "nina" | "mensch";
  text: string;
  transkriptRoh?: string | null;
}): Promise<void> {
  const db = await getDb();
  await withUser(db, opt.userId, (tx) =>
    tx.insert(schema.onboardingNachrichten).values({
      gespraechId: opt.gespraechId,
      organizationId: opt.organizationId,
      rolle: opt.rolle,
      text: opt.text.slice(0, 8000),
      transkriptRoh: opt.transkriptRoh?.slice(0, 8000) ?? null,
    }),
  );
}

export async function verlaufLaden(gespraechId: string, userId: string) {
  const db = await getDb();
  return withUser(db, userId, (tx) =>
    tx
      .select({
        rolle: schema.onboardingNachrichten.rolle,
        text: schema.onboardingNachrichten.text,
        erstelltAm: schema.onboardingNachrichten.erstelltAm,
      })
      .from(schema.onboardingNachrichten)
      .where(eq(schema.onboardingNachrichten.gespraechId, gespraechId))
      .orderBy(asc(schema.onboardingNachrichten.erstelltAm))
      .limit(200),
  );
}
