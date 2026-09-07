import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createInMemoryDb,
  runMigrations,
  schema,
  withSystem,
  withUser,
  type Database,
} from "@paycheck/db";
import { anstoesse } from "./anstoss.ts";
import { syntheseFaellig, WICHTIG_BELEGE_AB, NEUE_BELEGE_AB } from "./hintergrund.ts";

/**
 * Ereignisse als Anstoss — und was sie ausdrücklich nicht tun.
 *
 * Ein Lebenslauf-Upload ruft nicht sofort das teure Modell. Er senkt
 * die Schwelle, damit gebündelt wird, was zusammengehört.
 */

let db: Database;
let close: () => Promise<void>;
let person: string;
const JETZT = new Date("2026-09-06T12:00:00Z");
const vorher = new Date(JETZT.getTime() - 60 * 60_000);

beforeAll(async () => {
  const h = await createInMemoryDb();
  db = h.db;
  close = h.close;
  await runMigrations(db);
}, 120_000);

afterAll(async () => close?.());

beforeEach(async () => {
  await withSystem(db, async (tx) => {
    await tx.delete(schema.nutzerEreignisse);
    await tx.delete(schema.userDocuments);
    await tx.delete(schema.applications);
    await tx.delete(schema.jobs);
    await tx.delete(schema.companies);
    await tx.delete(schema.jobSources);
    await tx.delete(schema.profilSynthesen);
    await tx.delete(schema.evidenceItems);
    await tx.delete(schema.users);
  });
  const [u] = await withSystem(db, (tx) =>
    tx
      .insert(schema.users)
      .values({ email: `anstoss-${Math.random()}@example.invalid` })
      .returning(),
  );
  person = u!.id;
});

async function belege(n: number, ab = 0, wann = JETZT) {
  await withUser(db, person, (tx) =>
    tx.insert(schema.evidenceItems).values(
      Array.from({ length: n }, (_, i) => ({
        userId: person,
        type: "preference" as const,
        statement: `Angabe ${ab + i}`,
        sourceType: "user_stated" as const,
        confidence: 0.9,
        createdAt: wann,
        updatedAt: wann,
      })),
    ),
  );
}

async function syntheseVom(wann: Date, anzahl: number, stand: string) {
  await withUser(db, person, (tx) =>
    tx.insert(schema.profilSynthesen).values({
      userId: person,
      art: "profilsynthese",
      ergebnis: {},
      belegStand: stand,
      belegAnzahl: anzahl,
      modell: "gpt-5.6-sol",
      promptFassung: "probe",
      konfidenz: 0.7,
      erstelltAm: wann,
    }),
  );
}

async function ereignis(art: string, wann = JETZT, urheber = "user") {
  await withUser(db, person, (tx) =>
    tx.insert(schema.nutzerEreignisse).values({
      userId: person,
      art,
      urheber,
      geschehenAm: wann,
      ereignisSchluessel: `${art}-${Math.random()}`,
    }),
  );
}

describe("Was als Anstoss zählt", () => {
  it("erkennt neue Unterlagen", async () => {
    await withUser(db, person, (tx) =>
      tx.insert(schema.userDocuments).values({
        userId: person,
        declaredKind: "cv",
        originalFilename: "lebenslauf.pdf",
        mimeType: "application/pdf",
        byteSize: 1000,
        storageBucket: "docs",
        storagePath: "x",
        createdAt: JETZT,
        updatedAt: JETZT,
      }),
    );
    const a = await anstoesse(db, person, vorher);
    expect(a.map((x) => x.art)).toContain("lebenslauf");
  });

  it("erkennt eine Bewerbung", async () => {
    const [quelle] = await withSystem(db, (tx) =>
      tx
        .insert(schema.jobSources)
        .values({ key: `q-${Math.random()}`, displayName: "Test", kind: "licensed_api" })
        .returning(),
    );
    const [firma] = await withSystem(db, (tx) =>
      tx.insert(schema.companies).values({ name: "Testbetrieb GmbH" }).returning(),
    );
    const [stelle] = await withSystem(db, (tx) =>
      tx
        .insert(schema.jobs)
        .values({
          sourceId: quelle!.id,
          companyId: firma!.id,
          contentHash: `hash-${Math.random()}`,
          originalUrl: "https://example.invalid/1",
          title: "Sachbearbeitung",
          description: "Eine Stelle mit einer hinreichend langen Beschreibung für den Test.",
          descriptionTokens: "sachbearbeitung stelle beschreibung",
          descriptionLength: 66,
          location: "Karlsruhe",
          fetchedAt: JETZT,
          workModel: "on_site" as const,
        })
        .returning(),
    );

    await withUser(db, person, (tx) =>
      tx
        .insert(schema.applications)
        .values({ userId: person, jobId: stelle!.id, createdAt: JETZT }),
    );
    const a = await anstoesse(db, person, vorher);
    expect(a.map((x) => x.art)).toContain("bewerbung");
  });

  it("erkennt eine geänderte Suche", async () => {
    await ereignis("search_changed");
    const a = await anstoesse(db, person, vorher);
    expect(a.map((x) => x.art)).toContain("suche_geaendert");
  });

  it("zählt drei angesehene Stellen, aber nicht zwei", async () => {
    await ereignis("job_viewed");
    await ereignis("job_viewed");
    expect((await anstoesse(db, person, vorher)).map((x) => x.art)).not.toContain(
      "viel_angesehen",
    );

    await ereignis("job_saved");
    expect((await anstoesse(db, person, vorher)).map((x) => x.art)).toContain("viel_angesehen");
  });

  it("zählt nicht, was Monday selbst getan hat", async () => {
    /*
     * Sonst entstünde derselbe Kreis, den `urheber` in den
     * Verhaltenssignalen verhindert: Monday merkt vor, das gilt als
     * Aktivität, Monday rechnet neu, merkt wieder vor.
     */
    for (let i = 0; i < 5; i++) await ereignis("job_viewed", JETZT, "nina");
    expect(await anstoesse(db, person, vorher)).toHaveLength(0);
  });

  it("sieht nichts, was vor dem Zeitpunkt liegt", async () => {
    await ereignis("search_changed", new Date(JETZT.getTime() - 5 * 3600_000));
    expect(await anstoesse(db, person, vorher)).toHaveLength(0);
  });
});

describe("Was ein Anstoss bewirkt", () => {
  it("senkt die Schwelle, statt sie zu überspringen", async () => {
    await belege(5, 0, vorher);
    await syntheseVom(vorher, 5, "alt");

    /* Zwei neue Belege — unter NEUE_BELEGE_AB. */
    await belege(WICHTIG_BELEGE_AB, 100);
    expect(WICHTIG_BELEGE_AB).toBeLessThan(NEUE_BELEGE_AB);

    const ohne = await syntheseFaellig(db, person, { jetzt: JETZT });
    expect(ohne.faellig).toBe(false);

    await ereignis("search_changed");
    const mit = await syntheseFaellig(db, person, { jetzt: JETZT });
    expect(mit.faellig).toBe(true);
    expect(mit.anlass).toBe("wichtiges_ereignis");
    expect(mit.anstoesse.map((a) => a.art)).toContain("suche_geaendert");
  });

  it("löst nichts aus, solange die Zehn-Minuten-Sperre gilt", async () => {
    await belege(5, 0, vorher);
    await syntheseVom(new Date(JETZT.getTime() - 5 * 60_000), 5, "alt");
    await belege(3, 200);
    await ereignis("search_changed");

    const f = await syntheseFaellig(db, person, { jetzt: JETZT });
    expect(f.faellig).toBe(false);
    expect(f.anlass).toBe("zu_frueh");
  });

  it("löst nichts aus, wenn sich die Belege nicht geändert haben", async () => {
    /*
     * Ein hochgeladener Lebenslauf, aus dem noch kein Beleg entstanden
     * ist, ändert am Ergebnis nichts. Zu rechnen wäre Geld für ein
     * identisches Bild.
     */
    await belege(5, 0, vorher);
    const stand = await import("./belege.ts").then((m) => m.belegstandLaden(db, person));
    await syntheseVom(vorher, 5, stand.stand);
    await ereignis("search_changed");

    const f = await syntheseFaellig(db, person, { jetzt: JETZT });
    expect(f.faellig).toBe(false);
    expect(f.anlass).toBe("kein_anlass");
  });
});
