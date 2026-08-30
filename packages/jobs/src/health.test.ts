import { describe, expect, it } from "vitest";
import { CircuitBreaker, DEFAULT_CAPABILITIES, cachedHealthCheck, healthCheck, resetBreakers } from "./health.ts";
import type { JobSourceAdapter } from "./adapter.ts";

function adapter(over: Partial<JobSourceAdapter> = {}): JobSourceAdapter {
  return {
    key: "arbeitnow",
    displayName: "Arbeitnow",
    kind: "licensed_api",
    licenseStatus: "licensed",
    attributionRequired: false,
    attributionText: null,
    termsUrl: null,
    isConfigured: () => true,
    async fetchListings() {
      return [
        {
          externalId: "1",
          title: "Fachkraft",
          companyName: "Beispiel",
          location: "Hamburg",
          description: "Text",
          url: "https://example.invalid/1",
        },
      ];
    },
    ...over,
  } as JobSourceAdapter;
}

describe("Gesundheitsprüfung", () => {
  it("fragt einen nicht freigegebenen Anbieter gar nicht erst", async () => {
    // Ein Health-Check ist ein Netzzugriff. Ihn vom rechtlichen Riegel
    // auszunehmen, wäre genau die Hintertür, die der Riegel schliesst.
    let gefragt = false;
    const report = await healthCheck(
      adapter({
        key: "indeed",
        async fetchListings() {
          gefragt = true;
          return [];
        },
      }),
    );

    expect(gefragt).toBe(false);
    expect(report.state).toBe("not_allowed");
  });

  it("unterscheidet fehlende Zugangsdaten von einem Ausfall", async () => {
    // Beides führt zu null Stellen. Für die Reaktion ist der
    // Unterschied alles: das eine repariert man in einer Minute, das
    // andere kann man nur abwarten.
    const report = await healthCheck(adapter({ isConfigured: () => false }));
    expect(report.state).toBe("not_configured");
  });

  it("nennt einen Anbieter ohne Ergebnisse eingeschränkt, nicht in Ordnung", async () => {
    const report = await healthCheck(adapter({ async fetchListings() { return []; } }));
    expect(report.state).toBe("degraded");
  });

  it("nennt einen langsamen Anbieter eingeschränkt", async () => {
    let t = 0;
    const report = await healthCheck(adapter(), () => (t += 12_000));
    expect(report.state).toBe("degraded");
    expect(report.detail).toMatch(/langsam/);
  });

  it("meldet einen Fehler als Ausfall, mit der Meldung", async () => {
    const report = await healthCheck(
      adapter({ async fetchListings() { throw new Error("503 Service Unavailable"); } }),
    );
    expect(report.state).toBe("down");
    expect(report.detail).toContain("503");
  });

  it("meldet einen funktionierenden Anbieter als in Ordnung", async () => {
    const report = await healthCheck(adapter());
    expect(report.state).toBe("ok");
    expect(report.latencyMs).not.toBeNull();
  });
});

describe("Sicherung", () => {
  const zeit = () => ({ jetzt: 0 });

  it("lässt anfangs durch", () => {
    expect(new CircuitBreaker().allows()).toBe(true);
  });

  it("öffnet erst beim Schwellwert", () => {
    const b = new CircuitBreaker(3, 60_000, () => 0);
    b.recordFailure();
    b.recordFailure();
    expect(b.allows()).toBe(true);
    b.recordFailure();
    expect(b.allows()).toBe(false);
  });

  it("vergisst Fehlschläge nach einem Erfolg", () => {
    const b = new CircuitBreaker(3, 60_000, () => 0);
    b.recordFailure();
    b.recordFailure();
    b.recordSuccess();
    b.recordFailure();
    b.recordFailure();
    expect(b.allows()).toBe(true);
  });

  it("lässt nach der Wartezeit genau einen Versuch zu", () => {
    const t = zeit();
    const b = new CircuitBreaker(1, 60_000, () => t.jetzt);
    b.recordFailure();
    expect(b.allows()).toBe(false);

    t.jetzt = 60_000;
    expect(b.state).toBe("half_open");
    expect(b.allows()).toBe(true);
  });

  it("geht nach einem gescheiterten Probeversuch sofort zurück in die Wartezeit", () => {
    // Der entscheidende Fall. Würde erst wieder bis zum Schwellwert
    // gezählt, bekäme der kaputte Dienst nach jeder Wartezeit erneut
    // drei Anfragen — und viele gleichzeitig neu startende Dienste
    // verlängern seinen Ausfall, statt ihn abzuwarten.
    const t = zeit();
    const b = new CircuitBreaker(3, 60_000, () => t.jetzt);
    b.recordFailure();
    b.recordFailure();
    b.recordFailure();

    t.jetzt = 60_000;
    expect(b.allows()).toBe(true);
    b.recordFailure();

    t.jetzt = 60_001;
    expect(b.allows()).toBe(false);
  });

  it("sagt, wie lange noch gewartet wird", () => {
    const t = zeit();
    const b = new CircuitBreaker(1, 60_000, () => t.jetzt);
    b.recordFailure();
    t.jetzt = 20_000;
    expect(b.retryInMs()).toBe(40_000);
  });
});

describe("Fähigkeiten", () => {
  it("nimmt im Zweifel wenig an", () => {
    // Die andere Richtung erzeugt stille Fehler: ein nicht
    // unterstützter Filter wird meist ignoriert, und das Ergebnis sieht
    // plausibel aus, ist aber falsch.
    expect(DEFAULT_CAPABILITIES.since).toBe(false);
    expect(DEFAULT_CAPABILITIES.details).toBe(false);
    expect(DEFAULT_CAPABILITIES.salary).toBe(false);
    expect(DEFAULT_CAPABILITIES.expiry).toBe(false);
    expect(DEFAULT_CAPABILITIES.rateLimitPerMinute).toBeNull();
  });
});

describe("Zwischengespeicherte Prüfung", () => {
  it("fragt innerhalb einer Minute nur einmal", async () => {
    resetBreakers();
    let anfragen = 0;
    const a = adapter({
      async fetchListings() {
        anfragen += 1;
        return [{ externalId: "1", title: "T", companyName: "C", location: "L", description: "D", url: "https://example.invalid/1" }];
      },
    });

    let jetzt = 0;
    await cachedHealthCheck(a, () => jetzt);
    jetzt = 30_000;
    await cachedHealthCheck(a, () => jetzt);

    expect(anfragen).toBe(1);
  });

  it("fragt nach Ablauf erneut", async () => {
    resetBreakers();
    let anfragen = 0;
    const a = adapter({
      async fetchListings() {
        anfragen += 1;
        return [{ externalId: "1", title: "T", companyName: "C", location: "L", description: "D", url: "https://example.invalid/1" }];
      },
    });

    let jetzt = 0;
    await cachedHealthCheck(a, () => jetzt);
    jetzt = 61_000;
    await cachedHealthCheck(a, () => jetzt);

    expect(anfragen).toBe(2);
  });
});
