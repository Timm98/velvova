import { NextResponse } from "next/server";
import { loadRuntimeConfig } from "@paycheck/config";
import { getDb, schema, withUser } from "@paycheck/db";
import { and, eq, isNull, like } from "drizzle-orm";

/**
 * Das Karrieregespräch der Demo-Persona zurücksetzen.
 *
 * Anlass: der E2E-Test „Eine Antwort landet als unbestätigte Angabe im
 * Profil“ schreibt bei jedem Lauf eine Antwort in dieselbe dauerhafte
 * Entwicklungsdatenbank. Nach genug Läufen war das Gespräch am Ende
 * angekommen — es gab kein Eingabefeld mehr, und der Test scheiterte an
 * einem Zustand, den er selbst erzeugt hatte.
 *
 * Das war kein Produktfehler, sondern ein Test ohne eigenen
 * Ausgangszustand. Ein Test, dessen Ergebnis davon abhängt, wie oft er
 * vorher gelaufen ist, prüft nichts Verlässliches.
 *
 * Entfernt werden ausschliesslich die vom Test erzeugten Spuren:
 * Gesprächszüge, die mit "Testantwort " beginnen, und die daraus
 * entstandenen unbestätigten Angaben. Bestätigte Angaben bleiben
 * unangetastet — sonst löschte dieser Endpunkt die Saatdaten mit,
 * an denen die halbe Testsuite hängt.
 *
 * Dieselben zwei Riegel wie bei der Demo-Anmeldung: nicht in
 * Produktion, nur mit dem lokalen Treiber. Sonst 404, als gäbe es ihn
 * nicht.
 */
export async function POST(): Promise<NextResponse> {
  const cfg = loadRuntimeConfig();
  if (cfg.nodeEnv === "production" || cfg.db.driver !== "pglite") {
    return NextResponse.json({ fehler: "Nicht gefunden" }, { status: 404 });
  }

  const db = await getDb(cfg);
  const [user] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(and(eq(schema.users.email, "lea.demo@example.invalid"), isNull(schema.users.deletedAt)))
    .limit(1);

  if (!user) {
    return NextResponse.json({ fehler: "Demo-Persona nicht gefunden." }, { status: 404 });
  }

  const geloescht = await withUser(db, user.id, async (tx) => {
    const zuege = await tx
      .delete(schema.interviewTurns)
      .where(
        and(
          eq(schema.interviewTurns.userId, user.id),
          like(schema.interviewTurns.content, "Testantwort %"),
        ),
      )
      .returning({ id: schema.interviewTurns.id });

    const angaben = await tx
      .delete(schema.evidenceItems)
      .where(
        and(
          eq(schema.evidenceItems.userId, user.id),
          eq(schema.evidenceItems.userConfirmed, false),
          like(schema.evidenceItems.statement, "%Testantwort %"),
        ),
      )
      .returning({ id: schema.evidenceItems.id });

    return { zuege: zuege.length, angaben: angaben.length };
  });

  /*
   * Eine offene Frage wiederherstellen.
   *
   * Das Gespräch gilt als abgeschlossen, sobald in jedem Thema alle
   * Fragen beantwortet sind — dann verschwindet das Eingabefeld. Der
   * erste Lauf der Testsuite beantwortet die letzte offene Frage, und
   * ab dem zweiten Lauf gibt es nichts mehr zu tippen.
   *
   * Deshalb wird ein Thema wieder geöffnet, und zwar ausdrücklich ein
   * NICHT erforderliches: die sechs Themen aus REQUIRED_STAGES bleiben
   * unangetastet, damit der Riegel vor den Jobvorschlägen offen bleibt.
   * Sonst repariert dieser Endpunkt einen Test und bricht zwanzig
   * andere.
   */
  const WIEDER_OEFFNEN = "learning_goals";

  const sessions = await db
    .select({
      id: schema.interviewSessions.id,
      completedStages: schema.interviewSessions.completedStages,
      skippedStages: schema.interviewSessions.skippedStages,
    })
    .from(schema.interviewSessions)
    .where(eq(schema.interviewSessions.userId, user.id));

  for (const s of sessions) {
    await db
      .update(schema.interviewSessions)
      .set({
        status: "active",
        completedAt: null,
        completedStages: ((s.completedStages ?? []) as string[]).filter(
          (stage) => stage !== WIEDER_OEFFNEN,
        ) as never,
        skippedStages: ((s.skippedStages ?? []) as string[]).filter(
          (stage) => stage !== WIEDER_OEFFNEN,
        ) as never,
      })
      .where(eq(schema.interviewSessions.id, s.id));
  }

  return NextResponse.json({ zurueckgesetzt: geloescht, wiederGeoeffnet: WIEDER_OEFFNEN });
}
