import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createInMemoryDb, runMigrations, schema, withSystem, withUser, type Database } from "@paycheck/db";
import { brauchtZweiteMeinung, karriereanalyse } from "./karriere.ts";

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
    tx.insert(schema.users).values({ email: "karriere@example.invalid" }).returning(),
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

async function grundlage(anzahl = 6) {
  const saetze = [
    "Ich wohne in Karlsruhe und pendle bis 30 km",
    "Mindestens 40.000 Euro brutto im Jahr",
    "Vier Jahre im Einzelhandel gearbeitet",
    "Ich möchte die Branche wechseln",
    "Keine Führungsverantwortung",
    "Vollzeit, feste Arbeitszeiten",
    "Wenig Stress ist mir wichtig",
  ];
  await withUser(db, person, (tx) =>
    tx.insert(schema.evidenceItems).values(
      saetze.slice(0, anzahl).map((statement) => ({
        userId: person,
        type: "preference" as const,
        statement,
        sourceType: "user_stated" as const,
        confidence: 0.9,
      })),
    ),
  );
}

const ANALYSE = {
  currentSituation: "Vier Jahre Einzelhandel, Wechselwunsch.",
  directions: [{ role: "Disposition", einschaetzung: "realistic_now", confidence: 0.7 }],
  contradictions: [],
  confidence: 0.8,
};

describe("Wann eine zweite Meinung nötig ist", () => {
  it("nicht bei klarer Lage", () => {
    expect(brauchtZweiteMeinung(ANALYSE).ja).toBe(false);
  });

  it("nicht bei einem einzelnen Merkmal", () => {
    /* Eine einzelne Auffälligkeit ist noch keine Unsicherheit. */
    expect(brauchtZweiteMeinung({ ...ANALYSE, confidence: 0.4 }).ja).toBe(false);
  });

  it("E — wenn mehrere Wege gleichauf liegen und die Zuversicht fehlt", () => {
    const b = brauchtZweiteMeinung({
      ...ANALYSE,
      confidence: 0.4,
      directions: [
        { role: "A", einschaetzung: "realistic_now" },
        { role: "B", einschaetzung: "realistic_now" },
        { role: "C", einschaetzung: "realistic_now" },
      ],
    });
    expect(b.ja).toBe(true);
    expect(b.grund).toContain("gleichauf");
  });

  it("C — bei Widersprüchen und geringer Zuversicht", () => {
    const b = brauchtZweiteMeinung({
      ...ANALYSE,
      confidence: 0.45,
      contradictions: ["Gehalt gegen Stresswunsch", "Führung gegen Titel"],
    });
    expect(b.ja).toBe(true);
  });
});

describe("Die Analyse", () => {
  it("entsteht ohne Grundlage nicht", async () => {
    /*
     * Ein Modell antwortet auch auf „welche Wege stehen mir offen"
     * ohne jede Angabe — mit dem, was für irgendeinen Menschen gilt.
     */
    await grundlage(2);
    const rufer = vi.fn();
    const b = await karriereanalyse(db, { userId: person, rufer, jetzt: JETZT });
    expect(rufer).not.toHaveBeenCalled();
    expect(b.analyse).toBeNull();
    expect(b.grund).toMatch(/zu wenig/);
    /* Stattdessen die Frage, die weiterhilft. */
    expect(b.naechsteFrage).not.toBeNull();
  });

  it("läuft einmal, wenn die Lage klar ist", async () => {
    await grundlage();
    const zweitrufer = vi.fn();
    const b = await karriereanalyse(db, {
      userId: person,
      rufer: async () => ({ ergebnis: ANALYSE, modell: "gpt-5.6-sol", konfidenz: 0.8 }),
      zweitrufer,
      zweitmeinungMoeglich: true,
      jetzt: JETZT,
    });
    expect(b.modell).toBe("gpt-5.6-sol");
    expect(b.zweitmodell).toBeNull();
    expect(zweitrufer).not.toHaveBeenCalled();
  });

  it("J — holt bei unklarer Lage eine zweite Meinung mit denselben Fakten", async () => {
    await grundlage();
    const gesehen: string[] = [];
    const unklar = {
      ...ANALYSE,
      confidence: 0.4,
      contradictions: ["a", "b"],
    };

    const b = await karriereanalyse(db, {
      userId: person,
      rufer: async (f) => {
        gesehen.push(f);
        return { ergebnis: unklar, modell: "gpt-5.6-sol", konfidenz: 0.4 };
      },
      zweitrufer: async (f) => {
        gesehen.push(f);
        return { ergebnis: { ...unklar, confidence: 0.7 }, modell: "gpt-6-astra" };
      },
      zweitmeinungMoeglich: true,
      vergleichen: () => [],
      jetzt: JETZT,
    });

    expect(b.zweitmodell).toBe("gpt-6-astra");
    /* Beide sahen dieselben Fakten — und die zweite sah nichts sonst. */
    expect(gesehen[0]).toBe(gesehen[1]);
    expect(gesehen[1]).not.toContain("realistic_now");
  });

  it("macht eine Uneinigkeit zur Frage, statt zu wählen", async () => {
    await grundlage();
    const b = await karriereanalyse(db, {
      userId: person,
      rufer: async () => ({
        ergebnis: { ...ANALYSE, confidence: 0.4, contradictions: ["a", "b"] },
        modell: "gpt-5.6-sol",
        konfidenz: 0.4,
      }),
      zweitrufer: async () => ({ ergebnis: { confidence: 0.8 }, modell: "gpt-6-astra" }),
      zweitmeinungMoeglich: true,
      vergleichen: () => [{ feld: "confidence", erst: 0.4, zweit: 0.8 }],
      jetzt: JETZT,
    });

    expect(b.einig).toBe(false);
    expect(b.hinweis).toContain("confidence");
    /* Keine Rangordnung — beide Ergebnisse bleiben. */
    expect(b.analyse).not.toBeNull();
    expect(b.hinweis).not.toMatch(/astra|sol|gpt/i);
  });

  it("lässt die erste Analyse stehen, wenn die zweite scheitert", async () => {
    await grundlage();
    const b = await karriereanalyse(db, {
      userId: person,
      rufer: async () => ({
        ergebnis: { ...ANALYSE, confidence: 0.4, contradictions: ["a", "b"] },
        modell: "gpt-5.6-sol",
        konfidenz: 0.4,
      }),
      zweitrufer: async () => {
        throw new Error("Zeitüberschreitung");
      },
      zweitmeinungMoeglich: true,
      jetzt: JETZT,
    });
    expect(b.analyse).not.toBeNull();
    expect(b.zweitmodell).toBeNull();
  });

  it("rechnet bei unverändertem Belegstand nicht neu", async () => {
    await grundlage();
    const rufer = vi.fn(async () => ({ ergebnis: ANALYSE, modell: "gpt-5.6-sol", konfidenz: 0.8 }));
    await karriereanalyse(db, { userId: person, rufer, jetzt: JETZT });
    const zweit = await karriereanalyse(db, { userId: person, rufer, jetzt: JETZT });
    expect(zweit.neuGerechnet).toBe(false);
    expect(rufer).toHaveBeenCalledTimes(1);
  });
});
