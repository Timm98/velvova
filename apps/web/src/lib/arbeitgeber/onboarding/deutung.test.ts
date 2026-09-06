import { beforeEach, describe, expect, it, vi } from "vitest";

/* Ein Anbieter, der zurückgibt, was der Test vorgibt. Kein Netz, kein
   Schlüssel — geprüft wird die Verarbeitung der Antwort, nicht das
   Modell. */
const antwort = vi.fn();
const nichtEingerichtet = vi.fn(() => false);

vi.mock("@paycheck/ai", () => {
  class AiNotConfiguredError extends Error {}
  return {
    AiNotConfiguredError,
    selectProvider: async () => {
      if (nichtEingerichtet()) throw new AiNotConfiguredError("AI_API_KEY");
      return { structuredGenerate: antwort };
    },
  };
});

const { deute, verstehe } = await import("./deutung");

const gab = (angaben: unknown[]) => antwort.mockResolvedValue({ data: { angaben } });

beforeEach(() => {
  antwort.mockReset();
  nichtEingerichtet.mockReturnValue(false);
});

describe("deute — was durchkommt", () => {
  it("wandelt eine Spanne in Zahlen um", async () => {
    gab([{ bereich: "gehalt", feld: "spanne", wert: "70.000 bis 90.000", belegstelle: "70.000 bis 90.000", sicher: true }]);
    const { funde } = await deute({ text: "…", bereitsGefunden: [] });
    expect(funde[0]?.wert).toEqual({ von: 70000, bis: 90000, waehrung: "EUR", zeitraum: "jahr" });
  });

  it("teilt eine Liste an „und“ und Komma", async () => {
    gab([{ bereich: "muss", feld: "faehigkeiten", wert: "Buchhaltung, Abschlüsse und Steuerrecht", belegstelle: "…", sicher: true }]);
    const { funde } = await deute({ text: "…", bereitsGefunden: [] });
    expect(funde[0]?.wert).toEqual(["Buchhaltung", "Abschlüsse", "Steuerrecht"]);
  });

  it("markiert alles als abgeleitet, auch wörtliche Funde", async () => {
    gab([{ bereich: "gehalt", feld: "spanne", wert: "70.000 bis 90.000", belegstelle: "steht so da", sicher: true }]);
    const { funde } = await deute({ text: "…", bereitsGefunden: [] });
    expect(funde[0]?.status).toBe("abgeleitet");
    expect(funde[0]?.konfidenz).toBe(65);
  });

  it("gibt Unsicherem eine niedrigere Konfidenz", async () => {
    gab([{ bereich: "gehalt", feld: "spanne", wert: "70.000 bis 90.000", belegstelle: "…", sicher: false }]);
    const { funde } = await deute({ text: "…", bereitsGefunden: [] });
    expect(funde[0]?.konfidenz).toBe(45);
  });
});

describe("deute — was hängen bleibt", () => {
  it("verwirft eine Angabe ohne Belegstelle", async () => {
    gab([{ bereich: "gehalt", feld: "spanne", wert: "70.000 bis 90.000", belegstelle: "   ", sicher: true }]);
    expect((await deute({ text: "…", bereitsGefunden: [] })).funde).toHaveLength(0);
  });

  it("verwirft eine Zahl, die keine ist", async () => {
    gab([{ bereich: "unternehmen", feld: "groesse", wert: "eher klein", belegstelle: "…", sicher: false }]);
    expect((await deute({ text: "…", bereitsGefunden: [] })).funde).toHaveLength(0);
  });

  it("verwirft eine verdrehte Spanne", async () => {
    gab([{ bereich: "gehalt", feld: "spanne", wert: "90.000 bis 70.000", belegstelle: "…", sicher: true }]);
    expect((await deute({ text: "…", bereitsGefunden: [] })).funde).toHaveLength(0);
  });

  it("verwirft ein Feld, das es nicht gibt", async () => {
    gab([{ bereich: "erfunden", feld: "quatsch", wert: "x", belegstelle: "…", sicher: true }]);
    expect((await deute({ text: "…", bereitsGefunden: [] })).funde).toHaveLength(0);
  });

  it("überschreibt nicht, was die Regeln schon haben", async () => {
    gab([{ bereich: "gehalt", feld: "spanne", wert: "10.000 bis 20.000", belegstelle: "…", sicher: true }]);
    const { funde } = await deute({
      text: "…",
      bereitsGefunden: [{ bereich: "gehalt", feld: "spanne" }],
    });
    expect(funde).toHaveLength(0);
  });
});

describe("deute — ohne Modell", () => {
  it("bricht das Gespräch nicht ab, wenn kein Schlüssel da ist", async () => {
    nichtEingerichtet.mockReturnValue(true);
    const e = await deute({ text: "…", bereitsGefunden: [] });
    expect(e).toEqual({ funde: [], grund: "kein_modell" });
  });

  it("bricht das Gespräch nicht ab, wenn der Aufruf scheitert", async () => {
    antwort.mockRejectedValue(new Error("Zeitüberschreitung"));
    const e = await deute({ text: "…", bereitsGefunden: [] });
    expect(e).toEqual({ funde: [], grund: "fehler" });
  });
});

describe("verstehe — die Reihenfolge", () => {
  it("liefert die Regelfunde auch dann, wenn kein Modell da ist", async () => {
    nichtEingerichtet.mockReturnValue(true);
    const { funde, gedeutet } = await verstehe({
      text: "Wir sind eine Beratung aus Karlsruhe mit 25 Mitarbeitern.",
    });
    expect(gedeutet).toBe(false);
    expect(funde.find((f) => f.feld === "groesse")?.wert).toBe(25);
  });

  it("fragt das Modell nur nach dem, was die Regeln nicht haben", async () => {
    gab([]);
    await verstehe({ text: "Wir haben 25 Mitarbeiter in Karlsruhe." });
    const system = antwort.mock.calls[0]![0].system as string;
    expect(system).not.toContain("unternehmen.groesse");
    expect(system).toContain("gehalt.spanne");
  });
});
