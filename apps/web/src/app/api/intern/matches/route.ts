import { NextResponse } from "next/server";
import { and, eq, isNull, ne } from "drizzle-orm";
import { getDb, schema } from "@paycheck/db";
import { matchesErzeugen } from "@/lib/arbeitgeber/matcher";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Der Suchlauf über alle veröffentlichten Stellen.
 *
 * ── Warum ein Endpunkt und kein eigenes Skript ────────────────
 *
 * Die Rechnung steckt in `matcher.ts` und benutzt `loadProfileContext`
 * — einen Lader, der über die Pfadaliase der Anwendung importiert. Ein
 * Skript ausserhalb von Next kann ihn nicht auflösen; es müsste die
 * halbe Profilabfrage nachbauen.
 *
 * Zwei Rechnungen für denselben Wert sind aber genau das, was ein
 * Passungswert nicht haben darf: Sie laufen beim ersten Nachbessern
 * auseinander, und dann bekommt dieselbe Paarung zwei Zahlen, je
 * nachdem wer sie ausgelöst hat.
 *
 * Der Pflegelauf ruft deshalb diesen Endpunkt auf. Dieselbe Rechnung,
 * derselbe Code, ein Aufrufweg mehr.
 *
 * ── Warum nur mit Geheimnis ───────────────────────────────────
 *
 * Er läuft über alle Organisationen. Eine angemeldete Person darf das
 * nicht auslösen — dafür gibt es den Knopf unter `/business/matches`,
 * und der läuft über genau eine Stelle ihrer eigenen Organisation.
 */
export async function POST(request: Request) {
  const secret = process.env.JOBS_REFRESH_SECRET;
  const header = request.headers.get("authorization");
  if (!secret || header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Nicht berechtigt." }, { status: 401 });
  }

  const db = await getDb();

  /*
   * Nur Stellen, deren Organisation die Automatisierung nicht
   * angehalten hat.
   *
   * Angehalten heisst angehalten — auch für den Lauf, der niemanden
   * anschreibt. Wer pausiert, will nicht, dass im Hintergrund
   * weitergerechnet wird und ihn beim Fortsetzen ein Berg neuer
   * Vorschläge erwartet, deren Grundlage Tage alt ist.
   */
  const stellen = await db
    .select({
      id: schema.jobPostings.id,
      organizationId: schema.jobPostings.organizationId,
      createdBy: schema.jobPostings.createdBy,
    })
    .from(schema.jobPostings)
    .leftJoin(
      schema.matchRegeln,
      and(
        eq(schema.matchRegeln.organizationId, schema.jobPostings.organizationId),
        isNull(schema.matchRegeln.postingId),
      ),
    )
    .where(
      and(
        eq(schema.jobPostings.status, "published"),
        isNull(schema.matchRegeln.pausiertAm),
      ),
    )
    .limit(200);

  let neu = 0;
  let aktualisiert = 0;
  let geprueft = 0;
  const fehler: string[] = [];

  for (const s of stellen) {
    try {
      const r = await matchesErzeugen(s.organizationId, s.id, "regel");
      neu += r.neu;
      aktualisiert += r.aktualisiert;
      geprueft += r.geprueft;
    } catch (e) {
      /* Eine Stelle, die scheitert, darf den Lauf nicht beenden. Der
         Grund steht im Bericht, damit er nicht still verschwindet. */
      fehler.push(`${s.id}: ${e instanceof Error ? e.message : "unbekannt"}`);
    }
  }

  return NextResponse.json({
    stellen: stellen.length,
    geprueft,
    neu,
    aktualisiert,
    fehler,
  });
}
