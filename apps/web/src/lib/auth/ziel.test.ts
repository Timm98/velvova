import { describe, expect, it } from "vitest";
import { zielNachLogin } from "./ziel.ts";

/*
 * Diese Verzweigung entscheidet, ob jemand nach dem Anmelden bei der
 * Stelle landet, wegen der er gekommen ist — oder auf einer Liste, auf
 * der er sie erst wiederfinden muss.
 */
describe("zielNachLogin", () => {
  it("nimmt das Ziel, wenn das Onboarding fertig ist", () => {
    expect(zielNachLogin("/app/jobs", "/app/jobs/abc")).toBe("/app/jobs/abc");
  });

  it("führt ins Setup, auch wenn ein Ziel mitkommt", () => {
    expect(zielNachLogin("/monday-einrichten", "/app/jobs/abc")).toBe("/monday-einrichten");
  });

  it("nimmt den Einstiegspunkt, wenn kein Ziel mitkommt", () => {
    expect(zielNachLogin("/app/monday", null)).toBe("/app/monday");
  });

  it("lässt das Ziel auch bei offenem Interview gewinnen", () => {
    expect(zielNachLogin("/app/monday", "/app/jobs/xyz")).toBe("/app/jobs/xyz");
  });
});
