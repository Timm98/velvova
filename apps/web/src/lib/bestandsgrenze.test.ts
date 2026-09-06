import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createInMemoryDb, runMigrations, schema, type Database } from "@paycheck/db";
import { beschreibungsTokens } from "@paycheck/matching";
import { sql } from "drizzle-orm";

/**
 * Die Obergrenze je Land — und warum sie je Land sein muss.
 *
 * ── Der Fehler, den das verhindert ────────────────────────────
 *
 * Der Bestand soll auf sechsstellige Grössen wachsen. Alles zu laden
 * hiesse Gigabyte im Arbeitsspeicher; also gibt es eine Grenze.
 *
 * Eine schlichte Grenze über den ganzen Bestand hätte einen stillen
 * Nebeneffekt gehabt: Deutschland liefert ein Vielfaches der Schweizer
 * und österreichischen Anzeigen. Die neuesten N wären fast
 * ausschliesslich deutsch gewesen — und eine Schweizer Nutzerin hätte
 * eine leere Liste gesehen, ohne dass irgendwo ein Fehler stünde.
 *
 * Genau diese Sorte Defekt ist die teuerste: nichts stürzt ab, nichts
 * wird rot, und die Ursache liegt in einer Zeile, an die niemand denkt.
 *
 * Geprüft wird deshalb die Fensterabfrage selbst, gegen echtes
 * Postgres — nicht die Absicht, sondern das SQL.
 */

let db: Database;
let close: () => Promise<void>;

/** Dasselbe Fenster wie in `bestandLaden()`. */
async function gefenstert(grenze: number) {
  const r = (await db.execute(sql`
    select country, count(*)::int n from (
      select j.country, row_number() over (
        partition by j.country
        order by coalesce(j.published_at, j.fetched_at) desc
      ) as rn
      from jobs j
      where j.is_demo = false
    ) g
    where g.rn <= ${grenze}
    group by country
  `)) as unknown as { rows: { country: string; n: number }[] };
  return new Map(r.rows.map((x) => [x.country, Number(x.n)]));
}

beforeAll(async () => {
  const handle = await createInMemoryDb();
  db = handle.db;
  close = handle.close;
  await runMigrations(db);

  const [quelle] = await db
    .insert(schema.jobSources)
    .values({ key: "t", displayName: "Testquelle", kind: "seed" })
    .returning();
  const [firma] = await db.insert(schema.companies).values({ name: "Beispiel GmbH" }).returning();

  /*
   * Ein Bestand, wie er wirklich aussieht: Deutschland um ein
   * Vielfaches grösser. Und die Schweizer Anzeigen sind die ÄLTESTEN
   * — so schlägt eine Gesamtgrenze am härtesten zu.
   */
  const werte = [];
  for (const [land, anzahl, tageAlt] of [
    ["DE", 60, 0],
    ["AT", 8, 30],
    ["CH", 5, 60],
  ] as const) {
    for (let i = 0; i < anzahl; i++) {
      werte.push({
        title: `Stelle ${land}-${i}`,
        companyId: firma!.id,
        sourceId: quelle!.id,
        location: land,
        country: land,
        workModel: "on_site" as const,
        description: "Eine Beschreibung mit genug Text.",
        descriptionTokens: beschreibungsTokens("Eine Beschreibung mit genug Text."),
        descriptionLength: 33,
        contentHash: randomUUID(),
        publishedAt: new Date(Date.now() - tageAlt * 86_400_000 - i * 60_000),
      });
    }
  }
  await db.insert(schema.jobs).values(werte);
}, 180_000);

afterAll(async () => {
  await close?.();
});

describe("Obergrenze je Land", () => {
  it("lässt jedem Land seine eigenen Plätze", async () => {
    const m = await gefenstert(10);
    expect(m.get("DE")).toBe(10);
    expect(m.get("AT")).toBe(8);
    expect(m.get("CH")).toBe(5);
  });

  it("nimmt der Schweiz nichts weg, wenn Deutschland wächst", async () => {
    /*
     * Der eigentliche Punkt. Bei einer Gesamtgrenze von 10 wären es
     * zehn deutsche Anzeigen und null Schweizer gewesen — denn die
     * deutschen sind die neuesten.
     */
    const eng = await gefenstert(3);
    expect(eng.get("CH")).toBe(3);
    expect(eng.get("AT")).toBe(3);
    expect(eng.get("DE")).toBe(3);
  });

  it("nimmt die neuesten, nicht irgendwelche", async () => {
    const r = (await db.execute(sql`
      select title from (
        select j.title, row_number() over (
          partition by j.country
          order by coalesce(j.published_at, j.fetched_at) desc
        ) as rn
        from jobs j where j.country = 'DE' and j.is_demo = false
      ) g where g.rn <= 2 order by g.rn
    `)) as unknown as { rows: { title: string }[] };
    // Der Aufbau oben macht Index 0 zur jüngsten Anzeige.
    expect(r.rows.map((x) => x.title)).toEqual(["Stelle DE-0", "Stelle DE-1"]);
  });

  it("lässt bei grosszügiger Grenze alles durch", async () => {
    const m = await gefenstert(1000);
    expect(m.get("DE")).toBe(60);
    expect(m.get("AT")).toBe(8);
    expect(m.get("CH")).toBe(5);
  });
});
