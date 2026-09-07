import { describe, expect, it } from "vitest";
import { entryRoute, sanitiseRoute } from "./workflow-state.ts";

/**
 * Die Weiterleitung nach dem Login.
 *
 * Genau eine Regel hat das Produkt vorher falsch gehabt, und sie steht
 * hier zuerst: wer sein Interview abgeschlossen hat, landet nicht
 * wieder im Interview. Das war kein Sonderfall, sondern der Normalfall
 * — jeder wiederkehrende Mensch war betroffen.
 */
describe("entryRoute", () => {
  const basis = {
    onboardingComplete: true,
    careerInterviewStatus: "not_started" as const,
    lastActiveRoute: null,
  };

  it("schickt ohne abgeschlossenes Onboarding ins Setup", () => {
    expect(entryRoute({ ...basis, onboardingComplete: false })).toBe("/monday-einrichten");
  });

  it("beginnt das Gespräch, wenn es noch nie lief", () => {
    expect(entryRoute(basis)).toBe("/app/monday");
  });

  it("setzt ein unterbrochenes Gespräch fort", () => {
    expect(entryRoute({ ...basis, careerInterviewStatus: "in_progress" })).toBe("/app/monday");
    expect(entryRoute({ ...basis, careerInterviewStatus: "paused" })).toBe("/app/monday");
  });

  it("führt ein abgeschlossenes Gespräch zur Jobliste, nicht zurück ins Interview", () => {
    expect(entryRoute({ ...basis, careerInterviewStatus: "completed" })).toBe("/app/jobs");
  });

  it("nimmt bei abgeschlossenem Gespräch die zuletzt besuchte Seite", () => {
    expect(
      entryRoute({
        ...basis,
        careerInterviewStatus: "completed",
        lastActiveRoute: "/app/applications",
      }),
    ).toBe("/app/applications");
  });

  it("führt auch über die zuletzt besuchte Seite NICHT zurück ins Interview", () => {
    // Ohne diese Ausnahme wäre die Regel oben wirkungslos: wer zuletzt
    // im Gespräch war — und das ist jeder, der es gerade abgeschlossen
    // hat —, käme über den Umweg wieder dort heraus.
    expect(
      entryRoute({
        ...basis,
        careerInterviewStatus: "completed",
        lastActiveRoute: "/app/monday",
      }),
    ).toBe("/app/jobs");
  });

  it("führt zur Profilprüfung, wenn etwas geklärt werden muss", () => {
    expect(entryRoute({ ...basis, careerInterviewStatus: "needs_review" })).toBe("/app/career");
  });
});

describe("sanitiseRoute", () => {
  it("wirft den Anfrageteil weg", () => {
    // Eine Suchanfrage in einer URL ist eine Aussage über den Menschen
    // („Teilzeit“, „Wiedereinstieg“). Sie gehört nicht in eine Spalte,
    // die beim nächsten Login automatisch aufgerufen wird.
    expect(sanitiseRoute("/app/jobs?q=teilzeit%20wiedereinstieg")).toBe("/app/jobs");
    expect(sanitiseRoute("/app/jobs#treffer-3")).toBe("/app/jobs");
  });

  it("nimmt nur Routen innerhalb der Anwendung", () => {
    expect(sanitiseRoute("https://beispiel.test/boese")).toBeNull();
    expect(sanitiseRoute("/login")).toBeNull();
    expect(sanitiseRoute("//fremde-domain.test")).toBeNull();
  });

  it("verwirft leere und überlange Werte", () => {
    expect(sanitiseRoute(null)).toBeNull();
    expect(sanitiseRoute("")).toBeNull();
    expect(sanitiseRoute("/app/" + "x".repeat(300))).toBeNull();
  });
});
