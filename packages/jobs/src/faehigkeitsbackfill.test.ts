import { describe, expect, it } from "vitest";
import { belegartAus, konfidenzAus, stufeAlsZahl } from "./faehigkeitsbackfill.ts";

describe("belegartAus", () => {
  it("ordnet die belegbaren Herkünfte zu", () => {
    expect(belegartAus("work_sample")).toBe("arbeitsprobe");
    expect(belegartAus("document_extract")).toBe("lebenslauf");
    expect(belegartAus("external_source")).toBe("zertifikat");
    expect(belegartAus("user_stated")).toBe("nutzer_aussage");
    expect(belegartAus("user_confirmed")).toBe("nutzer_aussage");
  });

  it("lässt eine Modellvermutung nicht herein", () => {
    /*
     * Ein Beleg, den ein Modell vermutet hat, ist kein Beleg. Aus ihm
     * eine Fähigkeit abzuleiten hiesse, eine Vermutung über eine
     * Vermutung zu legen — und am Ende stünde im Profil etwas, das
     * niemand je gesagt hat.
     */
    expect(belegartAus("ai_hypothesis")).toBeNull();
  });

  it("weist auch Unbekanntes ab", () => {
    /* Was künftig dazukommt und nicht zugeordnet wurde, zählt nicht. */
    expect(belegartAus("irgendwas_neues")).toBeNull();
  });
});

describe("konfidenzAus", () => {
  it("stuft eine Arbeitsprobe höher ein als eine Aussage", () => {
    expect(konfidenzAus("arbeitsprobe")).toBeGreaterThan(konfidenzAus("nutzer_aussage"));
    expect(konfidenzAus("zertifikat")).toBeGreaterThan(konfidenzAus("lebenslauf"));
  });

  it("bleibt überall unter voller Sicherheit", () => {
    /* Eine abgeleitete Aussage ist nie so sicher wie eine bestätigte. */
    for (const a of ["arbeitsprobe", "zertifikat", "lebenslauf", "nutzer_aussage"] as const) {
      expect(konfidenzAus(a), a).toBeLessThan(100);
    }
  });
});

describe("stufeAlsZahl", () => {
  it("bildet die vier Stufen auf 1 bis 4 ab", () => {
    expect(stufeAlsZahl("grundkenntnisse")).toBe(1);
    expect(stufeAlsZahl("sicher")).toBe(2);
    expect(stufeAlsZahl("routiniert")).toBe(3);
    expect(stufeAlsZahl("anleitend")).toBe(4);
  });
});
