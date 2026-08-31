import { describe, expect, it } from "vitest";
import { berufsgruppe, jobVisual, verlaufFür } from "./visuals.ts";

describe("Berufsgruppe", () => {
  it("erkennt die Gruppe am Titel", () => {
    expect(berufsgruppe("Senior Backend Engineer")).toBe("software_data");
    expect(berufsgruppe("Mitarbeiter Kundenservice")).toBe("customer_success");
    expect(berufsgruppe("Pflegefachkraft")).toBe("healthcare");
    expect(berufsgruppe("Account Manager Vertrieb")).toBe("sales");
  });

  it("richtet sich nach der Tätigkeit, nicht nach der Branche", () => {
    // Eine Entwicklerin in einer Klinik entwickelt — sie pflegt nicht.
    expect(berufsgruppe("Softwareentwickler", ["Klinik", "Gesundheitswesen"])).toBe("software_data");
  });

  it("gibt lieber nichts zurück als etwas Falsches", () => {
    /*
     * Ohne Treffer keine Gruppe — und damit keine Berufsillustration,
     * sondern ein Verlauf. Eine falsche Illustration wäre eine Aussage
     * über die Arbeit, die niemand geprüft hat.
     */
    expect(berufsgruppe("Zirkusdirektor (m/w/d)")).toBeNull();
  });
});

describe("Verlauf", () => {
  it("ist für dieselbe Stelle immer derselbe", () => {
    const a = verlaufFür("job-1");
    expect(verlaufFür("job-1")).toBe(a);
    expect(verlaufFür("job-2")).not.toBe(a);
  });

  it("bleibt in der Markenfamilie", () => {
    // 210–304 Grad: Eisblau bis Violett. Grün und Rot bedeuten im
    // Produkt etwas — bestätigt, Konflikt — und dürfen nicht als
    // Dekoration auftauchen.
    for (let i = 0; i < 200; i++) {
      const töne = [...verlaufFür(`job-${i}`).matchAll(/oklch\([\d.]+ [\d.]+ (\d+)\)/g)].map((m) =>
        Number(m[1]),
      );
      expect(töne.length).toBe(2);
      for (const t of töne) {
        expect(t, `job-${i}`).toBeGreaterThanOrEqual(210);
        expect(t, `job-${i}`).toBeLessThanOrEqual(304);
      }
    }
  });
});

describe("Jobvisual", () => {
  const job = { id: "abc", title: "Entwicklerin", companyName: "Beispiel GmbH" };

  it("fällt ohne Bibliothek auf den Verlauf zurück, ohne Netzaufruf", () => {
    const v = jobVisual(job);
    expect(v.grund).toBe("gradient");
    expect(v.url).toBeUndefined();
    expect(v.gradient).toContain("linear-gradient");
  });

  it("beschreibt den Platzhalter als das, was er ist", () => {
    // „Farbfläche“ ist ehrlich. „Büro“ wäre erfunden.
    const v = jobVisual(job);
    expect(v.altText).toContain("Farbfläche");
    expect(v.altText).toContain("Entwicklerin");
  });

  it("kennzeichnet erzeugte Bilder als Illustration", () => {
    const v = jobVisual(job, {
      grund: "role_family",
      url: "/visuals/software.webp",
      altText: "Abstrakte Darstellung von Softwarearbeit",
      aiGenerated: true,
    });
    expect(v.kennzeichnung).toBe("Illustration");
  });

  it("kennzeichnet ein echtes Logo nicht als Illustration", () => {
    const v = jobVisual(job, {
      grund: "company_logo",
      url: "https://beispiel.de/logo.svg",
      altText: "Logo der Beispiel GmbH",
      aiGenerated: false,
    });
    expect(v.kennzeichnung).toBeUndefined();
  });
});

describe("Bilderzeugung", () => {
  it("ist ohne ausdrückliche Freigabe aus", async () => {
    const { bilderzeugungErlaubt } = await import("./visuals.ts");
    expect(bilderzeugungErlaubt({ jobs: { imageGeneration: false } })).toBe(false);
    expect(bilderzeugungErlaubt({ jobs: { imageGeneration: true } })).toBe(true);
  });

  it("wird beim Anzeigen einer Stelle nicht gebraucht", () => {
    /*
     * `jobVisual` ist rein und kennt keine Konfiguration. Das ist die
     * Zusicherung aus §21.5: bei einem Seitenaufruf kann gar nichts
     * erzeugt werden, weil die Funktion nicht einmal weiss, ob sie
     * dürfte.
     */
    const v = jobVisual({ id: "x", title: "T", companyName: "C" });
    expect(v.grund).toBe("gradient");
  });
});
