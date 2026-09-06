import { describe, expect, it } from "vitest";
import { lies } from "./leser";

/** Kleine Hilfe: ein Feld aus den Funden ziehen. */
const feld = (funde: ReturnType<typeof lies>, bereich: string, name: string) =>
  funde.find((f) => f.bereich === bereich && f.feld === name);

describe("lies — das Beispiel aus der Spezifikation", () => {
  const satz =
    "Wir sind eine Beratung aus Karlsruhe mit 25 Mitarbeitern und suchen einen Senior Controller. " +
    "Er sollte Excel und möglichst SAP können, mindestens drei Jahre Erfahrung haben, " +
    "kann zwei Tage zu Hause arbeiten und verdient zwischen 65.000 und 80.000 Euro.";
  const funde = lies(satz);

  it("liest die Branche", () => {
    expect(feld(funde, "unternehmen", "branche")?.wert).toBe("Unternehmensberatung");
  });

  it("liest den Standort", () => {
    expect(feld(funde, "unternehmen", "hauptsitz")?.wert).toBe("Karlsruhe");
    expect(feld(funde, "standort", "ort")?.wert).toBe("Karlsruhe");
  });

  it("liest die Unternehmensgrösse", () => {
    expect(feld(funde, "unternehmen", "groesse")?.wert).toBe(25);
  });

  it("liest den Stellentitel", () => {
    expect(feld(funde, "stelle", "titel")?.wert).toBe("Senior Controller");
  });

  it("trennt Muss von Wunsch — Excel ist Pflicht, SAP nicht", () => {
    expect(feld(funde, "muss", "faehigkeiten")?.wert).toEqual(["Excel"]);
    expect(feld(funde, "wunsch", "faehigkeiten")?.wert).toEqual(["SAP"]);
  });

  it("liest die ausgeschriebene Erfahrung", () => {
    expect(feld(funde, "muss", "erfahrungsjahre")?.wert).toBe(3);
  });

  it("leitet aus zwei Tagen zu Hause drei Bürotage und hybrid ab", () => {
    expect(feld(funde, "standort", "modell")?.wert).toBe("hybrid");
    expect(feld(funde, "standort", "bueroTage")?.wert).toBe(3);
  });

  it("liest die Gehaltsspanne als Tausender, nicht als Kommazahl", () => {
    expect(feld(funde, "gehalt", "spanne")?.wert).toEqual({
      von: 65000,
      bis: 80000,
      waehrung: "EUR",
      zeitraum: "jahr",
    });
  });

  it("belegt jeden Fund mit der Stelle, aus der er stammt", () => {
    for (const f of funde) {
      expect(f.belegstelle.length).toBeGreaterThan(0);
      expect(f.status).toBe("gefunden");
      expect(f.quelle).toBe("gespraech");
    }
  });
});

describe("lies — die Tausendergrenze", () => {
  it("liest „65 bis 80 k“ als Tausender", () => {
    const f = lies("verdient 65 bis 80k")[0];
    expect(f?.wert).toMatchObject({ von: 65000, bis: 80000 });
  });

  it("lässt eine ausgeschriebene Spanne unangetastet", () => {
    const f = lies("zwischen 65.000 und 80.000 Euro")[0];
    expect(f?.wert).toMatchObject({ von: 65000, bis: 80000 });
  });

  it("liest keine verdrehte Spanne", () => {
    expect(lies("zwischen 80.000 und 65.000 Euro")).toHaveLength(0);
  });
});

describe("lies — was die Regeln bewusst nicht sagen", () => {
  it("erfindet nichts, wenn nichts dasteht", () => {
    expect(lies("Guten Tag.")).toHaveLength(0);
  });

  it("macht aus „weiss nicht“ keine Angabe", () => {
    expect(lies("Das weiss ich noch nicht, da müsste ich nachfragen.")).toHaveLength(0);
  });

  it("liest „belastbar“ nicht als prüfbare Fähigkeit", () => {
    const funde = lies("Er sollte belastbar und teamfähig sein.");
    expect(feld(funde, "muss", "faehigkeiten")).toBeUndefined();
  });
});

describe("lies — Arbeitsmodell", () => {
  it("erkennt vollständig remote", () => {
    expect(feld(lies("Wir arbeiten komplett remote."), "standort", "modell")?.wert).toBe("remote");
  });

  it("erkennt Präsenz", () => {
    expect(feld(lies("Die Arbeit findet vor Ort statt."), "standort", "modell")?.wert).toBe("on_site");
  });

  it("zählt fünf Tage zu Hause als remote", () => {
    expect(feld(lies("5 Tage im Homeoffice"), "standort", "modell")?.wert).toBe("remote");
    expect(feld(lies("5 Tage im Homeoffice"), "standort", "bueroTage")?.wert).toBe(0);
  });
});

describe("lies — Musswort hebt die Konfidenz", () => {
  it("ohne Musswort bleibt die Einordnung eine Annahme", () => {
    expect(feld(lies("Er arbeitet mit Excel."), "muss", "faehigkeiten")?.konfidenz).toBe(75);
  });

  it("mit Musswort steht sie fest", () => {
    expect(feld(lies("Excel ist zwingend erforderlich."), "muss", "faehigkeiten")?.konfidenz).toBe(85);
  });
});

describe("lies — weitere Einzelwerte", () => {
  it("liest die Wochenstunden", () => {
    expect(feld(lies("Die Stelle hat 32 Wochenstunden."), "bedingungen", "wochenstunden")?.wert).toBe(32);
  });

  it("liest keine unplausible Stundenzahl", () => {
    expect(feld(lies("Wir haben 99 Stunden"), "bedingungen", "wochenstunden")).toBeUndefined();
  });

  it("liest die Teamgrösse", () => {
    expect(feld(lies("Ein Team von 8 Leuten."), "kultur", "teamgroesse")?.wert).toBe(8);
  });
});
