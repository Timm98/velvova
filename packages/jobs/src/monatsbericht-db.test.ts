import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createInMemoryDb, runMigrations, schema, type Database } from "@paycheck/db";
import { sql } from "drizzle-orm";
import { monatsberichteLaufen } from "./monatsbericht.ts";

/**
 * ══════════════════════════════════════════════════════════════════
 * Dass der Monatslauf tut, was der Kommentar behauptet
 * ══════════════════════════════════════════════════════════════════
 *
 * ── Warum das eine Datenbankprüfung sein muss ───────────────────
 *
 * Weil die drei Regeln, um die es geht, in SQL stehen und nicht in
 * TypeScript: der eindeutige Teilindex gegen den doppelten Auslöser,
 * das `on conflict … where art = 'monatslauf'`, und die Abfrage, die
 * den Stand der Themen liest.
 *
 * Beim Schreiben dieser Datei war `lauf_kennung` in der UPDATE-Anweisung
 * über zwei Zeilen zerrissen — `lau` / `f_kennung`. `tsc` sieht das
 * nicht, es steht in einer Zeichenkette. Erst hier fällt es auf.
 */

let db: Database;
let close: () => Promise<void>;
const GLOBAL_KEY = Symbol.for("paycheck.db.handle");

let orgId: string;
let vorgangId: string;

beforeAll(async () => {
  const handle = await createInMemoryDb();
  db = handle.db;
  close = handle.close;
  await runMigrations(db);
  (globalThis as Record<symbol, unknown>)[GLOBAL_KEY] = handle;

  const [org] = await db
    .insert(schema.organizations)
    .values({ name: "Beispielbetrieb", slug: `test-${Date.now()}` })
    .returning();
  orgId = org!.id;

  const [v] = await db
    .insert(schema.bedarfsvorgaenge)
    .values({
      organizationId: orgId,
      titel: "Anfragen bleiben liegen",
      ausgangslage: "Kundenanfragen bleiben mehrere Tage liegen.",
      ebene: "beobachtung",
    })
    .returning();
  vorgangId = v!.id;

  await db.insert(schema.monatsberichtEinstellungen).values({
    organizationId: orgId,
    aktiv: true,
    zeitzone: "Europe/Berlin",
  });
}, 120_000);

afterAll(async () => {
  delete (globalThis as Record<symbol, unknown>)[GLOBAL_KEY];
  await close?.();
});

async function berichte() {
  const r = (await db.execute(sql`
    select berichtsmonat, zustand, lage, grund, fehler,
           jsonb_array_length(staende) as themen
    from monatsberichte where organization_id = ${orgId}
    order by berichtsmonat`)) as unknown as {
    rows: { berichtsmonat: string; zustand: string; lage: string; grund: string | null; fehler: string | null; themen: number }[];
  };
  return r.rows;
}

describe("Der Monatslauf", () => {
  it("rechnet für die aktivierte Organisation genau einen Bericht", async () => {
    const b = await monatsberichteLaufen(new Date("2026-10-05T09:00:00Z"));
    expect(b.organisationen).toBe(1);
    expect(b.gerechnet).toBe(1);
    expect(b.fehlgeschlagen).toBe(0);

    const zeilen = await berichte();
    expect(zeilen).toHaveLength(1);
    expect(zeilen[0]!.zustand).toBe("fertig");
    expect(zeilen[0]!.fehler).toBeNull();
    /* Ein Thema, und im ersten Bericht ist es neu. */
    expect(zeilen[0]!.themen).toBe(1);
    expect(zeilen[0]!.lage).toBe("stand");
  });

  it("erzeugt beim zweiten Auslöser im selben Monat keinen zweiten", async () => {
    const b = await monatsberichteLaufen(new Date("2026-10-27T09:00:00Z"));
    expect(b.gerechnet).toBe(0);
    expect(b.uebersprungen).toBe(1);
    expect(await berichte()).toHaveLength(1);
  });

  it("meldet im Folgemonat ohne Bewegung „kein belastbarer neuer Stand“", async () => {
    const b = await monatsberichteLaufen(new Date("2026-11-04T09:00:00Z"));
    expect(b.gerechnet).toBe(1);

    const zeilen = await berichte();
    expect(zeilen).toHaveLength(2);
    const november = zeilen.at(-1)!;
    expect(november.lage).toBe("kein_neuer_stand");
    expect(november.grund).toMatch(/unverändert/i);
  });

  it("erkennt den Fortschritt einer Ebene als Veränderung", async () => {
    await db.execute(sql`
      update bedarfsvorgaenge set ebene = 'hypothese' where id = ${vorgangId}`);

    const b = await monatsberichteLaufen(new Date("2026-12-03T09:00:00Z"));
    expect(b.gerechnet).toBe(1);

    const r = (await db.execute(sql`
      select veraenderungen from monatsberichte
      where organization_id = ${orgId} and berichtsmonat = '2026-11-01'`)) as unknown as {
      rows: { veraenderungen: { art: string }[] }[];
    };
    expect(r.rows[0]!.veraenderungen.map((v) => v.art)).toContain("fortgeschritten");
  });

  it("nennt ein gelöschtes Thema nicht gelöst", async () => {
    await db.execute(sql`delete from bedarfsvorgaenge where id = ${vorgangId}`);

    await monatsberichteLaufen(new Date("2027-01-06T09:00:00Z"));
    const r = (await db.execute(sql`
      select veraenderungen from monatsberichte
      where organization_id = ${orgId} and berichtsmonat = '2026-12-01'`)) as unknown as {
      rows: { veraenderungen: { art: string }[] }[];
    };
    const arten = r.rows[0]!.veraenderungen.map((v) => v.art);
    expect(arten).toContain("nicht_mehr_gemessen");
    expect(arten).not.toContain("geloest");
  });

  it("lässt eine nicht aktivierte Organisation in Ruhe", async () => {
    await db.execute(sql`
      update monatsbericht_einstellungen set aktiv = false where organization_id = ${orgId}`);
    const b = await monatsberichteLaufen(new Date("2027-02-03T09:00:00Z"));
    expect(b.organisationen).toBe(0);
    expect(b.gerechnet).toBe(0);
  });
});
