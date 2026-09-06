import { describe, expect, it } from "vitest";
import { analysiereLink, ausAdresseLesen } from "./link-analyse.ts";

/**
 * Was mit einem eingefügten Stellenlink passieren darf.
 *
 * Der wichtigste Test in dieser Datei ist der, der NICHTS erlaubt: eine
 * gesperrte Plattform darf unter keinen Umständen als „abrufbar"
 * durchgehen. Alles andere ist Bequemlichkeit; das hier ist die Zusage,
 * die dem Produkt zugrunde liegt.
 */

const BOARDS = [{ employerName: "Thermondo GmbH", board: "greenhouse", boardToken: "thermondo" }];

describe("Adresse lesen, nicht abrufen", () => {
  it("liest Titel und Arbeitgeber aus einem LinkedIn-Pfad", () => {
    const g = ausAdresseLesen(
      new URL("https://www.linkedin.com/jobs/view/senior-product-manager-at-thermondo-4021445566"),
    );
    expect(g.titel).toBe("Senior Product Manager");
    expect(g.arbeitgeber).toBe("Thermondo");
  });

  it("rät nicht, wenn im Pfad nichts steht", () => {
    // Indeed trägt nur eine Kennung. Einen Titel daraus zu erfinden wäre
    // schlimmer als keiner: er flösse in die Analyse ein.
    const g = ausAdresseLesen(new URL("https://de.indeed.com/viewjob?jk=a1b2c3d4e5f6"));
    expect(g.titel).toBeNull();
    expect(g.arbeitgeber).toBeNull();
  });

  it("lässt fremde Adressen unangetastet", () => {
    const g = ausAdresseLesen(new URL("https://example.invalid/irgendwas/senior-manager-at-firma-1"));
    expect(g).toEqual({ titel: null, arbeitgeber: null });
  });
});

describe("Gesperrte Plattformen", () => {
  for (const [name, href] of [
    ["LinkedIn", "https://www.linkedin.com/jobs/view/data-analyst-at-beispiel-123456"],
    ["Indeed", "https://de.indeed.com/viewjob?jk=abc123"],
    ["StepStone", "https://www.stepstone.de/stellenangebote--Data-Analyst-Hamburg--9876543-inline.html"],
    ["Monster", "https://www.monster.de/job-openings/data-analyst-hamburg--abc-123"],
  ] as const) {
    it(`${name} wird nie als abrufbar gemeldet`, () => {
      const a = analysiereLink(href);
      /*
       * Die Zusage in einer Zeile.
       *
       * `approved_source` hiesse: wir holen die Seite und werten sie
       * aus. Für diese vier Plattformen gibt es keinen Vertrag, und
       * ohne Vertrag wird nichts geholt — egal wie bequem es wäre.
       */
      expect(a.modus, name).not.toBe("approved_source");
      expect(a.eigenerImportMöglich, name).toBe(true);
      expect(a.hinweis.length, name).toBeGreaterThan(20);
    });
  }

  it("verweist auf die Originalquelle, wenn der Arbeitgeber registriert ist", () => {
    const a = analysiereLink(
      "https://www.linkedin.com/jobs/view/senior-product-manager-at-thermondo-4021445566",
      BOARDS,
    );
    expect(a.modus).toBe("canonical_employer_source");
    expect(a.vermuteterArbeitgeber).toBe("Thermondo");
  });

  it("erfindet keine Originalquelle für einen unbekannten Arbeitgeber", () => {
    /*
     * Der Punkt, an dem die naheliegende Abkürzung falsch wäre.
     *
     * Aus „Beispiel" liesse sich `boards.greenhouse.io/beispiel` bauen
     * und ausprobieren. Genau das verbietet die Quellenliste: der
     * Board-Bezeichner kommt aus einer Registrierung, nie aus einer
     * Suche. Ohne Eintrag bleibt es beim Verweis.
     */
    const a = analysiereLink(
      "https://www.linkedin.com/jobs/view/data-analyst-at-beispiel-123456",
      BOARDS,
    );
    expect(a.modus).toBe("link_only");
  });
});

describe("Unbekannte Adressen", () => {
  it("werden nicht abgerufen, nur weil sie harmlos aussehen", () => {
    const a = analysiereLink("https://irgendeine-jobseite.invalid/stelle/42");
    expect(a.modus).toBe("unknown_source");
    expect(a.eigenerImportMöglich).toBe(true);
  });

  it("nehmen keinen Unsinn als Adresse an", () => {
    const a = analysiereLink("das ist keine adresse");
    expect(a.modus).toBe("unknown_source");
    expect(a.eigenerImportMöglich).toBe(false);
  });
});
