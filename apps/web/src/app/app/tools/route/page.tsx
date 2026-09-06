import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { getDb, schema, withSystem } from "@paycheck/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui/states";
import { fehlendeModiGrund, verfuegbareModi } from "@/lib/geo/anbieter";
import { RoutenFormular } from "./RoutenFormular";

export const metadata: Metadata = { title: "Pendelrechner" };
export const dynamic = "force-dynamic";

/**
 * Der Weg zur Arbeit — was er kostet, an Zeit und an Geld.
 *
 * ── Warum eigenständig ────────────────────────────────────────
 *
 * Die Frage stellt sich auch ohne Stellenanzeige: beim Vergleich
 * zweier Angebote, beim Nachdenken über einen Umzug, beim Rechnen, ob
 * sich drei Bürotage lohnen. Ein Rechner, den es nur im Zusammenhang
 * einer Anzeige gibt, beantwortet sie nur zufällig.
 *
 * ── Was der Aufruf aus einer Stelle mitbringt ─────────────────
 *
 * `?jobId=` füllt die Zieladresse vor — sichtbar gekennzeichnet, mit
 * einem Knopf, der alles zurücksetzt. Ohne Kennzeichnung bliebe die
 * Adresse kleben, und die nächste Rechnung gälte heimlich für die
 * vorige Stelle. Genau das ist der Fehler, den die Vorgabe beim
 * Gehaltsrechner benennt.
 */
export default async function RoutenrechnerPage({
  searchParams,
}: {
  searchParams: Promise<{ jobId?: string }>;
}) {
  await requireUser();
  const { jobId } = await searchParams;

  let ziel: string | undefined;
  let herkunft: string | undefined;
  if (jobId) {
    const db = await getDb();
    const [job] = await withSystem(db, (tx) =>
      tx
        .select({ title: schema.jobs.title, location: schema.jobs.location })
        .from(schema.jobs)
        .where(eq(schema.jobs.id, jobId))
        .limit(1),
    ).catch(() => []);
    if (job?.location) {
      ziel = job.location;
      herkunft = `Aus der Stelle „${job.title}“ übernommen. Zurücksetzen leert das Feld.`;
    }
  }

  return (
    <div className="grid gap-8">
      <PageHeader eyebrow="Karriere-Tools" title="Pendelrechner" />

      <p className="max-w-[var(--measure)] leading-relaxed text-ink-2">
        Was ein Arbeitsweg kostet, steht in keiner Stellenanzeige — an Geld nicht und an Zeit
        erst recht nicht. Beides zusammen entscheidet oft mehr über einen Wechsel als die
        Gehaltsdifferenz.
      </p>

      <RoutenFormular
        vorbelegtNach={ziel}
        herkunft={herkunft}
        modi={verfuegbareModi()}
        fehlenderModusGrund={fehlendeModiGrund()}
      />
    </div>
  );
}
