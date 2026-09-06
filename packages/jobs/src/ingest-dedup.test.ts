import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createInMemoryDb, runMigrations, schema, type Database } from "@paycheck/db";
import { gleicheStelleBeiAnderemAnbieter } from "./ingest.ts";

/**
 * Zusammenführen darf keine Stellen verschlucken.
 *
 * Der Schlüssel „Titel | Arbeitgeber | Ort" ist über Anbietergrenzen
 * hinweg ein starkes Indiz für dieselbe Anzeige — und innerhalb eines
 * Anbieters das Gegenteil. Ein Callcenter mit fünf offenen Stellen
 * „Kundenberater (m/w/d)" in Karlsruhe ist kein konstruierter Fall.
 *
 * Die Fehlerrichtung ist teuer und unsichtbar: vier Stellen werden als
 * „merged" verbucht und verschwinden dauerhaft aus der Datenbank. Eine
 * kürzere Liste sieht aus wie eine vollständige.
 */

let db: Database;
let close: () => Promise<void>;
let quelleA: string;
let quelleB: string;
let jobA: string;
let firma: string;

const SCHLUESSEL = "kundenberater|muster|karlsruhe";

beforeAll(async () => {
  const handle = await createInMemoryDb();
  db = handle.db;
  close = handle.close;
  await runMigrations(db);

  const [f] = await db.insert(schema.companies).values({ name: "Muster GmbH" }).returning();
  firma = f!.id;

  const [a] = await db
    .insert(schema.jobSources)
    .values({ key: "quelle_a", displayName: "Quelle A", kind: "licensed_api", licenseStatus: "licensed" })
    .returning();
  const [b] = await db
    .insert(schema.jobSources)
    .values({ key: "quelle_b", displayName: "Quelle B", kind: "licensed_api", licenseStatus: "licensed" })
    .returning();
  quelleA = a!.id;
  quelleB = b!.id;

  const [j] = await db
    .insert(schema.jobs)
    .values({
      title: "Kundenberater (m/w/d)",
      companyId: firma,
      location: "Karlsruhe",
      country: "DE",
      workModel: "on_site",
      description: "Eine hinreichend lange Beschreibung für die Prüfung dieser Anzeige.",
      // Beides ist NOT NULL ohne Vorgabewert: die Wortmenge und ihre
      // Länge entstehen beim Import, nicht in der Datenbank.
      descriptionTokens: "beschreibung prüfung anzeige",
      descriptionLength: 66,
      contentHash: "hash-1",
      sourceId: quelleA,
    })
    .returning();
  jobA = j!.id;

  await db.insert(schema.jobSourceLinks).values({
    jobId: jobA,
    sourceId: quelleA,
    externalId: "a-1",
    url: "https://muster.de/jobs/1",
    canonicalKey: SCHLUESSEL,
  });
}, 120_000);

afterAll(async () => {
  await close?.();
});

describe("Zusammenführen über Anbietergrenzen", () => {
  it("findet dieselbe Stelle bei einem anderen Anbieter", () => {
    /*
     * Der Zweck der ganzen Übung. Ohne diesen Treffer stünde dieselbe
     * Anzeige zweimal in der Liste, einmal je Portal.
     */
    return expect(gleicheStelleBeiAnderemAnbieter(db, SCHLUESSEL, quelleB)).resolves.toBe(jobA);
  });

  it("führt eine zweite Ausschreibung DESSELBEN Anbieters nicht zusammen", async () => {
    /*
     * Der Fehler, gegen den dieser Test gebaut ist. Vorher lieferte
     * die Abfrage auch hier `jobA`, die zweite Ausschreibung wurde als
     * „merged" verbucht und verschwand.
     */
    await expect(gleicheStelleBeiAnderemAnbieter(db, SCHLUESSEL, quelleA)).resolves.toBeNull();
  });

  it("gibt bei unbekanntem Schlüssel nichts zurück", async () => {
    // Kein Treffer heisst „neue Stelle" und darf nie zu einem
    // beliebigen vorhandenen Datensatz führen.
    await expect(gleicheStelleBeiAnderemAnbieter(db, "gibt|es|nicht", quelleB)).resolves.toBeNull();
  });
});
