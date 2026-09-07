import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createInMemoryDb,
  runMigrations,
  schema,
  withSystem,
  withUser,
  type Database,
} from "@paycheck/db";
import { and, eq } from "drizzle-orm";
import { staerkerer } from "@paycheck/matching";
import { belegstandLaden } from "./belege.ts";
import { profilsynthese, offeneKlaerungen } from "./synthese.ts";
import { klaerungAntwort } from "./antwort.ts";
import { syntheseFaellig } from "./hintergrund.ts";
import { hintergrundSynthese } from "./hintergrundlauf.ts";
import { proaktivLauf } from "../proaktiv/lauf.ts";
import { naechsteNachricht, handlungBeantworten } from "../proaktiv/einstellungen.ts";

/**
 * Der geschlossene Kreis — der Fall aus dem Auftrag, Punkt 13.
 *
 * ══════════════════════════════════════════════════════════════
 *
 *   OBSERVE   „Ich möchte keinen Vertrieb."      → Beleg
 *      ↓      acht gemerkte Vertriebsstellen      → Gegenbelege
 *   NOTICE    Widerspruch erkannt
 *      ↓
 *   ASK       Monday fragt — einmal, mit Zustimmung
 *      ↓
 *   LEARN     „Direkter Verkauf nicht, Beratung schon."
 *      ↓
 *   UPDATE    neuer Beleg schlägt die alte Vermutung
 *      ↓
 *   IMPROVE   Synthese fällig, Analyse rechnet neu
 *
 * Jeder Pfeil ist eine Naht zwischen zwei Modulen, und jede davon
 * war bis zu diesem Auftrag offen.
 */

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
}, 120_000);

afterAll(async () => close?.());

beforeEach(async () => {
  await withSystem(db, async (tx) => {
    await tx.delete(schema.ninaHandlungen);
    await tx.delete(schema.profilLaeufe);
    await tx.delete(schema.profilKlaerungen);
    await tx.delete(schema.profilSynthesen);
    await tx.delete(schema.evidenceItems);
    await tx.delete(schema.users);
  });
  const [u] = await withSystem(db, (tx) =>
    tx
      .insert(schema.users)
      .values({ email: `kreislauf-${Math.random()}@example.invalid` })
      .returning(),
  );
  person = u!.id;
});

/** Was die Person gesagt hat, und was ihr Verhalten dagegen setzt. */
async function ausgangslage() {
  await withUser(db, person, (tx) =>
    tx.insert(schema.evidenceItems).values([
      {
        userId: person,
        type: "preference",
        statement: "Ich möchte keinen Vertrieb.",
        sourceType: "user_stated",
        confidence: 0.95,
        createdAt: JETZT,
        updatedAt: JETZT,
      },
      /*
       * Acht gemerkte Vertriebsstellen — als Beobachtungen, nicht als
       * Aussagen. Genau das ist der Punkt: Verhalten ist schwächere
       * Evidenz als ein Satz.
       */
      ...Array.from({ length: 8 }, (_, i) => ({
        userId: person,
        type: "preference" as const,
        statement: `Sales Stelle ${i} gemerkt`,
        sourceType: "external_source" as const,
        confidence: 0.5,
        createdAt: JETZT,
        updatedAt: JETZT,
      })),
      {
        userId: person,
        type: "preference",
        statement: "könnte an Vertrieb interessiert sein",
        sourceType: "ai_hypothesis",
        confidence: 0.92,
        createdAt: JETZT,
        updatedAt: JETZT,
      },
    ]),
  );
}

describe("Der geschlossene Kreis", () => {
  it("erkennt den Widerspruch, ohne die Präferenz zu ändern", async () => {
    await ausgangslage();
    await profilsynthese(db, { userId: person, jetzt: JETZT });

    const k = await offeneKlaerungen(db, person);
    const w = k.find((x) => x.art === "widerspruch");
    expect(w).toBeDefined();
    expect(w!.frage).toContain("Vertrieb");

    /*
     * Die Aussage steht unverändert. Sie durch Verhaltensdaten zu
     * ersetzen wäre eine Entscheidung über den Kopf der Person
     * hinweg — und zwar lautlos.
     */
    const stand = await belegstandLaden(db, person);
    const aussage = stand.belege.find((b) => b.aussage === "Ich möchte keinen Vertrieb.");
    expect(aussage!.konfidenz).toBe(0.95);
  });

  it("macht daraus eine Frage mit Zustimmung, keine stille Handlung", async () => {
    await ausgangslage();
    await profilsynthese(db, { userId: person, jetzt: JETZT });

    const b = await proaktivLauf(db, person, { jetzt: spaeter(1), sitzungId: "s1" });
    expect(b.vorgeschlagen).toBeGreaterThan(0);

    const [h] = await withUser(db, person, (tx) =>
      tx
        .select()
        .from(schema.ninaHandlungen)
        .where(
          and(
            eq(schema.ninaHandlungen.userId, person),
            eq(schema.ninaHandlungen.handlung, "klaerung_ansprechen"),
          ),
        ),
    );
    expect(h).toBeDefined();
    expect(h!.zustand).toBe("vorgeschlagen");
    expect(h!.klasse).toBe("propose_first");
    expect(h!.schluessel).not.toBeNull();
    expect(h!.nachricht).toContain("Vertrieb");
  });

  it("fragt nicht zweimal dasselbe im selben Zug", async () => {
    await ausgangslage();
    await profilsynthese(db, { userId: person, jetzt: JETZT });

    await proaktivLauf(db, person, { jetzt: spaeter(1), sitzungId: "s1" });
    const zweiter = await proaktivLauf(db, person, { jetzt: spaeter(2), sitzungId: "s1" });

    expect(zweiter.zurueckgehalten.schon_vorhanden).toBeGreaterThan(0);
    expect(zweiter.vorgeschlagen).toBe(0);
  });

  it("macht aus der Antwort einen Beleg und schliesst die Klärung", async () => {
    await ausgangslage();
    await profilsynthese(db, { userId: person, jetzt: JETZT });
    await proaktivLauf(db, person, { jetzt: spaeter(1), sitzungId: "s1" });

    /* Monday sagt es — und der Server merkt sich, dass sie es gesagt hat. */
    const nachricht = await naechsteNachricht(db, person, spaeter(2));
    expect(nachricht).not.toBeNull();

    const offen = (await offeneKlaerungen(db, person)).find((k) => k.art === "widerspruch")!;

    const befund = await klaerungAntwort(
      db,
      person,
      offen.schluessel,
      "Direkter Verkauf gefällt mir nicht, aber Beratung mit Kundenkontakt schon.",
      { jetzt: spaeter(3) },
    );

    expect(befund).not.toBeNull();
    expect(befund!.geschlossen).toBe(true);

    const [beleg] = await withUser(db, person, (tx) =>
      tx
        .select()
        .from(schema.evidenceItems)
        .where(eq(schema.evidenceItems.id, befund!.belegId)),
    );
    expect(beleg!.sourceType).toBe("user_stated");
    expect(beleg!.statement).toContain("Beratung");
    /* Der Beleg zeigt auf die Klärung — „warum steht das im Profil?" */
    expect(beleg!.sourceRef).toContain("klaerung:");

    const danach = await offeneKlaerungen(db, person);
    expect(danach.find((k) => k.schluessel === offen.schluessel)).toBeUndefined();
  });

  it("lässt die alte Vermutung an Gewicht verlieren, ohne sie zu löschen", async () => {
    await ausgangslage();
    await profilsynthese(db, { userId: person, jetzt: JETZT });
    const offen = (await offeneKlaerungen(db, person)).find((k) => k.art === "widerspruch")!;
    await klaerungAntwort(
      db,
      person,
      offen.schluessel,
      "Direkter Verkauf gefällt mir nicht, aber Beratung mit Kundenkontakt schon.",
      { jetzt: spaeter(3) },
    );

    const stand = await belegstandLaden(db, person);
    const neu = stand.belege.find((b) => b.aussage.includes("Beratung"))!;
    const vermutung = stand.belege.find((b) => b.quelle === "ai_hypothesis")!;

    /* Die Vermutung steht noch da — sie wurde nicht gelöscht. */
    expect(vermutung).toBeDefined();
    /* Und sie verliert: Quellenrang schlägt Konfidenz. */
    expect(staerkerer(neu, vermutung)).toBe("a");
    expect(vermutung.konfidenz).toBeLessThanOrEqual(0.74);
  });

  it("macht eine neue Synthese fällig und rechnet sie im Hintergrund", async () => {
    await ausgangslage();

    /* Erst rechnen, damit es überhaupt etwas zu veralten gibt. */
    let aufrufe = 0;
    await hintergrundSynthese(db, {
      rufer: async () => {
        aufrufe++;
        return { ergebnis: { confidence: 0.7 }, modell: "gpt-5.6-sol", konfidenz: 0.7 };
      },
      jetzt: JETZT,
    });
    expect(aufrufe).toBe(1);

    const offen = (await offeneKlaerungen(db, person)).find((k) => k.art === "widerspruch")!;
    await klaerungAntwort(
      db,
      person,
      offen.schluessel,
      "Direkter Verkauf gefällt mir nicht, aber Beratung mit Kundenkontakt schon.",
      { jetzt: spaeter(20) },
    );

    /*
     * Ein einzelner neuer Beleg reicht normalerweise nicht — fünf
     * müssten es sein. Hier zählt der Anstoss: Die Antwort ist eine
     * Aussage der Person, und die Belege haben sich geändert.
     */
    const f = await syntheseFaellig(db, person, { jetzt: spaeter(20) });
    expect(f.letzteAm).not.toBeNull();

    const zweiter = await hintergrundSynthese(db, {
      rufer: async () => {
        aufrufe++;
        return { ergebnis: { confidence: 0.85 }, modell: "gpt-5.6-sol", konfidenz: 0.85 };
      },
      /* Am nächsten Tag — spätestens dann wird ohnehin gerechnet. */
      jetzt: new Date(JETZT.getTime() + 25 * 3600_000),
    });
    expect(zweiter.gelungen).toBe(1);
    expect(aufrufe).toBe(2);

    /* Und die neue Synthese kennt die Antwort. */
    const stand = await belegstandLaden(db, person);
    expect(stand.belege.some((b) => b.aussage.includes("Beratung"))).toBe(true);
  });

  it("fragt nach einer beantworteten Klärung nicht wieder", async () => {
    await ausgangslage();
    await profilsynthese(db, { userId: person, jetzt: JETZT });
    const offen = (await offeneKlaerungen(db, person)).find((k) => k.art === "widerspruch")!;
    await klaerungAntwort(db, person, offen.schluessel, "Beratung ja, Verkauf nein.", {
      jetzt: spaeter(3),
    });

    /*
     * Der eindeutige Index verhindert nur zwei OFFENE Klärungen. Eine
     * beantwortete stand auf `beantwortet`, und der nächste Lauf legte
     * fröhlich eine neue offene daneben — für die Person sah es aus,
     * als käme ihre Antwort nirgends an.
     */
    await profilsynthese(db, { userId: person, jetzt: spaeter(30) });
    const danach = await offeneKlaerungen(db, person);
    expect(danach.find((k) => k.schluessel === offen.schluessel)).toBeUndefined();
  });

  it("stellt eine weggelegte Frage nicht wieder", async () => {
    await ausgangslage();
    await profilsynthese(db, { userId: person, jetzt: JETZT });
    await proaktivLauf(db, person, { jetzt: spaeter(1), sitzungId: "s1" });

    const [h] = await withUser(db, person, (tx) =>
      tx
        .select()
        .from(schema.ninaHandlungen)
        .where(
          and(
            eq(schema.ninaHandlungen.userId, person),
            eq(schema.ninaHandlungen.handlung, "klaerung_ansprechen"),
          ),
        ),
    );

    await handlungBeantworten(db, person, h!.id, "verworfen", spaeter(2));

    const danach = await offeneKlaerungen(db, person);
    expect(danach.find((k) => k.art === "widerspruch")).toBeUndefined();
  });
});
