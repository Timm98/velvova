import "server-only";

import { and, eq, isNull, ne } from "drizzle-orm";
import { computeFit } from "@paycheck/matching";
import { JobSchema, type Job } from "@paycheck/domain";
import { getDb, schema } from "@paycheck/db";
import { loadProfileContext } from "@/lib/matching";
import { protokolliereMatch } from "./matches";

/**
 * Vorschläge erzeugen.
 *
 * ══════════════════════════════════════════════════════════════
 * Wer überhaupt geprüft wird
 * ══════════════════════════════════════════════════════════════
 *
 * Nur Konten mit `user_settings.auffindbar = true`. Das ist keine
 * Optimierung, sondern die Bedingung: Wer nicht zugestimmt hat, wird
 * nicht bewertet — nicht „bewertet, aber nicht angezeigt". Eine
 * Bewertung, die entsteht und dann verworfen wird, ist trotzdem
 * entstanden.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum die vorhandene Fit-Rechnung benutzt wird
 * ══════════════════════════════════════════════════════════════
 *
 * `computeFit` gibt es seit dem Kandidatenbereich: dieselben Achsen,
 * dieselbe Gewichtung, dasselbe `coverage`. Eine zweite Rechnung für
 * die Arbeitgeberseite hiesse, dass dieselbe Paarung zwei verschiedene
 * Zahlen bekommt, je nachdem, wer draufschaut — und beide wären
 * begründbar. Genau das darf ein Passungswert nicht.
 *
 * ══════════════════════════════════════════════════════════════
 * Was NICHT einfliesst
 * ══════════════════════════════════════════════════════════════
 *
 * Alter, Geschlecht, Herkunft, Religion, Familienstand, Gesundheit,
 * Foto, Name. Nicht durch eine Filterliste, sondern weil `FitInput`
 * diese Felder nicht kennt: Es gibt keinen Weg, sie hineinzugeben.
 */

/** Ab hier lohnt sich ein Vorschlag. Darunter entsteht keine Zeile. */
const SCHWELLE = 55;

/**
 * Aus einer Stellenausschreibung wird ein `Job` für die Bewertung.
 *
 * Vieles bleibt `null` — Koordinaten, Sprachanforderungen, Lizenzen.
 * Das ist richtig so: `computeFit` behandelt Unbekanntes als neutral
 * und senkt dafür `coverage`. Etwas zu erraten, damit die Zahl
 * vollständiger aussieht, hiesse, die Datenbasis zu fälschen.
 */
function alsJob(posting: typeof schema.jobPostings.$inferSelect, firma: string): Job {
  return JobSchema.parse({
    id: posting.id,
    title: posting.title,
    companyId: posting.organizationId,
    companyName: firma,
    location: posting.location,
    country: posting.country,
    latitude: null,
    longitude: null,
    workModel: posting.workModel ?? "unknown",
    remotePercent: null,
    salary: {
      min: posting.salaryMin,
      max: posting.salaryMax,
      currency: posting.salaryCurrency,
      period: posting.salaryPeriod,
      source: "employer_stated",
    },
    contractType: posting.contractType ?? null,
    weeklyHours: posting.weeklyHours,
    shiftWork: null,
    travelPercent: null,
    experienceLevel: null,
    industry: null,
    languageRequirements: {},
    requiredLicenses: [],
    workPermitRequired: null,
    coreTasks: [],
    description: posting.description,
  });
}

export type LaufErgebnis = {
  geprueft: number;
  neu: number;
  aktualisiert: number;
  uebersprungen: number;
};

/**
 * Einen Lauf über eine Stelle.
 *
 * ── Warum vorhandene Vorschläge aktualisiert und nicht ersetzt ──
 *
 * Ein Vorschlag trägt seinen Zustand — angefragt, freigegeben,
 * abgelehnt. Ihn zu löschen und neu anzulegen setzte diesen Zustand
 * zurück: Eine Person, die ihre Freigabe erteilt hat, stünde wieder
 * auf „anonym erkannt", und das Unternehmen könnte erneut anfragen.
 *
 * Aktualisiert wird deshalb nur die Bewertung, und nur solange der
 * Vorschlag noch im anonymen Zustand ist. Danach ist die Zahl ein
 * Befund, über den bereits gesprochen wurde.
 */
export async function matchesErzeugen(
  organizationId: string,
  postingId: string,
  ausgeloestVon: string,
): Promise<LaufErgebnis> {
  const db = await getDb();

  const [posting] = await db
    .select()
    .from(schema.jobPostings)
    .where(
      and(eq(schema.jobPostings.id, postingId), eq(schema.jobPostings.organizationId, organizationId)),
    )
    .limit(1);

  if (!posting) return { geprueft: 0, neu: 0, aktualisiert: 0, uebersprungen: 0 };

  const [org] = await db
    .select({ name: schema.organizations.name })
    .from(schema.organizations)
    .where(eq(schema.organizations.id, organizationId))
    .limit(1);

  const job = alsJob(posting, org?.name ?? "");

  /*
   * Die Menge der Auffindbaren.
   *
   * `ne(users.id, createdBy)` schliesst die Person aus, die die
   * Anzeige geschrieben hat — sie sich selbst vorzuschlagen wäre ein
   * Fehler, den man einmal sieht und nie vergisst.
   */
  const kandidaten = await db
    .select({ userId: schema.userSettings.userId })
    .from(schema.userSettings)
    .innerJoin(schema.users, eq(schema.users.id, schema.userSettings.userId))
    .where(
      and(
        eq(schema.userSettings.auffindbar, true),
        isNull(schema.users.deletedAt),
        ne(schema.users.id, posting.createdBy),
      ),
    )
    .limit(500);

  const ergebnis: LaufErgebnis = { geprueft: 0, neu: 0, aktualisiert: 0, uebersprungen: 0 };

  for (const k of kandidaten) {
    ergebnis.geprueft++;

    const ctx = await loadProfileContext(k.userId).catch(() => null);
    if (!ctx) {
      ergebnis.uebersprungen++;
      continue;
    }

    const fit = computeFit({
      job,
      requirements: [],
      evidence: ctx.evidence,
      constraints: ctx.constraints,
      energisingTasks: ctx.energisingTasks,
      drainingTasks: ctx.drainingTasks,
      workStylePreferences: ctx.workStylePreferences,
      rankedValues: ctx.rankedValues,
      statedInterests: ctx.statedInterests,
    });

    if (fit.score !== null && fit.score < SCHWELLE) {
      ergebnis.uebersprungen++;
      continue;
    }

    /*
     * Die drei Teilwerte aus den Faktoren.
     *
     * `computeFit` liefert sieben Achsen; die Oberfläche zeigt drei.
     * Die Zuordnung steht hier und nicht in der Anzeige — sonst
     * bedeutete „fachlich" auf zwei Seiten zweierlei.
     */
    const achse = (...keys: string[]) => {
      const treffer = fit.factors.filter((f) => keys.includes(f.key) && f.raw !== null);
      if (treffer.length === 0) return null;
      return Math.round((treffer.reduce((a, f) => a + (f.raw ?? 0), 0) / treffer.length) * 100);
    };

    const belegt = fit.factors
      .filter((f) => f.raw !== null && f.raw >= 0.7)
      .map((f) => f.explanation)
      .slice(0, 5);
    const offen = fit.factors
      .filter((f) => f.raw === null)
      .map((f) => `${f.label}: keine Angabe im Profil`)
      .slice(0, 5);
    const entwickelbar = fit.factors
      .filter((f) => f.raw !== null && f.raw >= 0.3 && f.raw < 0.7)
      .map((f) => f.explanation)
      .slice(0, 5);

    const vorhanden = await db
      .select({ id: schema.stellenMatches.id, zustand: schema.stellenMatches.zustand })
      .from(schema.stellenMatches)
      .where(
        and(
          eq(schema.stellenMatches.postingId, postingId),
          eq(schema.stellenMatches.candidateUserId, k.userId),
        ),
      )
      .limit(1);

    const bewertung = {
      fitGesamt: fit.score,
      fitFachlich: achse("provenSkills", "preferredTasks"),
      fitPersoenlich: achse("workStyle", "valuesAndMotives"),
      fitLangfristig: achse("growthPotential", "marketRealism"),
      band: fit.band,
      datenbasis: Math.round(fit.coverage * 100),
      belegt,
      offen,
      entwickelbar,
      ausschluss: [] as string[],
      aktualisiertAm: new Date(),
    };

    if (!vorhanden[0]) {
      await db.insert(schema.stellenMatches).values({
        postingId,
        organizationId,
        candidateUserId: k.userId,
        ...bewertung,
      });
      ergebnis.neu++;
    } else if (vorhanden[0].zustand === "anonym_erkannt") {
      await db
        .update(schema.stellenMatches)
        .set(bewertung)
        .where(eq(schema.stellenMatches.id, vorhanden[0].id));
      ergebnis.aktualisiert++;
    } else {
      /* Der Vorschlag ist bereits in der Einwilligungskette. Seine
         Bewertung bleibt der Befund, über den gesprochen wurde. */
      ergebnis.uebersprungen++;
    }
  }

  await protokolliereMatch({
    organizationId,
    matchId: null,
    ausgeloestVon,
    handlung: "Lauf über eine Stelle",
    begruendung: `${ergebnis.geprueft} geprüft, ${ergebnis.neu} neu, ${ergebnis.aktualisiert} aktualisiert`,
    userId: ausgeloestVon,
  });

  return ergebnis;
}
