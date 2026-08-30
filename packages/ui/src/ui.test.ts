import { describe, expect, it } from "vitest";
import { toneForApplicationStage, toneForClaimStatus, toneForConstraintVerdict, truncate } from "./index.ts";

describe("Zustandstoene", () => {
  it("ordnet jedem Bewerbungsstand denselben Ton zu", () => {
    expect(toneForApplicationStage("offer")).toBe("positive");
    expect(toneForApplicationStage("rejected")).toBe("neutral");
    expect(toneForApplicationStage("interview")).toBe("accent");
  });

  it("markiert eine verletzte Bedingung als kritisch", () => {
    expect(toneForConstraintVerdict("blocked")).toBe("critical");
    expect(toneForConstraintVerdict("uncertain")).toBe("neutral");
  });

  it("markiert eine unbelegte Aussage als kritisch", () => {
    expect(toneForClaimStatus("unsupported")).toBe("critical");
    expect(toneForClaimStatus("needs_confirmation")).toBe("caution");
  });
});

describe("Kuerzen", () => {
  it("laesst kurzen Text unangetastet", () => {
    expect(truncate("kurz", 20)).toBe("kurz");
  });

  it("kuerzt an der Wortgrenze, nicht mitten im Wort", () => {
    const original = "Zwei Jahre Kundenbetreuung im Kundenservice";
    const out = truncate(original, 20);

    expect(out.endsWith("…")).toBe(true);

    // Die eigentliche Zusage: der gekuerzte Teil endet dort, wo im
    // Original ein Wort endet - also folgt ein Leerzeichen oder das Ende.
    const kept = out.slice(0, -1);
    expect(original.startsWith(kept)).toBe(true);
    const nextChar = original.charAt(kept.length);
    expect(nextChar === "" || nextChar === " ", `schneidet mitten im Wort: "${out}"`).toBe(true);
  });

  it("schneidet ein einzelnes ueberlanges Wort hart ab", () => {
    const out = truncate("Donaudampfschifffahrtsgesellschaftskapitaen", 10);
    expect(out).toBe("Donaudampf…");
  });
});
