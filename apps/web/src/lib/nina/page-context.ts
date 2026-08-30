import { and, eq } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";

/**
 * Was Nina auf DIESER Seite weiß.
 *
 * Der Umschlag (`build-context-envelope`) trägt, wer die Person ist und
 * wo sie im Vorgang steht. Hier kommt dazu, worüber gerade gesprochen
 * wird — die Stelle, die Bewerbung, die offenen Vermutungen.
 *
 * Entscheidend ist, was hier NICHT passiert: die Kennungen aus dem
 * Client werden nicht geglaubt. Jede wird gegen die Zeilensicherheit
 * gelesen. Kommt eine fremde Job- oder Bewerbungskennung herein, ist
 * das Ergebnis nicht „fremde Daten“, sondern `null`.
 */

export interface PageContext {
  /** Kurzer Satz für den Systemprompt. Leer, wenn es nichts zu sagen gibt. */
  briefing: string;
  /** Was Nina hier anbieten kann. Erscheint als Vorschläge im Drawer. */
  suggestions: string[];
  jobId: string | null;
  applicationId: string | null;
  /** Überschrift im Drawer: „Zu dieser Stelle“, „Zu deiner Bewerbung“ … */
  scopeLabel: string | null;
}

const LEER: PageContext = {
  briefing: "",
  suggestions: [],
  jobId: null,
  applicationId: null,
  scopeLabel: null,
};

function gehaltssatz(job: {
  salaryDisclosed: boolean;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  salaryPeriod: string;
}): string {
  // Schweigt die Anzeige, schweigt Nina. Eine Schätzung an dieser
  // Stelle wäre eine erfundene Zahl in einer Gehaltsverhandlung.
  if (!job.salaryDisclosed || (job.salaryMin === null && job.salaryMax === null)) {
    return "Gehalt: nicht angegeben (nicht schätzen, nicht behaupten).";
  }
  const von = job.salaryMin?.toLocaleString("de-DE");
  const bis = job.salaryMax?.toLocaleString("de-DE");
  const spanne = von && bis ? `${von}–${bis}` : (von ?? bis);
  return `Gehalt laut Anzeige: ${spanne} ${job.salaryCurrency} pro ${job.salaryPeriod === "year" ? "Jahr" : job.salaryPeriod}.`;
}

/**
 * Den Kontext für eine Route bauen.
 *
 * `route` kommt aus dem Client und wird ausschließlich zur Auswahl des
 * Zweigs benutzt — nie als Datenbankschlüssel. Ein manipulierter Wert
 * kann höchstens die falschen Vorschläge erzeugen.
 */
export async function buildPageContext(
  userId: string,
  input: { route: string; jobId?: string | null; applicationId?: string | null },
): Promise<PageContext> {
  const db = await getDb();
  const route = input.route.split("?")[0] ?? "";

  /* ── Eine konkrete Stelle ──────────────────────────────────── */
  if (input.jobId) {
    const [job] = await db
      .select({
        id: schema.jobs.id,
        title: schema.jobs.title,
        company: schema.companies.name,
        location: schema.jobs.location,
        workModel: schema.jobs.workModel,
        contractType: schema.jobs.contractType,
        coreTasks: schema.jobs.coreTasks,
        salaryDisclosed: schema.jobs.salaryDisclosed,
        salaryMin: schema.jobs.salaryMin,
        salaryMax: schema.jobs.salaryMax,
        salaryCurrency: schema.jobs.salaryCurrency,
        salaryPeriod: schema.jobs.salaryPeriod,
        publishedAt: schema.jobs.publishedAt,
        sourceName: schema.jobSources.displayName,
        fetchedAt: schema.jobs.fetchedAt,
      })
      .from(schema.jobs)
      .innerJoin(schema.companies, eq(schema.companies.id, schema.jobs.companyId))
      .innerJoin(schema.jobSources, eq(schema.jobSources.id, schema.jobs.sourceId))
      .where(and(eq(schema.jobs.id, input.jobId), eq(schema.jobs.isDemo, false)))
      .limit(1);

    if (job) {
      const [match] = await withUser(db, userId, (tx) =>
        tx
          .select({ score: schema.jobMatches.fitScore, confidence: schema.jobMatches.confidenceScore })
          .from(schema.jobMatches)
          .where(
            and(eq(schema.jobMatches.userId, userId), eq(schema.jobMatches.jobId, input.jobId!)),
          )
          .limit(1),
      );

      const zeilen = [
        `AKTUELLE STELLE: „${job.title}“ bei ${job.company}, ${job.location}.`,
        `Arbeitsmodell: ${job.workModel}${job.contractType ? `, ${job.contractType}` : ""}.`,
        gehaltssatz(job),
        job.coreTasks.length > 0
          ? `Kernaufgaben laut Anzeige: ${job.coreTasks.slice(0, 6).join("; ")}.`
          : null,
        `Quelle: ${job.sourceName}, zuletzt geprüft ${job.fetchedAt.toISOString().slice(0, 10)}.`,
        match
          ? `Berechnete Passung: ${match.score} bei Konfidenz ${match.confidence}. Diese Zahl stammt aus der Bewertungslogik, nicht aus deinem Eindruck.`
          : "Für diese Stelle liegt noch keine berechnete Passung vor.",
      ].filter(Boolean);

      return {
        briefing: zeilen.join("\n"),
        suggestions: [
          "Fass mir die wichtigsten Aufgaben zusammen.",
          "Welche Anforderungen fehlen mir noch?",
          "Bereite Fragen für das Gespräch vor.",
          "Lass uns die Bewerbung vorbereiten.",
        ],
        jobId: job.id,
        applicationId: null,
        scopeLabel: `Zu „${job.title}“`,
      };
    }
  }

  /* ── Eine konkrete Bewerbung ───────────────────────────────── */
  if (input.applicationId) {
    const [app] = await withUser(db, userId, (tx) =>
      tx
        .select({
          id: schema.applications.id,
          stage: schema.applications.stage,
          jobId: schema.applications.jobId,
          title: schema.jobs.title,
          company: schema.companies.name,
        })
        .from(schema.applications)
        .innerJoin(schema.jobs, eq(schema.jobs.id, schema.applications.jobId))
        .innerJoin(schema.companies, eq(schema.companies.id, schema.jobs.companyId))
        .where(
          and(
            eq(schema.applications.id, input.applicationId!),
            eq(schema.applications.userId, userId),
          ),
        )
        .limit(1),
    );

    if (app) {
      // Die erzeugten Unterlagen, nicht die hochgeladenen Dateien:
      // `documents` ist der Upload, `generated_artifacts` das, was für
      // diese Bewerbung entstanden ist.
      const dokumente = await withUser(db, userId, (tx) =>
        tx
          .select({ kind: schema.generatedArtifacts.kind })
          .from(schema.generatedArtifacts)
          .where(eq(schema.generatedArtifacts.applicationId, app.id))
          .limit(10),
      );

      return {
        briefing: [
          `AKTUELLE BEWERBUNG: „${app.title}“ bei ${app.company}, Stand: ${app.stage}.`,
          dokumente.length > 0
            ? `Vorhandene Unterlagen: ${dokumente.map((d) => d.kind).join(", ")}.`
            : "Es liegen noch keine Unterlagen vor.",
          "Nichts wird ohne ausdrückliche Freigabe verschickt.",
        ].join("\n"),
        suggestions: [
          "Optimiere meinen Lebenslauf für diese Stelle.",
          "Zeig mir die Änderungen zur Prüfung.",
          "Entwirf eine Antwort auf diese Screening-Frage.",
        ],
        jobId: app.jobId,
        applicationId: app.id,
        scopeLabel: `Zur Bewerbung bei ${app.company}`,
      };
    }
  }

  /* ── Seiten ohne einzelnen Datensatz ───────────────────────── */
  if (route.startsWith("/app/jobs")) {
    return {
      ...LEER,
      briefing:
        "AKTUELLE SEITE: die persönliche Jobliste. Die Person sucht. " +
        "Bedingungen dürfen nicht stillschweigend gelockert werden — wenn nichts passt, " +
        "sag das und frage, ob einmalig erweitert werden soll.",
      suggestions: [
        "Welche neuen Stellen passen zu meinem Profil?",
        "Welche ungewöhnlichen Rollen passen zu mir?",
        "Warum passt diese Auswahl zu mir?",
      ],
      scopeLabel: "Zur Jobsuche",
    };
  }

  if (route.startsWith("/app/profile") || route.startsWith("/app/career")) {
    const offen = await withUser(db, userId, (tx) =>
      tx
        .select({ statement: schema.evidenceItems.statement })
        .from(schema.evidenceItems)
        .where(
          and(
            eq(schema.evidenceItems.userId, userId),
            eq(schema.evidenceItems.userConfirmed, false),
            eq(schema.evidenceItems.userRejected, false),
          ),
        )
        .limit(8),
    );

    return {
      ...LEER,
      briefing: [
        "AKTUELLE SEITE: das Karriereprofil.",
        offen.length > 0
          ? `Offene Vermutungen, die auf Bestätigung warten: ${offen.map((o) => o.statement).join("; ")}.`
          : "Es warten keine Vermutungen auf Bestätigung.",
        "Bestätigen darf ausschließlich der Mensch.",
      ].join("\n"),
      suggestions: [
        "Was fehlt in meinem Profil noch?",
        "Erklär mir, worauf diese Aussage beruht.",
        "Hilf mir, diese Erfahrung besser zu formulieren.",
      ],
      scopeLabel: "Zum Profil",
    };
  }

  if (route.startsWith("/app/settings")) {
    return {
      ...LEER,
      briefing:
        "AKTUELLE SEITE: die Einstellungen. Hier wird ERKLÄRT, nicht geändert. " +
        "Keine Einstellung ohne ausdrückliche Bestätigung der Person anfassen.",
      suggestions: [
        "Was bedeutet diese Einstellung?",
        "Welche Sprache gilt wofür?",
        "Welche Daten sind gespeichert?",
      ],
      scopeLabel: "Zu den Einstellungen",
    };
  }

  if (route.startsWith("/app/applications")) {
    return {
      ...LEER,
      briefing: "AKTUELLE SEITE: die Übersicht der Bewerbungen.",
      suggestions: [
        "Wo stehe ich mit meinen Bewerbungen?",
        "Wo sollte ich nachfassen?",
      ],
      scopeLabel: "Zu den Bewerbungen",
    };
  }

  return {
    ...LEER,
    briefing: "AKTUELLE SEITE: die Startseite der Anwendung.",
    suggestions: [
      "Was ist mein nächster sinnvoller Schritt?",
      "Was weißt du über mich?",
    ],
  };
}
