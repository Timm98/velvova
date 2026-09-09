import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";
import { z } from "zod";
import { storeSummary } from "./conversations.ts";
import {
  EXTRACTION_SYSTEM_DE,
  EXTRACTION_SYSTEM_EN,
  NinaTurnSchema,
  evaluateReadiness,
  resolveStage,
  route,
  selectProvider,
  type NinaStage,
  type NinaTurn,
  type ReadinessResult,
  type StageEvidence,
  NINA_PROMPT_KEY,
  NINA_PROMPT_VERSION,
} from "@paycheck/ai";

/**
 * Mondays Maschinenraum.
 *
 * Hier passiert das, was die Person nicht sieht und worauf sich alles
 * verlässt: zählen, was tatsächlich bekannt ist; entscheiden, ob eine
 * Stufe weitergehen darf; ausrechnen, ob eine Jobliste belastbar wäre.
 *
 * Zwei Grundsätze:
 *
 *   **Gezählt wird, was in der Datenbank steht** — nicht, was das
 *   Modell meint. Ein Modell, das seinen eigenen Fortschritt schätzt,
 *   schätzt ihn wohlwollend.
 *
 *   **Alles Neue ist zunächst eine Hypothese.** Bestätigen darf
 *   ausschließlich ein Mensch. Das ist der Unterschied zwischen einem
 *   Karriereprofil und einem Chatprotokoll mit Selbstbewusstsein.
 */

/** Die Herkunftsmarke, an der die Zählung die Kategorie erkennt. */
const HERKUNFT = "nina:v3";

/*
 * Die Zuordnung Feld → Evidenztyp.
 *
 * Sie steht hier einmal und wird in beide Richtungen benutzt: beim
 * Speichern und beim Zählen. Zwei getrennte Zuordnungen wären zwei
 * Gelegenheiten, sie auseinanderlaufen zu lassen — und die Zählung
 * würde dann still zu wenig finden.
 */
const FELD_ZU_TYP = {
  goals: "motive",
  career_evidence: "experience_episode",
  skills: "skill",
  preferred_tasks: "preference",
  disliked_tasks: "preference",
  work_style_preferences: "work_environment",
  values: "motive",
  constraints: "constraint",
} as const;

type ExtraktFeld = keyof typeof FELD_ZU_TYP;

/** `sourceRef` trägt das Feld, damit die Zählung es wiederfindet. */
function quelle(feld: ExtraktFeld, stage: NinaStage): string {
  return `${HERKUNFT}:${feld}:${stage}`;
}

/* ── Bestandsaufnahme ──────────────────────────────────────────── */

export interface Bestand extends StageEvidence {
  readiness: ReadinessResult;
  stage: NinaStage;
}

/**
 * Was wissen wir über diesen Menschen?
 *
 * Eine Abfrage, kein Dutzend: alle Belege auf einmal, dann in JavaScript
 * gruppiert. Bei den Mengen, um die es hier geht (unter 200 Zeilen je
 * Person), ist das schneller als acht Zählabfragen — und deutlich
 * leichter richtig zu halten.
 */
export async function bestandAufnehmen(
  userId: string,
  options: { userAskedForJobs?: boolean } = {},
): Promise<Bestand> {
  const db = await getDb();

  const [belege, hypothesen, einstellungen, zustand] = await withUser(db, userId, async (tx) => [
    await tx
      .select({
        sourceRef: schema.evidenceItems.sourceRef,
        confirmed: schema.evidenceItems.userConfirmed,
        rejected: schema.evidenceItems.userRejected,
        type: schema.evidenceItems.type,
      })
      .from(schema.evidenceItems)
      .where(and(eq(schema.evidenceItems.userId, userId), isNull(schema.evidenceItems.deletedAt)))
      .limit(400),
    await tx
      .select({ id: schema.ninaRoleHypotheses.id })
      .from(schema.ninaRoleHypotheses)
      .where(
        and(
          eq(schema.ninaRoleHypotheses.userId, userId),
          eq(schema.ninaRoleHypotheses.userRejected, false),
        ),
      )
      .limit(50),
    await tx
      .select({
        baseLocation: schema.userSettings.baseLocation,
        jobMarket: schema.userSettings.jobMarketCountry,
        remote: schema.userSettings.remotePreference,
      })
      .from(schema.userSettings)
      .where(eq(schema.userSettings.userId, userId))
      .limit(1),
    await tx
      .select({
        stage: schema.workflowStates.ninaStage,
        agreed: schema.workflowStates.agreedToSeeJobs,
      })
      .from(schema.workflowStates)
      .where(eq(schema.workflowStates.userId, userId))
      .limit(1),
  ]);

  const aktiv = belege.filter((b) => !b.rejected);
  const zählen = (feld: ExtraktFeld) =>
    aktiv.filter((b) => b.sourceRef?.startsWith(`${HERKUNFT}:${feld}:`)).length;

  const ort = einstellungen[0];
  const evidence: StageEvidence = {
    goals: zählen("goals"),
    careerEvidence: zählen("career_evidence"),
    skills: zählen("skills"),
    preferredTasks: zählen("preferred_tasks"),
    dislikedTasks: zählen("disliked_tasks"),
    workStyle: zählen("work_style_preferences"),
    values: zählen("values"),
    constraints: zählen("constraints"),
    roleHypotheses: hypothesen.length,
    confirmed: aktiv.filter((b) => b.confirmed).length,
    /*
     * Ort und Remote kommen aus den Einstellungen, nicht aus dem
     * Gespräch. Sie sind dort verbindlich gesetzt — was jemand
     * nebenbei erwähnt, ist eine Erwähnung, keine Suchbedingung.
     */
    hasLocation: Boolean(ort?.baseLocation) || Boolean(ort?.jobMarket),
    hasRemotePreference: Boolean(ort?.remote && ort.remote !== "no_preference"),
  };

  const readiness = evaluateReadiness({
    ...evidence,
    userAgreedToSeeJobs: zustand[0]?.agreed ?? false,
    userExplicitlyAskedForJobs: options.userAskedForJobs ?? false,
  });

  return { ...evidence, readiness, stage: (zustand[0]?.stage as NinaStage) ?? "orientation" };
}

/* ── Extraktion ────────────────────────────────────────────────── */

/**
 * Aus einem Gesprächszug strukturierte Daten gewinnen.
 *
 * Läuft auf der schnellen Stufe und NACH dem sichtbaren Strom. Die
 * Person hat ihre Antwort dann schon gelesen; eine Analyse davor wäre
 * Wartezeit, die niemand sieht und jeder spürt.
 *
 * Gibt `null` zurück, wenn das Modell nichts Gültiges liefert. Das ist
 * ein Ergebnis, kein Ausnahmefall — der Gesprächszug bleibt trotzdem
 * gespeichert, es fehlt nur die Auswertung.
 */
export async function extrahieren(input: {
  /** Für das Protokoll. Ohne ihn ließe sich der Lauf niemandem zuordnen. */
  userId: string;
  locale: "de" | "en";
  stage: NinaStage;
  userMessage: string;
  assistantMessage: string;
  bekannteFakten: string[];
}): Promise<NinaTurn | null> {
  const provider = await selectProvider();
  const routing = route("document_extraction");

  const eingabe = [
    `AKTUELLE STUFE: ${input.stage}`,
    input.bekannteFakten.length > 0
      ? `BEREITS BEKANNT (nicht erneut aufnehmen):\n${input.bekannteFakten.map((f) => `- ${f}`).join("\n")}`
      : "BEREITS BEKANNT: nichts",
    "",
    `NUTZER: ${input.userMessage}`,
    "",
    `BEGLEITUNG: ${input.assistantMessage}`,
  ].join("\n");

  try {
    const ergebnis = await provider.structuredGenerate({
      system: input.locale === "en" ? EXTRACTION_SYSTEM_EN : EXTRACTION_SYSTEM_DE,
      messages: [{ role: "user", content: eingabe }],
      schema: NinaTurnSchema,
      schemaName: "nina_turn",
      tier: routing.providerTier,
    });

    /*
     * Auch dieser Lauf gehört ins Protokoll.
     *
     * Ohne ihn zeigt die Kostenübersicht nur das Gespräch — und die
     * Extraktion läuft bei JEDEM Zug. Eine Hälfte der Rechnung wäre
     * unsichtbar, und ausgerechnet die, die man am ehesten wegoptimieren
     * würde.
     *
     * `structuredOutputValid: true` steht hier zu Recht: kam die Antwort
     * bis hierher, hat sie das Schema erfüllt. Der Fehlerzweig unten
     * schreibt `false`.
     */
    await protokollieren(input.userId, routing.task, routing.tier, "ok", true, ergebnis.usage);
    return ergebnis.data;
  } catch (fehler) {
    /*
     * Kein Grund, das Gespräch zu stören — aber ein Grund, es zu
     * protokollieren.
     *
     * Die Nachricht ist gespeichert, die Antwort steht auf dem
     * Bildschirm. Was fehlt, ist die Auswertung. Ohne diese Zeile
     * fehlte sie stillschweigend: keine Belege, keine Stufe, keine
     * Reife — und von außen sieht das aus wie „Monday merkt sich
     * nichts", nicht wie ein fehlgeschlagener Aufruf.
     */
    console.error(
      "[nina/extraktion] fehlgeschlagen:",
      fehler instanceof Error ? `${fehler.name}: ${fehler.message}` : String(fehler),
    );
    await protokollieren(input.userId, routing.task, routing.tier, "failed", false).catch(
      () => undefined,
    );
    return null;
  }
}

/**
 * Einen Modelllauf vermerken. Nur Kennzahlen, kein Inhalt.
 *
 * Protokolle werden gelesen, und dort haben Gespräche nichts zu suchen.
 */
async function protokollieren(
  userId: string,
  taskType: string,
  tier: string,
  status: "ok" | "failed",
  structuredOutputValid: boolean,
  usage?: { provider: string; model: string; inputTokens: number | null; outputTokens: number | null; latencyMs: number | null },
): Promise<void> {
  const db = await getDb();
  await db
    .insert(schema.aiRuns)
    .values({
      userId,
      purpose: "nina_extraction",
      taskType,
      tier,
      /* Nicht "openai": Ein Fehlschlag ohne Nutzungsdaten weiss den
         Anbieter nicht, und ihn zu raten verfälscht genau die Spalte,
         aus der Ausfallraten je Anbieter gelesen werden. */
      provider: usage?.provider ?? "unbekannt",
      model: usage?.model ?? "unbekannt",
      promptKey: NINA_PROMPT_KEY,
      promptVersion: NINA_PROMPT_VERSION,
      inputTokens: usage?.inputTokens ?? null,
      outputTokens: usage?.outputTokens ?? null,
      latencyMs: usage?.latencyMs ?? null,
      status,
      structuredOutputValid,
    })
    .catch(() => undefined);
}

/* ── Persistenz ────────────────────────────────────────────────── */

export interface AnwendungsErgebnis {
  stage: NinaStage;
  stageChanged: boolean;
  stageReason: string;
  readiness: ReadinessResult;
  gespeicherteHypothesen: number;
  zurBestätigung: string[];
  /** Der neu gezählte Stand. Die Oberfläche zeigt ihn sofort an. */
  evidence: StageEvidence;
}

/**
 * Das Ergebnis eines Zuges anwenden.
 *
 * Reihenfolge mit Absicht: erst speichern, dann neu zählen, dann über
 * die Stufe entscheiden. Andersherum entschiede man über einen Stand,
 * den es noch nicht gibt.
 *
 * Alles Neue ist unbestätigt. Es gibt in dieser Funktion keinen Pfad,
 * der `userConfirmed: true` setzt — bestätigen kann nur ein Mensch,
 * und zwar über `confirmEvidence()` im Profil.
 */
export async function zugAnwenden(
  userId: string,
  turn: NinaTurn,
  options: { conversationId: string; userAskedForJobs?: boolean },
): Promise<AnwendungsErgebnis> {
  const db = await getDb();
  const extrakt = turn.extracted;

  if (extrakt) {
    const zeilen: (typeof schema.evidenceItems.$inferInsert)[] = [];

    for (const feld of Object.keys(FELD_ZU_TYP) as ExtraktFeld[]) {
      for (const fund of extrakt[feld] ?? []) {
        zeilen.push({
          userId,
          type: FELD_ZU_TYP[feld] as (typeof schema.evidenceItems.$inferInsert)["type"],
          // Der Beleg gehört an die Aussage. Eine Aussage ohne ihre
          // Herkunft lässt sich später nicht mehr prüfen — und genau das
          // müsste man tun, bevor sie in eine Bewerbung wandert.
          statement: fund.statement.slice(0, 1000),
          sourceType: "ai_hypothesis",
          sourceRef: quelle(feld, turn.current_stage),
          confidence: fund.confidence,
          userConfirmed: false,
          userRejected: false,
        });
      }
    }

    if (zeilen.length > 0) {
      await withUser(db, userId, (tx) => tx.insert(schema.evidenceItems).values(zeilen));
    }

    /*
     * Rollenhypothesen nur mit Begründung.
     *
     * `basedOn` ist Pflicht im Schema. Eine ungewöhnliche Rolle ohne
     * Angabe, worauf sie beruht, ist ein Einfall — und ein Einfall, der
     * wie eine Empfehlung aussieht, ist schlimmer als kein Vorschlag.
     */
    const rollen = (extrakt.role_hypotheses ?? []).filter((r) => r.basedOn.trim().length > 0);
    if (rollen.length > 0) {
      await withUser(db, userId, (tx) =>
        tx.insert(schema.ninaRoleHypotheses).values(
          rollen.map((r) => ({
            userId,
            conversationId: options.conversationId,
            role: r.role.slice(0, 120),
            groupKind: r.group,
            basedOn: r.basedOn.slice(0, 400),
            difference: r.difference || null,
            gap: r.gap || null,
            smallTest: r.smallTest || null,
            confidence: r.confidence,
          })),
        ),
      );
    }
  }

  // Jetzt erst zählen — der neue Stand ist drin.
  const bestand = await bestandAufnehmen(userId, { userAskedForJobs: options.userAskedForJobs });

  const stufe = resolveStage(bestand.stage, turn.next_stage_suggestion, bestand);

  await withUser(db, userId, (tx) =>
    tx
      .update(schema.workflowStates)
      .set({
        ninaStage: stufe.stage,
        jobReadinessState: bestand.readiness.state,
        jobReadinessScore: bestand.readiness.score,
        profileCompleteness: Math.min(100, Math.round(bestand.readiness.score)),
        updatedAt: sql`now()`,
      })
      .where(eq(schema.workflowStates.userId, userId)),
  );

  return {
    stage: stufe.stage,
    stageChanged: stufe.changed,
    stageReason: stufe.reason,
    readiness: bestand.readiness,
    gespeicherteHypothesen: (extrakt?.role_hypotheses ?? []).length,
    zurBestätigung: turn.confirmation_required,
    evidence: bestand,
  };
}

/**
 * Zustimmung vermerken, Stellen zu sehen.
 *
 * Eine eigene Funktion und eine eigene Spalte, weil es eine eigene
 * Entscheidung ist. Sie aus dem Gesprächsverlauf abzuleiten hieße:
 * jemandem Stellen vorzusetzen, weil er „so klang, als wollte er".
 */
export async function zustimmungVermerken(userId: string, zugestimmt: boolean): Promise<void> {
  const db = await getDb();
  await withUser(db, userId, (tx) =>
    tx
      .update(schema.workflowStates)
      .set({ agreedToSeeJobs: zugestimmt, updatedAt: sql`now()` })
      .where(eq(schema.workflowStates.userId, userId)),
  );
}

/* ── Verdichtung ───────────────────────────────────────────────── */

/* Ein Feld. Der Umweg über ein Schema erzwingt reinen Text ohne
   Vorrede — bei freier Ausgabe kommt regelmässig „Hier ist die
   Zusammenfassung:" mit. */
const VerdichtungSchema = z.object({
  zusammenfassung: z.string(),
});

const VERDICHTUNG_SYSTEM_DE = `Du verdichtest ein Gespräch zwischen einer Berufsbegleitung und einem Menschen.

Schreibe eine Zusammenfassung in höchstens zwölf Sätzen, in der dritten Person, auf Deutsch.

Enthalten sein muss, was für den weiteren Verlauf zählt:
- was die Person über ihre bisherige Arbeit gesagt hat
- was sie sucht und was sie ausschliesst
- welche Bedingungen sie genannt hat (Ort, Zeit, Geld, Gesundheit, Familie)
- worüber schon gesprochen wurde, damit es nicht erneut gefragt wird
- offene Fragen, die noch nicht beantwortet sind

Regeln:
- Nur was tatsächlich gesagt wurde. Keine Schlüsse, keine Vermutungen, keine Ratschläge.
- Zahlen und Orte wörtlich übernehmen.
- Wo etwas unklar blieb, schreibe, dass es unklar blieb.
- Keine Anrede, keine Einleitung, kein Fazit. Nur der verdichtete Inhalt.`;

const VERDICHTUNG_SYSTEM_EN = `You condense a conversation between a career companion and a person.

Write a summary of at most twelve sentences, in the third person, in English.

Include what matters for what follows: what the person said about their work so far, what they
are looking for and what they rule out, the conditions they named (place, time, money, health,
family), what has already been discussed so it is not asked again, and questions still open.

Rules: only what was actually said — no inferences, no advice. Keep numbers and places verbatim.
Where something stayed unclear, say that it stayed unclear. No salutation, no preamble, no
conclusion.`;

/**
 * Ein langes Gespräch verdichten.
 *
 * ── Was hier gefehlt hat ──────────────────────────────────────
 *
 * `loadModelContext` gibt Monday die letzten zwölf Züge wörtlich mit,
 * dazu die Zusammenfassung des Davor. `needsSummary` und
 * `storeSummary` standen fertig im Code, mit Schwelle bei zwanzig
 * Zügen — und keinen einzigen Aufrufer.
 *
 * Gemessen: 181 Gespräche, null Zusammenfassungen, das längste 47
 * Nachrichten. Alles vor dem zwölftletzten Zug war schlicht weg. Von
 * aussen sieht das aus wie „Monday merkt sich nichts" — und war es auch.
 *
 * ── Warum nach dem Strom und mit `structuredGenerate` ─────────
 *
 * Dieselbe Stelle wie die Extraktion: Die Person hat ihre Antwort
 * gelesen, hier wartet niemand. Und dasselbe Protokoll — sonst wäre
 * ein Teil der Rechnung unsichtbar.
 *
 * Schlägt es fehl, bleibt die alte Zusammenfassung stehen und der
 * nächste Zug versucht es erneut. Der Verlust wäre eine schlechtere
 * Erinnerung, kein kaputtes Gespräch.
 */
export async function verdichten(input: {
  userId: string;
  locale: string;
  conversationId: string;
  bisIndex: number;
  bisherigeZusammenfassung: string | null;
  zuege: { role: string; content: string }[];
}): Promise<void> {
  if (input.zuege.length === 0) return;
  const provider = await selectProvider();
  const routing = route("document_extraction");

  const eingabe = [
    input.bisherigeZusammenfassung
      ? `BISHERIGE ZUSAMMENFASSUNG:\n${input.bisherigeZusammenfassung}`
      : "BISHERIGE ZUSAMMENFASSUNG: keine",
    "",
    "GESPRÄCH:",
    ...input.zuege.map((z) => `${z.role === "user" ? "MENSCH" : "BEGLEITUNG"}: ${z.content}`),
  ].join("\n");

  try {
    const ergebnis = await provider.structuredGenerate({
      system: input.locale === "en" ? VERDICHTUNG_SYSTEM_EN : VERDICHTUNG_SYSTEM_DE,
      messages: [{ role: "user", content: eingabe }],
      schema: VerdichtungSchema,
      schemaName: "nina_verdichtung",
      tier: routing.providerTier,
    });
    await protokollieren(input.userId, routing.task, routing.tier, "ok", true, ergebnis.usage);
    const text = ergebnis.data.zusammenfassung.trim();
    if (text.length < 20) return;
    await storeSummary(input.userId, input.conversationId, text, input.bisIndex);
  } catch (fehler) {
    console.error(
      "[nina/verdichtung] fehlgeschlagen:",
      fehler instanceof Error ? `${fehler.name}: ${fehler.message}` : String(fehler),
    );
    await protokollieren(input.userId, routing.task, routing.tier, "failed", false).catch(() => {});
  }
}
