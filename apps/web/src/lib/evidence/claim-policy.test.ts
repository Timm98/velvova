import { describe, expect, it } from "vitest";
import { assessClaim, buildCitation, defaultTier, reconcile, type EvidenceRecord } from "./claim-policy.ts";

const quelle = (over: Partial<EvidenceRecord> = {}): EvidenceRecord => ({
  id: "1",
  title: "Beispiel",
  publisher: "Statistisches Bundesamt",
  publicationDate: new Date("2026-03-01"),
  url: "https://example.invalid/studie",
  evidenceType: "official_statistics",
  geography: "Deutschland",
  sampleSize: 12000,
  commercialInterest: null,
  limitations: null,
  qualityTier: "high",
  expiresAt: null,
  ...over,
});

const JETZT = new Date("2026-08-30");
const statistik = { isStatistic: true, isIndividualAdvice: false };

describe("Belegstufen", () => {
  it("stuft Quellenarten sinnvoll vor", () => {
    expect(defaultTier("official_statistics")).toBe("high");
    expect(defaultTier("company_sponsored_survey")).toBe("context_only");
    expect(defaultTier("forum_or_social_anecdote")).toBe("anecdotal");
  });
});

describe("Zahlen im Produkt", () => {
  it("lässt eine amtliche Statistik durch", () => {
    const v = assessClaim(quelle(), statistik, JETZT);
    expect(v.allowed).toBe(true);
    expect(v.hedge).toBeNull();
  });

  it("blockt einen Forenbeitrag als Statistik", () => {
    // Ein Einzelbericht trägt keine allgemeine Zahl, egal wie
    // überzeugend er klingt.
    const v = assessClaim(
      quelle({ evidenceType: "forum_or_social_anecdote", qualityTier: "anecdotal" }),
      statistik,
      JETZT,
    );
    expect(v.allowed).toBe(false);
    expect(v.reason).toMatch(/Einzelbericht/);
  });

  it("blockt eine Zahl ohne Datum", () => {
    const v = assessClaim(quelle({ publicationDate: null }), statistik, JETZT);
    expect(v.allowed).toBe(false);
    expect(v.reason).toMatch(/Erscheinungsdatum/);
  });

  it("blockt eine Zahl ohne Region", () => {
    const v = assessClaim(quelle({ geography: null }), statistik, JETZT);
    expect(v.allowed).toBe(false);
  });

  it("blockt eine überholte Quelle", () => {
    const v = assessClaim(quelle({ expiresAt: new Date("2026-01-01") }), statistik, JETZT);
    expect(v.allowed).toBe(false);
  });

  it("kennzeichnet eine Unternehmensstudie als interessengefärbt", () => {
    const v = assessClaim(
      quelle({ evidenceType: "company_sponsored_survey", qualityTier: "context_only" }),
      { isStatistic: false, isIndividualAdvice: false },
      JETZT,
    );
    expect(v.allowed).toBe(true);
    expect(v.hedge).toMatch(/eigenem Interesse/);
  });
});

describe("Vom Durchschnitt auf den Einzelfall", () => {
  it("erlaubt den Schluss nur mit ausdrücklicher Einschränkung", () => {
    // Der subtilste Fehler: "Studien zeigen X, also solltest du X tun."
    // Der Schluss von der Verteilung auf den Einzelfall ist unzulässig
    // — und er klingt überzeugend.
    const v = assessClaim(quelle(), { isStatistic: false, isIndividualAdvice: true }, JETZT);
    expect(v.allowed).toBe(true);
    expect(v.hedge).toMatch(/über deine Bewerbung nichts Sicheres/);
  });
});

describe("Quellenzeile", () => {
  it("enthält alles zum Nachprüfen nötige", () => {
    const z = buildCitation(quelle());
    expect(z).toContain("Amtliche Statistik");
    expect(z).toContain("Statistisches Bundesamt");
    expect(z).toContain("2026");
    expect(z).toContain("Deutschland");
    expect(z).toContain("n = 12000");
  });

  it("nennt die Belegstufe", () => {
    expect(buildCitation(quelle({ qualityTier: "anecdotal" }))).toContain("Einzelbericht");
  });
});

describe("Widersprüchliche Quellen", () => {
  it("veröffentlicht keine Einzelzahl, wenn die Quellen weit auseinanderliegen", () => {
    const r = reconcile([
      { value: 20, record: quelle() },
      { value: 65, record: quelle({ id: "2" }) },
    ]);
    expect(r.publishable).toBe(false);
    expect(r.note).toMatch(/widersprechen sich/);
    expect(r.range).toEqual([20, 65]);
  });

  it("lässt übereinstimmende Quellen durch", () => {
    const r = reconcile([
      { value: 40, record: quelle() },
      { value: 44, record: quelle({ id: "2" }) },
    ]);
    expect(r.publishable).toBe(true);
  });

  it("schweigt ohne Quelle", () => {
    expect(reconcile([]).publishable).toBe(false);
  });
});
