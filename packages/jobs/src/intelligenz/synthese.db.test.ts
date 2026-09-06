import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createInMemoryDb,
  runMigrations,
  schema,
  withSystem,
  withUser,
  type Database,
} from "@paycheck/db";
import { belegstandLaden } from "./belege.ts";
import { klaerungBeantwortet, offeneKlaerungen, profilsynthese } from "./synthese.ts";

let db: Database;
let close: () => Promise<void>;
let person: string;

const JETZT = new Date("2026-09-06T12:00:00Z");

beforeAll(async () => {
  const h = await createInMemoryDb();
  db = h.db;
  close = h.close;
  await runMigrations(db);
  const [u] = await withSystem(db, (tx) =>
    tx.insert(schema.users).values({ email: "synth@example.invalid" }).returning(),
  );
  person = u!.id;
}, 120_000);

afterAll(async () => close?.());

beforeEach(async () => {
  await withSystem(db, async (tx) => {
    await tx.delete(schema.profilKlaerungen);
    await tx.delete(schema.profilSynthesen);
    await tx.delete(schema.evidenceItems);
  });
});

async function beleg(
  statement: string,
  sourceType: "user_stated" | "ai_hypothesis" | "document_extract" | "external_source",
  confidence: number,
  type: "skill" | "preference" | "constraint" | "motive" = "preference",
) {
  const [z] = await withUser(db, person, (tx) =>
    tx.insert(schema.evidenceItems).values({ userId: person, type, statement, sourceType, confidence }).returning(),
  );
  return z!.id;
}

describe("Belegstand", () => {
  it("deckelt die Konfidenz einer Vermutung", async () => {
    await beleg("möchte vermutlich remote arbeiten", "ai_hypothesis", 0.95);
    const s = await belegstandLaden(db, person);
    expect(s.belege[0]!.art).toBe("inference");
    expect(s.belege[0]!.konfidenz).toBeLessThanOrEqual(0.74);
  });

  it("ändert den Fingerabdruck, wenn sich ein Beleg ändert", async () => {
    const id = await beleg("Ich wohne in Karlsruhe", "user_stated", 0.9);
    const a = await belegstandLaden(db, person);

    await withUser(db, person, (tx) =>
      tx
        .update(schema.evidenceItems)
        .set({ confidence: 0.5, updatedAt: new Date(JETZT.getTime() + 1000) })
        .where(eq(schema.evidenceItems.id, id)),
    );
    const b = await belegstandLaden(db, person);
    expect(b.stand).not.toBe(a.stand);
  });

  it("lässt abgelehnte Belege heraus", async () => {
    const id = await beleg("Ich möchte remote", "user_stated", 0.9);
    await withUser(db, person, (tx) =>
      tx.update(schema.evidenceItems).set({ userRejected: true }).where(eq(schema.evidenceItems.id, id)),
    );
    expect((await belegstandLaden(db, person)).anzahl).toBe(0);
  });
});

describe("Synthese", () => {
  it("rechnet bei zu wenigen Belegen nicht", async () => {
    /* Zwei Belege ergeben keine Zusammenfassung, sondern eine
       Aneinanderreihung von Vermutungen. */
    await beleg("Ich wohne in Karlsruhe", "user_stated", 0.9);
    const rufer = vi.fn();
    const b = await profilsynthese(db, { userId: person, rufer, jetzt: JETZT });
    expect(rufer).not.toHaveBeenCalled();
    expect(b.grund).toMatch(/zu wenig/);
  });

  it("rechnet einmal und dann nicht wieder", async () => {
    for (const t of ["Ich wohne in Karlsruhe", "Mindestens 40.000 brutto", "Drei Jahre im Lager"]) {
      await beleg(t, "user_stated", 0.9);
    }
    const rufer = vi.fn(async () => ({
      ergebnis: { demonstratedSkills: [], confidence: 0.7 },
      modell: "gpt-5.6-sol",
      konfidenz: 0.7,
    }));

    const erst = await profilsynthese(db, { userId: person, rufer, jetzt: JETZT });
    expect(erst.neuGerechnet).toBe(true);
    expect(rufer).toHaveBeenCalledTimes(1);

    /* Dieselbe Eingabe ergibt dieselbe Ausgabe — für Geld und Sekunden. */
    const zweit = await profilsynthese(db, { userId: person, rufer, jetzt: JETZT });
    expect(zweit.neuGerechnet).toBe(false);
    expect(zweit.grund).toMatch(/unverändert/);
    expect(rufer).toHaveBeenCalledTimes(1);
  });

  it("rechnet neu, wenn ein Beleg dazukommt", async () => {
    for (const t of ["Ich wohne in Karlsruhe", "Mindestens 40.000 brutto", "Drei Jahre im Lager"]) {
      await beleg(t, "user_stated", 0.9);
    }
    const rufer = vi.fn(async () => ({ ergebnis: {}, modell: "gpt-5.6-sol", konfidenz: 0.7 }));
    await profilsynthese(db, { userId: person, rufer, jetzt: JETZT });

    await beleg("Ich möchte keine Nachtschicht", "user_stated", 0.9);
    const b = await profilsynthese(db, { userId: person, rufer, jetzt: JETZT });
    expect(b.neuGerechnet).toBe(true);
    expect(rufer).toHaveBeenCalledTimes(2);
  });

  it("liefert Klärungen auch ohne Modell", async () => {
    /* Ohne Anbieter fällt die Zusammenfassung weg — die nächste
       Frage nicht. */
    await beleg("Drei Jahre im Lager gearbeitet", "user_stated", 0.9);
    const b = await profilsynthese(db, { userId: person, jetzt: JETZT });
    expect(b.synthese).toBeNull();
    expect(b.klaerungen.length).toBeGreaterThan(0);
    expect(b.klaerungen[0]!.art).toBe("frage");
  });
});

describe("Klärungen", () => {
  it("hält höchstens eine Frage offen", async () => {
    /*
     * Jeder Lauf legte zuerst die nächste offene Frage an. Nach zwei
     * Läufen standen zwei, nach zehn zehn — und genau das ist das
     * Formular, das eine Frage vermeiden soll.
     */
    await beleg("Drei Jahre im Lager", "user_stated", 0.9);
    for (let i = 0; i < 4; i++) await profilsynthese(db, { userId: person, jetzt: JETZT });

    const fragen = (await offeneKlaerungen(db, person)).filter((k) => k.art === "frage");
    expect(fragen).toHaveLength(1);
  });

  it("stellt die nächste erst nach einer Antwort", async () => {
    await beleg("Drei Jahre im Lager", "user_stated", 0.9);
    await profilsynthese(db, { userId: person, jetzt: JETZT });
    const erste = (await offeneKlaerungen(db, person)).find((k) => k.art === "frage")!;

    await klaerungBeantwortet(db, person, erste.schluessel, null, JETZT);
    await profilsynthese(db, { userId: person, jetzt: JETZT });

    const zweite = (await offeneKlaerungen(db, person)).filter((k) => k.art === "frage");
    expect(zweite).toHaveLength(1);
    expect(zweite[0]!.schluessel).not.toBe(erste.schluessel);
  });

  it("hält einen Widerspruch fest und stellt ihn als Frage", async () => {
    await beleg("Ich möchte keinen Vertrieb machen", "user_stated", 0.9, "preference");
    for (let i = 0; i < 4; i++) {
      await beleg(`Sales Manager Stelle gemerkt ${i}`, "external_source", 0.5, "preference");
    }
    await profilsynthese(db, { userId: person, jetzt: JETZT });

    const offen = await offeneKlaerungen(db, person);
    const w = offen.find((k) => k.art === "widerspruch");
    expect(w).toBeDefined();
    expect(w!.frage).toMatch(/\?$/);
  });

  it("schliesst eine beantwortete Frage", async () => {
    await beleg("Drei Jahre im Lager", "user_stated", 0.9);
    await profilsynthese(db, { userId: person, jetzt: JETZT });
    const offen = await offeneKlaerungen(db, person);

    await klaerungBeantwortet(db, person, offen[0]!.schluessel, null, JETZT);
    const nachher = await offeneKlaerungen(db, person);
    expect(nachher.find((k) => k.schluessel === offen[0]!.schluessel)).toBeUndefined();
  });
});
