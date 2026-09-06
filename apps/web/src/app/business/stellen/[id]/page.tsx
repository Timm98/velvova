import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { arbeitgeberKontext, darf } from "@/lib/arbeitgeber/zugang";
import { ladeStelle } from "@/lib/arbeitgeber/stellen";
import { ladeBewerbungen } from "@/lib/arbeitgeber/bewerbungen";
import { StellenFormular } from "./StellenFormular";
import { Rollenwahrheit } from "./Rollenwahrheit";
import { getDb, schema, withSystem } from "@paycheck/db";
import { eq } from "drizzle-orm";
import type { Arbeitsdimension } from "@paycheck/domain";

export const metadata: Metadata = { title: "Stelle bearbeiten" };
export const dynamic = "force-dynamic";

export default async function StellePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ org?: string }>;
}) {
  const { id } = await params;
  const { org } = await searchParams;
  const { organisation } = await arbeitgeberKontext(org);
  const stelle = await ladeStelle(organisation.organizationId, id);
  if (!stelle) notFound();

  const bewerbungen = await ladeBewerbungen(organisation.organizationId, id);

  /*
   * Die Rollenbeschreibung. Über die Systemverbindung, weil sie zur
   * Stelle gehört und nicht zu einem Menschen — der Zugriff auf die
   * Stelle ist eine Zeile vorher bereits geprüft.
   */
  const db = await getDb();
  const [achsenZeilen, aufgabenZeilen, abgangZeilen] = await Promise.all([
    withSystem(db, (tx) =>
      tx.select().from(schema.rollenAussagen).where(eq(schema.rollenAussagen.postingId, id)),
    ).catch(() => []),
    withSystem(db, (tx) =>
      tx.select().from(schema.rollenAufgaben).where(eq(schema.rollenAufgaben.postingId, id)),
    ).catch(() => []),
    withSystem(db, (tx) =>
      tx.select().from(schema.rollenAbgaenge).where(eq(schema.rollenAbgaenge.postingId, id)),
    ).catch(() => []),
  ]);
  const achsen: Partial<Record<Arbeitsdimension, { wert: number; begruendung: string }>> = {};
  for (const a of achsenZeilen) {
    achsen[a.dimension as Arbeitsdimension] = { wert: a.wert, begruendung: a.begruendung };
  }

  return (
    <div className="grid gap-8">
      <Link
        href="/business/stellen"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-ink-2 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="size-4" strokeWidth={1.9} />
        Zurück zu den Stellen
      </Link>

      <StellenFormular
        orgId={organisation.organizationId}
        stelle={stelle}
        darfSchreiben={darf(organisation.rolle, "recruiter")}
        darfVeroeffentlichen={darf(organisation.rolle, "admin")}
        verifiziert={organisation.verifiziert}
      />

      {darf(organisation.rolle, "recruiter") && (
        <div className="border-t border-line pt-8">
          <Rollenwahrheit
            postingId={id}
            achsen={achsen}
            aufgaben={aufgabenZeilen
              .sort((a, b) => a.reihenfolge - b.reihenfolge)
              .map((a) => ({ aufgabe: a.aufgabe, zeitanteil: a.zeitanteil }))}
            abgaenge={abgangZeilen.sort((a, b) => a.reihenfolge - b.reihenfolge).map((a) => a.grund)}
          />
        </div>
      )}

      <section className="grid gap-3 border-t border-line pt-8">
        <h2 className="text-base font-semibold">
          Bewerbungen ({bewerbungen.filter((b) => !b.withdrawnAt).length})
        </h2>
        {bewerbungen.length === 0 ? (
          <p className="text-sm text-ink-2">Noch keine Bewerbung auf diese Stelle.</p>
        ) : (
          <Link
            href={`/business/bewerbungen?stelle=${stelle.id}`}
            className="w-fit text-sm text-accent-text underline underline-offset-[3px]"
          >
            Bewerbungen zu dieser Stelle ansehen
          </Link>
        )}
      </section>
    </div>
  );
}
