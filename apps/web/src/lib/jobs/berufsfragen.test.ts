import { describe, expect, it } from "vitest";
import { berufAusTitel, berufsfragen, type Stellenlage } from "./berufsfragen";

const lage = (over: Partial<Stellenlage> = {}): Stellenlage => ({
  hatAufgaben: false,
  hatGehalt: false,
  hatAnforderungen: false,
  schichtarbeit: false,
  reiseanteil: null,
  arbeitsmodell: "on_site",
  unternehmen: "Beispiel GmbH",
  ...over,
});

describe("berufAusTitel", () => {
  it("wirft die Geschlechtsangabe heraus", () => {
    expect(berufAusTitel("LKW-Fahrer (m/w/d)")).toBe("LKW-Fahrer");
  });

  it("schneidet den Ort nach dem Komma ab", () => {
    // Sonst: „Wie sieht ein Arbeitstag als LKW-Fahrer in Eitting,
    // Eching aus?"
    expect(berufAusTitel("LKW-Fahrer (m/w/d) in Eitting, Eching")).toBe("LKW-Fahrer in Eitting");
  });

  it("schneidet den Zusatz nach dem Gedankenstrich ab", () => {
    expect(berufAusTitel("Pflegefachkraft – Nachtdienst")).toBe("Pflegefachkraft");
  });

  it("entfernt Vollzeit und Teilzeit", () => {
    expect(berufAusTitel("Bürokauffrau in Teilzeit")).toBe("Bürokauffrau");
  });

  it("lässt einen sauberen Titel unverändert", () => {
    expect(berufAusTitel("Fachkraft für Lagerlogistik")).toBe("Fachkraft für Lagerlogistik");
  });

  it("kommt mit doppelten Leerzeichen klar", () => {
    expect(berufAusTitel("Koch  (m/w/d)  ")).toBe("Koch");
  });
});

describe("berufsfragen", () => {
  it("stellt vier Fragen", () => {
    // Eine Liste, die man überfliegt, ist keine Auswahl mehr.
    expect(berufsfragen("Elektroniker (m/w/d)", lage())).toHaveLength(4);
  });

  it("setzt den Beruf in jede Frage ein", () => {
    for (const f of berufsfragen("Elektroniker (m/w/d)", lage())) {
      expect(f.text).toContain("Elektroniker");
    }
  });

  it("formuliert jede als Frage", () => {
    for (const f of berufsfragen("Koch", lage())) {
      expect(f.text.endsWith("?")).toBe(true);
    }
  });

  it("schweigt bei einem unbrauchbaren Titel", () => {
    // „Wie sieht ein Arbeitstag als aus?" ist schlimmer als nichts.
    expect(berufsfragen("(m/w/d)", lage())).toEqual([]);
    expect(berufsfragen("", lage())).toEqual([]);
  });

  it("stellt bei genanntem Gehalt eine andere Frage als ohne", () => {
    /*
     * Der Punkt der Anpassung: „Was verdient man üblicherweise?" unter
     * einer Anzeige mit Gehaltsangabe fragt nach etwas, das zwei
     * Zentimeter höher steht.
     */
    const ohne = berufsfragen("Koch", lage({ hatGehalt: false }));
    const mit = berufsfragen("Koch", lage({ hatGehalt: true }));
    const g = (fs: { key: string; text: string }[]) => fs.find((f) => f.key === "gehalt")?.text;
    expect(g(ohne)).not.toBe(g(mit));
    expect(g(ohne)).toContain("nennt kein Gehalt");
  });

  it("fragt nach Schichtarbeit, wenn die Anzeige sie nennt", () => {
    const fs = berufsfragen("Pflegefachkraft", lage({ schichtarbeit: true }));
    expect(fs.some((f) => f.key === "schicht")).toBe(true);
  });

  it("fragt nicht nach Schichtarbeit, wenn keine erwähnt ist", () => {
    expect(berufsfragen("Koch", lage()).some((f) => f.key === "schicht")).toBe(false);
  });

  it("nennt den Reiseanteil beim Namen, wenn er hoch ist", () => {
    const fs = berufsfragen("Berater", lage({ reiseanteil: 60 }));
    expect(fs.find((f) => f.key === "reisen")?.text).toContain("60 %");
  });

  it("bleibt bei vier Fragen, auch wenn viele passen", () => {
    const fs = berufsfragen("Berater", lage({
      schichtarbeit: true, reiseanteil: 60, hatGehalt: true,
      hatAufgaben: true, hatAnforderungen: true, arbeitsmodell: "remote",
    }));
    expect(fs).toHaveLength(4);
  });
});
