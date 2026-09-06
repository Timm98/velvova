import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createInMemoryDb,
  runMigrations,
  schema,
  withSystem,
  withUser,
  type Database,
} from "@paycheck/db";
import { hintergrundSynthese, laeufeLesen, VERSUCHE_MAX } from "./hintergrundlauf.ts";

/**
 * Der Hintergrundlauf — und die vier Bremsen.
 *
 * Was hier geprüft wird, ist keine Feinheit: Ohne diese Grenzen
 * startet ein Cron-Lauf bei hunderttausend Profilen hunderttausend
 * Aufrufe des tiefen Modells.
 */

let db: Database;
let close: () => Promise<void>;
const JETZT = new Date("2026-09-06T12:00:00Z");

beforeAll(async () => {
  const h = await createInMemoryDb();
  db = h.db;
  close = h.close;
  await runMigrations(db);
}, 120_000);

afterAll(async () => close?.());

beforeEach(async () => {
  await withSystem(db, async (tx) => {
    await tx.delete(schema.profilLaeufe);
    await tx.delete(schema.profilSynthesen);
    await tx.delete(schema.profilKlaerungen);
    await tx.delete(schema.evidenceItems);
    await tx.delete(schema.users);
  });
});

async function personMitBelegen(nr: number, anzahl = 6): Promise<string> {
  const [u] = await withSystem(db, (tx) =>
    tx
      .insert(schema.users)
      .values({ email: `hintergrundlauf-${nr}-${Math.random()}@example.invalid` })
      .returning(),
  );
  const id = u!.id;
  await withUser(db, id, (tx) =>
    tx.insert(schema.evidenceItems).values(
      Array.from({ length: anzahl }, (_, i) => ({
        userId: id,
        type: "preference" as const,
        statement: `Angabe ${nr}-${i}`,
        sourceType: "user_stated" as const,
        confidence: 0.9,
        createdAt: JETZT,
        updatedAt: JETZT,
      })),
    ),
  );
  return id;
}

function rufer(zaehler: { n: number }) {
  return async () => {
    zaehler.n++;
    return {
      ergebnis: { confidence: 0.8, demonstratedSkills: [] },
      modell: "gpt-5.6-sol",
      konfidenz: 0.8,
      kostenCent: 2,
    };
  };
}

describe("Wen der Hintergrundlauf anfasst", () => {
  it("rechnet für ein fälliges Profil und protokolliert es", async () => {
    await personMitBelegen(1);
    const zaehler = { n: 0 };

    const b = await hintergrundSynthese(db, { rufer: rufer(zaehler), jetzt: JETZT });

    expect(b.geprueft).toBe(1);
    expect(b.faellig).toBe(1);
    expect(b.gelungen).toBe(1);
    expect(b.solAufrufe).toBe(1);
    expect(zaehler.n).toBe(1);
    expect(b.kostenCent).toBe(2);
  });

  it("rührt ein Profil nicht an, dessen Belegstand sich nicht geändert hat", async () => {
    await personMitBelegen(2);
    const zaehler = { n: 0 };

    await hintergrundSynthese(db, { rufer: rufer(zaehler), jetzt: JETZT });
    /*
     * Zwei Stunden später — die Zehn-Minuten-Sperre ist vorbei, aber
     * es hat sich nichts geändert. Ein zweiter Aufruf wäre Geld für
     * dasselbe Ergebnis.
     */
    const zweiter = await hintergrundSynthese(db, {
      rufer: rufer(zaehler),
      jetzt: new Date(JETZT.getTime() + 2 * 3600_000),
    });

    expect(zaehler.n).toBe(1);
    expect(zweiter.faellig).toBe(0);
    expect(zweiter.zurueckgehalten.kein_anlass).toBe(1);
  });

  it("hält das Aufrufbudget ein, auch wenn mehr fällig wäre", async () => {
    for (let i = 0; i < 5; i++) await personMitBelegen(10 + i);
    const zaehler = { n: 0 };

    const b = await hintergrundSynthese(db, {
      rufer: rufer(zaehler),
      modellaufrufeMax: 2,
      jetzt: JETZT,
    });

    expect(b.faellig).toBe(5);
    expect(zaehler.n).toBe(2);
    expect(b.zurueckgehalten.budget).toBe(3);
  });

  it("hält den Stapel ein", async () => {
    for (let i = 0; i < 4; i++) await personMitBelegen(20 + i);
    const zaehler = { n: 0 };

    const b = await hintergrundSynthese(db, { rufer: rufer(zaehler), stapel: 2, jetzt: JETZT });
    expect(b.geprueft).toBe(2);
  });
});

describe("Zwei Arbeiter, ein Profil", () => {
  it("lässt nur einen von beiden rechnen", async () => {
    const person = await personMitBelegen(30);
    const zaehler = { n: 0 };

    /*
     * Beide Läufe gleichzeitig. Der eindeutige Index über
     * (user_id, art) where zustand = 'laeuft' lässt genau einen
     * Anspruch zu; der zweite geht leer aus.
     */
    const [a, b] = await Promise.all([
      hintergrundSynthese(db, { rufer: rufer(zaehler), jetzt: JETZT }),
      hintergrundSynthese(db, { rufer: rufer(zaehler), jetzt: JETZT }),
    ]);

    expect(a.gelungen + b.gelungen).toBe(1);
    expect(zaehler.n).toBe(1);

    const laeufe = await laeufeLesen(db, person);
    expect(laeufe.filter((l) => l.zustand === "fertig")).toHaveLength(1);
  });

  it("gibt einen hängengebliebenen Anspruch nach einer Weile frei", async () => {
    const person = await personMitBelegen(31);
    await withUser(db, person, (tx) =>
      tx.insert(schema.profilLaeufe).values({
        userId: person,
        art: "profilsynthese",
        anlass: "genug_neues",
        zustand: "laeuft",
        begonnenAm: JETZT,
      }),
    );

    const zaehler = { n: 0 };
    const b = await hintergrundSynthese(db, {
      rufer: rufer(zaehler),
      /* Zwanzig Minuten später — länger als STAU_MINUTEN. */
      jetzt: new Date(JETZT.getTime() + 20 * 60_000),
    });

    expect(b.zurueckgehalten.haengengeblieben_freigegeben).toBe(1);
    expect(b.gelungen).toBe(1);
  });
});

describe("Wenn etwas schiefgeht", () => {
  it("bricht den Lauf nicht ab, wenn ein Profil scheitert", async () => {
    await personMitBelegen(40);
    await personMitBelegen(41);
    await personMitBelegen(42);

    let n = 0;
    const b = await hintergrundSynthese(db, {
      rufer: async () => {
        n++;
        if (n === 1) throw new TypeError("Modell antwortet nicht");
        return {
          ergebnis: { confidence: 0.8 },
          modell: "gpt-5.6-sol",
          konfidenz: 0.8,
        };
      },
      /* Der Reihe nach, damit „der erste scheitert" reproduzierbar ist. */
      gleichzeitig: 1,
      jetzt: JETZT,
    });

    expect(b.fehlgeschlagen).toBe(1);
    expect(b.gelungen).toBe(2);
  });

  it("schreibt die Fehlerklasse, nicht die Meldung", async () => {
    const person = await personMitBelegen(43);
    await hintergrundSynthese(db, {
      rufer: async () => {
        throw new TypeError("Prompt enthielt: Ich wohne in Karlsruhe");
      },
      jetzt: JETZT,
    });

    const [lauf] = await laeufeLesen(db, person);
    expect(lauf!.zustand).toBe("fehler");
    expect(lauf!.fehler).toBe("TypeError");
    expect(lauf!.fehler).not.toContain("Karlsruhe");
  });

  it("lässt ein Profil nach drei Fehlschlägen ruhen", async () => {
    const person = await personMitBelegen(44);

    for (let i = 0; i < VERSUCHE_MAX; i++) {
      await hintergrundSynthese(db, {
        rufer: async () => {
          throw new Error("kaputt");
        },
        /* Jeweils eine Stunde später, damit die Fälligkeit bestehen bleibt. */
        jetzt: new Date(JETZT.getTime() + i * 3600_000),
      });
    }

    const zaehler = { n: 0 };
    const b = await hintergrundSynthese(db, {
      rufer: rufer(zaehler),
      jetzt: new Date(JETZT.getTime() + VERSUCHE_MAX * 3600_000),
    });

    expect(zaehler.n).toBe(0);
    expect(b.zurueckgehalten.ruht_nach_fehlern).toBe(1);
    expect(b.uebersprungen).toBe(1);

    const laeufe = await laeufeLesen(db, person, 10);
    expect(laeufe.filter((l) => l.zustand === "fehler").length).toBe(VERSUCHE_MAX);
  });

  it("versucht es nach einem Tag wieder", async () => {
    await personMitBelegen(45);
    for (let i = 0; i < VERSUCHE_MAX; i++) {
      await hintergrundSynthese(db, {
        rufer: async () => {
          throw new Error("kaputt");
        },
        jetzt: new Date(JETZT.getTime() + i * 3600_000),
      });
    }

    const zaehler = { n: 0 };
    await hintergrundSynthese(db, {
      rufer: rufer(zaehler),
      jetzt: new Date(JETZT.getTime() + 30 * 3600_000),
    });
    expect(zaehler.n).toBe(1);
  });
});

describe("Astra bleibt selten", () => {
  it("ruft im Hintergrund nie ein zweites Modell", async () => {
    for (let i = 0; i < 3; i++) await personMitBelegen(50 + i);
    const zaehler = { n: 0 };
    const b = await hintergrundSynthese(db, { rufer: rufer(zaehler), jetzt: JETZT });

    /*
     * Eine zweite Meinung entsteht ausschliesslich in der
     * Karriereanalyse und nur bei zwei gleichzeitigen
     * Auffälligkeiten. Der Hintergrund rechnet Profilsynthesen —
     * eine Zusammenfassung von Belegen, kein Urteil über einen
     * Lebensweg.
     */
    expect(b.astraAufrufe).toBe(0);
    expect(b.solAufrufe).toBe(3);
  });
});
