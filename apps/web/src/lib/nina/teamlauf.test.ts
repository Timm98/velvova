import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { teamWert } from "@paycheck/ai";
import { alsMaterial, lageAus, mondayTeam, teamModusAn, TEAMBUDGET } from "./teamlauf.ts";

describe("teamModusAn", () => {
  it("ist aus, solange niemand es einschaltet", () => {
    /* Ein Lauf sind bis zu sieben Modellaufrufe statt einem. Das
       stillschweigend einzuschalten hiesse, die Rechnung eines
       laufenden Betriebs zu ändern, ohne dass jemand zugestimmt hat. */
    expect(teamModusAn({})).toBe(false);
    expect(teamModusAn({ MONDAY_TEAM_MODE_ENABLED: "1" })).toBe(false);
    expect(teamModusAn({ MONDAY_TEAM_MODE_ENABLED: "yes" })).toBe(false);
    expect(teamModusAn({ MONDAY_TEAM_MODE_ENABLED: "true" })).toBe(true);
    expect(teamModusAn({ MONDAY_TEAM_MODE_ENABLED: " TRUE " })).toBe(true);
  });
});

describe("lageAus", () => {
  it("lässt eine flache Frage nie ins Team", () => {
    const lage = lageAus({ tiefe: "flach", aufgabe: "conversation", merkmale: [] });
    expect(teamWert(lage).lohntSich).toBe(false);
  });

  it("lässt eine Bedienfrage nie ins Team", () => {
    /* „Wo finde ich meine Einstellungen" ist keine Karriereentscheidung.
       Ohne diese Regel weckt die Bedienhilfe drei Modelle. */
    const lage = lageAus({ tiefe: "flach", aufgabe: "conversation", merkmale: ["Bedienfrage"] });
    expect(lage.unsicherheit).toBe("niedrig");
    expect(teamWert(lage).lohntSich).toBe(false);
  });

  it("erkennt die Entscheidung mit mehreren Merkmalen als Teamfall", () => {
    const lage = lageAus({
      tiefe: "entscheidung",
      aufgabe: "career_transition_analysis",
      merkmale: ["Abwägung", "Branchenwechsel"],
    });
    expect(lage.tragweite).toBe("kritisch");
    expect(lage.unsicherheit).toBe("hoch");
    expect(teamWert(lage).lohntSich).toBe(true);
  });

  it("zählt die Bedienfrage nicht als Merkmal für Unsicherheit", () => {
    const mit = lageAus({ tiefe: "beratend", aufgabe: "career_analysis", merkmale: ["Abwägung", "Bedienfrage"] });
    const ohne = lageAus({ tiefe: "beratend", aufgabe: "career_analysis", merkmale: ["Abwägung"] });
    expect(mit.unsicherheit).toBe(ohne.unsicherheit);
  });
});

describe("alsMaterial", () => {
  const ergebnis = {
    modelle: 3,
    gegengeprueft: true,
    vorlage: {
      abschnitte: [
        { stand: "gesichert" as const, ueberschrift: "Belegt und gegengeprüft", aussagen: ["A steht fest"] },
        { stand: "strittig" as const, ueberschrift: "Offen", aussagen: ["B ist unklar"] },
      ],
      hinweis: "1 Punkt blieb offen und ist als offen zu benennen.",
      verworfen: 2,
    },
  };

  it("nimmt den Hinweis auf die offenen Punkte mit", () => {
    /* Ein Text, der offene Punkte verschweigt, klingt sicherer als
       die Lage — genau das soll das Team verhindern. */
    expect(alsMaterial(ergebnis)).toContain("1 Punkt blieb offen");
  });

  it("sagt ausdrücklich, dass es Material ist und kein Text zum Vorlesen", () => {
    const text = alsMaterial(ergebnis);
    expect(text).toMatch(/kein Text zum Vorlesen/i);
    expect(text).toMatch(/Sprich nicht über Modelle/i);
  });

  it("trägt beide Abschnitte mit ihren Aussagen", () => {
    const text = alsMaterial(ergebnis);
    expect(text).toContain("A steht fest");
    expect(text).toContain("B ist unklar");
  });
});

describe("Budgetgrenzen", () => {
  it("stehen fest und sind kleiner als die Tagesgrenze aller Nutzer", () => {
    expect(TEAMBUDGET.proNutzerTagCent).toBeLessThan(TEAMBUDGET.gesamtTagCent);
    expect(TEAMBUDGET.proNutzerTagCent).toBeGreaterThan(0);
  });
});

/*
 * ══════════════════════════════════════════════════════════════════
 * Die ganze Kette, einmal durch
 * ══════════════════════════════════════════════════════════════════
 *
 * Vier Bausteine sind je für sich geprüft. Das sagt nichts darüber,
 * ob sie zusammen das Richtige tun — und genau dort gehen solche
 * Ketten kaputt: Runde 2 bekommt die Aussagen in einer Form, die
 * Runde 1 nie erzeugt; das Lagebild findet nichts wieder, weil ein
 * Wort anders geschrieben ist; der Richter urteilt über etwas, das
 * gar nicht strittig war.
 *
 * Dieser Test lässt echten Code laufen — teamAufstellen, teamLauf,
 * pruefrunde, lagebild, richterlauf, syntheseVorlage — und tauscht
 * nur die Modelle gegen erfundene. Was hier grün ist, ist wirklich
 * verdrahtet.
 */
describe("mondayTeam — die Kette", () => {
  const UMGEBUNG = {
    MONDAY_TEAM_MODE_ENABLED: "true",
    OPENAI_API_KEY: "x",
    ANTHROPIC_API_KEY: "x",
    GEMINI_API_KEY: "x",
    MONDAY_OPENAI_PRODUCTION_APPROVED: "true",
    MONDAY_ANTHROPIC_PRODUCTION_APPROVED: "true",
    MONDAY_GOOGLE_PRODUCTION_APPROVED: "true",
  };

  const alt = { ...process.env };
  beforeEach(() => Object.assign(process.env, UMGEBUNG));
  afterEach(() => {
    process.env = { ...alt };
  });

  const schwereFrage = {
    tiefe: "entscheidung" as const,
    aufgabe: "career_transition_analysis" as const,
    merkmale: ["Abwägung", "Branchenwechsel"],
  };

  /** Ein Modell, das immer dasselbe sagt. */
  function modell(antworten: { runde1?: unknown; runde2?: unknown; richter?: unknown }) {
    return {
      name: "test",
      isLocal: true,
      async structuredGenerate({ schemaName }: { schemaName: string }) {
        const daten =
          schemaName === "monday_agent"
            ? antworten.runde1
            : schemaName === "monday_pruefung"
              ? antworten.runde2
              : antworten.richter;
        if (!daten) throw new Error("nichts vorbereitet");
        return { data: daten, usage: { inputTokens: 1, outputTokens: 1, model: "m", provider: "test", latencyMs: 1 }, rationale: null };
      },
    } as never;
  }

  function werkzeuge(antworten: Parameters<typeof modell>[0]) {
    return {
      adapterFuer: async () => modell(antworten),
      budgetFrei: async () => true,
      buchen: async () => undefined,
    };
  }

  const agent = (befunde: string[], belege: string[] = []) => ({
    schluss: "…", befunde, risiken: [], unsicherheiten: [], empfehlungen: [], belege, sicherheit: 0.5,
  });

  it("läuft durch und liefert Material", async () => {
    const ereignisse: string[] = [];
    const ergebnis = await mondayTeam(
      {
        userId: "11111111-1111-1111-1111-111111111111",
        frage: "Soll ich mit vier Jahren Einzelhandel in die IT wechseln?",
        angaben: "Vier Jahre Einzelhandel.",
        tiefe: schwereFrage,
        melden: (e) => ereignisse.push(e.art),
      },
      werkzeuge({
        runde1: agent(["Der Wechsel ist machbar"], ["Angaben der Person"]),
        runde2: { urteile: [{ aussage: "Der Wechsel ist machbar", urteil: "gestuetzt", begruendung: "Passt.", beleg: "" }] },
      }),
    );

    expect(ergebnis).not.toBeNull();
    expect(ereignisse).toContain("aufgestellt");
    expect(ereignisse).toContain("gegengeprueft");
    expect(ereignisse).toContain("fertig");
    expect(alsMaterial(ergebnis!)).toContain("Der Wechsel ist machbar");
  });

  it("hält eine widerlegte Aussage aus dem Material heraus", async () => {
    /* Der Durchstich der Regel: In Runde 1 aufgestellt, in Runde 2
       mit Beleg widersprochen — und dann nirgends mehr zu sehen. */
    const ergebnis = await mondayTeam(
      {
        userId: "11111111-1111-1111-1111-111111111111",
        frage: "Soll ich mit vier Jahren Einzelhandel in die IT wechseln?",
        angaben: "",
        tiefe: schwereFrage,
        melden: () => undefined,
      },
      werkzeuge({
        runde1: agent(["Quereinstieg ist ausgeschlossen"]),
        runde2: {
          urteile: [
            {
              aussage: "Quereinstieg ist ausgeschlossen",
              urteil: "widersprochen",
              begruendung: "Es gibt Umschulungswege.",
              beleg: "Angaben der Person",
            },
          ],
        },
      }),
    );

    expect(ergebnis).not.toBeNull();
    expect(alsMaterial(ergebnis!)).not.toContain("Quereinstieg ist ausgeschlossen");
    expect(ergebnis!.vorlage.verworfen).toBe(1);
  });

  it("tagt nicht, wenn das Budget erschöpft ist", async () => {
    const ergebnis = await mondayTeam(
      { userId: "u", frage: "Soll ich wechseln, und was heisst das langfristig?", angaben: "", tiefe: schwereFrage, melden: () => undefined },
      { ...werkzeuge({ runde1: agent(["egal"]) }), budgetFrei: async () => false },
    );
    expect(ergebnis).toBeNull();
  });

  it("tagt nicht bei einer flachen Frage", async () => {
    let gefragt = false;
    const ergebnis = await mondayTeam(
      {
        userId: "u",
        frage: "Wo finde ich meine Einstellungen?",
        angaben: "",
        tiefe: { tiefe: "flach", aufgabe: "conversation", merkmale: ["Bedienfrage"] },
        melden: () => undefined,
      },
      { ...werkzeuge({ runde1: agent(["egal"]) }), budgetFrei: async () => { gefragt = true; return true; } },
    );
    expect(ergebnis).toBeNull();
    /* Nicht einmal das Budget wird gefragt — die Entscheidung fällt
       vorher und kostet nichts. */
    expect(gefragt).toBe(false);
  });

  it("tagt nicht, solange die Freigabe fehlt", async () => {
    process.env.MONDAY_TEAM_MODE_ENABLED = "false";
    const ergebnis = await mondayTeam(
      { userId: "u", frage: "Soll ich mit vier Jahren Einzelhandel in die IT wechseln?", angaben: "", tiefe: schwereFrage, melden: () => undefined },
      werkzeuge({ runde1: agent(["egal"]) }),
    );
    expect(ergebnis).toBeNull();
  });

  it("überlebt Modelle, die alle scheitern", async () => {
    const ergebnis = await mondayTeam(
      { userId: "u", frage: "Soll ich mit vier Jahren Einzelhandel in die IT wechseln?", angaben: "", tiefe: schwereFrage, melden: () => undefined },
      { ...werkzeuge({}), adapterFuer: async () => modell({}) },
    );
    expect(ergebnis).toBeNull();
  });
});
