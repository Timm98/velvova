import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createInMemoryDb, runMigrations, type Database } from "@paycheck/db";
import type { Auswahlposten } from "@paycheck/matching";
import { mailtexteBauen, type Prompt3 } from "./mailtext.ts";
import { BUDGET } from "./modell.ts";

/**
 * Systemprompt 3 — was das Modell darf und was nicht.
 *
 * Der Rufer ist eine Attrappe: Diese Prüfungen kosten nichts und
 * können nie versehentlich einen Anbieter erreichen. Was hier geprüft
 * wird, ist ohnehin nicht die Sprachfähigkeit, sondern die Frage, was
 * mit einer Antwort geschieht, die etwas Unerlaubtes enthält.
 */

let db: Database;
let close: () => Promise<void>;
let nutzer = "";

const PROMPT: Prompt3 = { anweisung: "egal", schema: {}, fassung: "test-1" };

function posten(id: string, grund: string, caveat: string | null = null): Auswahlposten {
  return {
    trefferId: `t-${id}`,
    jobId: id,
    kanonischeJobId: id,
    arbeitgeberId: `ag-${id}`,
    auftragId: "a1",
    fitScore: 80,
    materielleFassung: "v1",
    berechnetAm: new Date("2026-09-06T04:00:00Z"),
    grund,
    caveat,
    art: "neu",
    position: 0,
  };
}

const AUSWAHL = [
  posten("job-a", "Der Titel nennt lagerlogistik.", "Zum Gehalt sagt die Anzeige nichts."),
  posten("job-b", "Unbefristet und in Teilzeit."),
];

const EINGABE = {
  userId: "",
  auftragsname: "Lager",
  posten: AUSWAHL,
  titelJeId: new Map([
    ["job-a", "Fachkraft für Lagerlogistik"],
    ["job-b", "Lagerhelfer"],
  ]),
  basisLabel: "Bestätigter Suchauftrag vom 4. September 2026",
  anrede: "Tim",
  wuensche: ["Tätigkeit lager", "unbefristet"],
  ersatz: { betreff: "2 passende Stellen", einleitung: "Zwei sind dazugekommen.", abschluss: "Ende." },
  prompt: PROMPT,
};

/** Ein Rufer, der eine vorgegebene Antwort liefert. */
function attrappe(antwort: unknown) {
  return async () => ({
    data: antwort as never,
    usage: {
      inputTokens: 1200,
      outputTokens: 200,
      model: "attrappe",
      provider: "attrappe",
      latencyMs: 5,
      kostenCent: 2,
    },
  });
}

beforeAll(async () => {
  const handle = await createInMemoryDb();
  db = handle.db;
  close = handle.close;
  await runMigrations(db);
  const r = (await db.execute(
    sql`insert into users (email) values ('mailtext@example.test') returning id`,
  )) as unknown as { rows: { id: string }[] };
  nutzer = r.rows[0]!.id;
}, 180_000);

afterAll(async () => {
  await close?.();
});

describe("Ohne Modell", () => {
  it("nimmt die deterministischen Texte", async () => {
    const t = await mailtexteBauen(db, { ...EINGABE, userId: nutzer, rufer: undefined });
    expect(t.betreff).toBe("2 passende Stellen");
    expect(t.fassung).toBe("ersatz-1");
    expect(t.modell).toEqual({ rueckfall: "kein_modell" });
  });

  it("ruft bei null Empfehlungen gar nicht erst an", async () => {
    let gerufen = 0;
    const t = await mailtexteBauen(db, {
      ...EINGABE,
      userId: nutzer,
      posten: [],
      rufer: (async () => {
        gerufen++;
        throw new Error("hätte nicht rufen dürfen");
      }) as never,
    });
    expect(gerufen).toBe(0);
    expect(t.fassung).toBe("ersatz-1");
  });
});

describe("Mit Modell", () => {
  it("übernimmt Betreff, Einleitung und Abschluss", async () => {
    const t = await mailtexteBauen(db, {
      ...EINGABE,
      userId: nutzer,
      rufer: attrappe({
        subject: "2 Stellen im Lager",
        intro: "Zwei Stellen passen zu deinem Auftrag.",
        closing: "Du kannst deinen Auftrag jederzeit ändern.",
        basis_label: "Bestätigter Suchauftrag vom 4. September 2026",
        items: [
          { job_id: "job-a", reason: "Der Titel nennt lagerlogistik.", caveat: "Zum Gehalt sagt die Anzeige nichts." },
          { job_id: "job-b", reason: "Unbefristet und in Teilzeit.", caveat: null },
        ],
      }) as never,
    });
    expect(t.betreff).toBe("2 Stellen im Lager");
    expect(t.fassung).toBe("test-1");
    expect(t.gruende.get("job-a")).toBe("Der Titel nennt lagerlogistik.");
  });

  it("ersetzt einen Betreff mit falscher Trefferzahl", async () => {
    const t = await mailtexteBauen(db, {
      ...EINGABE,
      userId: nutzer,
      rufer: attrappe({
        subject: "5 neue Stellen für dich",
        intro: "Hallo.",
        closing: "Ende.",
        basis_label: "x",
        items: AUSWAHL.map((p) => ({ job_id: p.jobId, reason: p.grund!, caveat: p.caveat })),
      }) as never,
    });
    /* „5 neue Stellen" bei zwei Posten ist der Fehler, den niemand
       meldet und den jeder bemerkt. */
    expect(t.betreff).toBe("2 passende Stellen");
    expect(t.modell.betreffErsetzt).toBe(true);
  });

  it("verwirft den ganzen Text, wenn das Modell die Auswahl ändert", async () => {
    const t = await mailtexteBauen(db, {
      ...EINGABE,
      userId: nutzer,
      rufer: attrappe({
        subject: "3 Stellen",
        intro: "Hallo.",
        closing: "Ende.",
        basis_label: "x",
        items: [
          ...AUSWAHL.map((p) => ({ job_id: p.jobId, reason: p.grund!, caveat: p.caveat })),
          { job_id: "job-erfunden", reason: "auch schön", caveat: null },
        ],
      }) as never,
    });
    /*
     * Eine geänderte Auswahl ist kein Formulierungsfehler. Sie heisst,
     * dass das Modell eine Entscheidung getroffen hat, die ihm nicht
     * zusteht — dann gilt der ganze Text als unbrauchbar.
     */
    expect(t.fassung).toBe("ersatz-1");
    expect(t.modell.rueckfall).toBe("auswahl_veraendert");
  });

  it("ersetzt einen frei erfundenen Grund durch den validierten", async () => {
    const t = await mailtexteBauen(db, {
      ...EINGABE,
      userId: nutzer,
      rufer: attrappe({
        subject: "2 Stellen",
        intro: "Hallo.",
        closing: "Ende.",
        basis_label: "x",
        items: [
          { job_id: "job-a", reason: "Top-Arbeitgeber mit super Team!", caveat: null },
          { job_id: "job-b", reason: "Unbefristet und in Teilzeit.", caveat: null },
        ],
      }) as never,
    });
    expect(t.gruende.get("job-a")).toBe("Der Titel nennt lagerlogistik.");
  });

  it("erfindet keinen Vorbehalt, wo keiner belegt ist", async () => {
    const t = await mailtexteBauen(db, {
      ...EINGABE,
      userId: nutzer,
      rufer: attrappe({
        subject: "2 Stellen",
        intro: "Hallo.",
        closing: "Ende.",
        basis_label: "x",
        items: [
          { job_id: "job-a", reason: "Der Titel nennt lagerlogistik.", caveat: "Zum Gehalt sagt die Anzeige nichts." },
          { job_id: "job-b", reason: "Unbefristet und in Teilzeit.", caveat: "Etwas weit weg." },
        ],
      }) as never,
    });
    expect(t.caveats.get("job-b")).toBeNull();
  });

  it("verwirft das Basislabel des Modells", async () => {
    /* Ob ein Auftrag bestätigt oder ein Filter übernommen wurde, weiss
       der Code — ein falsches Label wäre ein erfundenes Gespräch. */
    const t = await mailtexteBauen(db, {
      ...EINGABE,
      userId: nutzer,
      rufer: attrappe({
        subject: "2 Stellen",
        intro: "Hallo.",
        closing: "Ende.",
        basis_label: "Gestern im Gespräch besprochen",
        items: AUSWAHL.map((p) => ({ job_id: p.jobId, reason: p.grund!, caveat: p.caveat })),
      }) as never,
    });
    expect(t.modell.basisLabelVerworfen).toBe("Gestern im Gespräch besprochen");
  });

  it("fällt bei einem Modellfehler auf den Ersatztext zurück", async () => {
    const t = await mailtexteBauen(db, {
      ...EINGABE,
      userId: nutzer,
      rufer: (async () => {
        throw new Error("Anbieter nicht erreichbar");
      }) as never,
    });
    expect(t.fassung).toBe("ersatz-1");
    expect(t.modell.rueckfall).toBe("fehler");
  });
});

describe("Budget", () => {
  it("hört auf zu rufen, wenn die Tagesgrenze erreicht ist", async () => {
    const teuer = await (async () => {
      const r = (await db.execute(
        sql`insert into users (email) values ('teuer@example.test') returning id`,
      )) as unknown as { rows: { id: string }[] };
      return r.rows[0]!.id;
    })();

    await db.execute(sql`
      insert into ai_runs (user_id, purpose, provider, model, status, cost_eur_cents)
      values (${teuer}::uuid, 'suchauftrag:mailtext', 'attrappe', 'attrappe', 'ok',
              ${BUDGET.proNutzerTagCent + 1})`);

    let gerufen = 0;
    const t = await mailtexteBauen(db, {
      ...EINGABE,
      userId: teuer,
      rufer: (async () => {
        gerufen++;
        throw new Error("hätte nicht rufen dürfen");
      }) as never,
    });
    expect(gerufen).toBe(0);
    expect(t.modell.rueckfall).toBe("budget");

    /* Und der abgelehnte Versuch steht im Protokoll — sonst wüsste
       niemand, warum die Mail nüchtern aussieht. */
    const zeilen = (await db.execute(sql`
      select status from ai_runs where user_id = ${teuer}::uuid and status = 'budget_exceeded'`)) as unknown as {
      rows: unknown[];
    };
    expect(zeilen.rows).toHaveLength(1);
  });

  it("protokolliert einen erfolgreichen Aufruf mit Kosten", async () => {
    const person = (
      (await db.execute(
        sql`insert into users (email) values ('protokoll@example.test') returning id`,
      )) as unknown as { rows: { id: string }[] }
    ).rows[0]!.id;

    await mailtexteBauen(db, {
      ...EINGABE,
      userId: person,
      rufer: attrappe({
        subject: "2 Stellen",
        intro: "Hallo.",
        closing: "Ende.",
        basis_label: "x",
        items: AUSWAHL.map((p) => ({ job_id: p.jobId, reason: p.grund!, caveat: p.caveat })),
      }) as never,
    });

    const zeilen = (await db.execute(sql`
      select cost_eur_cents, input_tokens, prompt_version, purpose
      from ai_runs where user_id = ${person}::uuid`)) as unknown as {
      rows: { cost_eur_cents: number; input_tokens: number; prompt_version: string; purpose: string }[];
    };
    expect(zeilen.rows[0]).toMatchObject({
      cost_eur_cents: 2,
      input_tokens: 1200,
      prompt_version: "test-1",
      purpose: "suchauftrag:mailtext",
    });
  });
});
