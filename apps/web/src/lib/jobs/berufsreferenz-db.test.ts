import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createInMemoryDb, runMigrations, type Database } from "@paycheck/db";
import { sql } from "drizzle-orm";
import {
  berufFuerTitel,
  entgeltFuerBeruf,
  referenzFuerTitel,
  referenzenFuerTitel,
} from "./berufsreferenz.ts";

/**
 * Die Leseseite gegen echtes Postgres.
 *
 * Die Entscheidungsregeln stehen in `berufsreferenz.test.ts` und
 * brauchen keine Datenbank. Was hier geprüft wird, ist das, was
 * zwischen Tabelle und Anzeige schiefgehen kann:
 *
 *   • Ein Titel bekommt die Referenz eines fremden Berufs.
 *   • Eine Referenz mit zu dünner Basis wird trotzdem gezeigt.
 *   • Die Sammelabfrage ordnet die Werte den falschen Titeln zu —
 *     der Fehler, den man in einer Liste nie sieht, weil jede Zeile
 *     für sich plausibel aussieht.
 *
 * Echtes Postgres (PGlite) mit den echten Migrationen, kein Doppelgänger.
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

  await db.execute(sql`
    insert into beruf_zuordnung (titel, beruf, treffer, gesamt) values
      ('softwareentwickler', 'Softwareentwickler/in', 80, 100),
      ('software engineer', 'Softwareentwickler/in', 40, 100),
      ('steuerberater', 'Steuerberater/in', 70, 100),
      ('it-allrounder', null, 0, 68),
      ('bühnenbildner', 'Bühnenbildner/in', 30, 60)
  `);
  await db.execute(sql`
    insert into beruf_entgelt (beruf, q1, median, q3, anzahl, quelle) values
      ('Softwareentwickler/in', 52000, 56500, 62000, 11, 'bundesagentur'),
      ('Steuerberater/in', 82500, 90000, 92500, 9, 'bundesagentur'),
      ('Bühnenbildner/in', 30000, 34000, 39000, 4, 'bundesagentur')
  `);
}, 120_000);

afterAll(async () => {
  delete (globalThis as Record<symbol, unknown>)[GLOBAL_KEY];
  await close?.();
});

describe("Vom Titel zur Referenz", () => {
  it("findet die Referenz über die amtliche Bezeichnung", async () => {
    const r = await referenzFuerTitel("Softwareentwickler (m/w/d)");
    expect(r?.beruf).toBe("Softwareentwickler/in");
    expect(r?.median).toBe(56500);
    expect(r?.quelle).toBe("bundesagentur");
  });

  it("führt verschiedene Titel auf denselben Beruf", async () => {
    // Der eigentliche Zweck der Zuordnung: „Software Engineer" und
    // „Softwareentwickler" sind derselbe Arbeitsmarkt.
    const a = await referenzFuerTitel("Software Engineer (m/w/d)");
    const b = await referenzFuerTitel("Softwareentwickler");
    expect(a?.median).toBe(b?.median);
  });

  it("gibt nichts zurück, wenn die Basis zu dünn ist", async () => {
    /*
     * Vier Angaben sind keine Spanne.
     *
     * Der Wert steht in der Tabelle — geschrieben von einem Lauf mit
     * anderer Mindestzahl oder von Hand. Die Leseseite muss ihn
     * trotzdem zurückhalten, sonst hängt eine Zusicherung an der
     * Disziplin eines Skripts.
     */
    expect(await entgeltFuerBeruf("Bühnenbildner/in")).toBeNull();
    expect(await referenzFuerTitel("Bühnenbildner")).toBeNull();
  });

  it("gibt nichts zurück, wenn der Titel keinem Beruf zugeordnet ist", async () => {
    expect(await berufFuerTitel("IT-Allrounder")).toBeNull();
    expect(await referenzFuerTitel("IT-Allrounder")).toBeNull();
  });

  it("gibt nichts zurück für einen unbekannten Titel", async () => {
    expect(await referenzFuerTitel("Raumfahrtarchäologin")).toBeNull();
  });

  it("verweigert die Vollzeitspanne für ein Werkstudium", async () => {
    // Auch wenn die Zuordnung gelänge: „Werkstudent
    // Softwareentwicklung" darf nicht 52.000 – 62.000 € bekommen.
    expect(await referenzFuerTitel("Werkstudent Softwareentwickler")).toBeNull();
  });
});

describe("Sammelabfrage für die Liste", () => {
  it("gibt jedem Titel seinen eigenen Wert", async () => {
    /*
     * Der Fehler, den man in einer Liste nie sieht.
     *
     * Wenn die Zuordnung verrutscht, bekommt jede Zeile trotzdem eine
     * plausible Zahl — nur die falsche. Deshalb wird hier auf beide
     * Titel gleichzeitig geprüft und nicht nacheinander.
     */
    const m = await referenzenFuerTitel([
      "Softwareentwickler (m/w/d)",
      "Steuerberater (m/w/d)",
    ]);
    expect(m.get("Softwareentwickler (m/w/d)")?.median).toBe(56500);
    expect(m.get("Steuerberater (m/w/d)")?.median).toBe(90000);
  });

  it("lässt Titel ohne tragfähige Referenz einfach weg", async () => {
    // Fehlen ist die richtige Antwort. Ein Platzhalter wäre eine Zahl.
    const m = await referenzenFuerTitel(["IT-Allrounder", "Bühnenbildner", "Steuerberater"]);
    expect(m.has("IT-Allrounder")).toBe(false);
    expect(m.has("Bühnenbildner")).toBe(false);
    expect(m.get("Steuerberater")?.median).toBe(90000);
  });

  it("bedient mehrere Schreibweisen desselben Titels", async () => {
    const m = await referenzenFuerTitel(["Steuerberater (m/w/d)", "Steuerberater/in", "Steuerberater"]);
    expect(m.size).toBe(3);
    for (const v of m.values()) expect(v.median).toBe(90000);
  });

  it("übergeht Werkstudententitel", async () => {
    const m = await referenzenFuerTitel(["Werkstudent Steuerberater", "Steuerberater"]);
    expect(m.has("Werkstudent Steuerberater")).toBe(false);
    expect(m.has("Steuerberater")).toBe(true);
  });

  it("kommt mit einer leeren Liste zurecht", async () => {
    expect((await referenzenFuerTitel([])).size).toBe(0);
  });
});
