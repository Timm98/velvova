import type { EvidenceItem, Job } from "@paycheck/domain";
import { describe, expect, it } from "vitest";
import { analyseClaims, checkApproval, isCheckableClaim } from "./claims.ts";
import { DraftDeliveryProvider, MailpitDeliveryProvider, OAuthMailProvider } from "./delivery.ts";
import { buildApplicationEmail, coverLetterAdvisable } from "./cv.ts";

const T0 = new Date("2026-08-01T00:00:00Z");

function ev(id: string, statement: string, confirmed = true): EvidenceItem {
  return {
    id, userId: "u1", type: "experience_episode", statement,
    sourceType: confirmed ? "user_stated" : "ai_hypothesis", sourceRef: "interview",
    confidence: 0.9, userConfirmed: confirmed, userRejected: false,
    sensitivityLevel: "normal", retentionClass: "profile",
    createdAt: T0, updatedAt: T0, deletedAt: null,
  };
}

const job = {
  id: "j1", title: "Customer Success Manager", companyName: "Demo GmbH",
  description: "Du betreust Kunden.", applyMethod: "email",
} as unknown as Job;

describe("Claim-Provenienz", () => {
  const evidence = [
    ev("e1", "Zwei Jahre Kundenbetreuung im Kundenservice, taeglich rund 40 Anfragen bearbeitet"),
    ev("e2", "Monatliche Auswertung der Anfragegruende erstellt und im Team praesentiert"),
  ];

  it("erkennt eine belegte Aussage", () => {
    const a = analyseClaims("art1", "Ich habe zwei Jahre Kundenbetreuung im Kundenservice gemacht.", evidence);
    expect(a.claims[0]!.status).not.toBe("unsupported");
    expect(a.claims[0]!.evidenceIds).toContain("e1");
  });

  it("markiert eine erfundene Aussage als unbelegt", () => {
    const a = analyseClaims("art1", "Ich habe den Umsatz um 40 Prozent gesteigert.", evidence);
    expect(a.claims[0]!.status).toBe("unsupported");
  });

  it("sperrt die Freigabe, solange eine Aussage unbelegt ist", () => {
    const a = analyseClaims("art1", "Ich habe den Umsatz um 40 Prozent gesteigert.", evidence);
    const check = checkApproval(a);
    expect(check.canApprove).toBe(false);
    expect(check.blockers).toHaveLength(1);
  });

  it("gibt frei, wenn alle Aussagen belegt sind", () => {
    const a = analyseClaims("art1", "Ich habe zwei Jahre Kundenbetreuung im Kundenservice gemacht.", evidence);
    expect(checkApproval(a).canApprove).toBe(true);
  });

  it("zaehlt unbestaetigte Hypothesen nicht als Beleg", () => {
    const nurHypothese = [ev("h1", "Zwei Jahre Kundenbetreuung im Kundenservice", false)];
    const a = analyseClaims("art1", "Ich habe zwei Jahre Kundenbetreuung im Kundenservice gemacht.", nurHypothese);
    expect(a.claims[0]!.status).toBe("unsupported");
  });

  it("prueft Anreden und Grussformeln nicht als Behauptung", () => {
    expect(isCheckableClaim("Sehr geehrte Damen und Herren,")).toBe(false);
    expect(isCheckableClaim("Mit freundlichen Gruessen")).toBe(false);
    expect(isCheckableClaim("Ich habe zwei Jahre im Kundenservice gearbeitet.")).toBe(true);
  });

  it("behandelt eine Absichtserklaerung nicht als Tatsachenbehauptung", () => {
    expect(isCheckableClaim("Ich moechte mich in diesem Bereich weiterentwickeln.")).toBe(false);
  });
});

describe("Versand", () => {
  const preview = {
    recipient: "jobs@demo.invalid", subject: "Bewerbung", body: "Text",
    attachments: [], locale: "de" as const, isDemo: true, providerName: "x",
  };

  it("versendet ohne Bestaetigung nichts", async () => {
    const r = await new DraftDeliveryProvider().send(preview, false);
    expect(r.status).toBe("refused");
    expect(r.isDemo).toBe(true);
  });

  it("erzeugt mit Bestaetigung einen Entwurf, sendet aber nicht", async () => {
    const r = await new DraftDeliveryProvider().send(preview, true);
    expect(r.status).toBe("draft_created");
    expect(r.isDemo).toBe(true);
    expect(r.draft?.filename).toMatch(/\.eml$/);
  });

  it("meldet ein nicht verbundenes Postfach ehrlich", async () => {
    const p = new OAuthMailProvider("gmail", "Gmail", false);
    expect(p.isConnected()).toBe(false);
    const r = await p.send(preview, true);
    expect(r.status).toBe("not_connected");
    expect(r.message).toContain("nicht verbunden");
  });

  it("meldet einen fehlenden Testserver, statt Erfolg vorzutaeuschen", async () => {
    const r = await new MailpitDeliveryProvider(undefined).send(preview, true);
    expect(r.status).toBe("not_connected");
  });
});

describe("Anschreiben", () => {
  it("raet ab, wenn die Anzeige keines verlangt", () => {
    const r = coverLetterAdvisable(job);
    expect(r.advisable).toBe(false);
    expect(r.reason.length).toBeGreaterThan(20);
  });

  it("raet zu, wenn die Anzeige eines verlangt", () => {
    const r = coverLetterAdvisable({ ...job, description: "Bitte mit Anschreiben bewerben." } as Job);
    expect(r.advisable).toBe(true);
  });

  it("baut die E-Mail nur aus bestaetigter Evidenz", () => {
    const r = buildApplicationEmail(job, [ev("e1", "Zwei Jahre Kundenservice"), ev("h1", "Erfundenes", false)], "Lea");
    expect(r.body).toContain("Zwei Jahre Kundenservice");
    expect(r.body).not.toContain("Erfundenes");
    expect(r.usedEvidenceIds).toEqual(["e1"]);
  });
});
