import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createInMemoryDb, runMigrations, type Database } from "@paycheck/db";
import { suchprofilAusText, type Prompt1 } from "./suchprofil.ts";
import { auftragAktivieren } from "./auftrag.ts";

/**
 * Systemprompt 1 — was mit einem Vorschlag geschieht.
 *
 * Der Rufer ist eine Attrappe. Was hier geprüft wird, ist nicht die
 * Sprachfähigkeit des Modells, sondern die Frage danach: Was passiert,
 * wenn es ein Kriterium erfindet, eine Signal-ID erfindet, aus einem
 * Klick ein Muss macht oder eine bestätigte Angabe überschreiben will?
 */

let db: Database;
let close: () => Promise<void>;
let nutzer = "";
const JETZT = new Date("2026-09-06T10:00:00Z");

const PROMPT: Prompt1 = { anweisung: "egal", schema: {}, fassung: "test-1" };

async function id(q: ReturnType<typeof sql>): Promise<string> {
  const r = (await db.execute(q)) as unknown as { rows: { id: string }[] };
  return r.rows[0]!.id;
}

async function zeilen<T>(q: ReturnType<typeof sql>): Promise<T[]> {
  const r = (await db.execute(q)) as unknown as { rows: T[] };
  return r.rows;
}

/**
 * Ein Rufer, der die Signal-ID aus der Eingabe übernimmt.
 *
 * So verhält sich ein Modell, das die Anweisung befolgt — und nur
 * dagegen lässt sich prüfen, ob der Code eines erkennt, das sie nicht
 * befolgt.
 */
function attrappe(
  bauen: (signalId: string) => Record<string, unknown>,
  usage: Partial<{ kostenCent: number }> = {},
) {
  return async (auftrag: { eingabe: string }) => {
    const eingabe = JSON.parse(auftrag.eingabe) as { signal_id: string };
    return {
      data: bauen(eingabe.signal_id) as never,
      usage: {
        inputTokens: 800,
        outputTokens: 150,
        model: "attrappe",
        provider: "attrappe",
        latencyMs: 4,
        kostenCent: usage.kostenCent ?? 2,
      },
    };
  };
}

function vorschlag(signalId: string, teil: Record<string, unknown>) {
  return {
    criterion_id: "taetigkeit",
    value: ["lager"],
    unit: null,
    operator: "enthaelt",
    strength: "muss",
    scope: "auftrag",
    group: null,
    source_event_ids: [signalId],
    requires_confirmation: false,
    valid_until: null,
    is_change_order: true,
    ...teil,
  };
}

function antwort(changes: Record<string, unknown>[], teil: Record<string, unknown> = {}) {
  return {
    proposed_changes: changes,
    conflicts: [],
    unknowns: [],
    question: null,
    confirmation_text: "Soll ich so suchen?",
    ...teil,
  };
}

beforeAll(async () => {
  const handle = await createInMemoryDb();
  db = handle.db;
  close = handle.close;
  await runMigrations(db);
  nutzer = await id(sql`insert into users (email) values ('profil@example.test') returning id`);
}, 180_000);

afterAll(async () => {
  await close?.();
});

describe("Ohne Modell", () => {
  it("rät nichts zusammen", async () => {
    const b = await suchprofilAusText(db, {
      userId: nutzer,
      text: "Such für mich weiter nach Lagerstellen in Karlsruhe",
      quelle: "chat",
      jetzt: JETZT,
    });
    expect(b.ok).toBe(false);
    expect(b.grund).toBe("kein_modell");
  });

  it("legt bei einem zu kurzen Satz nichts an", async () => {
    const b = await suchprofilAusText(db, {
      userId: nutzer,
      text: "hm",
      quelle: "chat",
      rufer: attrappe(() => antwort([])) as never,
      prompt: PROMPT,
      jetzt: JETZT,
    });
    expect(b.grund).toBe("nichts_erkannt");
  });
});

describe("Aus einem Satz", () => {
  it("legt einen Entwurf an, der nicht sucht", async () => {
    const b = await suchprofilAusText(db, {
      userId: nutzer,
      text: "Nina, such für mich weiter nach Lagerstellen in Karlsruhe, mindestens 32.000.",
      quelle: "chat",
      jetzt: new Date(JETZT.getTime() + 1000),
      prompt: PROMPT,
      rufer: attrappe((s) =>
        antwort([
          vorschlag(s, {}),
          vorschlag(s, { criterion_id: "arbeitsort", value: ["karlsruhe"], operator: "gleich" }),
          vorschlag(s, {
            criterion_id: "mindestgehalt",
            value: 32000,
            unit: "year",
            operator: "mindestens",
          }),
        ]),
      ) as never,
    });

    expect(b.ok).toBe(true);
    const [auftrag] = await zeilen<{ status: string; name: string; naechste_faelligkeit: Date | null }>(
      sql`select status, name, naechste_faelligkeit from such_auftraege where id = ${b.auftragId}::uuid`,
    );
    /* Ein Entwurf sucht nicht und versendet nicht. */
    expect(auftrag!.status).toBe("entwurf");
    expect(auftrag!.naechste_faelligkeit).toBeNull();
    /* Der Name kommt aus den Kriterien, nicht vom Modell. */
    expect(auftrag!.name).toBe("lager in karlsruhe");

    expect(b.kriterien).toContain("mindestens 32.000 EUR im Jahr");
    expect(b.bestaetigungstext).toContain("Muss stimmen");
  });

  it("wird erst durch Aktivieren wirksam", async () => {
    const b = await suchprofilAusText(db, {
      userId: nutzer,
      text: "Such weiter nach Pflegestellen.",
      quelle: "voice",
      jetzt: new Date(JETZT.getTime() + 2000),
      prompt: PROMPT,
      rufer: attrappe((s) => antwort([vorschlag(s, { value: ["pflege"] })])) as never,
    });
    const akt = await auftragAktivieren(db, nutzer, b.auftragId!, JETZT);
    expect(akt.ok).toBe(true);
    const [auftrag] = await zeilen<{ status: string; herkunft: string }>(
      sql`select status, herkunft from such_auftraege where id = ${b.auftragId}::uuid`,
    );
    expect(auftrag!.status).toBe("aktiv");
    expect(auftrag!.herkunft).toBe("voice");
  });
});

describe("Was der Code zurückweist", () => {
  it("verwirft ein Kriterium, für das es keine Prüfung gibt", async () => {
    const b = await suchprofilAusText(db, {
      userId: nutzer,
      text: "Ich will eine gute Arbeitsatmosphäre und Lagerstellen.",
      quelle: "chat",
      jetzt: new Date(JETZT.getTime() + 3000),
      prompt: PROMPT,
      rufer: attrappe((s) =>
        antwort([
          vorschlag(s, { criterion_id: "arbeitsatmosphaere", value: ["gut"] }),
          vorschlag(s, {}),
        ]),
      ) as never,
    });
    expect(b.ok).toBe(true);
    /*
     * Sonst stünde „arbeitsatmosphaere: gut" im Auftrag und liesse
     * jede Stelle offen — sichtbar, aber ohne Wirkung.
     */
    expect(b.verworfen).toContainEqual({
      kriterium: "arbeitsatmosphaere",
      grund: "unbekanntes_kriterium",
    });
    expect(b.kriterien).toHaveLength(1);
  });

  it("verwirft einen erfundenen Operator", async () => {
    const b = await suchprofilAusText(db, {
      userId: nutzer,
      text: "Lagerstellen, aber ungefähr so wie letztes Mal.",
      quelle: "chat",
      jetzt: new Date(JETZT.getTime() + 4000),
      prompt: PROMPT,
      rufer: attrappe((s) =>
        antwort([vorschlag(s, { operator: "aehnlich_wie" }), vorschlag(s, { criterion_id: "berufsfeld" })]),
      ) as never,
    });
    expect(b.verworfen).toContainEqual({ kriterium: "taetigkeit", grund: "unbekannter_operator" });
  });

  it("verwirft eine erfundene Signal-ID", async () => {
    const b = await suchprofilAusText(db, {
      userId: nutzer,
      text: "Such nach Stellen im Vertrieb.",
      quelle: "chat",
      jetzt: new Date(JETZT.getTime() + 5000),
      prompt: PROMPT,
      rufer: attrappe(() =>
        antwort([vorschlag("11111111-1111-1111-1111-111111111111", { value: ["vertrieb"] })]),
      ) as never,
    });
    /*
     * Ohne echten Beleg gibt es später keine Antwort auf „woher
     * weisst du das".
     */
    expect(b.ok).toBe(false);
    expect(b.verworfen).toContainEqual({ kriterium: "taetigkeit", grund: "unbekanntes_signal" });
  });

  it("verwirft ein Kriterium ohne Wert", async () => {
    const b = await suchprofilAusText(db, {
      userId: nutzer,
      text: "Ich hätte gern etwas mit Gehalt.",
      quelle: "chat",
      jetzt: new Date(JETZT.getTime() + 6000),
      prompt: PROMPT,
      rufer: attrappe((s) =>
        antwort([
          vorschlag(s, { criterion_id: "mindestgehalt", value: null }),
          vorschlag(s, {}),
        ]),
      ) as never,
    });
    expect(b.verworfen).toContainEqual({ kriterium: "mindestgehalt", grund: "ohne_wert" });
  });

  it("verwirft eine Befristung ohne Frist", async () => {
    const b = await suchprofilAusText(db, {
      userId: nutzer,
      text: "Nur heute auch Hamburg.",
      quelle: "chat",
      jetzt: new Date(JETZT.getTime() + 7000),
      prompt: PROMPT,
      rufer: attrappe((s) =>
        antwort([
          vorschlag(s, { criterion_id: "arbeitsort", value: ["hamburg"], scope: "befristet", valid_until: null }),
          vorschlag(s, {}),
        ]),
      ) as never,
    });
    expect(b.verworfen).toContainEqual({ kriterium: "arbeitsort", grund: "frist_fehlt" });
  });

  it("nimmt eine Befristung mit Frist an", async () => {
    const morgen = new Date(JETZT.getTime() + 86_400_000).toISOString();
    const b = await suchprofilAusText(db, {
      userId: nutzer,
      text: "Nur heute auch Hamburg, sonst Karlsruhe.",
      quelle: "chat",
      jetzt: new Date(JETZT.getTime() + 8000),
      prompt: PROMPT,
      rufer: attrappe((s) =>
        antwort([
          vorschlag(s, { criterion_id: "arbeitsort", value: ["hamburg"], scope: "befristet", valid_until: morgen }),
          vorschlag(s, {}),
        ]),
      ) as never,
    });
    const [befristet] = await zeilen<{ gueltig_bis: Date | null }>(
      sql`select gueltig_bis from such_kriterien
          where profil_id = ${b.profilId}::uuid and kriterium = 'arbeitsort'`,
    );
    expect(befristet!.gueltig_bis).not.toBeNull();
  });
});

describe("Nachweis", () => {
  it("hält den Satz der Person als Beleg fest", async () => {
    const satz = "Such für mich weiter nach Stellen in der Logistik.";
    const b = await suchprofilAusText(db, {
      userId: nutzer,
      text: satz,
      quelle: "chat",
      jetzt: new Date(JETZT.getTime() + 9000),
      prompt: PROMPT,
      rufer: attrappe((s) => antwort([vorschlag(s, { value: ["logistik"] })])) as never,
    });
    const [kriterium] = await zeilen<{ signal_ids: string[] }>(
      sql`select signal_ids from such_kriterien where profil_id = ${b.profilId}::uuid`,
    );
    const signale = await zeilen<{ inhalt: { aussage: string }; ausdruecklich: boolean }>(
      sql`select inhalt, ausdruecklich from profil_signale where id = ${kriterium!.signal_ids[0]}::uuid`,
    );
    expect(signale[0]!.inhalt.aussage).toBe(satz);
    expect(signale[0]!.ausdruecklich).toBe(true);
  });

  it("legt den Vorschlag des Modells unverändert ab", async () => {
    const b = await suchprofilAusText(db, {
      userId: nutzer,
      text: "Such nach Stellen als Elektroniker.",
      quelle: "chat",
      jetzt: new Date(JETZT.getTime() + 10_000),
      prompt: PROMPT,
      rufer: attrappe((s) => antwort([vorschlag(s, { value: ["elektroniker"] })])) as never,
    });
    const [profil] = await zeilen<{ vorschlag: { aussage: string; antwort: unknown } }>(
      sql`select vorschlag from such_profile where id = ${b.profilId}::uuid`,
    );
    /* Der Vergleich zwischen Vorschlag und übernommenen Kriterien ist
       der Nachweis, dass das Backend entschieden hat. */
    expect(profil!.vorschlag.antwort).toBeDefined();
    expect(profil!.vorschlag.aussage).toContain("Elektroniker");
  });

  it("protokolliert den Modellaufruf mit Kosten", async () => {
    const person = await id(sql`insert into users (email) values ('kosten@example.test') returning id`);
    await suchprofilAusText(db, {
      userId: person,
      text: "Such nach Stellen im Einzelhandel.",
      quelle: "chat",
      jetzt: JETZT,
      prompt: PROMPT,
      rufer: attrappe((s) => antwort([vorschlag(s, { value: ["einzelhandel"] })]), { kostenCent: 3 }) as never,
    });
    const [lauf] = await zeilen<{ purpose: string; cost_eur_cents: number; prompt_version: string }>(
      sql`select purpose, cost_eur_cents, prompt_version from ai_runs where user_id = ${person}::uuid`,
    );
    expect(lauf).toMatchObject({
      purpose: "suchauftrag:profil",
      cost_eur_cents: 3,
      prompt_version: "test-1",
    });
  });
});

describe("Ort und Arbeitsmodell", () => {
  it("macht aus „Karlsruhe oder remote“ zwei Kriterien einer Gruppe", async () => {
    /*
     * So hat ein echter Modellaufruf geantwortet: eine Ortsliste mit
     * „remote" darin. Die Ortsprüfung vergleicht mit `jobs.location`,
     * dort steht nie „remote" — die Alternative wäre stillschweigend
     * nie erfüllt gewesen.
     */
    const b = await suchprofilAusText(db, {
      userId: nutzer,
      text: "Such nach Lagerstellen in Karlsruhe oder komplett remote.",
      quelle: "chat",
      jetzt: new Date(JETZT.getTime() + 11_000),
      prompt: PROMPT,
      rufer: attrappe((s) =>
        antwort([
          vorschlag(s, {
            criterion_id: "arbeitsort",
            value: ["Karlsruhe", "remote"],
            operator: "einer_von",
          }),
          vorschlag(s, {}),
        ]),
      ) as never,
    });

    const kriterien = await zeilen<{ kriterium: string; gruppe: string | null; wert: unknown }>(
      sql`select kriterium, gruppe, wert from such_kriterien
          where profil_id = ${b.profilId}::uuid order by kriterium`,
    );
    const ort = kriterien.find((k) => k.kriterium === "arbeitsort");
    const modell = kriterien.find((k) => k.kriterium === "arbeitsmodell");
    expect(ort).toBeDefined();
    expect(modell).toBeDefined();
    expect(ort!.wert).toEqual(["karlsruhe"]);
    expect(modell!.wert).toEqual(["remote"]);
    /* Dieselbe Gruppe — „oder", nicht „und". */
    expect(ort!.gruppe).toBe(modell!.gruppe);
    expect(ort!.gruppe).not.toBeNull();
  });
});

describe("Der Satz, dem zugestimmt wird", () => {
  it("liest eine ODER-Gruppe als „oder“ und nicht als Aufzählung", async () => {
    /*
     * Ein echter Lauf erzeugte: „Muss stimmen: Arbeitsort karlsruhe,
     * vollständig remote, …". Gemeint war „oder". Im Code war es eine
     * Gruppe und richtig; im Satz stand das Gegenteil — und der Satz
     * ist das, wozu die Person zustimmt.
     */
    const b = await suchprofilAusText(db, {
      userId: nutzer,
      text: "Such nach Lagerstellen in Karlsruhe oder komplett remote.",
      quelle: "chat",
      jetzt: new Date(JETZT.getTime() + 12_000),
      prompt: PROMPT,
      rufer: attrappe((s) =>
        antwort([
          vorschlag(s, {
            criterion_id: "arbeitsort",
            value: ["Karlsruhe", "remote"],
            operator: "einer_von",
          }),
          vorschlag(s, {}),
        ]),
      ) as never,
    });
    expect(b.bestaetigungstext).toContain("oder");
    expect(b.bestaetigungstext).toContain("Arbeitsort karlsruhe oder vollständig remote");
  });

  it("sagt es, wenn keine Tätigkeit erkannt wurde", async () => {
    /*
     * Sonst wartet die Person auf eine Eingrenzung, die niemand
     * gespeichert hat — der Auftrag fände jede Stelle am Ort.
     */
    const b = await suchprofilAusText(db, {
      userId: nutzer,
      text: "Alles Unbefristete in Karlsruhe über 50.000.",
      quelle: "chat",
      jetzt: new Date(JETZT.getTime() + 13_000),
      prompt: PROMPT,
      rufer: attrappe((s) =>
        antwort([
          vorschlag(s, { criterion_id: "arbeitsort", value: ["karlsruhe"], operator: "gleich" }),
          vorschlag(s, {
            criterion_id: "mindestgehalt",
            value: 50000,
            unit: "year",
            operator: "mindestens",
          }),
        ]),
      ) as never,
    });
    expect(b.ok).toBe(true);
    expect(b.ohneTaetigkeit).toBe(true);
    /* Verweigert wird nichts — eine breite Suche ist legitim. */
    const [auftrag] = await zeilen<{ name: string }>(
      sql`select name from such_auftraege where id = ${b.auftragId}::uuid`,
    );
    expect(auftrag!.name).toBe("Stellen in karlsruhe");
  });
});
