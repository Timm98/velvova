import { describe, expect, it } from "vitest";
import { jobcheck, type JobcheckEingabe } from "./jobcheck.ts";
import type { Widerspruch } from "./widersprueche.ts";

/**
 * Die Empfehlung vor der Unterschrift.
 *
 * ── Warum diese Tests wichtiger sind als die meisten ──────────
 *
 * Vor der Bewerbung kostet ein Irrtum eine Stunde. Vor der Unterschrift
 * kostet er Monate. Eine Empfehlung, die hier zu weich ist, schadet
 * mehr als gar keine.
 */

const leer: JobcheckEingabe = {
  passt: [],
  passtNicht: [],
  ungeklaert: [],
  widersprueche: [],
  bedingungGebrochen: false,
};

const w = (): Widerspruch => ({
  punkt: "homeoffice",
  titel: "Homeoffice",
  staerker: { punkt: "homeoffice", zusage: "erst nach der Probezeit", herkunft: "gespraech", beleg: "" },
  schwaecher: { punkt: "homeoffice", zusage: "ab Tag eins", herkunft: "anzeige", beleg: "" },
  erklaerung: "…",
});

describe("Nina kann Nein sagen", () => {
  it("lehnt ab, wenn eine unverzichtbare Bedingung verletzt ist", () => {
    /*
     * Sie gegen eine gute Passung abzuwägen hiesse, die Entscheidung
     * des Menschen zu überstimmen — er hat sie selbst als
     * unverzichtbar bezeichnet.
     */
    const r = jobcheck({
      ...leer,
      passt: ["Aufgaben passen sehr gut", "Team passt", "Gehalt passt"],
      passtNicht: ["Die Stelle verlangt Schichtdienst"],
      bedingungGebrochen: true,
    });
    expect(r.empfehlung).toBe("ablehnen");
    expect(r.kernsatz).toContain("unverzichtbar");
  });

  it("rät auch von einer Stelle ab, die jemand bekäme", () => {
    /*
     * Die stärkste Aussage dieses Produkts: fachlich geeignet, und
     * trotzdem der falsche Job.
     */
    const r = jobcheck({
      ...leer,
      passt: ["Deine belegten Fähigkeiten decken den Kern"],
      passtNicht: ["Sehr viel Kundenkontakt", "Hoher Zeitdruck", "Kaum eigene Entscheidungen"],
    });
    expect(r.empfehlung).toBe("ablehnen");
    expect(r.kernsatz).toContain("wahrscheinlich bekommen");
    expect(r.kernsatz).toContain("nicht, dass du sie annehmen solltest");
  });
});

describe("Ein Widerspruch führt zum Klären, nicht zum Ablehnen", () => {
  it("weil unklar ist, welche Aussage falsch ist", () => {
    /*
     * Ein Widerspruch bedeutet, dass eine der beiden Aussagen nicht
     * stimmt — nicht, welche. Wer deshalb ablehnt, lehnt womöglich
     * wegen eines Missverständnisses ab.
     */
    const r = jobcheck({ ...leer, passt: ["alles passt"], widersprueche: [w()] });
    expect(r.empfehlung).toBe("erst_klaeren");
    expect(r.kernsatz).toContain("bevor du unterschreibst");
  });

  it("stellt den Widerspruch über offene Punkte", () => {
    const r = jobcheck({
      ...leer,
      ungeklaert: ["a", "b", "c", "d", "e"],
      widersprueche: [w()],
    });
    expect(r.kernsatz).toContain("zwei verschiedene Aussagen");
  });
});

describe("Die Abstufungen dazwischen", () => {
  it("rät zum Nachverhandeln bei einem einzelnen Gegenpunkt", () => {
    const r = jobcheck({ ...leer, passt: ["passt"], passtNicht: ["Das Gehalt liegt unter deiner Untergrenze"] });
    expect(r.empfehlung).toBe("verhandeln");
    expect(r.kernsatz).toContain("bevor du zusagst");
  });

  it("rät zum Klären, wenn vieles offen ist", () => {
    const r = jobcheck({ ...leer, ungeklaert: ["a", "b", "c", "d"] });
    expect(r.empfehlung).toBe("erst_klaeren");
  });

  it("sagt zu, wenn nichts dagegenspricht", () => {
    expect(jobcheck({ ...leer, passt: ["passt"] }).empfehlung).toBe("annehmen");
  });
});

describe("Die Grenze der Aussage steht immer dabei", () => {
  it("nennt, was die Einschätzung nicht kennt", () => {
    const r = jobcheck(leer);
    expect(r.grenzen).toContain("weder das Team noch den Vorgesetzten");
    expect(r.grenzen).toContain("ersetzt kein Gespräch");
  });
});
