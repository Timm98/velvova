import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createInMemoryDb, runMigrations, type Database } from "@paycheck/db";
import { sql } from "drizzle-orm";
import { beschreibungsTokens } from "@paycheck/matching";
import { zuordnungNachtragen } from "./entgeltreferenz.ts";

/**
 * Dass der Nachtrag auch beim zweiten Mal etwas tut.
 *
 * ── Der Fehler, der hier gefangen wird ────────────────────────
 *
 * Die erste Fassung kürzte die offenen Titel auf ein Vielfaches des
 * Budgets und verglich erst danach mit dem, was schon zugeordnet war.
 * Beim ersten Durchlauf ging das gut. Ab dem zweiten standen die
 * ersten Titel bereits in der Tabelle — es blieb nichts übrig, und der
 * Worker stand still.
 *
 * Nichts schlug fehl. Kein Protokolleintrag, kein roter Test, nur eine
 * Abdeckung, die nicht mehr wuchs. Die unangenehmste Sorte Fehler.
 *
 * Deshalb wird hier nicht geprüft, ob der Code läuft, sondern ob er
 * beim zweiten Mal den nächsten Titel nimmt.
 */

let db: Database;
let close: () => Promise<void>;
const GLOBAL_KEY = Symbol.for("paycheck.db.handle");
const echtesFetch = globalThis.fetch;

/** Die Jobbörse als Attrappe: jede Suche findet denselben Beruf. */
let gefragteAdressen: string[] = [];
function jobboerseAttrappe(beruf = "Fachkraft/-mann - Lager") {
  globalThis.fetch = (async (eingabe: unknown) => {
    gefragteAdressen.push(String(eingabe));
    return new Response(
      JSON.stringify({ ergebnisliste: Array.from({ length: 50 }, () => ({ hauptberuf: beruf })) }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as unknown as typeof fetch;
}

const KEIN_VOLLZEIT = /\b(werkstudent|praktikum)/i;

beforeAll(async () => {
  const handle = await createInMemoryDb();
  db = handle.db;
  close = handle.close;
  await runMigrations(db);
  (globalThis as Record<symbol, unknown>)[GLOBAL_KEY] = handle;

  const [quelle] = await db
    .insert((await import("@paycheck/db")).schema.jobSources)
    .values({ key: "t", displayName: "Testquelle", kind: "seed" })
    .returning();
  const [firma] = await db
    .insert((await import("@paycheck/db")).schema.companies)
    .values({ name: "Beispiel GmbH" })
    .returning();

  /*
   * Mehr Titel als das dreifache Budget.
   *
   * Genau da sass der Fehler: Die alte Fassung kürzte auf `budget * 3`
   * und filterte erst danach. Mit vier Titeln fiele er nicht auf —
   * deshalb sechs.
   */
  for (const titel of [
    "Anlagenmechaniker (m/w/d)",
    "Buchhalter (m/w/d)",
    "Disponent (m/w/d)",
    "Elektroniker (m/w/d)",
    "Fachlagerist (m/w/d)",
    "Gabelstaplerfahrer (m/w/d)",
    "Werkstudent Logistik (m/w/d)",
  ]) {
    await db.insert((await import("@paycheck/db")).schema.jobs).values({
      title: titel,
      companyId: firma!.id,
      sourceId: quelle!.id,
      location: "Hamburg",
      workModel: "on_site",
      description: "Eine Beschreibung mit genug Text.",
      descriptionTokens: beschreibungsTokens("Eine Beschreibung mit genug Text."),
      descriptionLength: 32,
      contentHash: `h-${titel}`,
    });
  }
}, 180_000);

afterEach(() => {
  globalThis.fetch = echtesFetch;
  gefragteAdressen = [];
});

afterAll(async () => {
  delete (globalThis as Record<symbol, unknown>)[GLOBAL_KEY];
  await close?.();
});

describe("Nachtragen", () => {
  it("arbeitet sich Durchlauf für Durchlauf weiter", async () => {
    /*
     * Der eigentliche Punkt.
     *
     * Mit der alten Reihenfolge lieferten die ersten drei Durchläufe
     * je einen Titel — und ab dem vierten stand der Worker still:
     * die auf `budget * 3` gekürzte Liste enthielt nur noch bereits
     * zugeordnete Titel. Nichts schlug fehl; die Abdeckung wuchs
     * einfach nicht mehr.
     */
    for (let i = 1; i <= 4; i++) {
      gefragteAdressen = [];
      jobboerseAttrappe();
      const r = await zuordnungNachtragen(1, KEIN_VOLLZEIT);
      expect(r.gefragt, `Durchlauf ${i}`).toBe(1);
      expect(r.zugeordnet, `Durchlauf ${i}`).toBe(1);
    }

    const alle =
      ((await db.execute(sql`select titel from beruf_zuordnung order by titel`)) as unknown as {
        rows: { titel: string }[];
      }).rows;
    expect(alle.length).toBe(4);
    expect(new Set(alle.map((r) => r.titel)).size).toBe(4);
  });

  it("übergeht Werkstudentenstellen ganz", async () => {
    // Nicht „ordnet zu und verwirft später": gar keine Anfrage. Das
    // spart bei 2.506 Stellen rund jede zehnte fremde Abfrage.
    jobboerseAttrappe();
    await zuordnungNachtragen(10, KEIN_VOLLZEIT);
    const zeilen =
      ((await db.execute(sql`select titel from beruf_zuordnung`)) as unknown as {
        rows: { titel: string }[];
      }).rows;
    expect(zeilen.some((r) => /werkstudent/i.test(String(r.titel)))).toBe(false);
    expect(gefragteAdressen.some((u) => /werkstudent/i.test(decodeURIComponent(u)))).toBe(false);
  });

  it("fragt nichts mehr, wenn alles zugeordnet ist", async () => {
    jobboerseAttrappe();
    const r = await zuordnungNachtragen(10, KEIN_VOLLZEIT);
    expect(r.gefragt).toBe(0);
    expect(gefragteAdressen).toHaveLength(0);
  });
});
