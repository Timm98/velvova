import { beforeEach, describe, expect, it, vi } from "vitest";

const antwort = vi.fn();
const ohneModell = vi.fn(() => false);

vi.mock("@paycheck/ai", () => {
  class AiNotConfiguredError extends Error {}
  return {
    AiNotConfiguredError,
    selectProvider: async () => {
      if (ohneModell()) throw new AiNotConfiguredError("AI_API_KEY");
      return { structuredGenerate: antwort };
    },
  };
});

const { alsFaktwunsch, bedingungenLesen } = await import("./gespraechsextraktion");

const gab = (bedingungen: unknown[]) => antwort.mockResolvedValue({ data: { bedingungen } });

beforeEach(() => {
  antwort.mockReset();
  ohneModell.mockReturnValue(false);
});

describe("Der Satz aus der Vorgabe", () => {
  it("liest Gehalt und Homeoffice als Bedingungen", async () => {
    gab([
      { schluessel: "aktuelles_gehalt", wert: 62000, harteBedingung: false, konfidenz: 0.9, belegstelle: "ungefähr 62k" },
      { schluessel: "mindestgehalt", wert: 70000, harteBedingung: true, konfidenz: 0.93, belegstelle: "unter 70 nicht mehr wechseln" },
      { schluessel: "mindest_remote_tage", wert: 2, harteBedingung: true, konfidenz: 0.97, belegstelle: "zwei Tage Homeoffice wären Pflicht" },
    ]);
    const e = await bedingungenLesen("Ich verdiene ungefähr 62k …");
    if (!e.ok) throw new Error("erwartet: ok");
    expect(e.bedingungen).toHaveLength(3);
    expect(e.bedingungen[1]).toMatchObject({ schluessel: "mindestgehalt", harteBedingung: true });
  });
});

describe("Was hängen bleibt", () => {
  it("verwirft eine Angabe ohne Belegstelle", async () => {
    gab([{ schluessel: "mindestgehalt", wert: 70000, harteBedingung: true, konfidenz: 0.9, belegstelle: "  " }]);
    const e = await bedingungenLesen("…");
    if (!e.ok) throw new Error("erwartet: ok");
    expect(e.bedingungen).toHaveLength(0);
  });

  it("fragt bei sehr kurzem Text gar nicht erst", async () => {
    const e = await bedingungenLesen("ok");
    expect(e).toEqual({ ok: true, bedingungen: [] });
    expect(antwort).not.toHaveBeenCalled();
  });

  it("bricht das Gespräch nicht ab, wenn kein Modell da ist", async () => {
    ohneModell.mockReturnValue(true);
    expect(await bedingungenLesen("Ein längerer Satz.")).toEqual({ ok: false, grund: "kein_modell" });
  });

  it("bricht das Gespräch nicht ab, wenn der Aufruf scheitert", async () => {
    antwort.mockRejectedValue(new Error("Netz"));
    expect(await bedingungenLesen("Ein längerer Satz.")).toEqual({ ok: false, grund: "fehler" });
  });
});

describe("alsFaktwunsch", () => {
  const b = {
    schluessel: "mindestgehalt" as const,
    wert: 70000,
    harteBedingung: true,
    konfidenz: 0.93,
    belegstelle: "unter 70 nicht",
  };

  it("legt nie als bestätigt ab", () => {
    /* Das ist die Grenze, auf der die ganze Regel steht: Eine
       Extraktion ist nie eine Bestätigung. */
    expect(alsFaktwunsch(b).bestaetigt).toBe(false);
  });

  it("deckelt die Konfidenz bei 85", () => {
    expect(alsFaktwunsch({ ...b, konfidenz: 1 }).konfidenz).toBe(85);
    expect(alsFaktwunsch({ ...b, konfidenz: 0.5 }).konfidenz).toBe(50);
  });

  it("trennt Bedingung von Vorliebe", () => {
    expect(alsFaktwunsch(b).art).toBe("bedingung");
    expect(alsFaktwunsch({ ...b, harteBedingung: false }).art).toBe("praeferenz");
  });

  it("führt die Belegstelle mit", () => {
    expect(alsFaktwunsch(b).beleg).toBe("unter 70 nicht");
  });
});
