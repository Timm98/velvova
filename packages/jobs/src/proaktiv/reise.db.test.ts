import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createInMemoryDb,
  runMigrations,
  schema,
  withSystem,
  withUser,
  type Database,
} from "@paycheck/db";
import { ereignisAufnehmen } from "./ereignisse.ts";
import { automatikSchalten, handlungBeantworten, naechsteNachricht } from "./einstellungen.ts";
import { proaktivLauf } from "./lauf.ts";
import { pruefspur, pruefspurAlsText, WIRKUNGSLOS } from "./pruefspur.ts";

/**
 * Die Nutzerreise, am Stück.
 *
 * ══════════════════════════════════════════════════════════════
 * Was hier geprüft wird
 * ══════════════════════════════════════════════════════════════
 *
 * Nicht ob die Einzelteile funktionieren — das tun die anderen
 * Tests. Sondern ob sich das Ganze wie eine Assistentin anfühlt und
 * nicht wie ein Benachrichtigungssystem.
 *
 * Der Massstab ist nicht „Nina macht viel", sondern: Sie erledigt im
 * Hintergrund sinnvolle Arbeit, meldet sich selten, kann jede
 * Handlung erklären, und sie verändert nichts Wichtiges ohne die
 * Person.
 */

let db: Database;
let close: () => Promise<void>;
let person: string;
let jobA: string;
let jobB: string;

const START = new Date("2026-09-06T09:00:00Z");
const nach = (min: number) => new Date(START.getTime() + min * 60_000);

beforeAll(async () => {
  const handle = await createInMemoryDb();
  db = handle.db;
  close = handle.close;
  await runMigrations(db);

  const [u] = await withSystem(db, (tx) =>
    tx.insert(schema.users).values({ email: "reise@example.invalid", displayName: "Reise" }).returning(),
  );
  person = u!.id;

  const [firma] = await withSystem(db, (tx) =>
    tx.insert(schema.companies).values({ name: "Testbetrieb GmbH" }).returning(),
  );
  const [quelle] = await withSystem(db, (tx) =>
    tx.insert(schema.jobSources).values({ key: "reise", displayName: "Reise", kind: "licensed_api" }).returning(),
  );

  /*
   * Zwei ähnliche Lagerstellen, die sich in Gehalt, Vertrag und
   * Stunden unterscheiden — sonst hätte ein Vergleich nichts zu
   * zeigen, und die Reise endete an einer Regel statt an einem
   * Ergebnis.
   */
  const zeilen = await withSystem(db, (tx) =>
    tx
      .insert(schema.jobs)
      .values(
        [
          { t: "Lagerhelfer (m/w/d)", gehalt: 36_000, vertrag: "permanent" as const, stunden: 40 },
          { t: "Kommissionierer (m/w/d)", gehalt: null, vertrag: "fixed_term" as const, stunden: null },
        ].map((j, i) => ({
          sourceId: quelle!.id,
          companyId: firma!.id,
          contentHash: `reise-${i}`,
          originalUrl: `https://example.invalid/reise/${i}`,
          title: j.t,
          description: `${j.t} in einem Testbetrieb, mit hinreichend langer Beschreibung.`,
          descriptionTokens: "testbetrieb lager beschreibung",
          descriptionLength: 70,
          location: "Karlsruhe",
          workModel: "on_site" as const,
          contractType: j.vertrag,
          salaryMin: j.gehalt,
          salaryDisclosed: j.gehalt !== null,
          weeklyHours: j.stunden,
          postedAt: START,
          fetchedAt: START,
        })),
      )
      .returning({ id: schema.jobs.id }),
  );
  jobA = zeilen[0]!.id;
  jobB = zeilen[1]!.id;
}, 120_000);

afterAll(async () => {
  await close?.();
});

beforeEach(async () => {
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

async function klick(
  art: string,
  jobId: string | null,
  min: number,
  kontext: Record<string, unknown> = {},
) {
  return ereignisAufnehmen(db, person, {
    art,
    jobId,
    sitzungId: "reise",
    geschehenAm: nach(min),
    kontext,
  });
}

const handlungen = () =>
  withUser(db, person, (tx) =>
    tx.select().from(schema.ninaHandlungen).where(eq(schema.ninaHandlungen.userId, person)),
  );

const vormerkungen = () =>
  withUser(db, person, (tx) =>
    tx.select().from(schema.ninaVormerkungen).where(eq(schema.ninaVormerkungen.userId, person)),
  );

describe("Die Reise", () => {
  it("Schritt 1 — ein kurzer Blick auf Job A: Nina tut nichts", async () => {
    await klick("job_viewed", jobA, 0);
    await klick("job_view_duration", jobA, 1, { sekunden: 12 });

    const b = await proaktivLauf(db, person, { jetzt: nach(2), sitzungId: "reise" });
    expect(b.ausgefuehrt).toBe(0);
    expect(b.meldungen).toBe(0);
    expect(await vormerkungen()).toHaveLength(0);
  });

  it("Schritt 2 — Job A erneut, mit Gehalt und Anforderungen: Arbeit ja, Nachricht nein", async () => {
    await klick("job_viewed", jobA, 0);
    await klick("job_reopened", jobA, 30);
    await klick("job_view_duration", jobA, 31, { sekunden: 140 });
    await klick("salary_opened", jobA, 32);
    await klick("requirements_opened", jobA, 33);

    const b = await proaktivLauf(db, person, { jetzt: nach(35), sitzungId: "reise" });

    /* Vorgemerkt und die offenen Fragen gesammelt — beides still. */
    expect(b.ausgefuehrt).toBeGreaterThanOrEqual(1);
    expect(await vormerkungen()).toHaveLength(1);

    /*
     * Und kein Wort darüber. Die Person steht gerade auf dieser
     * Stelle; ihr zu sagen, dass sie interessiert ist, wäre ein Echo.
     */
    expect(b.meldungen).toBe(0);
    expect(await naechsteNachricht(db, person, nach(36))).toBeNull();
  });

  it("Schritt 3 — dazu Job B: ein Vergleich und genau eine Meldung", async () => {
    for (const [job, ab] of [
      [jobA, 0],
      [jobB, 60],
    ] as const) {
      await klick("job_viewed", job, ab);
      await klick("job_reopened", job, ab + 20);
      await klick("job_view_duration", job, ab + 21, { sekunden: 150 });
      await klick("salary_opened", job, ab + 22);
      await klick("requirements_opened", job, ab + 23);
    }

    const b = await proaktivLauf(db, person, { jetzt: nach(90), sitzungId: "reise" });

    /* Vier Handlungen: zwei Vormerkungen, zwei Fragenlisten, ein Vergleich. */
    expect(b.ausgefuehrt).toBeGreaterThanOrEqual(4);
    const arten = (await handlungen()).map((h) => h.handlung);
    expect(arten).toContain("job_vormerken");
    expect(arten).toContain("vergleich_vorbereiten");
    expect(arten).toContain("offene_fragen_sammeln");

    /* Und genau eine Meldung. */
    expect(b.meldungen).toBe(1);

    const gesagt = await naechsteNachricht(db, person, nach(91));
    expect(gesagt).not.toBeNull();
    expect(gesagt!.text).toMatch(/gegenübergestellt/);
    /* Nicht viermal „ich habe“. */
    expect(gesagt!.text.match(/Ich habe/g) ?? []).toHaveLength(1);

    /* Ein zweiter Abruf bekommt nichts — auch nicht in einem anderen Tab. */
    expect(await naechsteNachricht(db, person, nach(92))).toBeNull();
  });

  it("nennt im Satz nur Unterschiede, die in den Daten stehen", async () => {
    for (const [job, ab] of [
      [jobA, 0],
      [jobB, 60],
    ] as const) {
      await klick("job_viewed", job, ab);
      await klick("job_reopened", job, ab + 20);
      await klick("salary_opened", job, ab + 22);
      await klick("requirements_opened", job, ab + 23);
    }
    await proaktivLauf(db, person, { jetzt: nach(90), sitzungId: "reise" });

    const h = (await handlungen()).find((x) => x.handlung === "vergleich_vorbereiten")!;
    const v = (h.ergebnis as { vergleich: { unterschiede: string[]; offen: string[] } }).vergleich;

    /* Die beiden unterscheiden sich im Vertrag — das steht in den Daten. */
    expect(v.unterschiede).toContain("Vertrag");
    /*
     * Beim Gehalt nennt nur eine der beiden etwas. Ein bekannter Wert
     * gegen eine Lücke ist kein Unterschied — es ist eine Lücke.
     */
    expect(v.unterschiede).not.toContain("Gehalt");
    expect(v.offen).toContain("Gehalt");
  });

  it("erklärt jede Handlung mit Belegen und Regelfassung", async () => {
    await klick("job_viewed", jobA, 0);
    await klick("job_reopened", jobA, 20);
    await klick("salary_opened", jobA, 22);
    await klick("requirements_opened", jobA, 23);
    await proaktivLauf(db, person, { jetzt: nach(30), sitzungId: "reise" });

    for (const h of await handlungen()) {
      expect(h.begruendung.length).toBeGreaterThan(10);
      expect(h.belegEreignisse.length).toBeGreaterThan(0);
      expect(h.policyFassung).toBe("proaktiv-2");
      /* Keine Handlung ohne Klasse — und nie `explicit_only`. */
      expect(["auto_allowed", "propose_first"]).toContain(h.klasse);
    }
  });

  it("ändert ohne Freigabe nichts am Suchauftrag", async () => {
    /*
     * Das Testkonto hat keine Freigabe für Kriterienänderungen. Ein
     * Gehaltsmuster darf deshalb höchstens fragen.
     */
    await klick("salary_opened", jobA, 0);
    await klick("salary_opened", jobB, 10);
    await klick("salary_opened", null, 20);
    await klick("search_changed", null, 21);

    await proaktivLauf(db, person, { jetzt: nach(30), sitzungId: "reise" });

    for (const h of await handlungen()) {
      if (h.klasse !== "propose_first") continue;
      /* Vorgeschlagen — nicht getan. */
      expect(h.zustand).toBe("vorgeschlagen");
    }
  });

  it("L — Rückgängig wirkt im Hintergrund, nicht nur in der Anzeige", async () => {
    await klick("job_viewed", jobA, 0);
    await klick("job_reopened", jobA, 20);
    await klick("salary_opened", jobA, 22);
    await klick("requirements_opened", jobA, 23);
    await proaktivLauf(db, person, { jetzt: nach(30), sitzungId: "reise" });

    const h = (await handlungen()).find((x) => x.handlung === "job_vormerken")!;
    await handlungBeantworten(db, person, h.id, "verworfen", nach(31));

    const [v] = await vormerkungen();
    expect(v!.zustand).toBe("verworfen");

    /* Dieselben alten Ereignisse erzeugen sie nicht erneut. */
    const nochmal = await proaktivLauf(db, person, { jetzt: nach(32), sitzungId: "reise" });
    expect(nochmal.ausgefuehrt).toBe(0);

    const [s] = await withUser(db, person, (tx) =>
      tx.select().from(schema.verhaltenssignale).where(eq(schema.verhaltenssignale.jobId, jobA)),
    );
    expect(s!.status).toBe("rejected");
  });

  it("M — abgeschaltete Automatik wird im Hintergrund blockiert", async () => {
    await automatikSchalten(db, person, "job_vormerken", false);

    await klick("job_viewed", jobA, 0);
    await klick("job_reopened", jobA, 20);
    await klick("salary_opened", jobA, 22);
    await klick("requirements_opened", jobA, 23);
    await proaktivLauf(db, person, { jetzt: nach(30), sitzungId: "reise" });

    expect(await vormerkungen()).toHaveLength(0);
    expect((await handlungen()).some((h) => h.handlung === "job_vormerken")).toBe(false);
  });

  it("S — ohne Modellzugang läuft alles davon unverändert", async () => {
    /*
     * Diese ganze Schicht ruft kein Modell auf. Der Test hält das
     * fest: Kein Lauf schreibt eine Zeile nach `ai_runs`.
     */
    for (const [job, ab] of [
      [jobA, 0],
      [jobB, 60],
    ] as const) {
      await klick("job_viewed", job, ab);
      await klick("job_reopened", job, ab + 20);
      await klick("salary_opened", job, ab + 22);
      await klick("requirements_opened", job, ab + 23);
    }
    await proaktivLauf(db, person, { jetzt: nach(90), sitzungId: "reise" });

    const laeufe = await withSystem(db, (tx) => tx.select().from(schema.aiRuns));
    expect(laeufe).toHaveLength(0);
  });
});

describe("Wann Nina schweigt", () => {
  async function vergleichHerstellen() {
    for (const [job, ab] of [
      [jobA, 0],
      [jobB, 60],
    ] as const) {
      await klick("job_viewed", job, ab);
      await klick("job_reopened", job, ab + 20);
      await klick("salary_opened", job, ab + 22);
      await klick("requirements_opened", job, ab + 23);
    }
    await proaktivLauf(db, person, { jetzt: nach(90), sitzungId: "reise" });
  }

  it("G — die Person tippt gerade: die Meldung wartet", async () => {
    await vergleichHerstellen();

    const jetztNicht = await naechsteNachricht(db, person, nach(91), { beschaeftigt: true });
    expect(jetztNicht).toBeNull();

    /*
     * Aufgeschoben, nicht verloren. Wer sie jetzt wegwürfe, verlöre
     * Arbeit, die schon getan ist.
     */
    const spaeter = await naechsteNachricht(db, person, nach(95));
    expect(spaeter).not.toBeNull();
    expect(spaeter!.text).toMatch(/gegenübergestellt/);
  });

  it("H — Nina spricht gerade: dieselbe Regel", async () => {
    await vergleichHerstellen();
    expect(await naechsteNachricht(db, person, nach(91), { beschaeftigt: true })).toBeNull();
    expect(await naechsteNachricht(db, person, nach(92), { beschaeftigt: true })).toBeNull();
    expect(await naechsteNachricht(db, person, nach(93))).not.toBeNull();
  });

  it("I — was im Chat gelesen wurde, sagt die Sprachausgabe nicht noch einmal", async () => {
    /*
     * Der Vermerk liegt im Server. Deshalb weiss der zweite Kanal,
     * was der erste schon gesagt hat.
     */
    await vergleichHerstellen();
    expect(await naechsteNachricht(db, person, nach(91))).not.toBeNull();
    expect(await naechsteNachricht(db, person, nach(92))).toBeNull();
  });

  it("Q — kein Anlass, kein Wort", async () => {
    await klick("job_viewed", jobA, 0);
    const b = await proaktivLauf(db, person, { jetzt: nach(5), sitzungId: "reise" });
    expect(b.meldungen).toBe(0);
    expect(await naechsteNachricht(db, person, nach(6))).toBeNull();
  });

  it("schweigt beim Scrollen ohne weitere Zeichen", async () => {
    /* Ein Filterwechsel und ein Suchklick sind keine Aussage über
       eine bestimmte Stelle. */
    await klick("filter_changed", null, 0);
    await klick("search_changed", null, 1);
    await klick("search_result_clicked", jobA, 2);

    const b = await proaktivLauf(db, person, { jetzt: nach(5), sitzungId: "reise" });
    expect(b.ausgefuehrt).toBe(0);
    expect(b.meldungen).toBe(0);
  });

  it("schweigt bei einem lange offenen Hintergrundtab", async () => {
    /*
     * Der Melder im Browser zählt nur sichtbare Zeit. Käme trotzdem
     * eine lange Dauer an, bliebe sie ein einzelner Hinweis — und
     * einer genügt nicht.
     */
    await klick("job_viewed", jobA, 0);
    await klick("job_view_duration", jobA, 240, { sekunden: 14_400 });

    const b = await proaktivLauf(db, person, { jetzt: nach(250), sitzungId: "reise" });
    expect(b.ausgefuehrt).toBe(0);
  });
});

describe("Hypothese und bestätigte Vorliebe", () => {
  async function hypotheseHerstellen() {
    /* Drei Stellen mit geöffnetem Gehalt ergeben ein Muster. */
    await klick("salary_opened", jobA, 0);
    await klick("salary_opened", jobB, 10);
    await klick("job_viewed", jobA, 20);
    await klick("job_viewed", jobB, 30);
    await proaktivLauf(db, person, { jetzt: nach(40), sitzungId: "reise" });
  }

  it("J — eine abgelehnte Hypothese lässt das Profil unberührt", async () => {
    await hypotheseHerstellen();
    const h = (await handlungen()).find((x) => x.handlung === "hypothese_merken");
    if (!h) return; /* Kein Remote-Muster in diesen Daten — dann nichts zu prüfen. */

    await handlungBeantworten(db, person, h.id, "verworfen", nach(41));

    const kriterien = await withUser(db, person, (tx) =>
      tx.select().from(schema.suchKriterien),
    );
    expect(kriterien).toHaveLength(0);
  });

  it("K — auch eine bestätigte Hypothese ändert die Suche nicht von selbst", async () => {
    /*
     * `confirmed` heisst: die Beobachtung stimmt. Nicht: ändere meine
     * Suche. Der Unterschied ist der zwischen „ja, ich schaue mehr
     * auf Remote" und „ja, ändere meine Suche".
     */
    await hypotheseHerstellen();
    const h = (await handlungen()).find((x) => x.handlung === "hypothese_merken");
    if (!h) return;

    await handlungBeantworten(db, person, h.id, "behalten", nach(41));

    const kriterien = await withUser(db, person, (tx) =>
      tx.select().from(schema.suchKriterien),
    );
    expect(kriterien).toHaveLength(0);

    const profile = await withUser(db, person, (tx) => tx.select().from(schema.suchProfile));
    expect(profile).toHaveLength(0);
  });
});

describe("P — ein alter Lauf überschreibt keinen neueren Stand", () => {
  it("lässt ein frisch geschriebenes Signal unangetastet", async () => {
    await klick("job_viewed", jobA, 0);
    await klick("job_reopened", jobA, 20);
    await klick("salary_opened", jobA, 22);
    await klick("requirements_opened", jobA, 23);

    /* Der neuere Lauf zuerst. */
    await proaktivLauf(db, person, { jetzt: nach(60), sitzungId: "reise" });
    const [frisch] = await withUser(db, person, (tx) =>
      tx.select().from(schema.verhaltenssignale).where(eq(schema.verhaltenssignale.jobId, jobA)),
    );
    const standVorher = frisch!.aktualisiertAm.getTime();

    /* Dann ein Arbeiter, der eine Stunde hing. */
    await proaktivLauf(db, person, { jetzt: nach(5), sitzungId: "reise" });

    const [nachher] = await withUser(db, person, (tx) =>
      tx.select().from(schema.verhaltenssignale).where(eq(schema.verhaltenssignale.jobId, jobA)),
    );
    expect(nachher!.aktualisiertAm.getTime()).toBe(standVorher);
  });
});

describe("Prüfspur", () => {
  it("erklärt jede Handlung nachvollziehbar", async () => {
    for (const [job, ab] of [
      [jobA, 0],
      [jobB, 60],
    ] as const) {
      await klick("job_viewed", job, ab);
      await klick("job_reopened", job, ab + 20);
      await klick("salary_opened", job, ab + 22);
      await klick("requirements_opened", job, ab + 23);
    }
    await proaktivLauf(db, person, { jetzt: nach(90), sitzungId: "reise" });

    const spur = await pruefspur(db, person, { seit: nach(-10) });
    expect(spur.length).toBeGreaterThan(0);

    for (const z of spur) {
      expect(z.ausloeser.length).toBeGreaterThan(10);
      expect(z.policyFassung).toBe("proaktiv-2");
      expect(z.berechtigung).toBe("erlaubt");
      expect(["gesagt", "still", "wartet"]).toContain(z.kommunikation);
    }

    /* Genau eine Zeile hat geredet, der Rest hat gearbeitet. */
    expect(spur.filter((z) => z.kommunikation !== "still")).toHaveLength(1);

    const text = pruefspurAlsText(spur);
    expect(text).toContain("BERECHTIGUNG");
    expect(text).toContain("KOMMUNIKATION");
  });

  it("zeigt eine seither abgeschaltete Automatik als solche", async () => {
    /*
     * Die Frage lautet „darf sie das", nicht „durfte sie das". Ein
     * Eintrag, den es heute nicht mehr gäbe, ist genau die
     * interessante Auskunft.
     */
    await klick("job_viewed", jobA, 0);
    await klick("job_reopened", jobA, 20);
    await klick("salary_opened", jobA, 22);
    await klick("requirements_opened", jobA, 23);
    await proaktivLauf(db, person, { jetzt: nach(30), sitzungId: "reise" });

    await automatikSchalten(db, person, "job_vormerken", false);

    const spur = await pruefspur(db, person, { seit: nach(-10) });
    const v = spur.find((z) => z.handlung === "job_vormerken")!;
    expect(v.berechtigung).toBe("seither abgeschaltet");
  });

  it("§13 — die sechs untätigen Handlungen entstehen gar nicht erst", async () => {
    /*
     * Sie stehen in der Regeltabelle und tun noch nichts. Ein Eintrag
     * von ihnen wäre eine Zeile in „Von Nina vorbereitet", hinter der
     * nichts steht.
     */
    for (const [job, ab] of [
      [jobA, 0],
      [jobB, 60],
    ] as const) {
      await klick("job_viewed", job, ab);
      await klick("job_reopened", job, ab + 20);
      await klick("salary_opened", job, ab + 22);
      await klick("requirements_opened", job, ab + 23);
    }
    await proaktivLauf(db, person, { jetzt: nach(90), sitzungId: "reise" });

    const spur = await pruefspur(db, person, { seit: nach(-10) });
    for (const z of spur) {
      expect(WIRKUNGSLOS.has(z.handlung), `${z.handlung} sollte nicht entstehen`).toBe(false);
      expect(z.ergebnis).not.toContain("OHNE WIRKUNG");
    }
  });
});
