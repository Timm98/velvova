import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema, withSystem } from "@paycheck/db";
import { requireUser } from "@/lib/auth";
import { Card } from "@/components/ui";
import { EmptyState, PageHeader } from "@/components/ui/states";
import { ProbeSpielen } from "@/components/proben/ProbeSpielen";
import { naechsteProbe } from "@/lib/proben";

export const metadata: Metadata = { title: "Job ausprobieren" };
export const dynamic = "force-dynamic";

/**
 * Diese Stelle ausprobieren — nicht irgendeine Arbeit.
 *
 * ── Was hier gefehlt hat ──────────────────────────────────────
 *
 * Es gab nur `/app/proben`. Die Aufgabe dort richtete sich nach dem
 * LETZTEN Bewerbungsereignis der Person — und wer noch keines hatte,
 * bekam irgendeine. In der Vorgabe steht der Fall wörtlich: Bei einer
 * Lieferfahrer-Stelle erschien eine Aufgabe über Warmwasser.
 *
 * Die Aufgaben selbst waren nie das Problem. Für die
 * Berufshauptgruppe 52 (Fahrzeugführung) gibt es „Die Lenkzeit läuft
 * ab" — genau richtig. Falsch war die Bindung.
 *
 * ── Warum eine eigene Seite und kein Zustand ──────────────────
 *
 * Eine Adresse, die die Stelle enthält, lässt sich teilen, zurück-
 * navigieren und neu laden, ohne dass jemand den Bezug verliert. Ein
 * Zustand im Speicher tut das nicht — und beim Zurückkommen stünde
 * wieder die Frage, welche Stelle gemeint war.
 */
export default async function JobProbePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireUser();

  const db = await getDb();
  const [job] = await withSystem(db, (tx) =>
    tx
      .select({
        id: schema.jobs.id,
        title: schema.jobs.title,
        companyId: schema.jobs.companyId,
        kldb: schema.jobs.kldb,
      })
      .from(schema.jobs)
      .where(eq(schema.jobs.id, id))
      .limit(1),
  ).catch(() => []);
  if (!job) notFound();

  const hauptgruppe = job.kldb ? String(job.kldb).slice(0, 2) : null;
  const probe = await naechsteProbe(hauptgruppe);

  return (
    <div className="grid gap-8">
      <PageHeader eyebrow="Job ausprobieren" title={job.title} />

      <p className="max-w-[var(--measure)] leading-relaxed text-ink-2">
        Eine kurze Aufgabe aus dem Berufsfeld dieser Stelle. Sie zeigt zwei Dinge, die keine
        Anzeige hergibt: ob dir die Arbeit liegt — und ob sie dir Energie gibt. Das ist nicht
        dasselbe, und wo beides auseinandergeht, wird es interessant.
      </p>

      {probe ? (
        <ProbeSpielen probe={probe} />
      ) : hauptgruppe ? (
        <EmptyState
          title="Für dieses Berufsfeld noch keine Aufgabe"
          body={
            "Es gibt Aufgaben für 33 Berufsfelder, für dieses noch nicht — oder du hast sie " +
            "schon gemacht. Eine Aufgabe aus einem anderen Beruf zu zeigen wäre keine Hilfe, " +
            "sondern eine falsche Auskunft über diese Stelle."
          }
        />
      ) : (
        <EmptyState
          title="Berufsfeld unbekannt"
          body={
            "Zu dieser Anzeige liegt uns keine amtliche Berufskennung vor. Ohne sie wüssten " +
            "wir nicht, welche Aufgabe zu dieser Arbeit gehört."
          }
        />
      )}

      <Card>
        <div className="grid gap-2">
          <h2 className="abschnitts-titel text-ink-3">
            Wofür das zählt
          </h2>
          <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
            Was du hier zeigst, wird als beobachteter Beleg festgehalten — auch das Misslungene.
            Geteilt wird nichts ohne deine ausdrückliche Freigabe.{" "}
            <Link href="/app/belege" className="text-accent-text underline underline-offset-[3px]">
              Deine Belege
            </Link>
            {" · "}
            <Link href={`/app/jobs/${job.id}`} className="text-accent-text underline underline-offset-[3px]">
              Zurück zur Stelle
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}
