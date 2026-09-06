import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { getDb, schema, withSystem } from "@paycheck/db";
import { requireUser } from "@/lib/auth";
import { Card } from "@/components/ui";
import { PageHeader } from "@/components/ui/states";
import { ladeGehaltsangaben } from "@/lib/payroll/einstellungen";
import { Gehaltslabor } from "@/app/app/settings/gehalt/Gehaltslabor";

export const metadata: Metadata = { title: "Gehaltsrechner" };
export const dynamic = "force-dynamic";

/**
 * Der Gehaltsrechner — ohne Stelle, wenn man ihn ohne Stelle öffnet.
 *
 * ── Der Fehler, den das behebt ────────────────────────────────
 *
 * Die Vorgabe benennt ihn: „Der Gehaltsrechner hängt noch an einem
 * alten ausgewählten Job." Wer über die Navigation kommt, will rechnen
 * — nicht die Zahlen einer Stelle nachrechnen, die er vor zwei Tagen
 * angesehen hat.
 *
 * Zwei Betriebsarten, sichtbar unterschieden:
 *
 *   ohne `?jobId=`   leer beziehungsweise die eigenen gespeicherten
 *                    Werte. Keine fremde Zahl.
 *   mit `?jobId=`    das Gehalt der Stelle, ausdrücklich
 *                    gekennzeichnet, mit einem Weg zurück.
 *
 * ── Warum die Kennzeichnung nicht schmückt ────────────────────
 *
 * Eine vorbelegte Zahl ohne Herkunft ist die gefährlichste Sorte: Sie
 * sieht aus wie eine eigene Eingabe und wird beim nächsten Öffnen
 * mitgeschleppt, ohne dass jemand weiss, woher sie kam.
 */
export default async function GehaltsrechnerPage({
  searchParams,
}: {
  searchParams: Promise<{ jobId?: string }>;
}) {
  await requireUser();
  const { jobId } = await searchParams;

  const angaben = await ladeGehaltsangaben();

  let ausStelle: { titel: string; brutto: number | null } | null = null;
  if (jobId) {
    const db = await getDb();
    const [job] = await withSystem(db, (tx) =>
      tx
        .select({
          title: schema.jobs.title,
          min: schema.jobs.salaryMin,
          max: schema.jobs.salaryMax,
          period: schema.jobs.salaryPeriod,
        })
        .from(schema.jobs)
        .where(eq(schema.jobs.id, jobId))
        .limit(1),
    ).catch(() => []);
    if (job) {
      /*
       * Die Mitte der Spanne, auf ein Jahr gerechnet.
       *
       * Eine Spanne lässt sich nicht in ein Feld schreiben. Die Mitte
       * ist die ehrlichste einzelne Zahl — und der Hinweis daneben
       * sagt, dass sie eine Mitte ist.
       */
      const roh = job.min !== null && job.max !== null
        ? (job.min + job.max) / 2
        : (job.min ?? job.max);
      const jahr =
        roh === null
          ? null
          : job.period === "month"
            ? roh * 12
            : job.period === "hour"
              ? roh * 40 * 52
              : roh;
      ausStelle = { titel: job.title, brutto: jahr === null ? null : Math.round(jahr) };
    }
  }

  return (
    <div className="grid gap-8">
      <PageHeader eyebrow="Karriere-Tools" title="Was bleibt wirklich übrig?" />

      {ausStelle ? (
        <Card>
          <div className="grid gap-1.5">
            <h2 className="abschnitts-titel text-ink-3">
              Gehalt aus der Stelle übernommen
            </h2>
            <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
              {ausStelle.brutto === null ? (
                <>
                  Die Anzeige „{ausStelle.titel}“ nennt kein Gehalt. Es ist deshalb nichts
                  vorbelegt — trag deine eigene Zahl ein.
                </>
              ) : (
                <>
                  {ausStelle.brutto.toLocaleString("de-DE")} € brutto im Jahr, aus „{ausStelle.titel}“.
                  Bei einer Spanne ist es die Mitte.{" "}
                  <Link href="/app/tools/gehalt" className="text-accent-text underline underline-offset-[3px]">
                    Ohne diese Stelle rechnen
                  </Link>
                </>
              )}
            </p>
          </div>
        </Card>
      ) : (
        <p className="max-w-[var(--measure)] leading-relaxed text-ink-2">
          Was von einem Bruttogehalt übrig bleibt, entscheidet sich an Abgaben und Fixkosten —
          und beides ist bei jedem anders. Hier steht keine Zahl aus einer Stelle, die du dir
          zuletzt angesehen hast.
        </p>
      )}

      <Gehaltslabor angaben={angaben} bruttoVorschlag={ausStelle?.brutto ?? null} />
    </div>
  );
}
