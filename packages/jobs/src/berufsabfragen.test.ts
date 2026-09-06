import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createInMemoryDb, runMigrations, type Database } from "@paycheck/db";
import { sql } from "drizzle-orm";
import { abfragenVermerken, berufsabfragen } from "./berufsabfragen.ts";
import { STANDARDSUCHEN } from "./sources/bundesagentur.ts";

/**
 * Welche Suchbegriffe die Importe bekommen — und in welcher Reihenfolge.
 *
 * ── Was hier schiefgehen kann ─────────────────────────────────
 *
 * Nichts davon stürzt ab. Ein schlechter Wortschatz führt zu einem
 * kleineren Bestand, und ein kleinerer Bestand sieht aus wie ein
 * Arbeitsmarkt mit wenig Angebot. Genau so war es: 236 Begriffe aus
 * dem eigenen Bestand deckten 573.662 von 999.398 Anzeigen ab, und
 * niemand konnte das der Liste ansehen.
 */

let db: Database;
let close: () => Promise<void>;
const GLOBAL_KEY = Symbol.for("paycheck.db.handle");

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

describe("Ohne alles", () => {
  it("gibt die Grundausstattung zurück, statt gar nichts", async () => {
    /*
     * Eine leere Datenbank heisst frisches System, nicht „keine
     * Suche". Ohne diesen Rückfall holte der erste Lauf nichts — und
     * danach stünde nichts da, woraus ein Wortschatz entstehen könnte.
     */
    expect(await berufsabfragen(50)).toEqual([...STANDARDSUCHEN]);
  });
});

describe("Der Zirkelschluss und sein Ausweg", () => {
  it("nimmt den eigenen Bestand, solange nichts geerntet wurde", async () => {
    await db.execute(sql`
      insert into beruf_zuordnung (titel, beruf, treffer, gesamt) values
        ('softwareentwickler', 'Softwareentwickler/in', 80, 100),
        ('koch', 'Koch/Köchin', 40, 100)
    `);
    const b = await berufsabfragen(50);
    expect(b).toContain("Softwareentwickler/in");
    expect(b).toContain("Koch/Köchin");
  });

  it("bevorzugt den geernteten Wortschatz, sobald es einen gibt", async () => {
    /*
     * Der Ausweg aus dem Zirkelschluss: Bezeichnungen aus den Anzeigen
     * der Jobbörse selbst, nicht aus dem, was wir schon haben.
     */
    await db.execute(sql`
      insert into beruf_wortschatz (beruf, vorkommen, anzeigen) values
        ('Verkäufer/in', 900, 120000),
        ('Mechatroniker/in', 700, 90000),
        ('Bühnenbildner/in', 3, 40)
    `);
    const b = await berufsabfragen(50);
    expect(b).toContain("Verkäufer/in");
    expect(b).not.toContain("Softwareentwickler/in");
  });

  it("stellt die ergiebigsten Begriffe nach vorn", async () => {
    /*
     * Jeder Begriff kostet gleich viel Anfragen. Wer mit den grössten
     * anfängt, holt mit demselben Aufwand mehr — und ein abgebrochener
     * Lauf hat trotzdem die ergiebigen erwischt.
     */
    const b = await berufsabfragen(50);
    expect(b.indexOf("Verkäufer/in")).toBeLessThan(b.indexOf("Mechatroniker/in"));
    expect(b.indexOf("Mechatroniker/in")).toBeLessThan(b.indexOf("Bühnenbildner/in"));
  });

  it("nimmt auch Begriffe mit, deren Trefferzahl noch unbekannt ist", async () => {
    // Ungefragt heisst nicht schlecht. Sie kommen nur später dran.
    await db.execute(sql`insert into beruf_wortschatz (beruf, vorkommen) values ('Reetdachdecker/in', 1)`);
    const b = await berufsabfragen(50);
    expect(b).toContain("Reetdachdecker/in");
  });

  it("hält sich an die Obergrenze", async () => {
    expect((await berufsabfragen(2)).length).toBe(2);
  });
});

describe("Nie verwendete Begriffe zuerst", () => {
  /**
   * ── Warum die Reihenfolge das Wichtigste ist ──────────────
   *
   * Vorher galt allein die Ergiebigkeit. Das ist für den ersten Lauf
   * richtig und für jeden weiteren falsch: Er beginnt wieder am Anfang
   * und holt, was längst da ist.
   *
   * Gemessen nach mehreren Läufen: **12 neue Stellen aus 3.000
   * geholten** — der Rest „unverändert". Von 12.304 Begriffen waren
   * erst 3.600 je abgefragt worden. Die Läufe drehten sich im Kreis,
   * während zwei Drittel des Wortschatzes unberührt lag.
   *
   * Und es sah dabei erfolgreich aus: „3.000 geholt" stand in jeder
   * Zeile des Protokolls.
   */
  it("nimmt einen nie verwendeten Begriff vor einen ergiebigen", async () => {
    await db.execute(sql`delete from beruf_wortschatz`);
    await db.execute(sql`
      insert into beruf_wortschatz (beruf, vorkommen, anzeigen, zuletzt_geholt) values
        ('Schon geholt', 900, 120000, now()),
        ('Nie geholt', 3, 40, null)
    `);
    const b = await berufsabfragen(10);
    expect(b[0]).toBe("Nie geholt");
  });

  it("nimmt danach den am längsten nicht verwendeten", async () => {
    await db.execute(sql`delete from beruf_wortschatz`);
    await db.execute(sql`
      insert into beruf_wortschatz (beruf, vorkommen, anzeigen, zuletzt_geholt) values
        ('Gestern', 5, 100, now() - interval '1 day'),
        ('Eben', 5, 100, now())
    `);
    expect((await berufsabfragen(10))[0]).toBe("Gestern");
  });

  it("entscheidet innerhalb derselben Stufe nach Ergiebigkeit", async () => {
    // Sind alle gleich alt, gilt weiter: die grössten zuerst. Ein
    // abgebrochener Lauf hat dann die ergiebigen erwischt.
    await db.execute(sql`delete from beruf_wortschatz`);
    await db.execute(sql`
      insert into beruf_wortschatz (beruf, vorkommen, anzeigen) values
        ('Klein', 5, 40), ('Gross', 5, 90000)
    `);
    expect((await berufsabfragen(10))[0]).toBe("Gross");
  });

  it("vermerkt verwendete Begriffe", async () => {
    await db.execute(sql`delete from beruf_wortschatz`);
    await db.execute(sql`insert into beruf_wortschatz (beruf, vorkommen) values ('Frisch', 1)`);
    await abfragenVermerken(["Frisch"]);
    const r = (await db.execute(sql`
      select zuletzt_geholt from beruf_wortschatz where beruf = 'Frisch'`)) as unknown as {
      rows: { zuletzt_geholt: unknown }[];
    };
    expect(r.rows[0]!.zuletzt_geholt).not.toBeNull();
  });
});
