import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { getDb, schema, withUser } from "@paycheck/db";
import { desc, eq } from "drizzle-orm";
import { Card } from "@/components/ui";
import { EmptyState, PageHeader } from "@/components/ui/states";
import { ProbeSpielen } from "@/components/proben/ProbeSpielen";
import { naechsteProbe, probenbilanz } from "@/lib/proben";

export const metadata: Metadata = { title: "Ausprobieren" };
export const dynamic = "force-dynamic";

/**
 * Arbeit ausprobieren, bevor man sich bewirbt.
 *
 * ── Warum die Bilanz zwei Listen hat ──────────────────────────
 *
 * „Was dir liegt" und „was dir Energie gibt" sind verschiedene Listen,
 * und sie dürfen verschiedene Berufe nennen. Genau darin liegt die
 * Auskunft: Der Mensch, der eine Arbeit beherrscht und daran zugrunde
 * geht, taucht in der einen Liste auf und in der anderen nicht.
 *
 * Eine gemeinsame Rangfolge hätte ihn versteckt.
 */
export default async function ProbenPage() {
  const user = await requireUser();
  const db = await getDb();

  /*
   * Die Berufsrichtung aus den zuletzt angesehenen Stellen.
   *
   * Nicht aus dem Profil: Wer sich gerade Pflegestellen ansieht, soll
   * eine Pflegeaufgabe bekommen — auch wenn im Lebenslauf etwas
   * anderes steht. Die Probe ist zum Ausprobieren da.
   */
  const [letzte] = await withUser(db, user.id, (tx) =>
    tx
      .select({ kldb: schema.jobs.kldb })
      .from(schema.applicationEvents)
      .innerJoin(schema.jobs, eq(schema.jobs.id, schema.applicationEvents.jobId))
      .where(eq(schema.applicationEvents.userId, user.id))
      .orderBy(desc(schema.applicationEvents.occurredAt))
      .limit(1),
  ).catch(() => []);

  const hauptgruppe = letzte?.kldb ? String(letzte.kldb).slice(0, 2) : null;
  const probe = await naechsteProbe(hauptgruppe);
  const bilanz = await probenbilanz();

  return (
    <div className="grid gap-8">
      <PageHeader
        eyebrow="Ausprobieren"
        title="Wie fühlt sich diese Arbeit an?"
      />

      <p className="max-w-[var(--measure)] leading-relaxed text-ink-2">
        Kurze Aufgaben aus echten Berufen. Sie zeigen zwei Dinge, die kein Lebenslauf hergibt:
        ob dir etwas liegt — und ob es dir Energie gibt. Das ist nicht dasselbe, und wo beides
        auseinandergeht, wird es interessant.
      </p>

      {probe ? (
        <ProbeSpielen probe={probe} />
      ) : (
        <EmptyState
          title="Alle Aufgaben gemacht"
          body="Für deine Richtung liegt gerade nichts Neues vor. Es kommen laufend welche dazu."
        />
      )}

      {bilanz.versuche > 0 && (
        <section aria-labelledby="bilanz" className="grid gap-4">
          <h2 id="bilanz" className="text-xl font-semibold">
            Was dabei herausgekommen ist
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <h3 className="abschnitts-titel text-ink-3">
                Was dir Energie gibt
              </h3>
              {bilanz.gabEnergie.length === 0 ? (
                <p className="mt-2 text-sm leading-relaxed text-ink-3">
                  Noch keine Aufgabe, bei der du das gesagt hast.
                </p>
              ) : (
                <ul className="mt-2 grid gap-1.5">
                  {bilanz.gabEnergie.map((e) => (
                    <li key={e.titel} className="text-[15px] leading-relaxed text-ink">
                      {e.titel}
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <h3 className="abschnitts-titel text-ink-3">
                Was dich Energie kostet
              </h3>
              {bilanz.kostenEnergie.length === 0 ? (
                <p className="mt-2 text-sm leading-relaxed text-ink-3">
                  Noch nichts, was dich ausgelaugt hat.
                </p>
              ) : (
                <ul className="mt-2 grid gap-1.5">
                  {bilanz.kostenEnergie.map((e) => (
                    <li key={e.titel} className="text-[15px] leading-relaxed text-ink">
                      {e.titel}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {/*
           * Die Trefferquote steht klein und zuletzt.
           *
           * Sie ist die Zahl, nach der jeder zuerst greift — und die
           * am wenigsten aussagt. Zehn richtige Antworten in einem
           * Beruf, der einen auslaugt, sind kein guter Befund.
           */}
          <p className="text-2xs text-ink-3">
            {bilanz.richtig} von {bilanz.versuche} Aufgaben wie üblich gelöst. Diese Zahl sagt
            weniger als die beiden Listen darüber.
          </p>
        </section>
      )}
    </div>
  );
}
