import { afterEach, describe, expect, it } from "vitest";
import { classifyCandidates } from "@paycheck/sources";
import { entdecke, führeZusammen, type DiscoveryProvider } from "./index.ts";
import {
  BraveSearchDiscoveryProvider,
  GoogleSearchDiscoveryProvider,
  aktiveDiscoveryProvider,
} from "./providers.ts";

const JETZT = new Date("2026-08-31T00:00:00Z");

function kandidaten(...urls: { url: string; title?: string }[]) {
  return classifyCandidates(urls, "test", JETZT);
}

describe("Entscheidung über einen Fund", () => {
  it("überlässt die Rechtsfrage der Policy Engine", () => {
    /*
     * Der erste Entwurf hatte hier eine eigene Sperrliste. Sie war
     * inhaltlich richtig und trotzdem falsch: dieselben Domains an
     * zwei Stellen laufen auseinander, und die Stelle, die veraltet,
     * ist die, an die niemand denkt.
     *
     * Geprüft wird deshalb, dass die gesperrten Plattformen weiterhin
     * gesperrt sind — aber über den einen Weg, der auch das rechtliche
     * Verzeichnis in docs/ speist.
     */
    for (const url of [
      "https://www.linkedin.com/jobs/view/1",
      "https://de.indeed.com/viewjob?jk=a",
      "https://www.stepstone.de/x",
      "https://www.xing.com/jobs/1",
      "https://www.kununu.com/de/firma",
    ]) {
      const [k] = kandidaten({ url });
      expect(k!.policyDecision, url).not.toBe("approved");
      expect(k!.policyReason.length, url).toBeGreaterThan(10);
    }
  });
});

describe("Zusammenführung doppelter Funde", () => {
  it("macht aus derselben Stelle auf zwei Portalen eine", () => {
    const zusammen = führeZusammen(
      kandidaten(
        { url: "https://www.linkedin.com/jobs/view/1", title: "Backend Engineer (m/w/d)" },
        { url: "https://beispiel.de/karriere/backend", title: "Backend Engineer" },
      ),
    );
    expect(zusammen.length).toBe(1);
  });

  it("bevorzugt die kürzere Adresse bei gleicher Entscheidung", () => {
    // Lange Adressen tragen Tracking-Parameter und Sitzungskennungen;
    // die kurze ist die kanonische und die, die in einem Jahr noch geht.
    const zusammen = führeZusammen(
      kandidaten(
        { url: "https://beispiel.de/k/backend?utm_source=x&sid=abc", title: "Backend Engineer" },
        { url: "https://beispiel.de/k/backend", title: "Backend Engineer" },
      ),
    );
    expect(zusammen[0]!.discoveredUrl).toBe("https://beispiel.de/k/backend");
  });

  it("hält zwei verschiedene Stellen auseinander", () => {
    const zusammen = führeZusammen(
      kandidaten(
        { url: "https://a.de/1", title: "Backend Engineer" },
        { url: "https://a.de/2", title: "Frontend Engineer" },
      ),
    );
    expect(zusammen.length).toBe(2);
  });
});

describe("Discovery-Anbieter", () => {
  const vorher = { ...process.env };
  afterEach(() => {
    process.env = { ...vorher };
  });

  it("ist ohne ausdrücklichen Schalter aus", () => {
    delete process.env.GOOGLE_SEARCH_DISCOVERY_ENABLED;
    delete process.env.BRAVE_SEARCH_ENABLED;
    expect(new GoogleSearchDiscoveryProvider().isEnabled()).toBe(false);
    expect(new BraveSearchDiscoveryProvider().isEnabled()).toBe(false);
    expect(aktiveDiscoveryProvider()).toEqual([]);
  });

  it("bleibt aus, wenn nur ein Schlüssel da ist", () => {
    /*
     * Ein Schlüssel in der Umgebung ist keine Bestellung. Er kann aus
     * einem anderen Zusammenhang stammen; erst der Schalter ist eine
     * Entscheidung — und jede Anfrage kostet Geld.
     */
    process.env.GOOGLE_SEARCH_API_KEY = "x";
    process.env.GOOGLE_SEARCH_ENGINE_ID = "y";
    delete process.env.GOOGLE_SEARCH_DISCOVERY_ENABLED;
    expect(new GoogleSearchDiscoveryProvider().isEnabled()).toBe(false);
  });

  it("bleibt aus, wenn der Schalter an ist, aber der Schlüssel fehlt", () => {
    process.env.BRAVE_SEARCH_ENABLED = "true";
    delete process.env.BRAVE_SEARCH_API_KEY;
    expect(new BraveSearchDiscoveryProvider().isEnabled()).toBe(false);
  });

  it("gibt ausgeschaltet eine leere Liste zurück, statt zu werfen", async () => {
    delete process.env.GOOGLE_SEARCH_DISCOVERY_ENABLED;
    await expect(new GoogleSearchDiscoveryProvider().suche("test")).resolves.toEqual([]);
  });

  it("nennt für jeden Anbieter die Grundlage", () => {
    for (const p of [new GoogleSearchDiscoveryProvider(), new BraveSearchDiscoveryProvider()]) {
      expect(p.grundlage.length, p.key).toBeGreaterThan(30);
    }
  });
});

describe("Entdeckungslauf", () => {
  const stumm: DiscoveryProvider = {
    key: "stumm",
    displayName: "Stummer Anbieter",
    grundlage: "Nur für Tests. Ruft nichts ab und findet nichts.",
    isEnabled: () => true,
    suche: async () => [
      { url: "https://beispiel.de/k/1", title: "Backend Engineer" },
      { url: "https://www.linkedin.com/jobs/view/9", title: "Backend Engineer (m/w/d)" },
    ],
  };

  const kaputt: DiscoveryProvider = {
    key: "kaputt",
    displayName: "Fehlerhafter Anbieter",
    grundlage: "Nur für Tests. Wirft immer, um den Ausfall zu prüfen.",
    isEnabled: () => true,
    suche: async () => {
      throw new Error("Anbieter nicht erreichbar");
    },
  };

  it("führt Funde zusammen und sagt, was geladen werden darf", async () => {
    const { kandidaten: k, ladbar, abdeckung } = await entdecke([stumm], "backend", { now: JETZT });
    expect(k.length, "beide Funde sind dieselbe Stelle").toBe(1);
    expect(ladbar.every((c) => c.policyDecision === "approved")).toBe(true);
    expect(abdeckung.length).toBeGreaterThan(10);
  });

  it("nimmt einen ausgefallenen Anbieter nicht mit in den Abgrund", async () => {
    /*
     * Ein Anbieter, der nicht antwortet, darf die Suche nicht
     * abbrechen. Die Abdeckungszeile wird dann kleiner — und das ist
     * die ehrliche Auskunft, keine Ausrede.
     */
    const { kandidaten: k } = await entdecke([kaputt, stumm], "backend", { now: JETZT });
    expect(k.length).toBe(1);
  });

  it("fragt ausgeschaltete Anbieter gar nicht erst", async () => {
    const aus: DiscoveryProvider = { ...stumm, key: "aus", isEnabled: () => false };
    const { kandidaten: k } = await entdecke([aus], "backend", { now: JETZT });
    expect(k).toEqual([]);
  });
});
