import { and, asc, desc, eq, gt, isNull, lte, sql } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";

/**
 * Der Gesprächsspeicher.
 *
 * Bisher lebte ein Gespräch im Zustand einer React-Komponente. Das
 * bedeutete: nach dem Neuladen weg, beim Seitenwechsel weg, auf dem
 * zweiten Gerät nie da gewesen. Kein Designproblem — eine fehlende
 * Tabelle.
 *
 * Zwei Regeln tragen alles Weitere:
 *
 * 1. **Die Nutzerkennung ist immer ein Parameter aus der Sitzung.**
 *    Keine Funktion hier nimmt sie aus einem Anfragekörper entgegen.
 *
 * 2. **An das Modell geht nie der ganze Verlauf.** Zusammenfassung plus
 *    die letzten Züge. Ein Gespräch, das mit jeder Runde länger wird,
 *    wird mit jeder Runde teurer und ungenauer.
 */

export type ConversationKind =
  | "career_interview"
  | "assistant"
  | "job_search"
  /** Hilfe und FAQ. Sieht die Produktdokumentation, nicht das Karriereprofil (§24.3). */
  | "support"
  /** Kurzfrage zu genau einer Stellenanzeige. */
  | "job_context";

export interface ConversationSummary {
  id: string;
  kind: ConversationKind;
  title: string | null;
  jobId: string | null;
  applicationId: string | null;
  messageCount: number;
  updatedAt: Date;
}

export interface StoredMessage {
  id: string;
  index: number;
  role: "user" | "assistant" | "tool";
  content: string;
  toolCalls: { name: string; ok: boolean; summary?: string }[];
  /** Welches Modell geantwortet hat. `null` bei eigenen Nachrichten. */
  model: string | null;
  createdAt: Date;
}

/** Wie viele Züge wörtlich mitgehen. Alles davor lebt in der Zusammenfassung. */
export const VERBATIM_TURNS = 12;
/** Ab wann verdichtet wird. */
export const SUMMARISE_AFTER = 20;

/**
 * Ein Gespräch holen oder anlegen.
 *
 * Die Zuordnung zur Person wird nachgeprüft, auch wenn eine Kennung
 * mitkommt: eine fremde `conversationId` darf kein fremdes Gespräch
 * öffnen. Die Zeilensicherheit fängt das ohnehin ab — aber sich auf
 * genau eine Verteidigungslinie zu verlassen ist der Grund, warum man
 * irgendwann keine mehr hat.
 */
export async function ensureConversation(
  userId: string,
  options: {
    conversationId?: string | null;
    kind?: ConversationKind;
    locale?: "de" | "en";
    route?: string | null;
    jobId?: string | null;
    applicationId?: string | null;
  } = {},
): Promise<{
  id: string;
  kind: ConversationKind;
  summary: string | null;
  messageCount: number;
  /**
   * Das Vorhaben, zu dem dieses Gespräch gehört.
   *
   * Es kommt von hier und nicht vom Browser. Die Chat-Route hatte
   * ein Feld `projektId` in ihrem Eingabeschema, das kein Client je
   * gefüllt hat — und selbst wenn: Welches Vorhaben offen ist, ist
   * eine Eigenschaft des Verlaufs und nichts, was der Aufrufer
   * bestimmen sollte.
   */
  projektId: string | null;
}> {
  const db = await getDb();
  const kind = options.kind ?? "assistant";

  return withUser(db, userId, async (tx) => {
    if (options.conversationId) {
      const [vorhanden] = await tx
        .select({
          id: schema.ninaConversations.id,
          kind: schema.ninaConversations.kind,
          summary: schema.ninaConversations.summary,
          messageCount: schema.ninaConversations.messageCount,
          projektId: schema.ninaConversations.projektId,
        })
        .from(schema.ninaConversations)
        .where(
          and(
            eq(schema.ninaConversations.id, options.conversationId),
            eq(schema.ninaConversations.userId, userId),
          ),
        )
        .limit(1);

      /*
       * Die Kennung gilt nur, wenn die ART dazu passt.
       *
       * Hier stand vorher `if (vorhanden) return vorhanden;` — die
       * Kennung genügte. Das war die Ursache der Kontextvermischung,
       * über die sich Menschen beschwert haben:
       *
       *   Jemand führt das Karrieregespräch unter /app/monday. Der
       *   Client merkt sich dessen Kennung. Danach geht er auf den
       *   Arbeitswelt-Radar und fragt Monday etwas über eine Meldung.
       *   Der Client schickt `kind: "assistant"` — aber dieselbe
       *   Kennung. Und diese Zeile gab dann das KARRIEREGESPRÄCH
       *   zurück.
       *
       * Die Frage zur Nachricht landete also im Interview, wurde dort
       * Teil des Verlaufs und floss in die nächste Interviewfrage ein.
       * Sichtbar war das als Monday, die mitten im Karrieregespräch über
       * eine Schlagzeile sprach.
       *
       * Eine Kennung, deren Art nicht stimmt, ist kein Auftrag, sondern
       * ein Irrtum des Aufrufers. Sie wird verworfen, und weiter unten
       * entsteht oder findet sich das richtige Gespräch.
       */
      if (vorhanden && vorhanden.kind === kind) return vorhanden;
    }

    /*
     * Das Karrieregespräch ist eines pro Person, nicht eines pro
     * Besuch. Wer die Seite dreimal öffnet, führt nicht drei
     * Interviews — und drei halbe Interviews wären schlimmer als
     * keines.
     */
    if (kind === "career_interview") {
      const [laufend] = await tx
        .select({
          id: schema.ninaConversations.id,
          kind: schema.ninaConversations.kind,
          summary: schema.ninaConversations.summary,
          messageCount: schema.ninaConversations.messageCount,
          projektId: schema.ninaConversations.projektId,
        })
        .from(schema.ninaConversations)
        .where(
          and(
            eq(schema.ninaConversations.userId, userId),
            eq(schema.ninaConversations.kind, "career_interview"),
            isNull(schema.ninaConversations.archivedAt),
          ),
        )
        .orderBy(desc(schema.ninaConversations.updatedAt))
        .limit(1);
      if (laufend) return laufend;
    }

    const [neu] = await tx
      .insert(schema.ninaConversations)
      .values({
        userId,
        kind,
        locale: options.locale ?? "de",
        originRoute: options.route?.split("?")[0] ?? null,
        jobId: options.jobId ?? null,
        applicationId: options.applicationId ?? null,
      })
      .returning({
        id: schema.ninaConversations.id,
        kind: schema.ninaConversations.kind,
        summary: schema.ninaConversations.summary,
        messageCount: schema.ninaConversations.messageCount,
        projektId: schema.ninaConversations.projektId,
      });

    return neu!;
  });
}

/**
 * Eine Nachricht anhängen.
 *
 * Die laufende Nummer entsteht in derselben Anweisung wie das Einfügen.
 * Sie vorher zu lesen und danach zu schreiben wäre ein Rennen, das bei
 * zwei gleichzeitigen Anfragen genau die Reihenfolge zerstört, die das
 * Gespräch ausmacht.
 */
export async function appendMessage(
  userId: string,
  conversationId: string,
  message: {
    role: "user" | "assistant" | "tool";
    content: string;
    toolCalls?: { name: string; ok: boolean; summary?: string }[];
    route?: string | null;
    jobId?: string | null;
    model?: string | null;
    inputTokens?: number | null;
    outputTokens?: number | null;
    latencyMs?: number | null;
    fromVoice?: boolean;
  },
): Promise<{ id: string; index: number }> {
  const db = await getDb();

  return withUser(db, userId, async (tx) => {
    const [row] = await tx
      .insert(schema.ninaMessages)
      .values({
        conversationId,
        userId,
        index: sql`(
          SELECT coalesce(max("index"), 0) + 1
          FROM nina_messages
          WHERE conversation_id = ${conversationId}
        )`,
        role: message.role,
        content: message.content,
        toolCalls: message.toolCalls ?? [],
        contextRoute: message.route?.split("?")[0] ?? null,
        contextJobId: message.jobId ?? null,
        model: message.model ?? null,
        inputTokens: message.inputTokens ?? null,
        outputTokens: message.outputTokens ?? null,
        latencyMs: message.latencyMs ?? null,
        fromVoice: message.fromVoice ?? false,
      })
      .returning({ id: schema.ninaMessages.id, index: schema.ninaMessages.index });

    // Titel aus der ersten Nutzernachricht. Eine Gesprächsliste, in der
    // zehnmal „Gespräch“ steht, ist keine Liste.
    const titel =
      message.role === "user" && row!.index <= 1
        ? message.content.replace(/\s+/g, " ").slice(0, 70)
        : undefined;

    await tx
      .update(schema.ninaConversations)
      .set({
        messageCount: sql`${schema.ninaConversations.messageCount} + 1`,
        updatedAt: new Date(),
        ...(titel ? { title: titel } : {}),
        ...(message.jobId ? { jobId: message.jobId } : {}),
      })
      .where(eq(schema.ninaConversations.id, conversationId));

    return row!;
  });
}

/** Der vollständige Verlauf — für die Anzeige, nicht für das Modell. */
export async function loadMessages(
  userId: string,
  conversationId: string,
  limit = 200,
): Promise<StoredMessage[]> {
  const db = await getDb();
  const rows = await withUser(db, userId, (tx) =>
    tx
      .select({
        id: schema.ninaMessages.id,
        index: schema.ninaMessages.index,
        role: schema.ninaMessages.role,
        content: schema.ninaMessages.content,
        /* Wer geschrieben hat — steht unter der Antwort, auch nach
           einem Neuladen. Ohne diese Zeile verlor die Angabe beim
           nächsten Öffnen ihren Wert und die Unterhaltung sah aus,
           als hätte immer dasselbe Modell geantwortet. */
        model: schema.ninaMessages.model,
        toolCalls: schema.ninaMessages.toolCalls,
        createdAt: schema.ninaMessages.createdAt,
      })
      .from(schema.ninaMessages)
      .where(eq(schema.ninaMessages.conversationId, conversationId))
      .orderBy(asc(schema.ninaMessages.index))
      .limit(limit),
  );
  return rows as StoredMessage[];
}

/**
 * Was an das Modell geht.
 *
 * Die Zusammenfassung des Alten plus die letzten Züge wörtlich. Nicht
 * der ganze Verlauf — das ist der Unterschied zwischen einem Gespräch,
 * das mit der Zeit besser wird, und einem, das mit der Zeit teurer
 * wird.
 */
export async function loadModelContext(
  userId: string,
  conversationId: string,
): Promise<{ summary: string | null; turns: { role: "user" | "assistant"; content: string }[] }> {
  const db = await getDb();

  return withUser(db, userId, async (tx) => {
    const [gespräch] = await tx
      .select({ summary: schema.ninaConversations.summary })
      .from(schema.ninaConversations)
      .where(eq(schema.ninaConversations.id, conversationId))
      .limit(1);

    const rows = await tx
      .select({ role: schema.ninaMessages.role, content: schema.ninaMessages.content })
      .from(schema.ninaMessages)
      .where(eq(schema.ninaMessages.conversationId, conversationId))
      .orderBy(desc(schema.ninaMessages.index))
      .limit(VERBATIM_TURNS);

    return {
      summary: gespräch?.summary ?? null,
      turns: rows
        .reverse()
        .filter((r): r is { role: "user" | "assistant"; content: string } =>
          r.role === "user" || r.role === "assistant",
        ),
    };
  });
}

export async function listConversations(
  userId: string,
  limit = 30,
): Promise<ConversationSummary[]> {
  const db = await getDb();
  const rows = await withUser(db, userId, (tx) =>
    tx
      .select({
        id: schema.ninaConversations.id,
        kind: schema.ninaConversations.kind,
        title: schema.ninaConversations.title,
        jobId: schema.ninaConversations.jobId,
        applicationId: schema.ninaConversations.applicationId,
        messageCount: schema.ninaConversations.messageCount,
        updatedAt: schema.ninaConversations.updatedAt,
      })
      .from(schema.ninaConversations)
      .where(
        and(
          eq(schema.ninaConversations.userId, userId),
          isNull(schema.ninaConversations.archivedAt),
        ),
      )
      .orderBy(desc(schema.ninaConversations.updatedAt))
      .limit(limit),
  );
  return rows as ConversationSummary[];
}

/** Muss verdichtet werden? Reine Funktion, damit die Schwelle prüfbar ist. */
export function needsSummary(messageCount: number, summarisedThrough: number): boolean {
  return messageCount - summarisedThrough >= SUMMARISE_AFTER;
}

export async function storeSummary(
  userId: string,
  conversationId: string,
  summary: string,
  throughIndex: number,
): Promise<void> {
  const db = await getDb();
  await withUser(db, userId, (tx) =>
    tx
      .update(schema.ninaConversations)
      .set({ summary, summarisedThroughIndex: throughIndex, updatedAt: new Date() })
      .where(eq(schema.ninaConversations.id, conversationId)),
  );
}

/**
 * Was verdichtet werden müsste — und was dafür gebraucht wird.
 *
 * Liefert `null`, solange die Schwelle nicht erreicht ist. Die
 * Entscheidung liegt bewusst hier und nicht in der Route: Sie hängt an
 * Zählern, die nur diese Datei kennt.
 */
export async function verdichtungsbedarf(
  userId: string,
  conversationId: string,
): Promise<{
  bisIndex: number;
  bisherigeZusammenfassung: string | null;
  zuege: { role: string; content: string }[];
} | null> {
  const db = await getDb();
  return withUser(db, userId, async (tx) => {
    const [g] = await tx
      .select({
        summary: schema.ninaConversations.summary,
        durch: schema.ninaConversations.summarisedThroughIndex,
      })
      .from(schema.ninaConversations)
      .where(eq(schema.ninaConversations.id, conversationId))
      .limit(1);
    if (!g) return null;

    const [z] = await tx
      .select({ hoechster: sql<number>`coalesce(max(${schema.ninaMessages.index}), 0)` })
      .from(schema.ninaMessages)
      .where(eq(schema.ninaMessages.conversationId, conversationId));
    const hoechster = Number(z?.hoechster ?? 0);
    if (!needsSummary(hoechster, g.durch)) return null;

    /*
     * Verdichtet wird alles bis auf die letzten wörtlichen Züge.
     *
     * Die bleiben im Wortlaut — sie gehen ohnehin mit. Würde man sie
     * mitverdichten, stünde dasselbe zweimal im Zusammenhang: einmal
     * wörtlich, einmal zusammengefasst.
     */
    const bisIndex = hoechster - VERBATIM_TURNS;
    if (bisIndex <= g.durch) return null;

    const rows = await tx
      .select({ role: schema.ninaMessages.role, content: schema.ninaMessages.content })
      .from(schema.ninaMessages)
      .where(
        and(
          eq(schema.ninaMessages.conversationId, conversationId),
          gt(schema.ninaMessages.index, g.durch),
          lte(schema.ninaMessages.index, bisIndex),
        ),
      )
      .orderBy(schema.ninaMessages.index);

    const zuege = rows.filter((r) => r.role === "user" || r.role === "assistant");
    if (zuege.length === 0) return null;
    return { bisIndex, bisherigeZusammenfassung: g.summary, zuege };
  });
}
