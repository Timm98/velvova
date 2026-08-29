import { NextResponse } from "next/server";
import { and, eq, ilike, or, sql } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Stellensuche für die Befehlspalette.
 *
 * Bewusst schlicht: Titel, Unternehmen, Ort. Keine Volltextsuche über
 * die Beschreibung — die brächte hier vor allem Treffer, die im
 * Ergebnis nicht erklärbar wären, und die Palette soll führen, nicht
 * überraschen.
 */
export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ jobs: [] }, { status: 401 });

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 3) return NextResponse.json({ jobs: [] });

  const pattern = `%${q.replace(/[%_]/g, (m) => `\\${m}`)}%`;
  const db = await getDb();

  const rows = await withUser(db, user.id, (tx) =>
    tx
      .select({
        id: schema.jobs.id,
        title: schema.jobs.title,
        companyName: schema.companies.name,
        location: schema.jobs.location,
      })
      .from(schema.jobs)
      .innerJoin(schema.companies, eq(schema.companies.id, schema.jobs.companyId))
      .where(
        or(
          ilike(schema.jobs.title, pattern),
          ilike(schema.companies.name, pattern),
          ilike(schema.jobs.location, pattern),
        ),
      )
      .orderBy(sql`${schema.jobs.publishedAt} desc nulls last`)
      .limit(6),
  );

  return NextResponse.json({ jobs: rows });
}
