import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@paycheck/db";
import { requireUser } from "@/lib/auth";
import { BewerbenFormular } from "./BewerbenFormular";

export const metadata: Metadata = { title: "Bewerben" };
export const dynamic = "force-dynamic";

/**
 * Sich auf eine Stelle bewerben, die ein Arbeitgeber hier eingestellt hat.
 *
 * ── Warum eine eigene Seite und kein Knopf ────────────────────
 *
 * Weil hier zum ersten Mal Daten dieses Produkts an ein Unternehmen
 * gehen. Das darf kein Nebeneffekt eines Klicks sein: Die Seite zeigt
 * vorher, WAS genau übermittelt wird — und was ausdrücklich nicht.
 *
 * Es gibt keine automatische Bewerbung. Was hier hinausgeht, hat ein
 * Mensch vorher gelesen und abgeschickt.
 */
export default async function BewerbenPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const db = await getDb();

  /*
   * Ohne Nutzerkontext gelesen — die Person ist kein Mitglied der
   * Organisation. Herausgegeben wird nur, was ohnehin in der
   * veröffentlichten Anzeige steht.
   */
  const [posting] = await db
    .select({
      id: schema.jobPostings.id,
      title: schema.jobPostings.title,
      location: schema.jobPostings.location,
      status: schema.jobPostings.status,
      organisation: schema.organizations.name,
    })
    .from(schema.jobPostings)
    .innerJoin(schema.organizations, eq(schema.organizations.id, schema.jobPostings.organizationId))
    .where(eq(schema.jobPostings.id, id))
    .limit(1);

  if (!posting || posting.status !== "published") notFound();

  const [vorhanden] = await db
    .select({ id: schema.postingCandidates.id })
    .from(schema.postingCandidates)
    .where(eq(schema.postingCandidates.postingId, id))
    .limit(1);

  return (
    <div className="grid max-w-[var(--measure)] gap-6">
      <div className="grid gap-2">
        <h1 className="font-display text-2xl font-semibold tracking-[-0.02em]">
          Bewerbung auf {posting.title}
        </h1>
        <p className="text-sm leading-relaxed text-ink-2">
          bei {posting.organisation}
          {posting.location ? ` · ${posting.location}` : ""}
        </p>
      </div>

      <div className="grid gap-3 rounded-(--radius-surface) bg-soft p-5">
        <h2 className="text-sm font-semibold">Was übermittelt wird</h2>
        <ul className="grid gap-1.5 text-sm leading-relaxed text-ink-2">
          <li>dein Name und die Kontaktadresse, die du unten einträgst</li>
          <li>deine Kurzbeschreibung und dein Anschreiben</li>
        </ul>
        <h2 className="mt-2 text-sm font-semibold">Was NICHT übermittelt wird</h2>
        <ul className="grid gap-1.5 text-sm leading-relaxed text-ink-2">
          <li>dein Gespräch mit Nina — weder Inhalt noch Zusammenfassung</li>
          <li>deine Lebenshaltung, dein aktuelles Gehalt, deine Steuerangaben</li>
          <li>deine anderen Bewerbungen und gespeicherten Stellen</li>
        </ul>
        <p className="text-2xs leading-relaxed text-ink-3">
          Was du hier abschickst, ist eine Kopie — sie bleibt so, wie sie heute ist. Änderst du
          später dein Profil, ändert sich diese Bewerbung nicht mit.
        </p>
      </div>

      {vorhanden ? (
        <p className="rounded-(--radius-surface) bg-inset p-5 text-sm leading-relaxed text-ink-2">
          Du hast dich auf diese Stelle bereits beworben. Den Stand siehst du unter „Bewerbungen".
        </p>
      ) : (
        <BewerbenFormular
          postingId={posting.id}
          vorschlagName={user.displayName ?? ""}
          /* Wer sich per SMS angemeldet hat, hat keine Adresse im
             Konto. Dann bleibt das Feld leer und wird ausgefüllt —
             ein Arbeitgeber braucht eine Rückmeldeadresse. */
          vorschlagEmail={user.email ?? ""}
        />
      )}
    </div>
  );
}
