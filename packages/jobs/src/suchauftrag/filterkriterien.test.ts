import { describe, expect, it } from "vitest";
import { auftragsname, filterZuKriterien, nichtUebernommen } from "./filterkriterien.ts";

describe("Filter zu Kriterien", () => {
  it("übernimmt nichts als bestätigt", () => {
    const k = filterZuKriterien({ q: "lagerist", ort: "Karlsruhe", gehaltAb: "32000" });
    expect(k.every((x) => x.bestaetigungsstatus === "offen")).toBe(true);
    expect(k.every((x) => x.herkunft === "uebernommener_filter")).toBe(true);
  });

  it("macht aus einem Ortsfilter kein Muss", () => {
    const [ort] = filterZuKriterien({ ort: "Karlsruhe" });
    expect(ort!.staerke).toBe("wunsch");
  });

  it("macht daraus ein Muss, wenn „genau dieser Ort“ gesetzt ist", () => {
    const [ort] = filterZuKriterien({ ort: "Karlsruhe", ortGenau: "1" });
    expect(ort!.staerke).toBe("muss");
  });

  it("legt Ort und Remote in dieselbe Gruppe", () => {
    const k = filterZuKriterien({ ort: "Stuttgart", remote: "remote" });
    const gruppen = k.map((x) => x.gruppe);
    expect(gruppen.filter((g) => g === "ort")).toHaveLength(2);
  });

  it("macht aus Schichtarbeit nur einen Wunsch", () => {
    const [schicht] = filterZuKriterien({ schicht: "0" });
    expect(schicht!.staerke).toBe("wunsch");
  });

  it("übernimmt keine Ansichtsangaben", () => {
    const k = filterZuKriterien({ sort: "fit", seite: "3", since: "24h", anzahl: "50" });
    expect(k).toHaveLength(0);
    expect(nichtUebernommen({ sort: "fit", since: "24h" })).toEqual(["sort", "since"]);
  });

  it("ignoriert einen zu kurzen Suchbegriff", () => {
    expect(filterZuKriterien({ q: "it" })).toHaveLength(0);
  });

  it("übernimmt ein Mindestgehalt als Muss mit Einheit", () => {
    const [gehalt] = filterZuKriterien({ gehaltAb: "45000" });
    expect(gehalt).toMatchObject({
      kriterium: "mindestgehalt",
      wert: 45000,
      einheit: "year",
      operator: "mindestens",
      staerke: "muss",
    });
  });
});

describe("Auftragsname", () => {
  it("leitet ihn aus der Suche ab", () => {
    expect(auftragsname({ q: "Lagerist", ort: "Karlsruhe" })).toBe("Lagerist in Karlsruhe");
  });

  it("hat immer einen Namen", () => {
    expect(auftragsname({})).toBe("Meine Suche");
  });
});

describe("Suchbegriffe", () => {
  it("nimmt den Stamm, damit der Wortanfang trifft", () => {
    const [k] = filterZuKriterien({ q: "Lagerstellen" });
    expect(k!.wert).toEqual(["lager"]);
  });

  it("lässt einen Beruf unangetastet", () => {
    const [k] = filterZuKriterien({ q: "Zerspanungsmechaniker" });
    expect(k!.wert).toEqual(["zerspanungsmechaniker"]);
  });
});
