import { describe, expect, it } from "vitest";
import { anforderungEinstufen, istWunschUeberschrift } from "./anforderungsart.ts";

describe("anforderungEinstufen", () => {
  it("liest eine wörtliche Pflicht als Pflicht", () => {
    const a = anforderungEinstufen("Ein abgeschlossenes Studium ist Voraussetzung");
    expect(a.zwingend).toBe(true);
    expect(a.belegstelle).toBe("ist Voraussetzung");
  });

  it("liest einen Wunsch als Wunsch", () => {
    const a = anforderungEinstufen("Erfahrung mit Kubernetes ist von Vorteil");
    expect(a.zwingend).toBe(false);
    expect(a.belegstelle).toBe("von Vorteil");
  });

  it("lässt den Wunsch gewinnen, wenn beide Wörter im Satz stehen", () => {
    // „Von Vorteil, aber nicht erforderlich" enthält beides und meint eines.
    const a = anforderungEinstufen("Von Vorteil ist SAP, zwingend erforderlich ist es nicht");
    expect(a.zwingend).toBe(false);
  });

  it("nennt eine wörtliche Einstufung sicher", () => {
    expect(anforderungEinstufen("Deutsch muss verhandlungssicher sein").konfidenz).toBe(95);
  });

  it("gibt einer Zeile ohne Signalwort niedrige Konfidenz", () => {
    const a = anforderungEinstufen("Kenntnisse in Excel und PowerPoint");
    expect(a.konfidenz).toBe(40);
    expect(a.belegstelle).toBeNull();
  });

  it("liest im Zweifel als Pflicht, nicht als Wunsch", () => {
    // Freundlicher wäre „Wunsch". Schlechter auch: Nina schickte
    // Menschen zu Stellen, deren Grundbedingung sie nicht erfüllen.
    expect(anforderungEinstufen("Kenntnisse in Excel").zwingend).toBe(true);
  });

  it("nutzt den Abschnitt, wenn die Zeile selbst nichts sagt", () => {
    const a = anforderungEinstufen("Kenntnisse in Excel", true);
    expect(a.zwingend).toBe(false);
    expect(a.konfidenz).toBe(70);
  });

  it("lässt ein Signalwort in der Zeile den Abschnitt schlagen", () => {
    // Ein „muss" im Wunschblock ist eine bewusste Ausnahme der Anzeige.
    expect(anforderungEinstufen("Ein Führerschein muss vorliegen", true).zwingend).toBe(true);
  });

  it("hält ein Werkzeug für erlernbar", () => {
    expect(anforderungEinstufen("Sicher im Umgang mit Jira").erlernbar).toBe(true);
  });

  it("hält einen Abschluss nicht für erlernbar", () => {
    expect(anforderungEinstufen("Abgeschlossenes Studium der Informatik").erlernbar).toBe(false);
  });

  it("hält geforderte Berufsjahre nicht für erlernbar", () => {
    // Man kann sie sich aneignen, aber nicht für diese Bewerbung.
    expect(anforderungEinstufen("Mindestens 5 Jahre Berufserfahrung").erlernbar).toBe(false);
  });

  it("stuft eine Sprachanforderung als tragend ein, auch als Wunsch", () => {
    const a = anforderungEinstufen("Englischkenntnisse wären wünschenswert");
    expect(a.zwingend).toBe(false);
    expect(a.wichtigkeit).toBe(3);
  });

  it("stuft ein beiläufiges Werkzeug als Nebensache ein", () => {
    expect(anforderungEinstufen("Confluence ist von Vorteil").wichtigkeit).toBe(1);
  });

  it("unterscheidet fehlend-aber-holbar von der harten Grenze", () => {
    const kurs = anforderungEinstufen("Kenntnisse in Python sind erforderlich");
    const grenze = anforderungEinstufen("Die Approbation ist zwingend erforderlich");
    expect([kurs.zwingend, kurs.erlernbar]).toEqual([true, true]);
    expect([grenze.zwingend, grenze.erlernbar]).toEqual([true, false]);
  });
});

describe("istWunschUeberschrift", () => {
  it("erkennt die übliche Wunschüberschrift", () => {
    expect(istWunschUeberschrift("Das wünschen wir uns zusätzlich")).toBe(true);
  });

  it("erkennt eine Pflichtüberschrift nicht als Wunsch", () => {
    expect(istWunschUeberschrift("Das bringen Sie mit")).toBe(false);
  });
});
