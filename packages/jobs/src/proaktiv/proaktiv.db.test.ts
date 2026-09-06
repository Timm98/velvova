import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createInMemoryDb, runMigrations, schema, withSystem, withUser, type Database } from "@paycheck/db";
import { ereignisAufnehmen, gemeldeterZeitpunkt } from "./ereignisse.ts";
import {
  automatikSchalten,
  handlungBeantworten,
  naechsteNachricht,
  stufeSetzen,
  zustandLaden,
} from "./einstellungen.ts";
import { proaktivLauf } from "./lauf.ts";

/**
 * Ninas Eigeninitiative gegen eine echte Datenbank.
 *
 * Die Fälle sind die aus dem Auftrag, Abschnitt 19 — von „ein kurzer
 * Blick ergibt nichts" bis „keine sinnvolle Handlung".
 */

let db: Database;
let close: () => Promise<void>;
let nutzer: string;
let anderer: string;
const stellen: string[] = [];

const JETZT = new Date("2026-09-06T12:00:00Z");
const vorMinuten = (n: number) => new Date(JETZT.getTime() - n * 60_000);

beforeAll(async () => {
  const handle = await createInMemoryDb();
  db = handle.db;
  close = handle.close;
  await runMigrations(db);

  const [u1, u2] = await withSystem(db, (tx) =>
    tx
      .insert(schema.users)
      .values([
        { email: "proaktiv-a@example.invalid", displayName: "A" },
        { email: "proaktiv-b@example.invalid", displayName: "B" },
      ])
      .returning(),
  );
  nutzer = u1!.id;
  anderer = u2!.id;

  const [quelle] = await withSystem(db, (tx) =>
    tx
      .insert(schema.jobSources)
      .values({ key: "test", displayName: "Test", kind: "licensed_api" })
      .returning(),
  );

  const [firma] = await withSystem(db, (tx) =>
    tx.insert(schema.companies).values({ name: "Testbetrieb GmbH" }).returning(),
  );

  const zeilen = await withSystem(db, (tx) =>
    tx
      .insert(schema.jobs)
      .values(
        /*
         * Die beiden Lagerstellen unterscheiden sich bewusst in
         * Gehalt, Vertrag und Stunden — sonst hätte ein Vergleich
         * nichts zu zeigen, und genau das prüft eine der Regeln.
         */
        [
          { titel: "Lagerhelfer (m/w/d)", remote: false, gehalt: 36_000, vertrag: "permanent" as const, stunden: 40 },
          { titel: "Kommissionierer (m/w/d)", remote: false, gehalt: 42_000, vertrag: "fixed_term" as const, stunden: 30 },
          { titel: "Remote Kundenbetreuung", remote: true, gehalt: null, vertrag: "permanent" as const, stunden: null },
          { titel: "Remote Sachbearbeitung", remote: true, gehalt: null, vertrag: "permanent" as const, stunden: null },
          { titel: "Remote Disposition", remote: true, gehalt: null, vertrag: "permanent" as const, stunden: null },
        ].map((j, i) => ({
          sourceId: quelle!.id,
          companyId: firma!.id,
          contentHash: `hash-t${i}`,
          originalUrl: `https://example.invalid/${i}`,
          title: j.titel,
          description: `${j.titel} in einem Testbetrieb, mit einer hinreichend langen Beschreibung.`,
          /* Beides ist NOT NULL ohne Vorgabewert — es entsteht beim Import. */
          descriptionTokens: "testbetrieb beschreibung anzeige",
          descriptionLength: 72,
          location: "Karlsruhe",
          workModel: j.remote ? ("remote" as const) : ("on_site" as const),
          contractType: j.vertrag,
          salaryMin: j.gehalt,
          salaryDisclosed: j.gehalt !== null,
          weeklyHours: j.stunden,
          postedAt: JETZT,
          fetchedAt: JETZT,
        })),
      )
      .returning({ id: schema.jobs.id }),
  );
  stellen.push(...zeilen.map((z) => z.id));
}, 120_000);

afterAll(async () => {
  await close?.();
});

beforeEach(async () => {
  /* Jeder Fall beginnt ohne Vorgeschichte. */
  await withSystem(db, async (tx) => {
    await tx.delete(schema.ninaVormerkungen);
    await tx.delete(schema.ninaHandlungen);
    await tx.delete(schema.verhaltenssignale);
    await tx.delete(schema.nutzerEreignisse);
    /* Aufrufe und Merkungen liegen im Trichter, nicht hier. */
    await tx.delete(schema.applicationEvents);
    await tx.delete(schema.ninaEigeninitiative);
  });
});

async function melde(
  art: string,
  jobId: string | null,
  minutenVorher: number,
  kontext: Record<string, unknown> = {},
  wer = nutzer,
) {
  return ereignisAufnehmen(db, wer, {
    art,
    jobId,
    sitzungId: "s1",
    geschehenAm: vorMinuten(minutenVorher),
    kontext,
  });
}

async function vormerkungen(wer = nutzer) {
  return withUser(db, wer, (tx) =>
    tx.select().from(schema.ninaVormerkungen).where(eq(schema.ninaVormerkungen.userId, wer)),
  );
}

async function handlungen(wer = nutzer) {
  return withUser(db, wer, (tx) =>
    tx.select().from(schema.ninaHandlungen).where(eq(schema.ninaHandlungen.userId, wer)),
  );
}

/* ═══════════════════════════════════════════════════════════════
   Aufnahme
   ═══════════════════════════════════════════════════════════════ */

describe("Ereignisse aufnehmen", () => {
  it("weist eine unbekannte Art ab", async () => {
    const b = await ereignisAufnehmen(db, nutzer, { art: "maus_bewegt", jobId: stellen[0] });
    expect(b).toEqual({ ok: false, grund: "unbekannte_art" });
  });

  it("weist ein Stellenereignis ohne Stelle ab", async () => {
    const b = await ereignisAufnehmen(db, nutzer, { art: "job_viewed", jobId: null });
    expect(b).toEqual({ ok: false, grund: "ohne_bezug" });
  });

  it("N — nimmt dasselbe Ereignis aus zwei Tabs nur einmal", async () => {
    /* Auch im Trichter: dort von Hand geprüft, weil die bestehende
       Tabelle keinen Schlüssel gegen Doppelmeldungen hat. */
    const a = await melde("job_viewed", stellen[0]!, 10);
    const b = await melde("job_viewed", stellen[0]!, 10);
    expect(a).toMatchObject({ ok: true, neu: true });
    expect(b).toMatchObject({ ok: true, neu: false });
    expect((a as { id: string }).id).toBe((b as { id: string }).id);
  });

  it("kürzt langen Kontext, statt das Ereignis zu verwerfen", async () => {
    /* `job_view_duration` ist neu und liegt deshalb in der eigenen
       Tabelle — nur dort gibt es überhaupt einen Kontext. */
    await melde("job_view_duration", stellen[0]!, 5, { notiz: "x".repeat(500), sekunden: 90 });
    const [z] = await withUser(db, nutzer, (tx) =>
      tx.select().from(schema.nutzerEreignisse).limit(1),
    );
    expect(String(z!.kontext.notiz).length).toBeLessThanOrEqual(64);
    expect(z!.kontext.sekunden).toBe(90);
  });
});

/* ═══════════════════════════════════════════════════════════════
   Die Fälle aus dem Auftrag
   ═══════════════════════════════════════════════════════════════ */

describe("Automatisches Vormerken", () => {
  it("A — ein kurzer Blick ergibt keine Handlung", async () => {
    await melde("job_viewed", stellen[0]!, 10);
    const b = await proaktivLauf(db, nutzer, { jetzt: JETZT, sitzungId: "s1" });
    expect(b.ausgefuehrt).toBe(0);
    expect(await vormerkungen()).toHaveLength(0);
  });

  it("B — dreimal geöffnet mit Details ergibt eine Vormerkung", async () => {
    await melde("job_viewed", stellen[0]!, 30);
    await melde("job_reopened", stellen[0]!, 20);
    await melde("salary_opened", stellen[0]!, 19);
    await melde("requirements_opened", stellen[0]!, 18);

    const b = await proaktivLauf(db, nutzer, { jetzt: JETZT, sitzungId: "s1" });
    /* Vormerken und offene Fragen — zwei Handlungen, eine Nachricht. */
    expect(b.ausgefuehrt).toBeGreaterThanOrEqual(1);

    const v = await vormerkungen();
    expect(v).toHaveLength(1);
    expect(v[0]!.art).toBe("interessant");
    expect(v[0]!.zustand).toBe("offen");
    expect(v[0]!.begruendung).toMatch(/^Du hast diese Stelle/);
  });

  it("schreibt die Handlung mit Belegen und Policy-Fassung", async () => {
    await melde("job_viewed", stellen[0]!, 30);
    await melde("job_reopened", stellen[0]!, 20);
    await melde("job_compared", stellen[0]!, 15);
    await proaktivLauf(db, nutzer, { jetzt: JETZT, sitzungId: "s1" });

    const h = (await handlungen()).find((x) => x.handlung === "job_vormerken");
    expect(h).toBeDefined();
    expect(h!.klasse).toBe("auto_allowed");
    expect(h!.zustand).toBe("ausgefuehrt");
    expect(h!.policyFassung).toBe("proaktiv-2");
    expect(h!.belegEreignisse.length).toBeGreaterThan(0);
  });

  it("M — ein zweiter Lauf erzeugt keine zweite Handlung", async () => {
    await melde("job_viewed", stellen[0]!, 30);
    await melde("job_reopened", stellen[0]!, 20);
    await melde("salary_opened", stellen[0]!, 19);
    await melde("requirements_opened", stellen[0]!, 18);

    await proaktivLauf(db, nutzer, { jetzt: JETZT, sitzungId: "s1" });
    const zweiter = await proaktivLauf(db, nutzer, { jetzt: JETZT, sitzungId: "s1" });

    expect(zweiter.ausgefuehrt).toBe(0);
    expect(zweiter.zurueckgehalten.schon_vorhanden).toBeGreaterThan(0);
    expect((await handlungen()).filter((h) => h.handlung === "job_vormerken")).toHaveLength(1);
    expect(await vormerkungen()).toHaveLength(1);
  });

  it("C — eine Ablehnung verhindert die Vormerkung", async () => {
    await melde("job_viewed", stellen[0]!, 30);
    await melde("job_reopened", stellen[0]!, 20);
    await melde("salary_opened", stellen[0]!, 19);
    await melde("requirements_opened", stellen[0]!, 18);
    await melde("job_dismissed", stellen[0]!, 5);

    const b = await proaktivLauf(db, nutzer, { jetzt: JETZT, sitzungId: "s1" });
    expect(b.ausgefuehrt).toBe(0);
    expect(await vormerkungen()).toHaveLength(0);
  });

  it("I — abgeschaltete Automatik merkt nichts mehr vor", async () => {
    await automatikSchalten(db, nutzer, "job_vormerken", false);
    await melde("job_viewed", stellen[0]!, 30);
    await melde("job_reopened", stellen[0]!, 20);
    await melde("salary_opened", stellen[0]!, 19);
    await melde("requirements_opened", stellen[0]!, 18);

    const b = await proaktivLauf(db, nutzer, { jetzt: JETZT, sitzungId: "s1" });
    expect(await vormerkungen()).toHaveLength(0);
    expect((await handlungen()).some((h) => h.handlung === "job_vormerken")).toBe(false);
  });
});

describe("Zurücknehmen", () => {
  async function vormerkungHerstellen() {
    await melde("job_viewed", stellen[0]!, 30);
    await melde("job_reopened", stellen[0]!, 20);
    await melde("salary_opened", stellen[0]!, 19);
    await melde("requirements_opened", stellen[0]!, 18);
    await proaktivLauf(db, nutzer, { jetzt: JETZT, sitzungId: "s1" });
    return (await handlungen()).find((h) => h.handlung === "job_vormerken")!;
  }

  it("nimmt die Wirkung zurück und merkt sich die Ablehnung", async () => {
    const h = await vormerkungHerstellen();
    const antwort = await handlungBeantworten(db, nutzer, h.id, "verworfen", JETZT);
    expect(antwort.ok).toBe(true);

    const nachher = (await handlungen()).find((x) => x.id === h.id);
    expect(nachher!.zustand).toBe("rueckgaengig");

    const [v] = await vormerkungen();
    expect(v!.zustand).toBe("verworfen");
  });

  it("verstärkt ein verworfenes Signal nicht weiter", async () => {
    /*
     * Sonst entstünde beim nächsten Lauf aus denselben Ereignissen
     * dieselbe Vermutung, und die Ablehnung wäre eine Geste ohne
     * Wirkung.
     */
    const h = await vormerkungHerstellen();
    await handlungBeantworten(db, nutzer, h.id, "verworfen", JETZT);

    const [s] = await withUser(db, nutzer, (tx) =>
      tx.select().from(schema.verhaltenssignale).where(eq(schema.verhaltenssignale.userId, nutzer)),
    );
    expect(s!.status).toBe("rejected");

    const spaeter = await proaktivLauf(db, nutzer, { jetzt: JETZT, sitzungId: "s1" });
    expect(spaeter.ausgefuehrt).toBe(0);
  });

  it("hält die Handlung eines anderen Nutzers für nicht vorhanden", async () => {
    const h = await vormerkungHerstellen();
    const fremd = await handlungBeantworten(db, anderer, h.id, "behalten", JETZT);
    expect(fremd.ok).toBe(false);
  });
});

describe("Muster über mehrere Stellen", () => {
  it("D — Remote-Stellen ergeben eine Vermutung, kein Profilwechsel", async () => {
    await melde("job_viewed", stellen[2]!, 40);
    await melde("job_viewed", stellen[3]!, 30);
    await melde("job_viewed", stellen[4]!, 20);

    const b = await proaktivLauf(db, nutzer, { jetzt: JETZT, sitzungId: "s1" });
    expect(b.signale).toBeGreaterThan(0);

    const signale = await withUser(db, nutzer, (tx) =>
      tx.select().from(schema.verhaltenssignale).where(eq(schema.verhaltenssignale.userId, nutzer)),
    );
    const remote = signale.find((s) => s.art === "remote_interesse");
    expect(remote).toBeDefined();
    expect(remote!.status).toBe("inferred");
    /* Beobachtung, keine Diagnose. */
    expect(remote!.beobachtung).toMatch(/angesehen/);
    expect(remote!.beobachtung).not.toMatch(/bist|willst/i);

    const h = await handlungen();
    expect(h.map((x) => x.handlung)).not.toContain("profil_uebernehmen");
    expect(h.map((x) => x.handlung)).not.toContain("suchauftrag_aendern");
  });

  it("K — ein Gehaltsmuster ändert den Suchauftrag nur als Vorschlag", async () => {
    await melde("salary_opened", stellen[0]!, 40);
    await melde("salary_opened", stellen[1]!, 30);
    await melde("salary_opened", stellen[2]!, 20);

    const b = await proaktivLauf(db, nutzer, { jetzt: JETZT, sitzungId: "s1" });
    expect(b.vorgeschlagen).toBeGreaterThan(0);

    const h = (await handlungen()).find((x) => x.handlung === "suchauftrag_aendern");
    expect(h).toBeDefined();
    expect(h!.zustand).toBe("vorgeschlagen");
    expect(h!.klasse).toBe("propose_first");
    expect(h!.nachricht).toMatch(/\?$/);
  });

  it("E — erst die Zustimmung macht aus dem Vorschlag eine Zusage", async () => {
    await melde("salary_opened", stellen[0]!, 40);
    await melde("salary_opened", stellen[1]!, 30);
    await melde("salary_opened", stellen[2]!, 20);
    await proaktivLauf(db, nutzer, { jetzt: JETZT, sitzungId: "s1" });

    const h = (await handlungen()).find((x) => x.handlung === "suchauftrag_aendern")!;
    await handlungBeantworten(db, nutzer, h.id, "behalten", JETZT);

    const [nachher] = await withUser(db, nutzer, (tx) =>
      tx.select().from(schema.ninaHandlungen).where(eq(schema.ninaHandlungen.id, h.id)),
    );
    expect(nachher!.zustand).toBe("zugestimmt");
  });
});

describe("Zurückhaltung", () => {
  it("H — „zurückhaltend“ lässt weniger durch, ohne Rechte zu ändern", async () => {
    await stufeSetzen(db, nutzer, "zurueckhaltend");

    /* Zwei Stellen, beide mit genug Hinweisen. */
    for (const s of [stellen[0]!, stellen[1]!]) {
      await melde("job_viewed", s, 40);
      await melde("job_reopened", s, 30);
      await melde("salary_opened", s, 25);
      await melde("requirements_opened", s, 20);
    }

    const b = await proaktivLauf(db, nutzer, { jetzt: JETZT, sitzungId: "s1" });
    /*
     * Beide Stellen werden vorgemerkt — die Sperre gilt dem Reden,
     * nicht dem Arbeiten. Nur eine davon sagt Nina auch.
     */
    expect(await vormerkungen()).toHaveLength(2);
    expect(b.still).toBeGreaterThanOrEqual(1);
  });

  it("lässt bei „ausgeglichen“ beide durch", async () => {
    for (const s of [stellen[0]!, stellen[1]!]) {
      await melde("job_viewed", s, 40);
      await melde("job_reopened", s, 30);
      await melde("salary_opened", s, 25);
      await melde("requirements_opened", s, 20);
    }
    const b = await proaktivLauf(db, nutzer, { jetzt: JETZT, sitzungId: "s1" });
    /*
     * Auch hier spricht Nina nur einmal über das Vormerken: Zwei
     * Nachrichten über dasselbe Thema in derselben Sitzung wären zwei
     * Meldungen für eine Sache.
     */
    expect(await vormerkungen()).toHaveLength(2);
    expect(b.still).toBeGreaterThanOrEqual(1);
  });

  it("zählt Nachrichten über Prozesse hinweg", async () => {
    /*
     * Der Zähler steht in der Datenbank, nicht im Arbeitsspeicher.
     * Chat, Sprachausgabe und Hintergrunddienst sind drei Prozesse;
     * ein Zähler je Prozess wäre dreimal niedrig.
     */
    /* Zwei Stellen — erst dann hat Nina überhaupt etwas zu sagen. */
    for (const st of [stellen[0]!, stellen[1]!]) {
      await melde("job_viewed", st, 40);
      await melde("job_reopened", st, 30);
      await melde("salary_opened", st, 25);
      await melde("requirements_opened", st, 20);
    }
    await proaktivLauf(db, nutzer, { jetzt: JETZT, sitzungId: "s1" });

    const z = await zustandLaden(db, nutzer, "s1", JETZT);
    expect(z.inSitzung).toBe(1);
    expect(z.letzteNachricht).not.toBeNull();
    expect(z.themenDerSitzung.has("vergleich_vorbereiten")).toBe(true);
  });
});

describe("O — kein Anlass, keine Handlung", () => {
  it("tut ohne Ereignisse nichts", async () => {
    const b = await proaktivLauf(db, nutzer, { jetzt: JETZT, sitzungId: "s1" });
    expect(b).toMatchObject({ ereignisse: 0, ausgefuehrt: 0, vorgeschlagen: 0 });
  });

  it("beobachtet nicht, wenn die Person die Eigeninitiative abgeschaltet hat", async () => {
    /*
     * Beobachten ohne zu handeln wäre die unangenehmste Variante von
     * beidem.
     */
    await withUser(db, nutzer, (tx) =>
      tx.insert(schema.ninaEigeninitiative).values({ userId: nutzer, aktiv: false }),
    );
    await melde("job_viewed", stellen[0]!, 30);
    await melde("job_reopened", stellen[0]!, 20);
    await melde("salary_opened", stellen[0]!, 19);
    await melde("requirements_opened", stellen[0]!, 18);

    const b = await proaktivLauf(db, nutzer, { jetzt: JETZT, sitzungId: "s1" });
    expect(b.signale).toBe(0);
    expect(await handlungen()).toHaveLength(0);
  });
});

describe("Trennung der Nutzer", () => {
  it("liest die Ereignisse eines anderen nicht", async () => {
    await melde("job_viewed", stellen[0]!, 30, {}, anderer);
    await melde("job_reopened", stellen[0]!, 20, {}, anderer);
    await melde("salary_opened", stellen[0]!, 19, {}, anderer);
    await melde("requirements_opened", stellen[0]!, 18, {}, anderer);

    const meiner = await proaktivLauf(db, nutzer, { jetzt: JETZT, sitzungId: "s1" });
    expect(meiner.ereignisse).toBe(0);

    const seiner = await proaktivLauf(db, anderer, { jetzt: JETZT, sitzungId: "s1" });
    expect(seiner.ausgefuehrt).toBeGreaterThanOrEqual(1);
    expect(await vormerkungen(nutzer)).toHaveLength(0);
    expect(await vormerkungen(anderer)).toHaveLength(1);
  });
});

describe("Der gemeldete Zeitpunkt", () => {
  it("übernimmt eine plausible Angabe", () => {
    const vorhin = new Date(JETZT.getTime() - 30_000);
    expect(gemeldeterZeitpunkt(vorhin.toISOString(), JETZT).getTime()).toBe(vorhin.getTime());
  });

  it("weist die Zukunft ab", () => {
    /*
     * Ein Ereignis von morgen bliebe für immer im Rückblickfenster und
     * zählte jeden Tag erneut — aus einem Klick würde dauerhaftes
     * Interesse.
     */
    const morgen = new Date(JETZT.getTime() + 24 * 60 * 60 * 1000);
    expect(gemeldeterZeitpunkt(morgen.toISOString(), JETZT).getTime()).toBe(JETZT.getTime());
  });

  it("duldet eine Minute Uhrenversatz", () => {
    const knapp = new Date(JETZT.getTime() + 20_000);
    expect(gemeldeterZeitpunkt(knapp.toISOString(), JETZT).getTime()).toBe(knapp.getTime());
  });

  it("weist eine alte Angabe ab", () => {
    const vorEinemJahr = new Date(JETZT.getTime() - 365 * 24 * 60 * 60 * 1000);
    expect(gemeldeterZeitpunkt(vorEinemJahr.toISOString(), JETZT).getTime()).toBe(JETZT.getTime());
  });

  it("nimmt bei Unsinn die Serverzeit", () => {
    expect(gemeldeterZeitpunkt("gestern", JETZT).getTime()).toBe(JETZT.getTime());
    expect(gemeldeterZeitpunkt(42, JETZT).getTime()).toBe(JETZT.getTime());
    expect(gemeldeterZeitpunkt(null, JETZT).getTime()).toBe(JETZT.getTime());
  });
});

describe("Offene Fragen und Vergleich", () => {
  async function interesseAn(jobId: string, ab: number) {
    await melde("job_viewed", jobId, ab + 20);
    await melde("job_reopened", jobId, ab + 10);
    await melde("salary_opened", jobId, ab + 5);
    await melde("requirements_opened", jobId, ab);
  }

  it("sammelt die offenen Fragen einer unvollständigen Anzeige", async () => {
    await interesseAn(stellen[0]!, 20);
    await proaktivLauf(db, nutzer, { jetzt: JETZT, sitzungId: "s1" });

    const h = (await handlungen()).find((x) => x.handlung === "offene_fragen_sammeln");
    expect(h).toBeDefined();
    expect(h!.zustand).toBe("ausgefuehrt");

    const fragen = (h!.ergebnis as { fragen: { frage: string }[] }).fragen;
    expect(fragen.length).toBeGreaterThan(0);
    /* Nie eine Wertung, immer eine Frage. */
    for (const f of fragen) expect(f.frage).toMatch(/\?$/);
  });

  it("sagt zu den offenen Fragen nichts extra im Chat", async () => {
    /* Der Hinweis zur Vormerkung ist schon draussen — zwei Meldungen
       über dieselbe Stelle sind eine zu viel. */
    await interesseAn(stellen[0]!, 20);
    await proaktivLauf(db, nutzer, { jetzt: JETZT, sitzungId: "s1" });
    const h = (await handlungen()).find((x) => x.handlung === "offene_fragen_sammeln");
    expect(h!.nachricht).toBeNull();
  });

  it("bereitet aus zwei interessanten Stellen einen Vergleich vor", async () => {
    await interesseAn(stellen[0]!, 40);
    await interesseAn(stellen[1]!, 20);
    await proaktivLauf(db, nutzer, { jetzt: JETZT, sitzungId: "s1" });

    const h = (await handlungen()).find((x) => x.handlung === "vergleich_vorbereiten");
    expect(h).toBeDefined();

    const v = (h!.ergebnis as { vergleich: { jobIds: string[]; unterschiede: string[] } }).vergleich;
    expect(v.jobIds).toHaveLength(2);
    expect(v.unterschiede.length).toBeGreaterThan(0);
  });

  it("bereitet aus einer einzelnen Stelle keinen Vergleich vor", async () => {
    await interesseAn(stellen[0]!, 20);
    await proaktivLauf(db, nutzer, { jetzt: JETZT, sitzungId: "s1" });
    expect((await handlungen()).some((x) => x.handlung === "vergleich_vorbereiten")).toBe(false);
  });
});

describe("Was Nina zu sagen hat", () => {
  async function nachrichtHerstellen() {
    /*
     * Zwei Stellen. Eine allein ergibt keine Nachricht mehr — Nina
     * erzählt nicht, was die Person gerade selbst tut.
     */
    for (const st of [stellen[0]!, stellen[1]!]) {
      await melde("job_viewed", st, 30);
      await melde("job_reopened", st, 20);
      await melde("salary_opened", st, 19);
      await melde("requirements_opened", st, 18);
    }
    await proaktivLauf(db, nutzer, { jetzt: JETZT, sitzungId: "s1" });
  }

  it("gibt die Nachricht heraus und merkt sie als gesagt", async () => {
    await nachrichtHerstellen();

    const erste = await naechsteNachricht(db, nutzer, JETZT);
    expect(erste).not.toBeNull();
    expect(erste!.text).toMatch(/gegenübergestellt/);
    expect(erste!.brauchtZustimmung).toBe(false);

    /*
     * Zwei offene Tabs holen dieselbe Nachricht — der zweite bekommt
     * nichts. Sonst liest die Person zweimal dasselbe.
     */
    const zweite = await naechsteNachricht(db, nutzer, JETZT);
    expect(zweite).toBeNull();
  });

  it("reicht nichts Älteres als einen Tag nach", async () => {
    /*
     * Ein Hinweis von gestern zu einer Stelle, die man längst
     * weggeklickt hat, wirkt wie ein System, das nicht mitbekommt,
     * was gerade passiert.
     */
    await nachrichtHerstellen();
    const uebermorgen = new Date(JETZT.getTime() + 2 * 24 * 60 * 60 * 1000);
    expect(await naechsteNachricht(db, nutzer, uebermorgen)).toBeNull();
  });

  it("gibt die Nachricht eines anderen Nutzers nicht heraus", async () => {
    await nachrichtHerstellen();
    expect(await naechsteNachricht(db, anderer, JETZT)).toBeNull();
  });

  it("kennzeichnet einen Vorschlag als zustimmungspflichtig", async () => {
    await melde("salary_opened", stellen[0]!, 40);
    await melde("salary_opened", stellen[1]!, 30);
    await melde("salary_opened", stellen[2]!, 20);
    await proaktivLauf(db, nutzer, { jetzt: JETZT, sitzungId: "s1" });

    const n = await naechsteNachricht(db, nutzer, JETZT);
    expect(n).not.toBeNull();
    expect(n!.brauchtZustimmung).toBe(true);
    expect(n!.text).toMatch(/\?$/);
  });

  it("hat ohne Anlass nichts zu sagen", async () => {
    expect(await naechsteNachricht(db, nutzer, JETZT)).toBeNull();
  });
});

describe("Eine Aufzeichnung, kein Doppel", () => {
  it("schreibt einen Aufruf in den Trichter, nicht in beide Tabellen", async () => {
    /*
     * Die erste Fassung schrieb `job_viewed` ein zweites Mal in
     * `nutzer_ereignisse`. Zwei Aufzeichnungen desselben Klicks — und
     * irgendwann weichen sie voneinander ab, ohne dass jemand sagen
     * kann, welche stimmt.
     */
    await melde("job_viewed", stellen[0]!, 10);

    const eigene = await withUser(db, nutzer, (tx) =>
      tx.select().from(schema.nutzerEreignisse).where(eq(schema.nutzerEreignisse.userId, nutzer)),
    );
    expect(eigene).toHaveLength(0);

    const trichter = await withUser(db, nutzer, (tx) =>
      tx
        .select()
        .from(schema.applicationEvents)
        .where(eq(schema.applicationEvents.userId, nutzer)),
    );
    expect(trichter).toHaveLength(1);
    expect(trichter[0]!.type).toBe("job_viewed");
  });

  it("liest beide Quellen als einen Strom", async () => {
    await melde("job_viewed", stellen[0]!, 30);
    await melde("job_reopened", stellen[0]!, 20);
    await melde("salary_opened", stellen[0]!, 19);
    await melde("requirements_opened", stellen[0]!, 18);

    /* Vier Ereignisse, zwei Tabellen, ein Signal. */
    const b = await proaktivLauf(db, nutzer, { jetzt: JETZT, sitzungId: "s1" });
    expect(b.ereignisse).toBe(4);
    expect(await vormerkungen()).toHaveLength(1);
  });

  it("schreibt eine Handlung Ninas nie in den Trichter", async () => {
    /*
     * `application_events` zeichnet Meilensteine einer Bewerbung auf.
     * Eine Handlung Ninas gehört dort nicht hinein — sonst stünde in
     * der Trichterdiagnose ein Aufruf, den niemand gemacht hat.
     */
    await ereignisAufnehmen(db, nutzer, {
      art: "job_viewed",
      jobId: stellen[0]!,
      urheber: "nina",
    });

    const trichter = await withUser(db, nutzer, (tx) =>
      tx
        .select()
        .from(schema.applicationEvents)
        .where(eq(schema.applicationEvents.userId, nutzer)),
    );
    expect(trichter).toHaveLength(0);
  });
});
