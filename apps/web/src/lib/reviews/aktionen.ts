"use server";

import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import { getDb, schema } from "@paycheck/db";
import { currentUser, requireUser } from "@/lib/auth";
import { pruefeBewertung, type Fehler } from "./pruefung.ts";

/**
 * Was mit einer Bewertung passiert.
 *
 * Drei Wege, drei sehr verschiedene Berechtigungen:
 *
 *   `bewertungAbgeben`   darf jeder — auch ohne Konto. Landet auf
 *                        „ausstehend" und wird nirgends sichtbar.
 *   `hilfreichMarkieren` darf jeder Leser, einmal je Bewertung.
 *   `moderiere…`         nur Betrieb und Verwaltung.
 *
 * Die mittlere ist die heikelste: sie muss ohne Anmeldung funktionieren
 * und trotzdem nicht beliebig oft gehen. Wie das ohne Wiedererkennung
 * von Lesern geht, steht bei `stimmKennung`.
 */

export interface AbgabeErgebnis {
  ok: boolean;
  fehler?: Fehler[];
  danke?: string;
}

/*
 * Das Geheimnis für die Stimmkennung.
 *
 * Wird beim Start einmal gezogen, wenn keines gesetzt ist. Folge: nach
 * einem Neustart zählen alte Stimmen als fremd, und jemand könnte
 * erneut abstimmen. Das ist die richtige Voreinstellung — lieber eine
 * Stimme zu viel als ein dauerhaft stabiler Fingerabdruck von Lesern,
 * der ohne jede Konfiguration entsteht.
 */
const STIMM_GEHEIMNIS = process.env.REVIEW_VOTE_SECRET ?? randomBytes(32).toString("hex");

/**
 * Wer hat schon abgestimmt — ohne zu wissen, wer es ist.
 *
 * Aus Adresse, Browserkennung UND Bewertungskennung wird ein Hashwert
 * gebildet. Die letzte Zutat ist die entscheidende: dieselbe Person
 * bekommt bei zwei Bewertungen zwei verschiedene Kennungen. Damit lässt
 * sich die zweite Stimme zu EINER Bewertung verhindern, aber niemand
 * über mehrere Bewertungen hinweg verfolgen.
 *
 * Ausdrücklich kein sicherer Schutz: wer will, wechselt das Netz. Die
 * Abwägung ist bewusst — eine Doppelstimme ist ein Ordnungsproblem, das
 * Verfolgen von Lesern wäre ein Vertrauensbruch.
 */
async function stimmKennung(zweck: string): Promise<string> {
  const h = await headers();
  const adresse = (h.get("x-forwarded-for") ?? "").split(",")[0]?.trim() ?? "";
  const browser = h.get("user-agent") ?? "";
  return createHash("sha256")
    .update(`${STIMM_GEHEIMNIS}|${zweck}|${adresse}|${browser}`)
    .digest("hex");
}

/** Wie viele Bewertungen aus derselben Richtung in einer Stunde. */
const MAX_PRO_STUNDE = 3;

export async function bewertungAbgeben(form: FormData): Promise<AbgabeErgebnis> {
  const geprueft = pruefeBewertung({
    displayName: form.get("displayName"),
    roleOrCompany: form.get("roleOrCompany"),
    contactEmail: form.get("contactEmail"),
    rating: form.get("rating"),
    headline: form.get("headline"),
    body: form.get("body"),
    consentPublish: form.get("consentPublish"),
    consentPrivacy: form.get("consentPrivacy"),
    website: form.get("website"),
  });

  if (!geprueft.ok) return { ok: false, fehler: geprueft.fehler };

  const db = await getDb();
  const user = await currentUser();
  const kennung = await stimmKennung("abgabe");
  const seit = new Date(Date.now() - 60 * 60 * 1000);

  /*
   * Ein einfaches Mass gegen Fluten.
   *
   * Gezählt wird über dieselbe Kennung wie beim Abstimmen: kein Konto
   * nötig, keine dauerhafte Wiedererkennung. Gespeichert liegt sie in
   * `submitter_hash` — getrennt von der Moderationsnotiz, die einem
   * Menschen gehört.
   */
  const [wieviele] = await db
    .select({ n: count() })
    .from(schema.platformReviews)
    .where(
      and(
        gte(schema.platformReviews.createdAt, seit),
        eq(schema.platformReviews.submitterHash, kennung),
      ),
    )
    .catch(() => [{ n: 0 }]);

  if ((wieviele?.n ?? 0) >= MAX_PRO_STUNDE) {
    return {
      ok: false,
      fehler: [
        {
          feld: "body",
          text: "Du hast gerade schon mehrere Bewertungen abgegeben. Versuch es später noch einmal.",
        },
      ],
    };
  }

  await db.insert(schema.platformReviews).values({
    userId: user?.id ?? null,
    displayName: geprueft.wert.displayName,
    roleOrCompany: geprueft.wert.roleOrCompany,
    contactEmail: geprueft.wert.contactEmail,
    rating: geprueft.wert.rating,
    headline: geprueft.wert.headline,
    body: geprueft.wert.body,
    consentPublish: true,
    consentPrivacy: true,
    submitterHash: kennung,
    status: "pending",
  });

  return {
    ok: true,
    danke:
      "Vielen Dank für deine Bewertung. Sie wird vor der Veröffentlichung von unserem Team geprüft.",
  };
}

/** Eine Bewertung als hilfreich markieren. Einmal je Leser. */
export async function hilfreichMarkieren(
  reviewId: string,
): Promise<{ ok: boolean; anzahl?: number }> {
  const db = await getDb();
  const kennung = await stimmKennung(reviewId);

  try {
    const eingefuegt = await db
      .insert(schema.reviewHelpfulVotes)
      .values({ reviewId, voterHash: kennung })
      .onConflictDoNothing()
      .returning({ reviewId: schema.reviewHelpfulVotes.reviewId });

    // Nichts eingefügt heisst: schon abgestimmt. Kein Fehler, nur
    // nichts zu tun — und der Zähler bleibt, wie er ist.
    if (eingefuegt.length === 0) {
      const [zeile] = await db
        .select({ n: schema.platformReviews.helpfulCount })
        .from(schema.platformReviews)
        .where(eq(schema.platformReviews.id, reviewId))
        .limit(1);
      return { ok: true, anzahl: zeile?.n ?? 0 };
    }

    const [aktualisiert] = await db
      .update(schema.platformReviews)
      .set({ helpfulCount: sql`${schema.platformReviews.helpfulCount} + 1` })
      .where(eq(schema.platformReviews.id, reviewId))
      .returning({ n: schema.platformReviews.helpfulCount });

    revalidatePath("/reviews");
    return { ok: true, anzahl: aktualisiert?.n ?? 0 };
  } catch {
    return { ok: false };
  }
}

// ── Moderation ──────────────────────────────────────────────

async function nurModeration() {
  const user = await requireUser();
  if (user.role !== "operator" && user.role !== "admin") {
    // Kein 403: dass es diese Aktion gibt, geht niemanden etwas an.
    throw new Error("not found");
  }
  return user;
}

export async function bewertungFreigeben(id: string): Promise<void> {
  const user = await nurModeration();
  const db = await getDb();
  await db
    .update(schema.platformReviews)
    .set({
      status: "approved",
      publishedAt: new Date(),
      moderatedBy: user.id,
      moderatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.platformReviews.id, id));
  neuLaden();
}

export async function bewertungAblehnen(id: string, notiz?: string): Promise<void> {
  const user = await nurModeration();
  const db = await getDb();
  await db
    .update(schema.platformReviews)
    .set({
      status: "rejected",
      publishedAt: null,
      moderationNote: notiz?.slice(0, 500) ?? null,
      moderatedBy: user.id,
      moderatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.platformReviews.id, id));
  neuLaden();
}

export async function bewertungKennzeichnen(
  id: string,
  was: { verifiziert?: boolean; hervorgehoben?: boolean; reihenfolge?: number },
): Promise<void> {
  await nurModeration();
  const db = await getDb();
  await db
    .update(schema.platformReviews)
    .set({
      ...(was.verifiziert !== undefined ? { isVerified: was.verifiziert } : {}),
      ...(was.hervorgehoben !== undefined ? { isFeatured: was.hervorgehoben } : {}),
      ...(was.reihenfolge !== undefined ? { sortOrder: was.reihenfolge } : {}),
      updatedAt: new Date(),
    })
    .where(eq(schema.platformReviews.id, id));
  neuLaden();
}

export async function bewertungBearbeiten(
  id: string,
  was: { headline?: string; body?: string },
): Promise<void> {
  await nurModeration();
  const db = await getDb();
  /*
   * Bearbeiten ist heikel: es ist der fremde Text einer anderen Person.
   *
   * Erlaubt sind Tippfehler und Kürzungen, nicht die Umdeutung einer
   * Aussage. Der Umfang bleibt deshalb an dieselben Grenzen gebunden
   * wie beim Absenden — der `CHECK` in der Datenbank fängt den Rest.
   */
  await db
    .update(schema.platformReviews)
    .set({
      ...(was.headline !== undefined ? { headline: was.headline.slice(0, 120) || null } : {}),
      ...(was.body !== undefined ? { body: was.body.slice(0, 5000) } : {}),
      updatedAt: new Date(),
    })
    .where(eq(schema.platformReviews.id, id));
  neuLaden();
}

export async function bewertungLoeschen(id: string): Promise<void> {
  await nurModeration();
  const db = await getDb();
  await db.delete(schema.platformReviews).where(eq(schema.platformReviews.id, id));
  neuLaden();
}

/** Alles für die Moderationsseite — inklusive dessen, was nicht öffentlich ist. */
export async function alleBewertungenFuerModeration() {
  await nurModeration();
  const db = await getDb();
  return db
    .select()
    .from(schema.platformReviews)
    .orderBy(desc(schema.platformReviews.createdAt))
    .limit(200);
}

function neuLaden() {
  revalidatePath("/");
  revalidatePath("/reviews");
  revalidatePath("/admin/reviews");
}
