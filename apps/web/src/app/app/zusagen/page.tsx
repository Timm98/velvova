import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { getDb, schema, withUser } from "@paycheck/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import { Card } from "@/components/ui";
import { EmptyState, PageHeader } from "@/components/ui/states";
import { Zusagenblock } from "@/components/zusagen/Zusagenblock";
import { jobcheckFuer, zusagenLaden } from "@/lib/zusagen";
import { Jobcheck } from "@/components/zusagen/Jobcheck";

export const metadata: Metadata = { title: "Was dir zugesagt wurde" };
export const dynamic = "force-dynamic";

/**
 * Der Promise Lock.
 *
 * ── Warum diese Seite existiert ───────────────────────────────
 *
 * Die meisten schlechten Jobentscheidungen entstehen nicht, weil der
 * Beruf falsch war, sondern weil die Arbeit nicht dem entsprach, was im
 * Bewerbungsprozess versprochen wurde. Nach drei Monaten erinnert sich
 * niemand mehr genau an das zweite Gespräch.
 *
 * ── Warum die Marken 14, 30 und 90 sind ───────────────────────
 *
 * Andere als bei den Check-ins, und mit Absicht. Der Check-in fragt
 * nach Zufriedenheit — die braucht Zeit. Eine gebrochene Zusage fällt
 * früher auf: Wer nach vierzehn Tagen keine Einarbeitung hat, hat
 * keine.
 */
export default async function ZusagenPage() {
  const user = await requireUser();
  const db = await getDb();

  /*
   * Bewerbungen, bei denen Zusagen überhaupt entstehen können.
   *
   * Vor dem ersten Gespräch gibt es nichts festzuhalten; nach einer
   * Absage nichts mehr zu prüfen.
   */
  const bewerbungen = await withUser(db, user.id, (tx) =>
    tx
      .select({
        id: schema.applications.id,
        stage: schema.applications.stage,
        titel: schema.jobs.title,
        firma: schema.companies.name,
        seit: schema.applications.updatedAt,
      })
      .from(schema.applications)
      .innerJoin(schema.jobs, eq(schema.jobs.id, schema.applications.jobId))
      .innerJoin(schema.companies, eq(schema.companies.id, schema.jobs.companyId))
      .where(
        and(
          eq(schema.applications.userId, user.id),
          inArray(schema.applications.stage, ["interview", "offer", "accepted"]),
        ),
      )
      .orderBy(desc(schema.applications.updatedAt)),
  ).catch(() => []);

  if (bewerbungen.length === 0) {
    return (
      <div className="grid gap-8">
        <PageHeader eyebrow="Promise Lock" title="Was dir zugesagt wurde" />
        <EmptyState
          title="Noch nichts festzuhalten"
          body="Sobald du im Gespräch bist, kannst du hier festhalten, was dir zugesagt wurde — und nach 14, 30 und 90 Tagen prüfen, ob es stimmt."
        />
      </div>
    );
  }

  const aktuell = bewerbungen[0]!;
  const [zusagen, check] = await Promise.all([
    zusagenLaden(aktuell.id).catch(() => []),
    jobcheckFuer(aktuell.id).catch(() => null),
  ]);

  /*
   * Geprüft wird erst, wenn die Stelle angetreten ist — und dann nur
   * die Marken, die schon erreicht sind. Eine Zusage nach zwei Tagen
   * zu prüfen ergäbe nur „zu früh".
   */
  const tage = Math.floor((Date.now() - aktuell.seit.getTime()) / 86_400_000);
  const pruefbar =
    aktuell.stage === "accepted" ? [14, 30, 90].filter((m) => tage >= m) : [];

  return (
    <div className="grid gap-8">
      <PageHeader eyebrow="Promise Lock" title="Was dir zugesagt wurde" />

      <Card>
        <p className="text-[15px] leading-relaxed text-ink">
          <strong>{aktuell.titel}</strong> bei {aktuell.firma}
        </p>
        <p className="mt-1 max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
          {aktuell.stage === "accepted"
            ? pruefbar.length > 0
              ? `Seit ${tage} Tagen dort. Prüfbar: Tag ${pruefbar.join(", ")}.`
              : `Seit ${tage} Tagen dort. Die erste Prüfung steht nach 14 Tagen an.`
            : "Halte fest, was zugesagt wird. Geprüft wird, sobald du angetreten bist."}
        </p>
      </Card>

      {/*
       * Der Job-Check steht VOR dem Formular.
       *
       * Wer hier landet, will wissen, ob er zusagen soll — nicht
       * zuerst etwas eintragen. Das Formular darunter ist der Weg,
       * den Check zu verbessern.
       */}
      {check && <Jobcheck befund={check.befund} fragen={check.fragen} />}

      <Zusagenblock applicationId={aktuell.id} zusagen={zusagen} pruefbar={pruefbar} />

      {/*
       * Was mit den Angaben passiert — an der Stelle, an der sie
       * gemacht werden, nicht in einer Datenschutzerklärung.
       */}
      <Card>
        <h2 className="abschnitts-titel text-ink-3">
          Was damit passiert
        </h2>
        <p className="mt-2 max-w-[var(--measure)] leading-relaxed text-ink-2">
          Deine Angaben bleiben bei dir. In den Arbeitgeber-Score gehen sie erst ein, wenn genug
          Menschen zu diesem Unternehmen geantwortet haben — vorher liesse sich aus einer Quote auf
          eine einzelne Person schliessen. Was du hier schreibst, sieht kein Arbeitgeber.
        </p>
      </Card>
    </div>
  );
}
