import { and, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import {
  AiNotConfiguredError,
  NINA_PROMPT_KEY,
  NINA_PROMPT_VERSION,
  TOOL_DESCRIPTIONS,
  ToolSchemas,
  WRITING_TOOLS,
  aiUnavailableMessage,
  buildNinaSystemPrompt,
  route as routeTask,
  selectProvider,
  validateToolCall,
  zodToJsonSchema,
  type ToolName,
} from "@paycheck/ai";
import { getDb, schema, withUser } from "@paycheck/db";
import { buildContextEnvelope, buildScopedContext } from "@/lib/nina/context/build-context-envelope";
import { buildPageContext } from "@/lib/nina/page-context";
import { appendMessage, ensureConversation, loadModelContext } from "@/lib/nina/conversations";
import { markInterviewProgress, rememberRoute, updateWorkflowState } from "@/lib/nina/workflow-state";
import { recordInterviewAnswer } from "@/lib/nina/interview-progress";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Ninas Gespräch — eine Route für alle Seiten.
 *
 * Vorher gab es einen Weg für das Interview und keinen für den Rest.
 * Deshalb konnte Nina auf einer Jobseite nichts, und deshalb war ein
 * Gespräch nach dem Seitenwechsel verschwunden.
 *
 * Vier Eigenschaften, die zusammen den Unterschied zwischen einem
 * Chatfenster und einer Assistenz ausmachen, der man Daten anvertraut:
 *
 * 1. **Die Nutzerkennung kommt aus der Sitzung.** Sie steht in keinem
 *    Schema, das ein Modell befüllen könnte.
 *
 * 2. **Die Nutzernachricht wird VOR dem Modellaufruf gespeichert.**
 *    Bricht der Aufruf ab, ist die Frage trotzdem da. Die umgekehrte
 *    Reihenfolge verliert genau das, was die Person getippt hat.
 *
 * 3. **An das Modell geht nie der ganze Verlauf.** Zusammenfassung,
 *    letzte Züge, Seitenkontext.
 *
 * 4. **Ohne eingerichtete KI kommt ein Fehler, keine Beispielantwort.**
 *    Eine erfundene Antwort ist von einer echten nicht zu
 *    unterscheiden — und die Person stützt Entscheidungen darauf.
 */

const BodySchema = z.object({
  message: z.string().min(1).max(8000),
  conversationId: z.string().uuid().nullish(),
  kind: z.enum(["career_interview", "assistant", "job_search"]).default("assistant"),
  /** Wo die Person gerade ist. Nur zur Auswahl des Kontexts, nie als Schlüssel. */
  route: z.string().max(200).default("/app"),
  jobId: z.string().uuid().nullish(),
  applicationId: z.string().uuid().nullish(),
  fromVoice: z.boolean().default(false),
});

/**
 * Die Werkzeuge, die in `runTool` tatsächlich etwas tun.
 *
 * Diese Liste ist die Wahrheit, nicht `TOOL_NAMES`. Wächst `runTool`,
 * wächst sie mit — und wer sie vergisst, merkt es daran, dass sein
 * neues Werkzeug nie aufgerufen wird. Das ist die richtige Richtung
 * zu scheitern: ein fehlendes Werkzeug fällt auf, ein Werkzeug, das
 * „erledigt“ meldet ohne etwas zu tun, nicht.
 */
const IMPLEMENTED_TOOLS = [
  /*
   * `save_interview_answer` steht hier NICHT.
   *
   * Es gab nur vor, etwas zu tun: es meldete `{ saved: true }` und
   * schrieb nichts. Gespeichert wird die Antwort ohnehin serverseitig,
   * bevor das Modell überhaupt läuft — `recordInterviewAnswer` erledigt
   * das. Das Werkzeug kostete also eine ganze Modellrunde, um eine
   * Unwahrheit über eine Arbeit zu erzählen, die schon getan war.
   */
  "create_or_update_evidence",
  "search_jobs",
  "save_job",
  "create_application",
] as const satisfies readonly ToolName[];

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
  const eingabe = parsed.data;

  /*
   * Der Anbieter zuerst — und ohne Rückfall.
   *
   * Schlägt das fehl, ist noch nichts gespeichert und noch nichts
   * behauptet. Die Person bekommt eine ehrliche Meldung statt eines
   * Gesprächs mit einem Gegenüber, das es nicht gibt.
   */
  let provider;
  try {
    provider = await selectProvider();
  } catch (error) {
    if (error instanceof AiNotConfiguredError) {
      return Response.json(
        { error: "ai_not_configured", message: aiUnavailableMessage() },
        { status: 503 },
      );
    }
    throw error;
  }

  const db = await getDb();

  const gespräch = await ensureConversation(user.id, {
    conversationId: eingabe.conversationId,
    kind: eingabe.kind,
    locale: user.locale,
    route: eingabe.route,
    jobId: eingabe.jobId,
    applicationId: eingabe.applicationId,
  });

  // Erst speichern, dann fragen. Bricht der Modellaufruf ab, ist die
  // Frage der Person trotzdem im Verlauf.
  await appendMessage(user.id, gespräch.id, {
    role: "user",
    content: eingabe.message,
    route: eingabe.route,
    jobId: eingabe.jobId,
    fromVoice: eingabe.fromVoice,
  });

  await Promise.all([
    rememberRoute(user.id, eingabe.route, {
      jobId: eingabe.jobId ?? undefined,
      applicationId: eingabe.applicationId ?? undefined,
    }),
    updateWorkflowState(user.id, { activeConversationId: gespräch.id }),
    eingabe.kind === "career_interview" ? markInterviewProgress(user.id) : Promise.resolve(),
    /*
     * Den Interviewfortschritt fortschreiben.
     *
     * Ohne diesen Aufruf bleibt die Sperre vor personalisierten
     * Vorschlägen für immer zu: sie zählt abgeschlossene Themen in
     * `interview_sessions`, und die wuchsen nur über den alten
     * Formularweg. Man konnte beliebig lange sprechen, ohne dass
     * irgendetwas aufging.
     */
    eingabe.kind === "career_interview"
      ? recordInterviewAnswer(user.id, eingabe.message, user.locale).catch(() => null)
      : Promise.resolve(null),
  ]);

  const [envelope, seite, verlauf] = await Promise.all([
    buildContextEnvelope(user.id, {
      conversationId: gespräch.id,
      applicationId: eingabe.applicationId,
      locale: user.locale,
    }),
    buildPageContext(user.id, {
      route: eingabe.route,
      jobId: eingabe.jobId,
      applicationId: eingabe.applicationId,
    }),
    loadModelContext(user.id, gespräch.id),
  ]);

  const scoped = await buildScopedContext(envelope, { recentTurnLimit: 0 });

  /*
   * Der Bauplan der Nachrichtenliste.
   *
   * Zusammenfassung als eigener Zug, dann die letzten Züge wörtlich.
   * Die aktuelle Nachricht steht schon in `verlauf` — sie wurde eben
   * gespeichert. Sie ein zweites Mal anzuhängen würde sie doppelt
   * zeigen, und das Modell würde sich wiederholen.
   */
  const messages = [
    ...(verlauf.summary
      ? [
          {
            role: "assistant" as const,
            content: `Bisheriger Gesprächsstand (verdichtet): ${verlauf.summary}`,
          },
        ]
      : []),
    ...verlauf.turns,
  ];

  const systemPrompt =
    buildNinaSystemPrompt({
      locale: user.locale,
      confirmedFacts: scoped.confirmedFacts,
      openHypotheses: scoped.openHypotheses,
      hardConstraints: scoped.hardConstraints,
      rejectedStatements: scoped.rejectedStatements,
      currentStage: envelope.workflowStage,
      externalProviderActive: true,
    }) + (seite.briefing ? `\n\nSEITENKONTEXT\n${seite.briefing}` : "");

  /*
   * Nur die Werkzeuge anbieten, die es wirklich gibt.
   *
   * Vorher gingen alle zwölf Schemata mit — sieben davon antworten mit
   * „ist noch nicht angeschlossen“. Das kostet zweimal: die Schemata
   * blähen jede Anfrage auf (der gemessene Eingabeteil lag bei rund
   * 10.000 Token), und wenn das Modell eines davon wählt, ist eine
   * ganze Runde verbrannt, bevor überhaupt etwas passiert.
   *
   * Ein Werkzeug anzubieten, das nichts tut, ist dieselbe Sorte
   * Unwahrheit wie eine erfundene Antwort — nur eine Ebene tiefer.
   */
  const tools = IMPLEMENTED_TOOLS.map((name) => ({
    name,
    description: TOOL_DESCRIPTIONS[name],
    parameters: zodToJsonSchema(ToolSchemas[name]),
  }));

  /*
   * Welche Stufe diese Nachricht bekommt, entscheidet der Router —
   * nicht diese Datei und schon gar nicht der Client. Ein Feld im
   * Anfragekörper, mit dem man das Modell wählen kann, ist ein Feld,
   * über das jemand die teure Stufe anfordert.
   *
   * Der Regelfall ist DEFAULT. Die tiefe Stufe wird gezielt eskaliert,
   * nicht standardmäßig benutzt.
   */
  const routing = routeTask(
    eingabe.kind === "career_interview" ? "career_interview" : "conversation",
  );
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let offen = true;
      function send(event: Record<string, unknown>) {
        if (!offen) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }

      send({
        type: "meta",
        conversationId: gespräch.id,
        scopeLabel: seite.scopeLabel,
        suggestions: seite.suggestions,
        workflow: {
          stage: envelope.workflowStage,
          lastCompletedAction: envelope.lastCompletedAction,
          pendingAction: envelope.pendingAction,
        },
      });

      let antwort = "";
      const werkzeuge: { name: string; ok: boolean; summary?: string }[] = [];
      let modell: string | null = null;
      let inputTokens: number | null = null;
      let outputTokens: number | null = null;
      let latenz: number | null = null;

      try {
        /*
         * Die Agentenschleife.
         *
         * Ein Zug kann mit einem Werkzeugaufruf enden statt mit Text.
         * Dann hat das Modell etwas getan und nie gesagt, was dabei
         * herauskam — in der Oberfläche sieht das aus, als hätte Nina
         * geschwiegen. Genau so war es: der Werkzeugaufruf lief, die
         * Antwort blieb leer.
         *
         * Also: Ergebnisse zurückgeben und weiterlaufen lassen, bis Text
         * kommt. Höchstens drei Runden — nicht als Vorsichtsmaßnahme,
         * sondern weil ein Modell, das nach drei Runden immer noch nur
         * Werkzeuge aufruft, in einer Schleife hängt und nicht arbeitet.
         */
        const MAX_RUNDEN = 2;
        let offeneErgebnisse: {
          id: string;
          name: string;
          arguments?: unknown;
          output: unknown;
        }[] = [];

        for (let runde = 0; runde < MAX_RUNDEN; runde += 1) {
          const dieseRunde: typeof offeneErgebnisse = [];
          let textInDieserRunde = false;

          for await (const event of provider.streamConversation({
            system: systemPrompt,
            messages,
            tier: routing.providerTier,
            tools,
            toolResults: offeneErgebnisse,
          })) {
            if (event.type === "text") {
              antwort += event.delta;
              textInDieserRunde = true;
              send({ type: "text", delta: event.delta });
              continue;
            }

            if (event.type === "tool_call") {
              const check = validateToolCall(event.name, event.input);
              if (!check.ok) {
                // Ein unbekanntes Werkzeug ist ein Versuch, etwas zu tun,
                // das es nicht gibt. Wird gemeldet, nicht ausgeführt.
                werkzeuge.push({ name: event.name, ok: false, summary: check.error });
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

              const ergebnis = await runTool(user.id, check.name, check.input);
              werkzeuge.push({ name: check.name, ok: ergebnis.ok, summary: ergebnis.error });
              dieseRunde.push({
                id: event.id,
                name: check.name,
                arguments: check.input,
                output: ergebnis.ok ? ergebnis.output : { fehler: ergebnis.error },
              });
              send({
                type: "tool_done",
                id: event.id,
                name: check.name,
                ok: ergebnis.ok,
                output: ergebnis.output,
              });
              continue;
            }

            if (event.type === "error") {
              send({ type: "error", message: event.message });
              continue;
            }

            if (event.type === "done") {
              modell = event.usage.model;
              // Tokens summieren sich über die Runden. Nur die letzte zu
              // zählen würde die Kosten kleinrechnen.
              inputTokens = (inputTokens ?? 0) + (event.usage.inputTokens ?? 0);
              outputTokens = (outputTokens ?? 0) + (event.usage.outputTokens ?? 0);
              latenz = (latenz ?? 0) + (event.usage.latencyMs ?? 0);
            }
          }

          // Text da oder nichts mehr zu tun: fertig.
          if (textInDieserRunde || dieseRunde.length === 0) break;
          offeneErgebnisse = [...offeneErgebnisse, ...dieseRunde];
        }

        /*
         * Wenn nach allen Runden kein Text kam: eine Schlussrunde OHNE
         * Werkzeuge.
         *
         * Ein Modell, das nur Werkzeuge aufruft, hat gearbeitet und
         * nichts gesagt. In der Oberfläche ist das nicht von „Nina
         * antwortet nicht“ zu unterscheiden — und genau so war es zu
         * beobachten: zwei von drei Zügen kamen mit null Zeichen an.
         *
         * Ohne Werkzeuge bleibt dem Modell nur das Sprechen. Die
         * Antwort kommt weiterhin vom Modell; hier wird nichts
         * erfunden, es wird nur die eine Möglichkeit weggenommen,
         * wieder auszuweichen.
         */
        if (antwort.trim().length === 0) {
          for await (const event of provider.streamConversation({
            system: systemPrompt,
            messages,
            tier: routing.providerTier,
            tools: [],
            toolResults: offeneErgebnisse,
          })) {
            if (event.type === "text") {
              antwort += event.delta;
              send({ type: "text", delta: event.delta });
              continue;
            }
            if (event.type === "done") {
              modell = event.usage.model;
              inputTokens = (inputTokens ?? 0) + (event.usage.inputTokens ?? 0);
              outputTokens = (outputTokens ?? 0) + (event.usage.outputTokens ?? 0);
              latenz = (latenz ?? 0) + (event.usage.latencyMs ?? 0);
            }
          }
        }

        // Nur Kennzahlen, kein Inhalt: Protokolle werden gelesen, und
        // dort haben Gespräche nichts zu suchen.
        if (modell) {
          await db
            .insert(schema.aiRuns)
            .values({
              userId: user.id,
              purpose: eingabe.kind,
              taskType: routing.task,
              tier: routing.tier,
              provider: "openai",
              model: modell,
              promptKey: NINA_PROMPT_KEY,
              promptVersion: NINA_PROMPT_VERSION,
              inputTokens,
              outputTokens,
              latencyMs: latenz,
              status: "ok",
            })
            .catch(() => undefined);
        }
      } catch (error) {
        /*
         * Der echte Grund gehört ins Serverprotokoll.
         *
         * Die Person bekommt einen verständlichen Satz — sie kann mit
         * "Unerwartetes Token in JSON" nichts anfangen. Aber wer das
         * Protokoll liest, muss den Grund sehen: eine Fehlermeldung, die
         * nirgends ankommt, macht aus einem behebbaren Problem ein
         * unsichtbares. Kein Gesprächsinhalt, nur die Ursache.
         */
        console.error(
          "[nina/chat] Modellaufruf fehlgeschlagen:",
          error instanceof Error ? `${error.name}: ${error.message}` : String(error),
        );

        send({
          type: "error",
          message:
            error instanceof AiNotConfiguredError
              ? aiUnavailableMessage()
              : "Das Gespräch wurde unterbrochen. Deine bisherige Nachricht ist gespeichert.",
        });
      } finally {
        /*
         * Die Antwort speichern, auch wenn sie unvollständig ist.
         *
         * Ein abgebrochener Strom hinterlässt sonst eine Frage ohne
         * Antwort im Verlauf — und beim nächsten Laden sieht es aus,
         * als hätte Nina nichts gesagt, obwohl sie angefangen hatte.
         */
        if (antwort.trim().length > 0 || werkzeuge.length > 0) {
          const gespeichert = await appendMessage(user.id, gespräch.id, {
            role: "assistant",
            content: antwort,
            toolCalls: werkzeuge,
            route: eingabe.route,
            jobId: eingabe.jobId,
            model: modell,
            inputTokens,
            outputTokens,
            latencyMs: latenz,
          }).catch(() => null);
          send({ type: "saved", messageId: gespeichert?.id ?? null });
        }

        send({ type: "done", model: modell, latencyMs: latenz });
        offen = false;
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
 * Die Nutzerkennung ist ein Parameter und kommt aus der Sitzung. Sie
 * steht in keinem Werkzeugschema — genau deshalb kann kein Gespräch sie
 * beeinflussen.
 */
async function runTool(
  userId: string,
  name: ToolName,
  input: unknown,
): Promise<{ ok: boolean; output?: unknown; error?: string }> {
  const db = await getDb();

  try {
    switch (name) {
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
              sourceRef: data.sourceRef ?? "nina:tool",
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
        const muster = data.query ? `%${data.query.replace(/[%_]/g, (m) => `\\${m}`)}%` : null;

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
              muster
                ? or(ilike(schema.jobs.title, muster), ilike(schema.companies.name, muster))
                : undefined,
            ),
          )
          .limit(data.limit);

        return { ok: true, output: { count: rows.length, jobs: rows } };
      }

      case "save_job": {
        const data = input as z.infer<(typeof ToolSchemas)["save_job"]>;
        await withUser(db, userId, (tx) =>
          tx.insert(schema.savedJobs).values({ userId, jobId: data.jobId }).onConflictDoNothing(),
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
        // angeschlossen ist, meldet das — sonst hält das Modell den
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
