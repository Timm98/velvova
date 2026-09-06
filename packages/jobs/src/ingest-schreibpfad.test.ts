import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createInMemoryDb, runMigrations, schema, type Database } from "@paycheck/db";
import { eq, sql } from "drizzle-orm";
import { ingestFromAdapter, type IngestPolicy } from "./ingest.ts";
import type { JobSourceAdapter, RawListing } from "./adapter.ts";
import { DEFAULT_CAPABILITIES } from "./adapter.ts";

/**
 * Was der Schreibpfad tut — festgehalten, bevor er umgebaut wird.
 *
 * ── Warum dieser Test zuerst entstand ─────────────────────────
 *
 * Der Schreibpfad macht acht bis zehn Hin- und Rückwege zur Datenbank
 * je Anzeige. Gemessen: 6,7 Anzeigen je Sekunde — für einen Bestand in
 * sechsstelliger Grösse sind das Tage. Gebündelt wäre dieselbe
 * Datenbank 208-mal schneller.
 *
 * Vor so einem Umbau braucht es ein Netz. Nicht „die Tests laufen
 * durch", sondern: Diese vier Entscheidungen — neu, unverändert,
 * geändert, zusammengeführt — müssen danach dieselben sein. Sie sind
 * die Grenze zwischen einer Metasuche und drei nebeneinanderlaufenden
 * Listen, und ein Fehler darin sieht aus wie eine kürzere Liste, nicht
 * wie ein Fehler.
 *
 * Der Test kennt den Umbau nicht. Er beschreibt nur, was heute
 * geschieht — und muss danach unverändert grün sein.
 */

let db: Database;
let close: () => Promise<void>;
const GLOBAL_KEY = Symbol.for("paycheck.db.handle");

const FREIGABE: IngestPolicy = {
  decision: "approved",
  allowedOperations: ["Search", "FetchDetails", "Cache"],
  reason: "Test",
};

function anzeige(over: Partial<RawListing> = {}): RawListing {
  return {
    externalId: "a-1",
    title: "Disponent (m/w/d)",
    companyName: "Muster GmbH",
    location: "Karlsruhe",
    country: "DE",
    workModel: "on_site",
    description:
      "Eine hinreichend lange Beschreibung dieser Stelle, damit sie als Anzeige zählt und nicht verworfen wird.",
    applyMethod: "portal",
    applyTarget: "https://example.invalid/a-1",
    originalUrl: "https://example.invalid/a-1",
    publishedAt: new Date("2026-08-01T00:00:00Z"),
    ...over,
  } as RawListing;
}

/** Ein Adapter, der genau die übergebenen Anzeigen liefert. */
function quelle(key: string, listings: RawListing[]): JobSourceAdapter {
  return {
    key,
    displayName: key,
    kind: "licensed_api",
    licenseStatus: "licensed",
    herkunft: "licensed_partner",
    capabilities: DEFAULT_CAPABILITIES,
    isConfigured: () => true,
    fetchListings: async () => listings,
  } as unknown as JobSourceAdapter;
}

async function lauf(key: string, listings: RawListing[]) {
  return ingestFromAdapter(quelle(key, listings), { limit: 100, policy: FREIGABE });
}

async function stellenZahl(): Promise<number> {
  const r = (await db.execute(sql`select count(*)::int n from jobs`)) as unknown as {
    rows: { n: number }[];
  };
  return Number(r.rows[0]!.n);
}

beforeAll(async () => {
  const handle = await createInMemoryDb();
  db = handle.db;
  close = handle.close;
  await runMigrations(db);
  (globalThis as Record<symbol, unknown>)[GLOBAL_KEY] = handle;
}, 180_000);

afterAll(async () => {
  delete (globalThis as Record<symbol, unknown>)[GLOBAL_KEY];
  await close?.();
});

describe("Die vier Entscheidungen", () => {
  it("legt eine unbekannte Anzeige an", async () => {
    const r = await lauf("q_neu", [anzeige({ externalId: "n-1", originalUrl: "https://example.invalid/n-1" })]);
    expect(r.inserted).toBe(1);
    expect(r.updated + r.unchanged + r.failed).toBe(0);

    const [j] = await db.select().from(schema.jobs).where(eq(schema.jobs.title, "Disponent (m/w/d)")).limit(1);
    expect(j?.descriptionLength).toBeGreaterThan(40);
    expect(j?.contentHash).toBeTruthy();
  });

  it("schreibt schon beim Anlegen eine Fundstelle mit", async () => {
    /*
     * ── Der Fehler, den dieser Test gefunden hat ──────────────
     *
     * Jeder andere Zweig des Schreibpfads trug die Fundstelle ein —
     * nur der, der eine Stelle ANLEGT, nicht. Eine frisch importierte
     * Anzeige stand in `jobs`, aber nicht in `job_source_links`.
     *
     * Das ist nicht bloss eine fehlende Herkunftsangabe: Genau diese
     * Tabelle fragt `gleicheStelleBeiAnderemAnbieter()` ab. Eine nie
     * fortgeschriebene Anzeige war dort unsichtbar, und ein zweiter
     * Anbieter mit derselben Stelle legte sie erneut an.
     *
     * Gemessen bei 20.277 Stellen im echten Bestand: 3.218 hatten eine
     * Fundstelle — 15,9 %.
     */
    const links = await db
      .select()
      .from(schema.jobSourceLinks)
      .where(eq(schema.jobSourceLinks.externalId, "n-1"));
    expect(links).toHaveLength(1);
    expect(links[0]!.canonicalKey).toBeTruthy();

    const snaps = await db.select().from(schema.jobSnapshots);
    expect(snaps.length).toBeGreaterThan(0);
  });

  it("erkennt eine Stelle bei einem zweiten Anbieter, ohne dass sie je aktualisiert wurde", async () => {
    /*
     * Die Probe aufs Exempel. Vor der Reparatur wäre hier eine zweite
     * Zeile entstanden — die Anzeige war frisch angelegt und deshalb
     * für die Entdopplung unsichtbar.
     */
    await lauf("q_frisch_a", [
      anzeige({
        externalId: "f-1",
        originalUrl: "https://example.invalid/f-1",
        title: "Zerspanungsmechaniker (m/w/d)",
        companyName: "Frisch GmbH",
      }),
    ]);
    const vorher = await stellenZahl();
    const r = await lauf("q_frisch_b", [
      anzeige({
        externalId: "f-2",
        originalUrl: "https://example.invalid/f-2",
        title: "Zerspanungsmechaniker (m/w/d)",
        companyName: "Frisch GmbH",
      }),
    ]);
    expect(r.merged).toBe(1);
    expect(await stellenZahl()).toBe(vorher);
  });

  it("erkennt dieselbe Anzeige beim zweiten Lauf als unverändert", async () => {
    const vorher = await stellenZahl();
    const r = await lauf("q_neu", [anzeige({ externalId: "n-1", originalUrl: "https://example.invalid/n-1" })]);
    expect(r.unchanged).toBe(1);
    expect(r.inserted).toBe(0);
    expect(await stellenZahl()).toBe(vorher);
  });

  it("schreibt fort, wenn sich der Text geändert hat", async () => {
    const r = await lauf("q_neu", [
      anzeige({
        externalId: "n-1",
        originalUrl: "https://example.invalid/n-1",
        description:
          "Ein deutlich anderer Text für dieselbe Stelle, lang genug um als vollwertige Anzeige zu gelten.",
      }),
    ]);
    expect(r.updated).toBe(1);
    expect(r.inserted).toBe(0);
  });

  it("führt dieselbe Stelle von einem anderen Anbieter zusammen", async () => {
    /*
     * Der eigentliche Unterschied zwischen einer Metasuche und drei
     * Listen nebeneinander. Geht das verloren, steht dieselbe Anzeige
     * mehrfach in der Liste — und niemand nennt das einen Fehler.
     */
    const vorher = await stellenZahl();
    const r = await lauf("q_zweit", [
      anzeige({ externalId: "z-1", originalUrl: "https://example.invalid/z-1" }),
    ]);
    expect(r.merged).toBe(1);
    expect(r.inserted).toBe(0);
    expect(await stellenZahl()).toBe(vorher);

    // Aber die zweite Fundstelle ist vermerkt.
    const links = await db
      .select()
      .from(schema.jobSourceLinks)
      .where(eq(schema.jobSourceLinks.externalId, "z-1"));
    expect(links).toHaveLength(1);
  });

  it("hält zwei verschiedene Stellen desselben Anbieters auseinander", async () => {
    /*
     * Fünf offene Stellen „Kundenberater (m/w/d)" in einem Callcenter
     * haben denselben Schlüssel und verschiedene Texte. Sie
     * zusammenzuführen hiesse, vier davon verschwinden zu lassen.
     */
    const vorher = await stellenZahl();
    await lauf("q_callcenter", [
      anzeige({
        externalId: "c-1",
        originalUrl: "https://example.invalid/c-1",
        title: "Kundenberater (m/w/d)",
        description: "Erste Stelle im Vertriebsinnendienst mit Schwerpunkt auf Bestandskunden und Betreuung.",
      }),
      anzeige({
        externalId: "c-2",
        originalUrl: "https://example.invalid/c-2",
        title: "Kundenberater (m/w/d)",
        description: "Zweite Stelle mit ganz anderem Zuschnitt: Neukundengewinnung, Messen und Aussendienst.",
      }),
    ]);
    expect(await stellenZahl()).toBe(vorher + 2);
  });
});

describe("Was auch ohne Textänderung geschrieben wird", () => {
  it("trägt ein neu gefundenes Gehalt nach", async () => {
    /*
     * Der Hash erkennt Änderungen an der QUELLE, nicht an unserer
     * Zuordnung. Als der Adapter der Bundesagentur die Gehaltsfelder
     * neu auslas, bekam von 248 Stellen genau eine das Gehalt — bei den
     * übrigen war der Text unverändert, also blieb es beim alten Stand.
     */
    await lauf("q_gehalt", [
      anzeige({ externalId: "g-1", originalUrl: "https://example.invalid/g-1", title: "Lagerist (m/w/d)" }),
    ]);
    const r = await lauf("q_gehalt", [
      anzeige({
        externalId: "g-1",
        originalUrl: "https://example.invalid/g-1",
        title: "Lagerist (m/w/d)",
        salaryMin: 38000,
        salaryMax: 45000,
        salaryCurrency: "EUR",
        salaryPeriod: "year",
      }),
    ]);
    expect(r.updated).toBe(1);

    const [j] = await db.select().from(schema.jobs).where(eq(schema.jobs.title, "Lagerist (m/w/d)")).limit(1);
    expect(j?.salaryMin).toBe(38000);
  });
});

describe("Ein grösserer Schwung", () => {
  it("verarbeitet hundert Anzeigen vollständig und ohne Dubletten", async () => {
    const viele = Array.from({ length: 100 }, (_, i) =>
      anzeige({
        externalId: `m-${i}`,
        originalUrl: `https://example.invalid/m-${i}`,
        title: `Fachkraft ${i} (m/w/d)`,
        companyName: `Firma ${i % 7} GmbH`,
        description: `Beschreibung der Stelle Nummer ${i}, ausführlich genug um als Anzeige zu zählen und nicht verworfen zu werden.`,
      }),
    );
    const vorher = await stellenZahl();
    const r = await lauf("q_viele", viele);
    expect(r.inserted).toBe(100);
    expect(r.failed).toBe(0);
    expect(await stellenZahl()).toBe(vorher + 100);

    // Sieben Arbeitgeber, hundert Anzeigen: die Firmen werden geteilt,
    // nicht hundertmal angelegt.
    const firmen = await db
      .select()
      .from(schema.companies)
      .where(sql`${schema.companies.name} like 'Firma %'`);
    expect(firmen).toHaveLength(7);
  });

  it("meldet denselben Schwung beim zweiten Mal als unverändert", async () => {
    const viele = Array.from({ length: 100 }, (_, i) =>
      anzeige({
        externalId: `m-${i}`,
        originalUrl: `https://example.invalid/m-${i}`,
        title: `Fachkraft ${i} (m/w/d)`,
        companyName: `Firma ${i % 7} GmbH`,
        description: `Beschreibung der Stelle Nummer ${i}, ausführlich genug um als Anzeige zu zählen und nicht verworfen zu werden.`,
      }),
    );
    const r = await lauf("q_viele", viele);
    expect(r.unchanged).toBe(100);
    expect(r.inserted).toBe(0);
  });
});
