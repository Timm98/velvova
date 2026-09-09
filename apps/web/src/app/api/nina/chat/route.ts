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
  anbieterFuerModell,
  buildNinaSystemPrompt,
  modellAuswaehlen,
  anbieterMelden,
  type Anbieter,
  ModellNichtVerfuegbarError,
  route as routeTask,
  selectProvider,
  validateToolCall,
  zodToJsonSchema,
  type ToolName,
} from "@paycheck/ai";
import { getDb, schema, withUser } from "@paycheck/db";
import { projektAnlegenPruefen } from "@paycheck/domain";
import {
  completedGroups,
  gespraechstiefe,
  KARRIEREANALYSE_ANWEISUNG,
  KARRIEREANALYSE_FASSUNG,
  KarriereanalyseSchema,
  looksLikeJobRequest,
  modellFuer,
  PROGRESS_GROUPS,
  STAGE_STATUS_DE,
  ultraVerfuegbar,
  vergleichen,
} from "@paycheck/ai";
import { karriereanalyse } from "@paycheck/jobs";
import { loadRuntimeConfig } from "@paycheck/config";
import {
  bestandAufnehmen,
  extrahieren,
  verdichten,
  zugAnwenden,
  zustimmungVermerken,
} from "@/lib/nina/engine";
import { ninaJobSuggestions } from "@/lib/nina/suggest-jobs";
import { listJobsForUser, loadProfileContext } from "@/lib/matching";
import { buildContextEnvelope, buildScopedContext } from "@/lib/nina/context/build-context-envelope";
import { buildPageContext } from "@/lib/nina/page-context";
import {
  appendMessage,
  ensureConversation,
  loadModelContext,
  verdichtungsbedarf,
} from "@/lib/nina/conversations";
import {
  markInterviewCompleted,
  markInterviewProgress,
  rememberRoute,
  updateWorkflowState,
} from "@/lib/nina/workflow-state";
import { recordInterviewAnswer } from "@/lib/nina/interview-progress";
import { requireUser } from "@/lib/auth";
import { antwortVerbuchen, intelligenzstand } from "@/lib/nina/intelligenz";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Mondays Gespräch — eine Route für alle Seiten.
 *
 * Vorher gab es einen Weg für das Interview und keinen für den Rest.
 * Deshalb konnte Monday auf einer Jobseite nichts, und deshalb war ein
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
  /*
   * Ausdrückliche Zustimmung, Stellen zu sehen.
   *
   * Kommt von einem Knopf, nicht aus dem Gesprächsverlauf. „Klang, als
   * wollte er" ist keine Grundlage dafür, jemandem Stellen vorzusetzen.
   */
  agreeToSeeJobs: z.boolean().default(false),
  /*
   * Welches Modell antworten soll.
   *
   * `"auto"` oder gar nichts heisst: Monday entscheidet. Sonst die
   * interne Kennung aus /api/monday/models — nie eine API-Kennung.
   * Der Browser soll gar nicht wissen, wie die Modelle beim Anbieter
   * heissen; sonst steht irgendwann ein Anbietername in einer
   * Komponente.
   */
  modell: z.string().max(64).optional(),
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
  "request_career_analysis",
  "search_jobs",
  "save_job",
  "create_application",
  "projekt_anlegen",
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
  request_career_analysis: "Ich denke gründlich darüber nach",
  projekt_anlegen: "Vorhaben wird angelegt",
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
   *
   * ── Zwei Wege, und der zweite weicht nicht aus ──────────────
   *
   * Ohne ausdrückliche Wahl gilt die Konfiguration wie bisher.
   *
   * Mit ausdrücklicher Wahl gilt genau dieses Modell. Ist es nicht
   * verfügbar, bricht die Anfrage ab — sie fällt NICHT auf ein
   * anderes zurück. Wer ein Modell wählt, soll dieses bekommen oder
   * erfahren, warum nicht; eine Antwort von einem Modell, das er
   * nicht gewählt hat, wäre eine stille Lüge.
   */
  const gewaehlt =
    eingabe.modell && eingabe.modell !== "auto" ? eingabe.modell : null;

  let provider;
  try {
    if (gewaehlt) {
      const definition = modellAuswaehlen(gewaehlt);
      if (!definition) {
        return Response.json(
          {
            error: "modell_nicht_verfuegbar",
            message:
              "Dieses Modell steht gerade nicht zur Verfügung. " +
              "Wähle ein anderes oder stelle auf Automatisch.",
          },
          { status: 409 },
        );
      }
      const cfg = loadRuntimeConfig();
      provider = await anbieterFuerModell(definition, {
        maxTokens: cfg.ai.maxTokensPerRun,
        timeoutMs: cfg.ai.timeoutMs,
      });
    } else {
      provider = await selectProvider();
    }
  } catch (error) {
    if (error instanceof ModellNichtVerfuegbarError) {
      /*
       * Der Grund nennt die Umgebungsvariable und geht deshalb ins
       * Protokoll, nicht ans Netz. Nach draussen dieselbe Meldung wie
       * oben: Wer eine Kennung rät, soll aus der Antwort nichts über
       * die Einrichtung lernen.
       */
      console.warn("[monday] Modell nicht verfügbar:", error.message);
      return Response.json(
        {
          error: "modell_nicht_verfuegbar",
          message:
            "Dieses Modell steht gerade nicht zur Verfügung. " +
            "Wähle ein anderes oder stelle auf Automatisch.",
        },
        { status: 409 },
      );
    }
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

  /*
   * Verstehen, bevor geantwortet wird.
   *
   * `verarbeite` erkennt die Absicht, liest bei einer Angabe die
   * Bedingungen heraus und legt sie nach der Regel aus
   * `faktenregeln.ts` ab — ohne einen bestätigten Wert zu
   * überschreiben.
   *
   * Die Reihenfolge ist der Punkt: Was gerade gesagt wurde, muss im
   * Profil stehen, BEVOR Monday antwortet. Sonst antwortet sie auf
   * einen Stand, den sie im selben Zug überholt hat.
   *
   * Scheitert es, geht das Gespräch weiter. Eine Extraktion ist eine
   * Verbesserung der Antwort, keine Bedingung für sie — und ein
   * Gespräch, das an einer Nebenleistung abbricht, ist schlechter als
   * eines ohne sie.
   */
  /*
   * Die Verarbeitung läuft NEBEN dem Rest, nicht davor.
   *
   * Sie stand hier als `await` — mit dem Argument, was gerade gesagt
   * wurde, müsse im Profil stehen, BEVOR Monday antwortet. Das Argument
   * gilt weiterhin für das Profil; für die ANTWORTZEIT war es teuer:
   * Bei einer Angabe kostet die Verarbeitung einen eigenen
   * Modellaufruf, und der lag vor allen anderen Vorbereitungen.
   *
   * Gemessen an der Reihenfolge im Code: sieben Datenbankrunden
   * nacheinander, bevor das Modell überhaupt anfing. Bei einer Frage
   * wie „Wie sieht der Arbeitsalltag aus?" ist die Verarbeitung
   * ausserdem ein Leerlauf — sie steigt sofort wieder aus.
   *
   * Jetzt startet sie hier und wird erst gebraucht, wenn die Rückfragen
   * in den Kontext gehen. Bis dahin ist sie meistens fertig.
   */
  const verstandenLaeuft = import("@/lib/nina/orchestrator")
    .then((m) => m.verarbeite(user.id, eingabe.message))
    .catch((fehler) => {
      console.warn("[nina] Verarbeitung fehlgeschlagen:", fehler);
      return null;
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

  if (eingabe.agreeToSeeJobs) await zustimmungVermerken(user.id, true);

  /*
   * Bestand und Jobreife stehen VOR dem Modellaufruf fest.
   *
   * Sie gehen als Ansage in den Systemprompt. Ein Modell, das selbst
   * entscheidet, ob es schon Stellen zeigen darf, entscheidet
   * wohlwollend — und behauptet nach drei Antworten, den passenden Job
   * gefunden zu haben.
   */
  const jobAnfrage = looksLikeJobRequest(eingabe.message);
  const bestand = await bestandAufnehmen(user.id, { userAskedForJobs: jobAnfrage });

  /*
   * Den Abschluss vermerken, sobald er erreicht ist.
   *
   * ── Was hier gefehlt hat ──────────────────────────────────────
   *
   * `evaluateReadiness` rechnet seit dem ersten Entwurf aus, wann
   * genug verstanden ist — und `markInterviewCompleted` steht fertig
   * daneben, mit Kommentar, ohne einen einzigen Aufrufer. Der Zustand
   * blieb deshalb bei jedem auf `in_progress` stehen.
   *
   * Gemessen im Bestand: 61 Menschen haben angefangen, ein einziger
   * steht auf `completed`. `entryRoute` schickt alle anderen bei jedem
   * Besuch zurück ins Gespräch, obwohl Monday längst genug weiss.
   *
   * ── Warum `ready` und nicht „genug Fragen" ────────────────────
   *
   * `ready` heisst: 70 Punkte UND die Mindestangaben stehen. Das ist
   * dieselbe Schwelle, ab der Stellen überhaupt sinnvoll sortiert
   * werden — es wäre widersprüchlich, jemandem eine belastbare Liste
   * zu zeigen und ihn gleichzeitig als „mitten im Interview" zu
   * führen.
   *
   * `markInterviewProgress` oben überschreibt einen einmal erreichten
   * Abschluss nicht, und `updateWorkflowState` ist idempotent: Wer
   * weiterredet, verliert ihn nicht.
   */
  if (bestand.readiness.state === "ready") {
    await markInterviewCompleted(user.id).catch(() => {});
  }

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

  /* Hier wird das Ergebnis der Verarbeitung zum ersten Mal gebraucht.
     Alles davor lief parallel dazu. */
  const verstanden = await verstandenLaeuft;

  const systemPrompt = buildNinaSystemPrompt({
    locale: user.locale,
    confirmedFacts: scoped.confirmedFacts,
    openHypotheses: scoped.openHypotheses,
    hardConstraints: scoped.hardConstraints,
    rejectedStatements: scoped.rejectedStatements,
    currentStage: bestand.stage,
    jobReadiness: {
      state: bestand.readiness.state,
      score: bestand.readiness.score,
      missing: bestand.readiness.missing,
    },
    userName: user.displayName,
    /*
     * Die offene Rückfrage kommt in die Seitenlage.
     *
     * Wenn die gerade gelesene Angabe einer bestätigten widerspricht,
     * darf Monday nicht so tun, als sei nichts gewesen — und sie darf
     * auch nicht einfach überschreiben. Sie fragt.
     *
     * Der Satz steht bewusst hier und nicht als eigene Nachricht: Monday
     * soll ihn in ihre Antwort einweben, nicht als Formular
     * dazwischenschieben.
     */
    pageBriefing: [
      seite.briefing || "",
      ...(verstanden?.rueckfragen ?? []).map(
        (f) => `Offene Rückfrage aus dem letzten Satz — stell sie beiläufig: ${f}`,
      ),
    ]
      .filter(Boolean)
      .join("\n") || undefined,
    externalProviderActive: true,
  });

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
  /*
   * ══════════════════════════════════════════════════════════════
   * Die Eskalation, die hier gefehlt hat
   * ══════════════════════════════════════════════════════════════
   *
   * Der Kommentar darüber stand seit dem ersten Entwurf und stimmte
   * zur Hälfte: DEFAULT war der Regelfall, und eskaliert wurde nie.
   * Jede Frage lief über dasselbe Modell — „Hallo" genauso wie „soll
   * ich mit vier Jahren Einzelhandel in die IT wechseln".
   *
   * `gespraechstiefe` liest die Form der Frage, nicht einzelne
   * Wörter: Wägt sie ab? Nennt sie eine Lebensentscheidung? Bittet
   * jemand ausdrücklich um Gründlichkeit? Kein Modellaufruf — der
   * würde die Wartezeit jeder Nachricht verdoppeln, um zu klären,
   * welcher Aufruf folgt.
   *
   * Das Interview behält seine eigene Aufgabe: Dort ist der Zweck
   * bekannt und muss nicht aus dem Satz erschlossen werden.
   */
  const tiefe = gespraechstiefe(eingabe.message ?? "");
  const routing = routeTask(
    eingabe.kind === "career_interview" ? "career_interview" : tiefe.aufgabe,
  );

  /*
   * ══════════════════════════════════════════════════════════════
   * Hat die Person gerade eine Frage von Monday beantwortet?
   * ══════════════════════════════════════════════════════════════
   *
   * Wenn ja, wird die Antwort ein Beleg — und die Klärung schliesst
   * sich. Ohne diesen Schritt fragte Monday dieselbe Sache in zehn
   * Minuten noch einmal, und für die Person sähe es aus, als käme
   * ihre Antwort nirgends an.
   *
   * Es läuft NEBEN der Antwort, nicht davor: Die Person soll auf
   * ihren Satz eine Antwort bekommen und nicht auf eine
   * Datenbankrunde warten. Der neue Beleg wirkt sich erst auf die
   * nächste Synthese aus, und die läuft ohnehin im Hintergrund.
   *
   * Eine Bedienfrage („wie lösche ich mein Konto") zählt nicht als
   * Antwort. Sie als Aussage über die eigene Arbeitszeit abzulegen
   * wäre ein erfundener Beleg.
   */
  const antwortLaeuft = antwortVerbuchen(user.id, eingabe.message ?? "", {
    istBedienfrage: tiefe.merkmale.includes("Bedienfrage"),
  }).catch((fehler) => {
    console.warn("[nina] Klärungsantwort fehlgeschlagen:", fehler);
    return null;
  });
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
        stage: bestand.stage,
        // Eine menschliche Statuszeile, kein „Frage 3 von 40“.
        stageStatus: STAGE_STATUS_DE[bestand.stage],
        readiness: {
          state: bestand.readiness.state,
          score: bestand.readiness.score,
          missing: bestand.readiness.missing,
          reason: bestand.readiness.reason,
        },
        workflow: {
          stage: envelope.workflowStage,
          lastCompletedAction: envelope.lastCompletedAction,
          pendingAction: envelope.pendingAction,
        },
      });

      let antwort = "";
      const werkzeuge: { name: string; ok: boolean; summary?: string }[] = [];
      let modell: string | null = null;
      /*
       * Der Anbieter kommt aus demselben Ereignis wie das Modell.
       *
       * Hier stand `provider: "openai"` fest im Protokolleintrag,
       * während `model` echt war. Seit die Registry auch zu Anthropic
       * und Google routet, wurde damit JEDER Lauf als OpenAI
       * verbucht — inklusive der Läufe, die nachweislich woanders
       * liefen.
       *
       * Das ist nicht bloss ein falsches Feld. Kosten je Anbieter,
       * Ausfallraten und jeder spätere Vergleich zwischen Modellen
       * lesen genau diese Spalte. Eine Auswertung darauf wäre nicht
       * ungenau gewesen, sondern verkehrt.
       *
       * `event.usage.provider` setzt der Adapter, der tatsächlich
       * geantwortet hat — nicht der, den wir ausgewählt zu haben
       * glauben. Bei einem Ausweichmodell ist das der Unterschied.
       */
      let anbieter: string | null = null;
      let inputTokens: number | null = null;
      let outputTokens: number | null = null;
      let latenz: number | null = null;

      try {
        /*
         * Die Agentenschleife.
         *
         * Ein Zug kann mit einem Werkzeugaufruf enden statt mit Text.
         * Dann hat das Modell etwas getan und nie gesagt, was dabei
         * herauskam — in der Oberfläche sieht das aus, als hätte Monday
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

              const ergebnis = await runTool(user.id, check.name, check.input, gespräch.id);
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
              anbieter = event.usage.provider ?? anbieter;
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
         * nichts gesagt. In der Oberfläche ist das nicht von „Monday
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
              anbieter = event.usage.provider ?? anbieter;
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
              /*
               * Warum diese Stufe — nicht nur welche.
               *
               * Ohne die Merkmale wäre später nicht zu klären, warum
               * eine Nachricht das teure Modell bekam und die
               * nächste nicht. „tier: DEEP" allein ist die Sorte
               * Protokollzeile, die man liest und danach genauso
               * ratlos ist.
               *
               * Keine Nutzertexte — nur die Namen der Merkmale.
               */
              rationale:
                tiefe.merkmale.length > 0
                  ? `${tiefe.tiefe}: ${tiefe.merkmale.join(", ")}`
                  : tiefe.tiefe,
              provider: anbieter ?? provider.name,
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

        /*
         * Dem Schutzschalter sagen, dass es geklappt hat.
         *
         * Erst hier, nicht beim ersten Zeichen: Ein Strom, der nach
         * der Hälfte abreisst, ist kein gelungener Aufruf, und ihn
         * als solchen zu melden würde einen Schalter offen halten,
         * der zumachen sollte.
         */
        anbieterMelden((anbieter ?? provider.name) as Anbieter, true);
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
        const grund = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
        console.error("[nina/chat] Modellaufruf fehlgeschlagen:", grund);

        /*
         * Und dem Schutzschalter, dass es nicht geklappt hat.
         *
         * Er sortiert selbst, ob das dem Anbieter anzulasten ist:
         * Ein abgelehntes Dokument darf einen gesunden Anbieter nicht
         * aus dem Betrieb nehmen. Deshalb geht der Text mit und nicht
         * nur ein Zähler.
         */
        anbieterMelden((anbieter ?? provider.name) as Anbieter, false, grund);

        /*
         * ── Und den Fehlschlag ins Protokoll ──────────────────────
         *
         * Hier stand nichts. Eingetragen wurde nur der Erfolgsfall,
         * mit `status: "ok"` — `ai_runs` zeigte also 100 Prozent
         * Erfolg, gleichgültig was tatsächlich geschah.
         *
         * Das ist schlimmer als eine Lücke. Kosten je Anbieter,
         * Ausfallraten, jeder Modellvergleich und jede
         * Gesundheitsanzeige lesen genau diese Tabelle. Sie hätten
         * nicht wenig gezeigt, sondern durchweg das Beste — und
         * niemand hätte einen Grund gehabt, daran zu zweifeln.
         *
         * `failed` und `timeout` stehen seit jeher im Enum. Sie
         * wurden nur nie geschrieben.
         *
         * `model: "unbekannt"`, wenn der Aufruf scheiterte, bevor ein
         * Modell antwortete. Die Spalte lässt nichts anderes zu, und
         * ein erfundener Modellname wäre in einem Vergleich schlimmer
         * als ein ehrliches Eingeständnis.
         */
        await db
          .insert(schema.aiRuns)
          .values({
            userId: user.id,
            purpose: eingabe.kind,
            taskType: routing.task,
            tier: routing.tier,
            provider: (anbieter ?? provider.name) as string,
            model: modell ?? "unbekannt",
            promptKey: NINA_PROMPT_KEY,
            promptVersion: NINA_PROMPT_VERSION,
            inputTokens,
            outputTokens,
            latencyMs: latenz,
            status: /abort|timeout|frist/i.test(grund) ? "timeout" : "failed",
            /* Nur die Ursache, nie der Inhalt der Anfrage. */
            errorMessage: grund.slice(0, 400),
          })
          .catch(() => undefined);

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
         * als hätte Monday nichts gesagt, obwohl sie angefangen hatte.
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

          /*
           * Die strukturierte Auswertung — NACH dem sichtbaren Text.
           *
           * Die Person hat ihre Antwort schon gelesen; eine Analyse
           * davor wäre Wartezeit, die niemand sieht und jeder spürt.
           * Sie läuft auf der schnellen Stufe und schreibt
           * ausschließlich UNBESTÄTIGTE Hypothesen.
           *
           * Schlägt sie fehl, ist das kein Fehler des Gesprächs: die
           * Nachrichten stehen, es fehlt nur die Auswertung — und die
           * holt der nächste Zug nach.
           */
          /*
           * Das Gespräch verdichten, wenn es lang geworden ist.
           *
           * Ohne diesen Aufruf sah Monday nur die letzten zwölf Züge und
           * nichts davor — die Zusammenfassung, die das auffangen
           * soll, wurde nie geschrieben. Gemessen: 181 Gespräche, null
           * Zusammenfassungen, das längste 47 Nachrichten.
           *
           * Läuft nach dem sichtbaren Text und meistens gar nicht: nur
           * wenn seit der letzten Verdichtung genug dazugekommen ist.
           */
          const bedarf = await verdichtungsbedarf(user.id, gespräch.id).catch(() => null);
          if (bedarf) {
            await verdichten({
              userId: user.id,
              locale: user.locale,
              conversationId: gespräch.id,
              ...bedarf,
            }).catch(() => {});
          }

          const turn = await extrahieren({
            userId: user.id,
            locale: user.locale,
            stage: bestand.stage,
            userMessage: eingabe.message,
            assistantMessage: antwort,
            bekannteFakten: [...scoped.confirmedFacts, ...scoped.openHypotheses].slice(0, 40),
          }).catch(() => null);

          if (turn) {
            const angewendet = await zugAnwenden(user.id, turn, {
              conversationId: gespräch.id,
              userAskedForJobs: jobAnfrage,
            }).catch(() => null);

            if (angewendet) {
              await db
                .update(schema.ninaMessages)
                .set({
                  stage: angewendet.stage,
                  recommendedAction: turn.recommended_action,
                })
                .where(eq(schema.ninaMessages.id, gespeichert!.id))
                .catch(() => undefined);

              /*
               * Jobs nur, wenn der Server sie erlaubt UND Monday sie
               * gerade zeigen will.
               *
               * Zwei Bedingungen, die beide gelten müssen: die Reife ist
               * die Serverentscheidung, `show_jobs` die des Modells. Nur
               * eine von beiden reicht nicht — sonst zeigt entweder ein
               * Modell Stellen, die es nicht zeigen darf, oder der
               * Server drängt sie mitten in eine andere Frage.
               */
              /*
               * Wer ausdrücklich nach Stellen fragt, bekommt sie.
               *
               * Vorher mussten ZWEI Bedingungen gelten: das Modell
               * musste `show_jobs` empfehlen UND die Reife durfte
               * nicht `not_ready` sein. Das war richtig gedacht — der
               * Server soll niemandem Stellen mitten in eine andere
               * Frage drängen — und falsch für den einen Fall, um den
               * es geht: „zeig mir Jobs". Dann stand da eine
               * Empfehlung, aber keine Stelle.
               *
               * `jobAnfrage` ist die dritte Tür: Hat die Person selbst
               * danach gefragt, wird gezeigt. Die Reifeprüfung bleibt
               * für den Fall, dass MONDAY es vorschlägt — dort ist
               * Zurückhaltung richtig.
               *
               * Ehrlich bleibt es, weil jede Karte ihre Passung und
               * ihre Sicherheit mitbringt. Wer wenig über sich gesagt
               * hat, sieht eine niedrige Sicherheit — nicht eine
               * geschönte Auswahl.
               */
              if (
                jobAnfrage ||
                (turn.recommended_action === "show_jobs" &&
                  angewendet.readiness.state !== "not_ready")
              ) {
                const vorschläge = await ninaJobSuggestions(user.id, 3).catch(() => []);
                if (vorschläge.length > 0) send({ type: "jobs", jobs: vorschläge });
              }

              send({
                type: "turn",
                stage: angewendet.stage,
                stageStatus: STAGE_STATUS_DE[angewendet.stage],
                stageChanged: angewendet.stageChanged,
                recommendedAction: turn.recommended_action,
                readiness: {
                  state: angewendet.readiness.state,
                  score: angewendet.readiness.score,
                  missing: angewendet.readiness.missing,
                  reason: angewendet.readiness.reason,
                },
                confirmationRequired: angewendet.zurBestätigung,
                roleHypotheses: angewendet.gespeicherteHypothesen,
                /*
                 * Der Fortschritt geht mit hinaus.
                 *
                 * Vorher kam er nur beim Seitenaufbau — der Drawer zeigte
                 * dann bei 97 Reifepunkten noch „0 Bereiche klar“, weil er
                 * den Stand vom Öffnen der Seite trug.
                 */
                progressGroups: PROGRESS_GROUPS.map((g) => ({
                  key: g.key,
                  label: g.label,
                  done: completedGroups(angewendet.evidence).includes(g.key),
                })),
              });
            }
          }
        }

        /*
         * ══════════════════════════════════════════════════════════
         * Was Monday weiss, geht mit hinaus
         * ══════════════════════════════════════════════════════════
         *
         * Synthese, Karriereanalyse, offene Frage, Widersprüche,
         * harte Konflikte und höchstens ein proaktiver Hinweis. Keine
         * Oberfläche zeigt das heute an — es steht trotzdem hier,
         * damit der Bildschirm später nicht das Feld erfindet, das
         * gerade ins Layout passt.
         *
         * ── Warum der Moment mitentscheidet ─────────────────────
         *
         * Eine Bedienfrage ist der falsche Anlass für eine Rückfrage
         * zum Berufsweg. „Wie lösche ich mein Konto" mit „Was musst
         * du mindestens verdienen?" zu beantworten wäre ein Produkt,
         * das nicht zuhört. Der Hinweis geht dann nicht verloren — er
         * wird nur nicht als gezeigt vermerkt und kommt beim nächsten
         * Mal.
         */
        const antwort_klaerung = await antwortLaeuft;
        const momentPasst =
          !tiefe.merkmale.includes("Bedienfrage") && antwort.trim().length > 0;

        const stand = await intelligenzstand(user.id, { momentPasst }).catch((fehler) => {
          console.warn("[nina] Intelligenzstand fehlgeschlagen:", fehler);
          return null;
        });

        if (stand) {
          send({
            type: "intelligenz",
            ...stand,
            /* Ob diese Nachricht eine offene Klärung geschlossen hat. */
            klaerungBeantwortet: antwort_klaerung?.schluessel ?? null,
            syntheseFaellig: antwort_klaerung?.faelligkeit.faellig ?? false,
          });
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
  /*
   * Das laufende Gespräch.
   *
   * Bisher brauchte kein Werkzeug es — `projekt_anlegen` schon: Es
   * ordnet das Gespräch dem neuen Vorhaben zu. Ohne diese Zuordnung
   * entstünde ein Vorhaben ohne Verlauf, und das Gespräch, in dem es
   * beschlossen wurde, läge daneben.
   */
  conversationId: string,
): Promise<{ ok: boolean; output?: unknown; error?: string }> {
  const db = await getDb();

  try {
    switch (name) {
      /*
       * ══════════════════════════════════════════════════════════
       * Die Tiefenanalyse als Werkzeug
       * ══════════════════════════════════════════════════════════
       *
       * Dasselbe Werkzeug für Chat und Sprache. Im Sprachmodus
       * antwortet Monday über das Realtime-Modell — schnell und für ein
       * Gespräch richtig, für eine Karriereanalyse das falsche
       * Werkzeug. Statt es tiefer denken zu lassen, fordert es die
       * Analyse an und erzählt danach das Ergebnis.
       *
       * Zwei Wege hiessen früher oder später zwei verschiedene
       * Antworten auf dieselbe Frage.
       */
      case "request_career_analysis": {
        const data = input as z.infer<(typeof ToolSchemas)["request_career_analysis"]>;
        const cfg = loadRuntimeConfig();
        const provider = await selectProvider(cfg);
        const ultra = modellFuer(cfg, "ULTRA");

        const rufer = (modell?: string) => async (fakten: string) => {
          const a = await provider.structuredGenerate({
            system: KARRIEREANALYSE_ANWEISUNG,
            schema: KarriereanalyseSchema,
            schemaName: "karriereanalyse",
            messages: [{ role: "user", content: fakten }],
            tier: "deep",
            temperature: 0,
            ...(modell ? { modell } : {}),
          });
          return { ergebnis: a.data as Record<string, unknown>, modell: a.usage.model, konfidenz: a.data.confidence };
        };

        const befund = await karriereanalyse(db, {
          userId,
          rufer: rufer(),
          zweitrufer: async (f) => {
            const r = await rufer(ultra.modell)(f);
            return { ergebnis: r.ergebnis, modell: r.modell };
          },
          zweitmeinungMoeglich: ultraVerfuegbar(cfg),
          vergleichen: (a, b) => vergleichen(a, b),
          promptFassung: KARRIEREANALYSE_FASSUNG,
          /* Eine ausdrückliche Bitte umgeht den Zwischenspeicher. */
          frisch: data.ausdruecklichGruendlich,
        });

        /*
         * Was zurückgeht, ist das Ergebnis — und der Hinweis, falls
         * zwei Durchgänge auseinandergingen. Welches Modell was
         * gesagt hat, gehört nicht ins Gespräch.
         */
        return {
          ok: true,
          output: {
            analyse: befund.analyse,
            hinweis: befund.hinweis,
            naechsteFrage: befund.naechsteFrage,
            grund: befund.analyse === null ? befund.grund : null,
          },
        };
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
        /*
         * ══════════════════════════════════════════════════════════
         * Dieselbe Suche wie auf der Stellenseite — nicht eine zweite
         * ══════════════════════════════════════════════════════════
         *
         * Hier stand eine eigene Abfrage:
         *
         *   WHERE is_demo = false
         *     AND (title ILIKE '%…%' OR company.name ILIKE '%…%')
         *   LIMIT n
         *
         * Zwei Fehler in vier Zeilen.
         *
         * Der erste ist die Geschwindigkeit. Ein `ILIKE` mit führendem
         * Prozentzeichen kann keinen Index benutzen — bei 3,37
         * Millionen Zeilen mit Verbund auf `companies` ist das ein
         * vollständiger Durchlauf. Im Protokoll standen dafür
         * Antwortzeiten von 2,3 und 4,1 MINUTEN. So lange stand im
         * Gespräch „Denkt nach".
         *
         * Der zweite ist die Güte. Die Abfrage nahm die ersten
         * Treffer, die der Datenbank einfielen: keine Reihenfolge,
         * kein Profil, keine Bedingungen, kein Ort, kein Gehalt. Wer
         * „zeig mir Jobs" sagt, bekam irgendwelche Stellen, deren
         * Titel den Suchbegriff enthielt.
         *
         * `listJobsForUser` ist der Weg, den die Stellenseite geht:
         * Vorauswahl über den Volltextindex, dann Bewertung gegen das
         * Profil, dann Aussortieren dessen, was die Bedingungen
         * verletzt. Dieselbe Rechnung, dieselben Zahlen — und wenn
         * Monday drei Stellen nennt, sind es dieselben drei, die auf
         * der Seite oben stehen.
         */
        const data = input as z.infer<(typeof ToolSchemas)["search_jobs"]>;
        const ctx = await loadProfileContext(userId);
        const { jobs } = await listJobsForUser(userId, ctx, {
          suche: data.query ?? null,
          /*
           * Zwölf Kandidaten je gezeigter Stelle — dieselbe Regel wie
           * auf der Seite. Wer drei sehen will, braucht genug
           * bewertete, damit die drei besten auch wirklich die besten
           * sind.
           */
          sichtbar: data.limit,
          limit: data.limit * 3,
        });

        /*
         * Die Arbeitsform filtert erst danach.
         *
         * Sie ist eine harte Bedingung, kein Rangkriterium — und
         * `listJobsForUser` kennt sie nicht. Nachträglich zu filtern
         * ist hier richtig: Es entfernt, was nicht passt, ohne die
         * Reihenfolge des Restes zu verändern.
         */
        const passend = data.remoteType
          ? jobs.filter((j) => j.job.workModel === data.remoteType)
          : jobs;

        return {
          ok: true,
          output: {
            count: Math.min(passend.length, data.limit),
            jobs: passend.slice(0, data.limit).map((j) => ({
              id: j.jobId,
              title: j.job.title,
              companyName: j.job.companyName,
              location: j.job.location,
              workModel: j.job.workModel,
              /*
               * Passung und Sicherheit gehören dazu, sonst nennt
               * Monday drei Stellen, ohne sagen zu können, warum
               * gerade diese.
               */
              fit: j.fit.band,
              reason: j.fit.topReason,
              caveat: j.fit.topReservation || null,
            })),
          },
        };
      }

      /*
       * ══════════════════════════════════════════════════════════
       * Ein Vorhaben anlegen
       * ══════════════════════════════════════════════════════════
       *
       * Das Modell hat gefragt und eine Zustimmung behauptet. Was es
       * NICHT entscheiden darf, steht in `projektAnlegenPruefen`:
       * ob der Name taugt, ob es das Vorhaben schon gibt, ob die
       * Leiste noch Platz hat.
       *
       * Der Fall „gibt es schon" ist dabei kein Fehler. Wer nach drei
       * Wochen wieder über Zürich spricht, meint dasselbe Vorhaben —
       * ein zweites daneben wäre für ihn nicht unterscheidbar, und
       * seine Stellen lägen danach in zwei Töpfen. Also wird das
       * vorhandene geöffnet und das gesagt.
       */
      case "projekt_anlegen": {
        const data = input as z.infer<(typeof ToolSchemas)["projekt_anlegen"]>;

        const vorhandene = await withUser(db, userId, (tx) =>
          tx
            .select({
              id: schema.projekte.id,
              name: schema.projekte.name,
              status: schema.projekte.status,
            })
            .from(schema.projekte)
            .where(eq(schema.projekte.userId, userId)),
        );

        const urteil = projektAnlegenPruefen(data.name, vorhandene);

        if (!urteil.erlaubt && urteil.grund === "existiert") {
          return {
            ok: true,
            output: {
              projektId: urteil.vorhandenesId,
              name: urteil.name,
              neu: false,
              hinweis: "Dieses Vorhaben gibt es bereits — ich benutze es weiter.",
            },
          };
        }
        if (!urteil.erlaubt) return { ok: false, error: urteil.hinweis };

        const [angelegt] = await withUser(db, userId, (tx) =>
          tx
            .insert(schema.projekte)
            .values({ userId, name: urteil.name, ziel: data.ziel })
            .returning({ id: schema.projekte.id }),
        );
        if (!angelegt) return { ok: false, error: "Das Vorhaben konnte nicht angelegt werden." };

        /*
         * Das laufende Gespräch gehört ab jetzt dazu.
         *
         * Ohne diese Zeile entstünde ein Vorhaben ohne Verlauf, und
         * das Gespräch, in dem es beschlossen wurde, läge daneben.
         */
        await withUser(db, userId, (tx) =>
          tx
            .update(schema.ninaConversations)
            .set({ projektId: angelegt.id })
            .where(
              and(
                eq(schema.ninaConversations.id, conversationId),
                eq(schema.ninaConversations.userId, userId),
              ),
            ),
        );

        return { ok: true, output: { projektId: angelegt.id, name: urteil.name, neu: true } };
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
