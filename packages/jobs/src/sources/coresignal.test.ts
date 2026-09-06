import { describe, expect, it } from "vitest";
import { passt } from "./coresignal.ts";

/**
 * Die Zuordnung ist der ganze Wert dieser Anreicherung.
 *
 * Der Anlass steht in echten Daten: die Suche nach `sap.com` gibt als
 * ersten Treffer „SAP Moment Marketing" zurück. Wer den ersten Treffer
 * nimmt, hängt einer Stelle Mitarbeiterzahl, Branche und Hauptsitz
 * einer anderen Firma an — plausibel und falsch.
 */

describe("Zuordnung über die Domain", () => {
  it("nimmt den Treffer, dessen Domain übereinstimmt", () => {
    expect(passt({ website: "https://www.sap.com/" }, "SAP", "sap.com")).toBe("domain");
  });

  it("weist ähnliche Namen mit anderer Domain ab", () => {
    // Genau der Fall aus den echten Daten.
    expect(passt({ name: "SAP Moment Marketing", website: "https://momentmarketing.io" }, "SAP", "sap.com")).toBeNull();
  });

  it("verlässt sich bei bekannter Domain NICHT auf den Namen", () => {
    /*
     * Sonst hebelte ein passender Name die Domainprüfung aus — und die
     * Domain ist der einzige harte Schlüssel, den wir haben.
     */
    expect(passt({ name: "SAP", website: "https://etwas-anderes.de" }, "SAP", "sap.com")).toBeNull();
  });
});

describe("Zuordnung über den Namen", () => {
  it("ignoriert Rechtsform und Landeszusatz", () => {
    expect(passt({ name: "Muster GmbH" }, "Muster Deutschland GmbH", null)).toBe("name");
  });

  it("verlangt Gleichheit, nicht Ähnlichkeit", () => {
    expect(passt({ name: "Muster Logistik GmbH" }, "Muster GmbH", null)).toBeNull();
  });

  it("ordnet nichts zu, wenn vom Namen nichts übrig bleibt", () => {
    // „Group Holding GmbH" besteht nur aus Zusätzen. Ein leerer Kern
    // würde sonst auf jeden anderen leeren Kern passen.
    expect(passt({ name: "Group Holding GmbH" }, "Holding GmbH", null)).toBeNull();
  });
});
