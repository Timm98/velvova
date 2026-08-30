import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createInMemoryDb, runMigrations, schema, withUser, type Database } from "@paycheck/db";
import { buildContextEnvelope, buildScopedContext } from "./build-context-envelope.ts";
import { ContextIntegrityError } from "./types.ts";

/**
 * Der Kontext-Umschlag ist die Stelle, an der zwei Versprechen
 * eingelöst oder gebrochen werden:
 *
 *   1. Nina setzt nach einem Neustart dort fort, wo aufgehört wurde.
 *   2. Nina sieht ausschließlich die Daten der angemeldeten Person.
 *
 * Beides sind Sicherheits- beziehungsweise Verlässlichkeitsaussagen,
 * und Aussagen dieser Art gehören geprüft. Es läuft echtes Postgres
 * (PGlite) mit den echten RLS-Richtlinien, nicht ein Doppelgänger.
 *
 * §24B des Auftrags verlangt genau diese Prüfungen.
 */

let db: Database;
let close: () => Promise<void>;
let userA: string;
let userB: string;
let jobId: string;

const GLOBAL_KEY = Symbol.for("paycheck.db.handle");

beforeAll(async () => {
  const handle = await createInMemoryDb();
  db = handle.db;
  close = handle.close;
  await runMigrations(db);

  // getDb() liest aus diesem Zwischenspeicher. Wird er gesetzt, läuft
  // der echte Code gegen die Testdatenbank — ohne dass irgendetwas
  // gemockt werden müsste.
  (globalThis as Record<symbol, unknown>)[GLOBAL_KEY] = handle;

  const [a] = await db.insert(schema.users).values({ email: `a-${randomUUID()}@example.invalid` }).returning();
  const [b] = await db.insert(schema.users).values({ email: `b-${randomUUID()}@example.invalid` }).returning();
  userA = a!.id;
  userB = b!.id;

  const [source] = await db
    .insert(schema.jobSources)
    .values({ key: "test_source", displayName: "Testquelle", kind: "seed" })
    .returning();
  const [company] = await db.insert(schema.companies).values({ name: "Beispiel GmbH" }).returning();
  const [job] = await db
    .insert(schema.jobs)
    .values({
      title: "Fachkraft Logistik",
      companyId: company!.id,
      location: "Hamburg",
      workModel: "on_site",
      description: "Eine Beschreibung.",
      sourceId: source!.id,
      contentHash: randomUUID(),
    })
    .returning();
  jobId = job!.id;
}, 120_000);

afterAll(async () => {
  (globalThis as Record<symbol, unknown>)[GLOBAL_KEY] = null;
  await close?.();
});

describe("Kontext-Umschlag", () => {
  it("behauptet ohne Ereignis keinen Fortschritt", async () => {
    const envelope = await buildContextEnvelope(userB);

    expect(envelope.workflowStage).toBe("ACCOUNT_SETUP");
    expect(envelope.lastCompletedAction).toBeNull();
    expect(envelope.selectedJobIds).toEqual([]);
  });

  it("nimmt nach einem Neustart den gespeicherten Vorgang wieder auf", async () => {
    await withUser(db, userA, (tx) =>
      tx.insert(schema.applications).values({ userId: userA, jobId, stage: "sent" }),
    );

    // Ein neuer Aufruf ohne jeden Sitzungszustand — genau das, was nach
    // einem Serverneustart oder einem Gerätewechsel passiert.
    const envelope = await buildContextEnvelope(userA);

    expect(envelope.workflowStage).toBe("APPLICATION_TRACKING");
    expect(envelope.lastCompletedAction).toBe("Bewerbung versendet");
    expect(envelope.pendingAction).toBe("Bewerbung fortsetzen");
  });

  it("trägt gemerkte Stellen mit, ohne sie zu erfinden", async () => {
    await withUser(db, userA, (tx) =>
      tx.insert(schema.savedJobs).values({ userId: userA, jobId }),
    );

    const forA = await buildContextEnvelope(userA);
    const forB = await buildContextEnvelope(userB);

    expect(forA.selectedJobIds).toEqual([jobId]);
    expect(forB.selectedJobIds).toEqual([]);
  });

  it("nimmt die Nutzerkennung ausschließlich aus dem Aufrufparameter", async () => {
    // Der Aufruf trägt eine fremde Kennung im Gesprächsfeld. Sie darf
    // nirgends im Umschlag landen: es gibt kein Feld, über das eine
    // Kennung aus dem Anfragekörper hereinkäme.
    const envelope = await buildContextEnvelope(userB, {
      conversationId: userA,
    });

    expect(envelope.authenticatedUserId).toBe(userB);
    expect(envelope.selectedJobIds).toEqual([]);
    expect(envelope.careerProfileId).not.toBe(userA);
  });

  it("verweigert die Arbeit ohne Nutzerkennung", async () => {
    await expect(buildContextEnvelope("")).rejects.toThrow(ContextIntegrityError);
  });
});

describe("Geltungsbereich", () => {
  beforeAll(async () => {
    await withUser(db, userA, (tx) =>
      tx.insert(schema.evidenceItems).values([
        {
          userId: userA, type: "skill", statement: "Führt seit vier Jahren ein Schichtteam",
          sourceType: "user_stated", confidence: 0.9, userConfirmed: true,
        },
        {
          userId: userA, type: "skill", statement: "Könnte Erfahrung in der Disposition haben",
          sourceType: "ai_hypothesis", confidence: 0.4, userConfirmed: false,
        },
        {
          userId: userA, type: "skill", statement: "Stimmt nicht",
          sourceType: "ai_hypothesis", confidence: 0.3, userConfirmed: false, userRejected: true,
        },
      ]),
    );
    await withUser(db, userB, (tx) =>
      tx.insert(schema.evidenceItems).values({
        userId: userB, type: "skill", statement: "Geheimnis von B",
        sourceType: "user_stated", confidence: 0.9, userConfirmed: true,
      }),
    );
  });

  it("trennt Bestätigtes, Vermutetes und Verworfenes", async () => {
    const scoped = await buildScopedContext(await buildContextEnvelope(userA));

    expect(scoped.confirmedFacts).toContain("Führt seit vier Jahren ein Schichtteam");
    expect(scoped.openHypotheses).toContain("Könnte Erfahrung in der Disposition haben");
    expect(scoped.rejectedStatements).toContain("Stimmt nicht");

    // Verworfenes darf nicht als offene Vermutung durchrutschen und
    // damit erneut vorgeschlagen werden.
    expect(scoped.openHypotheses).not.toContain("Stimmt nicht");
  });

  it("lässt nichts von einer anderen Person in den Kontext", async () => {
    const scoped = await buildScopedContext(await buildContextEnvelope(userA));
    const alles = [
      ...scoped.confirmedFacts,
      ...scoped.openHypotheses,
      ...scoped.rejectedStatements,
      ...scoped.recentTurns.map((t) => t.content),
    ].join(" ");

    expect(alles).not.toContain("Geheimnis von B");
  });

  it("gibt harte Bedingungen als Sätze weiter, nicht als Rohdaten", async () => {
    await withUser(db, userA, (tx) =>
      tx.insert(schema.userConstraints).values({
        userId: userA,
        data: { minSalaryPerYear: 48000, remoteRequired: true },
      }),
    );

    const scoped = await buildScopedContext(await buildContextEnvelope(userA));

    expect(scoped.hardConstraints.join(" ")).toContain("48000");
    expect(scoped.hardConstraints.join(" ")).toContain("Bedingung");
  });
});
