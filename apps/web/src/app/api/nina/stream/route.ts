import { and, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  NINA_PROMPT_KEY,
  NINA_PROMPT_VERSION,
  TOOL_DESCRIPTIONS,
  TOOL_NAMES,
  ToolSchemas,
  WRITING_TOOLS,
  buildNinaSystemPrompt,
  selectProvider,
  validateToolCall,
  zodToJsonSchema,
  type ToolName,
} from "@paycheck/ai";
import { loadGate } from "@/lib/gate";
import { getDb, schema, withUser } from "@paycheck/db";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Ninas Gespräch als Ereignisstrom.
 *
 * Der Aufbau folgt drei Regeln, die zusammen den Unterschied zwischen
 * „ein Chatfenster“ und „eine Assistenz, der man Daten anvertraut“
 * ausmachen:
 *
 * 1. **Der Verlauf liegt bei uns.** An das Modell geht nur, was der
 *    aktuelle Schritt braucht: die verdichtete Zusammenfassung und die
 *    letzten Züge. Kein externes Modellgedächtnis, keine Abhängigkeit
 *    davon, was ein Anbieter aufbewahrt.
 *
 * 2. **Werkzeuge laufen serverseitig und geprüft.** Die Nutzerkennung
 *    kommt aus der Sitzung, nie aus dem Werkzeugaufruf. Ein Modell kann
 *    nicht in fremde Daten schreiben, weil es die Kennung gar nicht
 *    beeinflusst.
 *
 * 3. **Der Zustand ist sichtbar.** Jeder Werkzeugaufruf erzeugt ein
 *    eigenes Ereignis mit lesbarem Text. Eine Wartezeit ohne Aussage
 *    wirkt doppelt so lang.
 */

const BodySchema = z.object({
  sessionId: z.string().uuid().optional(),
  message: z.string().min(1).max(8000),
  stage: z.string().max(64).optional(),
  questionKey: z.string().max(120).nullable().optional(),
});

/** Was der Person angezeigt wird, während ein Werkzeug läuft. */
const RUNNING_LABEL: Record<ToolName, string> = {
  save_interview_answer: "Antwort wird gespeichert",
  create_or_update_evidence: "Profil wird ergänzt",
  update_user_preference: "Einstellung wird vorgeschlagen",
  generate_career_profile_draft: "Profilentwurf entsteht",
  confirm_profile_item: "Bestätigung wird vorgelegt",
  search_jobs: "Stellen werden durchsucht",
  get_job_detail: "Stelle wird geladen",
  save_job: "Stelle wird gemerkt",
  calculate_match: "Passung wird berechnet",
  create_application: "Bewerbung wird angelegt",
  generate_document_draft: "Entwurf entsteht",
  schedule_follow_up: "Erinnerung wird angelegt",
};

export async function POST(request: Request) {
  const user = await requireUser();

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const { provider, usingRequested, fallbackReason } = await selectProvider();
  const db = await getDb();

  // Kontext: die verdichtete Zusammenfassung plus die letzten Züge.
  // Der vollständige Verlauf bleibt in der Datenbank.
  const recent = await withUser(db, user.id, (tx) =>
    tx
      .select({
        role: schema.interviewTurns.role,
        content: schema.interviewTurns.content,
      })
      .from(schema.interviewTurns)
      .where(eq(schema.interviewTurns.userId, user.id))
      .orderBy(sql`${schema.interviewTurns.createdAt} desc`)
      .limit(12),
  );

  const messages = [
    ...recent
      .reverse()
      .filter((t) => t.role === "user" || t.role === "assistant")
      .map((t) => ({ role: t.role as "user" | "assistant", content: t.content })),
    { role: "user" as const, content: parsed.data.message },
  ];

  const tools = TOOL_NAMES.map((name) => ({
    name,
    description: TOOL_DESCRIPTIONS[name],
    parameters: zodToJsonSchema(ToolSchemas[name]),
  }));

  // Der Prompt kennt den Zustand des Profils. Ohne ihn würde Nina nach
  // Dingen fragen, die längst bestätigt sind — und Bestätigtes erneut
  // als Vermutung behandeln.
  const gate = await loadGate(user.id);
  const evidence = await withUser(db, user.id, (tx) =>
    tx
      .select({
        statement: schema.evidenceItems.statement,
        confirmed: schema.evidenceItems.userConfirmed,
        rejected: schema.evidenceItems.userRejected,
      })
      .from(schema.evidenceItems)
      .where(eq(schema.evidenceItems.userId, user.id))
      .limit(120),
  );

  const systemPrompt = buildNinaSystemPrompt({
    locale: "de",
    confirmedFacts: evidence.filter((e) => e.confirmed && !e.rejected).map((e) => e.statement),
    openHypotheses: evidence.filter((e) => !e.confirmed && !e.rejected).map((e) => e.statement),
    hardConstraints: [],
    rejectedStatements: evidence.filter((e) => e.rejected).map((e) => e.statement),
    currentStage: parsed.data.stage ?? gate.missingStages[0] ?? "experience_episodes",
    externalProviderActive: provider.name !== "mock",
  });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }

      // Der Zustand des Anbieters steht am Anfang des Stroms, nicht in
      // einer Fußnote: wer eine Beispielantwort liest, soll das wissen,
      // bevor er sie liest.
      send({
          type: "meta",
          provider: provider.name,
          isMock: provider.name === "mock",
          fallbackReason,
        });

      try {
        for await (const event of provider.streamConversation({
          system: systemPrompt,
          messages,
          tier: "interactive",
          tools,
        })) {
          if (event.type === "text") {
            send({ type: "text", delta: event.delta });
            continue;
          }

          if (event.type === "tool_call") {
            const check = validateToolCall(event.name, event.input);

            if (!check.ok) {
              // Ein unbekanntes Werkzeug ist ein Versuch, etwas zu tun,
              // das es nicht gibt. Das wird protokolliert, nicht
              // ausgeführt.
              send({ type: "tool_error", name: event.name, message: check.error });
              continue;
            }

            send({
              type: "tool_start",
              id: event.id,
              name: check.name,
              label: RUNNING_LABEL[check.name],
              writes: WRITING_TOOLS.includes(check.name),
            });

            const result = await runTool(user.id, check.name, check.input);
            send({ type: "tool_done", id: event.id, name: check.name, ok: result.ok, output: result.output });
            continue;
          }

          if (event.type === "error") {
            send({ type: "error", message: event.message });
            continue;
          }

          if (event.type === "done") {
            // Nur Kennzahlen, kein Inhalt: Protokolle werden gelesen,
            // und dort haben Gespräche nichts zu suchen.
            await db
              .insert(schema.aiRuns)
              .values({
                userId: user.id,
                purpose: "interview_chat",
                provider: event.usage.provider,
                model: event.usage.model,
                promptKey: NINA_PROMPT_KEY,
                promptVersion: NINA_PROMPT_VERSION,
                inputTokens: event.usage.inputTokens,
                outputTokens: event.usage.outputTokens,
                latencyMs: event.usage.latencyMs,
                status: "ok",
              })
              .catch(() => undefined);

            send({ type: "done", model: event.usage.model, latencyMs: event.usage.latencyMs });
          }
        }
      } catch (error) {
        send({
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : "Das Gespräch wurde unterbrochen. Deine bisherigen Angaben sind gespeichert.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

/**
 * Ein Werkzeug ausführen.
 *
 * Die Nutzerkennung ist ein Parameter dieser Funktion und kommt aus der
 * Sitzung. Sie steht in keinem Werkzeugschema — genau deshalb kann kein
 * Gespräch sie beeinflussen.
 */
async function runTool(
  userId: string,
  name: ToolName,
  input: unknown,
): Promise<{ ok: boolean; output?: unknown; error?: string }> {
  const db = await getDb();

  try {
    switch (name) {
      case "save_interview_answer": {
        const data = input as z.infer<(typeof ToolSchemas)["save_interview_answer"]>;
        return { ok: true, output: { saved: true, length: data.answer.length } };
      }

      case "create_or_update_evidence": {
        const data = input as z.infer<(typeof ToolSchemas)["create_or_update_evidence"]>;
        // Was das Modell ableitet, ist unbestätigt. Auf "bestätigt"
        // setzt ausschließlich ein Mensch, und zwar im Karriereprofil.
        const [row] = await withUser(db, userId, (tx) =>
          tx
            .insert(schema.evidenceItems)
            .values({
              userId,
              statement: data.statement,
              type: "skill",
              sourceType: "ai_hypothesis",
              sourceRef: data.sourceRef ?? "interview:tool",
              confidence: data.confidence,
              userConfirmed: false,
              userRejected: false,
            })
            .returning({ id: schema.evidenceItems.id }),
        );
        return { ok: true, output: { id: row?.id, status: "inferred" } };
      }

      case "search_jobs": {
        const data = input as z.infer<(typeof ToolSchemas)["search_jobs"]>;
        const pattern = data.query ? `%${data.query.replace(/[%_]/g, (m) => `\\${m}`)}%` : null;

        const rows = await db
          .select({
            id: schema.jobs.id,
            title: schema.jobs.title,
            companyName: schema.companies.name,
            location: schema.jobs.location,
          })
          .from(schema.jobs)
          .innerJoin(schema.companies, eq(schema.companies.id, schema.jobs.companyId))
          .where(
            and(
              eq(schema.jobs.isDemo, false),
              data.remoteType ? eq(schema.jobs.workModel, data.remoteType) : undefined,
              pattern
                ? or(ilike(schema.jobs.title, pattern), ilike(schema.companies.name, pattern))
                : undefined,
            ),
          )
          .limit(data.limit);

        return { ok: true, output: { count: rows.length, jobs: rows } };
      }

      case "save_job": {
        const data = input as z.infer<(typeof ToolSchemas)["save_job"]>;
        await withUser(db, userId, (tx) =>
          tx
            .insert(schema.savedJobs)
            .values({ userId, jobId: data.jobId })
            .onConflictDoNothing(),
        );
        return { ok: true, output: { saved: true } };
      }

      case "create_application": {
        const data = input as z.infer<(typeof ToolSchemas)["create_application"]>;
        const [row] = await withUser(db, userId, (tx) =>
          tx
            .insert(schema.applications)
            .values({ userId, jobId: data.jobId, stage: "preparing" })
            .returning({ id: schema.applications.id }),
        );
        return { ok: true, output: { applicationId: row?.id } };
      }

      default:
        // Ausdrücklich kein stiller Erfolg. Ein Werkzeug, das noch nicht
        // ausgeführt wird, meldet das — sonst hält das Modell den
        // Vorgang für erledigt und redet darüber, als wäre er es.
        return {
          ok: false,
          error: `Das Werkzeug ${name} ist noch nicht angeschlossen. Es wurde nichts geändert.`,
        };
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Das Werkzeug ist fehlgeschlagen.",
    };
  }
}
