import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createInMemoryDb, type Database } from "./client.ts";
import { runMigrations } from "./migrate.ts";

/**
 * Die Trennlinien des Arbeitgeberbereichs — gegen eine echte Datenbank.
 *
 * ── Warum das nicht in der Anwendungsschicht geprüft wird ─────
 *
 * Weil die Anwendungsschicht die Stelle ist, an der man es vergisst. Ein
 * `where`, das beim Umbau verlorengeht, eine Abfrage ohne
 * Organisationsfilter, ein Join, der eine Zeile zu viel mitnimmt: Jedes
 * davon ist ein normaler Programmierfehler und keiner, der auffällt.
 *
 * Diese Prüfungen sprechen deshalb direkt mit Postgres, unter der
 * eingeschränkten Anwendungsrolle und mit gesetzter Nutzerkennung —
 * genau so, wie die Anwendung es tut.
 *
 * ── Die Lücke, die dabei gefunden wurde ───────────────────────
 *
 * `memberships` stand in der allgemeinen Eigentümerschleife:
 * `user_id = app_current_user_id()`, für ALLE Befehle. Postgres
 * verknüpft zulassende Richtlinien mit ODER — also durfte jeder
 * Angemeldete sich selbst in JEDE Organisation eintragen, denn die Zeile
 * trug ja seine eigene Kennung.
 *
 * Wer die Organisationskennung kannte — sie steht in jedem
 * Arbeitgeber-Link —, hätte damit Zugang zu allen Bewerbungen dieses
 * Unternehmens gehabt. Der erste Test unten ist genau dieser Angriff.
 */

let db: Database;
let close: () => Promise<void>;

/**
 * Führt etwas als angemeldete Person unter der Anwendungsrolle aus.
 *
 * Die Transaktion wird ÜBERGEBEN und nicht als Nebenwirkung gesetzt. Die
 * erste Fassung rief `db.execute` innerhalb der Transaktion auf — das
 * holt sich eine zweite Verbindung aus dem Pool, und PGlite hat nur
 * eine. Der Aufbau lief in eine Zeitüberschreitung von drei Minuten,
 * ohne dass ein einziger Test lief.
 */
async function alsPerson<T>(
  userId: string,
  fn: (tx: Database) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT set_config('role', 'paycheck_app', true), set_config('app.user_id', ${userId}, true)`,
    );
    return fn(tx as unknown as Database);
  }) as Promise<T>;
}

async function neuerNutzer(email: string): Promise<string> {
  const r = (await db.execute(
    sql`INSERT INTO users (email) VALUES (${email}) RETURNING id`,
  )) as unknown as { rows: { id: string }[] };
  return r.rows[0]!.id;
}

let anna = "";
let bernd = "";
let carla = "";
let orgA = "";
let postingA = "";

beforeAll(async () => {
  const handle = await createInMemoryDb();
  db = handle.db;
  close = handle.close;
  await runMigrations(db);

  anna = await neuerNutzer("anna@example.invalid");
  bernd = await neuerNutzer("bernd@example.invalid");
  carla = await neuerNutzer("carla@example.invalid");

  // Anna gründet ein Unternehmen und stellt eine Stelle ein.
  const r = (await alsPerson(anna, async (tx) => {
    const x = (await tx.execute(
      sql`SELECT app_create_organization('Nordwind GmbH', 'employer') AS id`,
    )) as unknown as { rows: { id: string }[] };
    return x.rows[0]!.id;
  })) as string;
  orgA = r;

  postingA = await alsPerson(anna, async (tx) => {
    const x = (await tx.execute(sql`
      INSERT INTO job_postings (organization_id, created_by, title, status)
      VALUES (${orgA}, ${anna}, 'Disponent (m/w/d)', 'published') RETURNING id
    `)) as unknown as { rows: { id: string }[] };
    return x.rows[0]!.id;
  });

  // Carla bewirbt sich.
  await alsPerson(carla, async (tx) => {
    await tx.execute(sql`
      INSERT INTO posting_candidates
        (posting_id, organization_id, candidate_user_id, display_name, contact_email)
      VALUES (${postingA}, ${orgA}, ${carla}, 'Carla B.', 'carla@example.invalid')
    `);
  });
}, 180_000);

afterAll(async () => {
  await close?.();
});

describe("Niemand verschafft sich selbst Zugang", () => {
  it("lässt einen Fremden sich NICHT in eine Organisation eintragen", async () => {
    /*
     * Der Angriff, der vorher funktioniert hat.
     *
     * Bernd kennt nur die Organisationskennung. Gelänge die Zeile, sähe
     * er ab dem nächsten Aufruf jede Bewerbung dieses Unternehmens.
     */
    await expect(
      alsPerson(bernd, (tx) =>
        tx.execute(sql`
          INSERT INTO memberships (organization_id, user_id, role)
          VALUES (${orgA}, ${bernd}, 'admin')
        `),
      ),
    ).rejects.toThrow();
  });

  it("lässt einen Fremden sich auch nicht als einfaches Mitglied eintragen", async () => {
    await expect(
      alsPerson(bernd, (tx) =>
        tx.execute(sql`
          INSERT INTO memberships (organization_id, user_id, role)
          VALUES (${orgA}, ${bernd}, 'viewer')
        `),
      ),
    ).rejects.toThrow();
  });

  it("lässt eine Verwalterin sehr wohl jemanden eintragen", async () => {
    /*
     * Die Gegenprobe zu den beiden Tests darüber.
     *
     * Ohne sie könnte die Richtlinie einfach jedes Eintragen verbieten
     * und beide blieben grün — bei einem Arbeitgeberbereich, in den
     * niemand einen Kollegen holen kann.
     */
    await alsPerson(anna, (tx) =>
      tx.execute(sql`
        INSERT INTO memberships (organization_id, user_id, role)
        VALUES (${orgA}, ${bernd}, 'recruiter')
      `),
    );
    const r = (await alsPerson(anna, (tx) =>
      tx.execute(sql`SELECT role FROM memberships WHERE organization_id = ${orgA} AND user_id = ${bernd}`),
    )) as unknown as { rows: { role: string }[] };
    expect(r.rows[0]!.role).toBe("recruiter");

    // Und wieder heraus, damit die folgenden Tests Bernd als Fremden
    // behandeln können.
    await alsPerson(anna, (tx) =>
      tx.execute(sql`DELETE FROM memberships WHERE organization_id = ${orgA} AND user_id = ${bernd}`),
    );
  });

  it("macht die Gründerin zur Besitzerin", async () => {
    const r = (await alsPerson(anna, (tx) =>
      tx.execute(sql`SELECT role FROM memberships WHERE organization_id = ${orgA}`),
    )) as unknown as { rows: { role: string }[] };
    expect(r.rows.map((x) => x.role)).toEqual(["owner"]);
  });
});

describe("Ein fremdes Unternehmen bleibt unsichtbar", () => {
  it("zeigt einem Fremden die Organisation nicht", async () => {
    const r = (await alsPerson(bernd, (tx) =>
      tx.execute(sql`SELECT id FROM organizations WHERE id = ${orgA}`),
    )) as unknown as { rows: unknown[] };
    expect(r.rows).toHaveLength(0);
  });

  it("zeigt einem Fremden die Stellen nicht", async () => {
    const r = (await alsPerson(bernd, (tx) =>
      tx.execute(sql`SELECT id FROM job_postings WHERE organization_id = ${orgA}`),
    )) as unknown as { rows: unknown[] };
    expect(r.rows).toHaveLength(0);
  });

  it("zeigt einem Fremden die Bewerbungen nicht", async () => {
    /*
     * Die wichtigste Zeile dieser Datei.
     *
     * In `posting_candidates` stehen Name, E-Mail-Adresse und
     * Anschreiben von Menschen, die sich beworben haben.
     */
    const r = (await alsPerson(bernd, (tx) =>
      tx.execute(sql`SELECT id FROM posting_candidates WHERE organization_id = ${orgA}`),
    )) as unknown as { rows: unknown[] };
    expect(r.rows).toHaveLength(0);
  });

  it("zeigt sie der Organisation sehr wohl", async () => {
    // Die Gegenprobe. Ohne sie könnte die Richtlinie einfach alles
    // sperren und alle Tests oben blieben grün.
    const r = (await alsPerson(anna, (tx) =>
      tx.execute(sql`SELECT display_name FROM posting_candidates WHERE organization_id = ${orgA}`),
    )) as unknown as { rows: { display_name: string }[] };
    expect(r.rows.map((x) => x.display_name)).toEqual(["Carla B."]);
  });
});

describe("Die Bewerberin behält ihre Bewerbung", () => {
  it("sieht ihre eigene Bewerbung", async () => {
    /*
     * Die falsche Sorte Datenschutz wäre, sie auszusperren: eine
     * Bewerbung, die man abschickt und nie wiedersieht.
     */
    const r = (await alsPerson(carla, (tx) =>
      tx.execute(sql`SELECT id FROM posting_candidates WHERE candidate_user_id = ${carla}`),
    )) as unknown as { rows: unknown[] };
    expect(r.rows).toHaveLength(1);
  });

  it("darf zurückziehen", async () => {
    await alsPerson(carla, (tx) =>
      tx.execute(
        sql`UPDATE posting_candidates SET withdrawn_at = now() WHERE candidate_user_id = ${carla}`,
      ),
    );
    const r = (await alsPerson(anna, (tx) =>
      tx.execute(sql`SELECT withdrawn_at FROM posting_candidates WHERE organization_id = ${orgA}`),
    )) as unknown as { rows: { withdrawn_at: string | null }[] };
    expect(r.rows[0]!.withdrawn_at).not.toBeNull();
  });

  it("darf ihren eigenen Stand NICHT setzen", async () => {
    /*
     * Zeilenschutz kennt keine Spalten.
     *
     * Die Richtlinie erlaubt ihr UPDATE auf ihrer Zeile — damit stünde
     * ihr auch `stage = 'hired'` offen. Der Trigger zieht die
     * Spaltengrenze nach.
     */
    await expect(
      alsPerson(carla, (tx) =>
        tx.execute(
          sql`UPDATE posting_candidates SET stage = 'hired' WHERE candidate_user_id = ${carla}`,
        ),
      ),
    ).rejects.toThrow();
  });

  it("darf die Notiz des Unternehmens nicht überschreiben", async () => {
    await expect(
      alsPerson(carla, (tx) =>
        tx.execute(
          sql`UPDATE posting_candidates SET employer_note = 'super' WHERE candidate_user_id = ${carla}`,
        ),
      ),
    ).rejects.toThrow();
  });

  it("lässt das Unternehmen den Stand sehr wohl setzen", async () => {
    // Gegenprobe zum Trigger: Er darf nur den Bewerber bremsen.
    await alsPerson(anna, (tx) =>
      tx.execute(
        sql`UPDATE posting_candidates SET stage = 'screening' WHERE organization_id = ${orgA}`,
      ),
    );
    const r = (await alsPerson(anna, (tx) =>
      tx.execute(sql`SELECT stage FROM posting_candidates WHERE organization_id = ${orgA}`),
    )) as unknown as { rows: { stage: string }[] };
    expect(r.rows[0]!.stage).toBe("screening");
  });
});

describe("Das Unternehmen sieht nichts Privates", () => {
  it("sieht den Nina-Chat der Bewerberin nicht", async () => {
    /*
     * Die Zusage aus dem Auftrag, wörtlich: „Das Unternehmen darf
     * niemals den privaten Nina-Chat eines Kandidaten sehen."
     *
     * Sie hängt nicht daran, dass niemand eine solche Abfrage schreibt,
     * sondern daran, dass sie leer zurückkommt, wenn jemand es tut.
     */
    await alsPerson(carla, (tx) =>
      tx.execute(sql`
        INSERT INTO nina_conversations (user_id, title) VALUES (${carla}, 'Mein Gespräch')
      `),
    );
    const r = (await alsPerson(anna, (tx) =>
      tx.execute(sql`SELECT id FROM nina_conversations WHERE user_id = ${carla}`),
    )) as unknown as { rows: unknown[] };
    expect(r.rows).toHaveLength(0);
  });

  it("sieht die Lebenshaltung der Bewerberin nicht", async () => {
    await alsPerson(carla, (tx) =>
      tx.execute(sql`INSERT INTO living_costs (user_id, wohnen) VALUES (${carla}, 1200)`),
    );
    const r = (await alsPerson(anna, (tx) =>
      tx.execute(sql`SELECT user_id FROM living_costs WHERE user_id = ${carla}`),
    )) as unknown as { rows: unknown[] };
    expect(r.rows).toHaveLength(0);
  });

  it("sieht ihre aktuelle Stelle und ihr Gehalt nicht", async () => {
    await alsPerson(carla, (tx) =>
      tx.execute(
        sql`INSERT INTO current_employment (user_id, gross_amount) VALUES (${carla}, 63000)`,
      ),
    );
    const r = (await alsPerson(anna, (tx) =>
      tx.execute(sql`SELECT gross_amount FROM current_employment WHERE user_id = ${carla}`),
    )) as unknown as { rows: unknown[] };
    expect(r.rows).toHaveLength(0);
  });

  it("sieht ihre anderen Bewerbungen nicht", async () => {
    const r = (await alsPerson(anna, (tx) =>
      tx.execute(sql`SELECT id FROM applications WHERE user_id = ${carla}`),
    )) as unknown as { rows: unknown[] };
    expect(r.rows).toHaveLength(0);
  });
});
