import { describe, expect, it } from "vitest";
import { assessScamSignals, type ScamInput } from "./scamSignals.ts";

/**
 * Die Beispiele hier sind Maschen, die im Bewerbungsumfeld dokumentiert
 * sind — nicht ausgedachte Extremfälle. Ein Vorschussbetrug kostet eine
 * arbeitssuchende Person mehrere hundert Euro, die sie gerade nicht
 * hat.
 *
 * Ebenso wichtig sind die Gegenproben: eine ganz normale Anzeige darf
 * nicht als verdächtig markiert werden. Ein Warnsystem, das bei jedem
 * zweiten Fall anschlägt, wird weggeklickt — und dann fehlt es beim
 * Fall, der zählt.
 */

const basis: ScamInput = {
  title: "Sachbearbeitung",
  description: "Du bearbeitest Kundenanfragen und pflegst Stammdaten.",
  companyName: "Muster GmbH",
  originalUrl: "https://muster.example/jobs/1",
  fromEmployerFeed: false,
  employerDomainVerified: false,
};

const mit = (description: string, over: Partial<ScamInput> = {}) =>
  assessScamSignals({ ...basis, description, ...over });

describe("Schwere Signale", () => {
  it("erkennt eine verlangte Vorabzahlung", () => {
    const a = mit("Für die Schulung fällt eine Bearbeitungsgebühr von 249 EUR an.");
    expect(a.level).toBe("additional_verification_recommended");
    expect(a.signals[0]!.key).toBe("upfront_payment");
    expect(a.signals[0]!.advice).toMatch(/Überweise nichts/);
  });

  it("erkennt die Abfrage von Bankdaten vor einem Gespräch", () => {
    const a = mit("Sende uns deine IBAN und eine Ausweiskopie für die Registrierung.");
    expect(a.level).toBe("additional_verification_recommended");
    expect(a.signals.map((s) => s.key)).toContain("sensitive_data_early");
  });

  it("erkennt Finanzagenten- und Paketagentenmaschen", () => {
    expect(mit("Du empfängst Gelder und leitest sie weiter.").signals.map((s) => s.key))
      .toContain("money_handling");
    expect(mit("Du nimmst Pakete an und leitest sie weiter.").signals.map((s) => s.key))
      .toContain("money_handling");
  });

  it("nennt zu jedem Signal die Fundstelle im Text", () => {
    // Ohne Zitat kann die Person den Hinweis nicht prüfen — und ein
    // Hinweis, den man nicht prüfen kann, ist eine Behauptung.
    const a = mit("Für die Schulung fällt eine Bearbeitungsgebühr an.");
    expect(a.signals[0]!.evidence).toContain("Bearbeitungsgebühr");
    expect(a.signals[0]!.evidence.length).toBeLessThan(200);
  });
});

describe("Mittlere Signale", () => {
  it("schlägt bei einem einzelnen mittleren Signal nicht Alarm", () => {
    // Einzeln haben diese Fälle harmlose Erklärungen. Ein Warnsystem,
    // das bei jedem zweiten Fall anschlägt, wird weggeklickt.
    const a = mit("Melde dich gern per WhatsApp, das geht bei uns am schnellsten.");
    expect(a.signals).toHaveLength(1);
    expect(a.level).toBe("normal_confidence");
  });

  it("schlägt bei zwei mittleren Signalen an", () => {
    const a = mit(
      "Melde dich nur über Telegram. Eine sofortige Zusage ohne Vorstellungsgespräch ist möglich.",
    );
    expect(a.signals.length).toBeGreaterThanOrEqual(2);
    expect(a.level).toBe("additional_verification_recommended");
  });

  it("erkennt auffällige Verdienstversprechen", () => {
    expect(mit("Verdiene 800 EUR pro Tag von zu Hause.").signals.map((s) => s.key))
      .toContain("unrealistic_pay");
  });
});

describe("Gegenproben", () => {
  it("lässt eine gewöhnliche Anzeige in Ruhe", () => {
    const a = assessScamSignals(basis);
    expect(a.signals).toEqual([]);
    expect(a.level).toBe("normal_confidence");
    expect(a.summary).toBe("Nichts Auffälliges in der Anzeige.");
  });

  it("verwechselt ein genanntes Gehalt nicht mit einem Versprechen", () => {
    const a = mit("Wir zahlen 3.400 EUR brutto im Monat bei 38 Stunden.");
    expect(a.signals).toEqual([]);
  });

  it("hält eine erwähnte Fahrtkostenerstattung für unauffällig", () => {
    const a = mit("Fahrtkosten zum Vorstellungsgespräch erstatten wir dir.");
    expect(a.signals.filter((s) => s.severity === "hoch")).toEqual([]);
  });

  it("meldet einen Firmen-Mailkontakt nicht als Freemail", () => {
    const a = mit("Fragen an bewerbung@muster-gmbh.de.");
    expect(a.signals.map((s) => s.key)).not.toContain("free_mail_contact");
  });

  it("meldet eine Freemail-Adresse als Hinweis, nicht als Alarm", () => {
    const a = mit("Fragen an muster.personal@gmail.com.");
    expect(a.signals.map((s) => s.key)).toContain("free_mail_contact");
    expect(a.level).toBe("normal_confidence");
  });
});

describe("Einstufung", () => {
  it("vergibt „geprüfte Quelle“ nur bei verifizierter Domäne und sauberem Bild", () => {
    expect(
      assessScamSignals({ ...basis, fromEmployerFeed: true, employerDomainVerified: true }).level,
    ).toBe("verified_source");

    // Auch ein echtes Unternehmen kann eine schlecht formulierte
    // Anzeige schalten. Dann steht der Hinweis trotzdem.
    expect(
      assessScamSignals({
        ...basis,
        description: "Melde dich nur über Telegram.",
        fromEmployerFeed: true,
        employerDomainVerified: true,
      }).level,
    ).toBe("normal_confidence");
  });

  it("genügt eine direkte Quelle allein nicht", () => {
    expect(
      assessScamSignals({ ...basis, fromEmployerFeed: true, employerDomainVerified: false }).level,
    ).toBe("normal_confidence");
  });

  it("sagt nie „Betrug“", () => {
    // Wir können aus der Ferne nicht feststellen, ob eine Anzeige
    // betrügerisch ist. Wir können sagen, was in ihr steht.
    const a = mit("Überweise 249 EUR Bearbeitungsgebühr und sende deine IBAN.");
    const alles = [a.summary, ...a.signals.map((s) => `${s.label} ${s.advice}`)].join(" ");
    expect(alles).not.toMatch(/betrug|fake|scam|kriminell|unseriös/i);
  });

  it("erwähnt fehlendes HTTPS als Hinweis", () => {
    const a = assessScamSignals({ ...basis, originalUrl: "http://muster.example/jobs/1" });
    expect(a.signals.map((s) => s.key)).toContain("no_https");
    expect(a.level).toBe("normal_confidence");
  });
});
