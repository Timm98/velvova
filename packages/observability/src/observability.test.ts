import { describe, expect, it, vi } from "vitest";
import { NullAnalyticsAdapter, redact, redactText, track } from "./index.ts";

describe("Redaktion", () => {
  it("entfernt direkte Identifikatoren aus Text", () => {
    const out = redactText("Kontakt: lea@example.invalid, Tel 040 123456789, IP 192.168.0.4");
    expect(out).not.toContain("lea@example.invalid");
    expect(out).toContain("[E-Mail]");
    expect(out).toContain("[Telefon]");
    expect(out).toContain("[IP]");
  });

  it("ersetzt Geheimnisfelder vollstaendig", () => {
    const out = redact({ email: "a@b.invalid", password: "geheim", tokenHash: "abc" }) as Record<string, unknown>;
    expect(out.password).toBe("[entfernt]");
    expect(out.tokenHash).toBe("[entfernt]");
  });

  it("entfernt Freitextfelder, die Nutzerinhalte tragen", () => {
    const out = redact({ answer: "Meine Lebensgeschichte", statement: "Zwei Jahre..." }) as Record<string, unknown>;
    expect(out.answer).toBe("[entfernt]");
    expect(out.statement).toBe("[entfernt]");
  });

  it("bricht bei zu tiefer Verschachtelung ab", () => {
    let deep: unknown = "x";
    for (let i = 0; i < 10; i++) deep = { n: deep };
    expect(JSON.stringify(redact(deep))).toContain("zu tief");
  });
});

describe("Nutzungsmessung", () => {
  it("misst ohne Einwilligung gar nichts", async () => {
    const adapter = new NullAnalyticsAdapter();
    const spy = vi.spyOn(adapter, "track");
    const r = await track({ adapter, hasConsent: false }, "job_viewed", "s1", { x: 1 });
    expect(r.tracked).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  it("laesst lange Freitexte nicht durch", async () => {
    const adapter = new NullAnalyticsAdapter();
    const spy = vi.spyOn(adapter, "track");
    await track({ adapter, hasConsent: true }, "job_viewed", "s1", {
      kurz: "ok",
      lang: "x".repeat(200),
    });
    expect(spy).toHaveBeenCalledWith("job_viewed", "s1", { kurz: "ok" });
  });
});
