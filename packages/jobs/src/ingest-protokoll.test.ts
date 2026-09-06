import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createInMemoryDb, runMigrations, schema, type Database } from "@paycheck/db";
import { letzterErfolgreicherLauf } from "./ingest.ts";

/**
 * Ohne Laufprotokoll gibt es kein „seit wann".
 *
 * Die Tabelle existierte seit dem ersten Entwurf, und niemand schrieb
 * hinein. Die Betriebsansicht zeigte „Importläufe" als Kennzahl — eine
 * Null, die aussah wie eine Messung und es nie war.
 *
 * Der zweite Schaden war unsichtbarer: jeder Lauf holte alles von vorn,
 * auch bei Anbietern, die nach Datum filtern können. Verschenktes
 * Kontingent, ohne dass irgendwo etwas falsch aussah.
 */

let db: Database;
let close: () => Promise<void>;

beforeAll(async () => {
  const handle = await createInMemoryDb();
  db = handle.db;
  close = handle.close;
  await runMigrations(db);
}, 120_000);

afterAll(async () => {
  await close?.();
});

const T = (iso: string) => new Date(iso);

describe("Letzter erfolgreicher Lauf", () => {
  it("gibt nichts zurück, solange es keinen gab", async () => {
    /*
     * Der erste Lauf muss alles holen. `null` ist hier die richtige
     * Antwort — ein erfundener Startzeitpunkt liesse genau die Stellen
     * aus, die es vor ihm schon gab.
     */
    await expect(letzterErfolgreicherLauf(db, "noch_nie")).resolves.toBeNull();
  });

  it("nimmt den jüngsten fehlerfreien Lauf", async () => {
    await db.insert(schema.jobIngestionRuns).values([
      { sourceKey: "quelle_x", startedAt: T("2026-08-01T10:00:00Z"), finishedAt: T("2026-08-01T10:01:00Z"), failed: 0 },
      { sourceKey: "quelle_x", startedAt: T("2026-08-20T10:00:00Z"), finishedAt: T("2026-08-20T10:01:00Z"), failed: 0 },
    ]);
    const d = await letzterErfolgreicherLauf(db, "quelle_x");
    expect(d?.toISOString()).toBe("2026-08-20T10:00:00.000Z");
  });

  it("überspringt Läufe mit Fehlern", async () => {
    /*
     * Der Punkt, an dem eine Lücke entsteht oder nicht.
     *
     * Zählte ein gescheiterter Lauf, machte der nächste dort weiter,
     * wo jener abbrach — und alles, was währenddessen veröffentlicht
     * wurde, käme nie in die Datenbank. Niemand würde es je bemerken:
     * fehlende Stellen sehen aus wie nicht vorhandene.
     */
    await db.insert(schema.jobIngestionRuns).values({
      sourceKey: "quelle_x",
      startedAt: T("2026-08-25T10:00:00Z"),
      finishedAt: T("2026-08-25T10:00:30Z"),
      failed: 3,
      errorSummary: "HTTP 429",
    });
    const d = await letzterErfolgreicherLauf(db, "quelle_x");
    expect(d?.toISOString()).toBe("2026-08-20T10:00:00.000Z");
  });

  it("überspringt Läufe, die nie fertig wurden", async () => {
    // Ein abgebrochener Prozess hinterlässt eine Zeile ohne Ende. Sie
    // als erfolgreich zu lesen hiesse, seine Lücke zu übernehmen.
    await db.insert(schema.jobIngestionRuns).values({
      sourceKey: "quelle_x",
      startedAt: T("2026-08-28T10:00:00Z"),
      finishedAt: null,
      failed: 0,
    });
    const d = await letzterErfolgreicherLauf(db, "quelle_x");
    expect(d?.toISOString()).toBe("2026-08-20T10:00:00.000Z");
  });

  it("hält Quellen auseinander", async () => {
    await db.insert(schema.jobIngestionRuns).values({
      sourceKey: "quelle_y",
      startedAt: T("2026-08-30T10:00:00Z"),
      finishedAt: T("2026-08-30T10:01:00Z"),
      failed: 0,
    });
    await expect(letzterErfolgreicherLauf(db, "quelle_x")).resolves.toEqual(T("2026-08-20T10:00:00Z"));
  });
});
