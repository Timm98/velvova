import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createInMemoryDb, runMigrations, schema, withSystem, withUser, type Database } from "@paycheck/db";
import { faelligeProfile, syntheseFaellig } from "./hintergrund.ts";
import { belegstandLaden } from "./belege.ts";

let db: Database;
let close: () => Promise<void>;
let person: string;
const JETZT = new Date("2026-09-06T12:00:00Z");
const spaeter = (min: number) => new Date(JETZT.getTime() + min * 60_000);

beforeAll(async () => {
  const h = await createInMemoryDb();
  db = h.db;
  close = h.close;
  await runMigrations(db);
  const [u] = await withSystem(db, (tx) =>
    tx.insert(schema.users).values({ email: "hintergrund@example.invalid" }).returning(),
  );
  person = u!.id;
}, 120_000);

afterAll(async () => close?.());

beforeEach(async () => {
  await withSystem(db, async (tx) => {
    await tx.delete(schema.profilSynthesen);
    await tx.delete(schema.evidenceItems);
  });
});

async function belege(n: number, ab = 0) {
  await withUser(db, person, (tx) =>
    tx.insert(schema.evidenceItems).values(
      Array.from({ length: n }, (_, i) => ({
        userId: person,
        type: "preference" as const,
        statement: `Angabe ${ab + i}`,
        sourceType: "user_stated" as const,
        confidence: 0.9,
        createdAt: JETZT,
        updatedAt: JETZT,
      })),
    ),
  );
}

async function syntheseVom(wann: Date, belegAnzahl: number, stand: string) {
  await withUser(db, person, (tx) =>
    tx.insert(schema.profilSynthesen).values({
      userId: person,
      art: "profilsynthese",
      ergebnis: {},
      belegStand: stand,
      belegAnzahl,
      modell: "gpt-5.6-sol",
      promptFassung: "probe",
      konfidenz: 0.7,
      erstelltAm: wann,
    }),
  );
}

describe("Wann im Hintergrund gerechnet wird", () => {
  it("rechnet die erste Synthese ab drei Belegen", async () => {
    await belege(3);
    const f = await syntheseFaellig(db, person, { jetzt: JETZT });
    expect(f.faellig).toBe(true);
    expect(f.anlass).toBe("erste_analyse");
  });

  it("rechnet bei zwei Belegen noch nicht", async () => {
    await belege(2);
    expect((await syntheseFaellig(db, person, { jetzt: JETZT })).faellig).toBe(false);
  });

  it("wartet nach einem frischen Lauf", async () => {
    /*
     * Ein Gespräch erzeugt in fünf Minuten ein Dutzend Belege. Nach
     * jedem zu rechnen hiesse, zwölfmal das tiefe Modell für ein Bild
     * zu bezahlen, das sich elfmal kaum unterscheidet.
     */
    await belege(10);
    await syntheseVom(JETZT, 3, "alt");
    const f = await syntheseFaellig(db, person, { jetzt: spaeter(2) });
    expect(f.faellig).toBe(false);
    expect(f.anlass).toBe("zu_frueh");
  });

  it("rechnet, wenn genug Neues dazukam", async () => {
    await belege(10);
    await syntheseVom(JETZT, 3, "alt");
    const f = await syntheseFaellig(db, person, { jetzt: spaeter(30) });
    expect(f.faellig).toBe(true);
    expect(f.anlass).toBe("genug_neues");
    expect(f.neueBelege).toBeGreaterThanOrEqual(5);
  });

  it("rechnet bei wenig Neuem nicht", async () => {
    await belege(5);
    await syntheseVom(JETZT, 3, "alt");
    const f = await syntheseFaellig(db, person, { jetzt: spaeter(30) });
    expect(f.faellig).toBe(false);
    expect(f.anlass).toBe("kein_anlass");
  });

  it("rechnet nach einem Tag ohnehin", async () => {
    await belege(4);
    await syntheseVom(new Date(JETZT.getTime() - 25 * 3600_000), 4, "alt");
    const f = await syntheseFaellig(db, person, { jetzt: JETZT });
    expect(f.faellig).toBe(true);
    expect(f.anlass).toBe("zu_lange_her");
  });

  it("folgt einer ausdrücklichen Bitte sofort", async () => {
    await belege(4);
    await syntheseVom(JETZT, 4, "alt");
    const f = await syntheseFaellig(db, person, { jetzt: spaeter(1), ausdruecklich: true });
    expect(f.faellig).toBe(true);
    expect(f.anlass).toBe("ausdruecklich");
  });
});

describe("Wessen Profil ansteht", () => {
  it("nennt nur Menschen mit frischer Aktivität", async () => {
    await belege(4);
    const faellig = await faelligeProfile(db, { jetzt: spaeter(60) });
    expect(faellig).toContain(person);
  });

  it("lässt lange unberührte Profile aus", async () => {
    /* Eine Zusammenfassung, die niemand abruft, kostet Geld für
       nichts. */
    await belege(4);
    const faellig = await faelligeProfile(db, { jetzt: new Date(JETZT.getTime() + 200 * 3600_000) });
    expect(faellig).not.toContain(person);
  });
});

describe("Die ausdrückliche Bitte", () => {
  it("übergeht die Wartezeit, aber nicht den Fingerabdruck", async () => {
    /*
     * Der Fall aus dem Echtlauf vom 6. September: `ausdruecklich`
     * liess an allem vorbei, ein Anspruch wurde genommen, ein
     * Budgetplatz belegt — und dann rechnete `profilsynthese` nicht,
     * weil sich nichts geändert hatte. Zwei Schichten, zwei
     * Antworten auf dieselbe Frage.
     */
    await belege(5);
    const stand = await belegstandLaden(db, person);
    await syntheseVom(spaeter(-1), 5, stand.stand);

    const gleich = await syntheseFaellig(db, person, {
      jetzt: JETZT,
      ausdruecklich: true,
    });
    expect(gleich.faellig).toBe(false);
    expect(gleich.anlass).toBe("kein_anlass");

    /* Ein einziger neuer Beleg genügt — dann ist es etwas anderes. */
    await belege(1, 99);
    const anders = await syntheseFaellig(db, person, {
      jetzt: JETZT,
      ausdruecklich: true,
    });
    expect(anders.faellig).toBe(true);
    expect(anders.anlass).toBe("ausdruecklich");
  });
});

