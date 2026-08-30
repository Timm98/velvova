import { describe, expect, it } from "vitest";
import { browserFamily, deviceClass, mayAskForMicroFeedback, redactRoute } from "./service.ts";

/**
 * Ein Fehlerbericht, der nebenbei einen halben Lebenslauf mitschickt,
 * ist ein Datenleck mit guter Absicht.
 */

describe("Adresszeile kürzen", () => {
  it("ersetzt Kennungen durch ihre Form", () => {
    expect(redactRoute("/app/jobs/8a5c7588-6e05-42a8-b9f8-8d1f43ebd9f7")).toBe("/app/jobs/:id");
    expect(redactRoute("/app/applications/12345")).toBe("/app/applications/:n");
  });

  it("wirft Suchbegriffe weg", () => {
    // "Jobs Hamburg Teilzeit Pflege" sagt mehr über eine Person, als
    // sie in einen Fehlerbericht schreiben wollte.
    expect(redactRoute("/app/jobs?q=Pflege+Teilzeit&ort=Hamburg")).toBe("/app/jobs");
  });

  it("behält den Pfad lesbar", () => {
    expect(redactRoute("/app/settings/privacy")).toBe("/app/settings/privacy");
  });
});

describe("Technischer Kontext", () => {
  it("nennt nur die Browserfamilie, nicht die Fassung", () => {
    // Die genaue Fassung ist ein Merkmal, mit dem sich Geräte
    // wiedererkennen lassen.
    const ua = "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/120.0.6099.109 Safari/537.36";
    expect(browserFamily(ua)).toBe("Chrome");
    expect(browserFamily(ua)).not.toMatch(/\d/);
  });

  it("unterscheidet Safari von Chrome", () => {
    expect(browserFamily("Mozilla/5.0 (iPhone) AppleWebKit Version/17.0 Safari/605.1")).toBe("Safari");
  });

  it("gibt nur eine grobe Geräteklasse", () => {
    expect(deviceClass("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)")).toBe("mobil");
    expect(deviceClass("Mozilla/5.0 (iPad; CPU OS 17_0)")).toBe("tablet");
    expect(deviceClass("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe("desktop");
  });
});

describe("Wann gefragt werden darf", () => {
  it("fragt nicht direkt nach einer Absage", () => {
    // Der Moment gehört der Person, nicht unserer Produktverbesserung.
    expect(mayAskForMicroFeedback("rejection_received")).toBe(false);
    expect(mayAskForMicroFeedback("offer_declined")).toBe(false);
  });

  it("fragt in gewöhnlichen Schritten", () => {
    expect(mayAskForMicroFeedback("JOB_REVIEW")).toBe(true);
    expect(mayAskForMicroFeedback(null)).toBe(true);
  });
});
