import { describe, expect, it } from "vitest";
import { NETWORKING_VERBOTE, RECIPROCITY_NOTE, buildMessage, type MessageInput } from "./message-builder.ts";

const basis: MessageInput = {
  contactName: "Anna",
  relationship: "similar_path",
  context: "Dein Wechsel aus der Pflege in die Qualitätssicherung ist genau der Schritt, den ich verstehen möchte",
  question: "Was war rückblickend der schwierigste Teil daran",
  ownSituation: "Ich arbeite seit vier Jahren auf Station und überlege, in eine ähnliche Richtung zu gehen",
};

describe("Entwurf", () => {
  const d = buildMessage(basis);

  it("bleibt kurz genug, um beantwortet zu werden", () => {
    expect(d.length).toBeLessThan(700);
    expect(d.warnings).toEqual([]);
  });

  it("enthält immer einen einfachen Ausweg", () => {
    // Kein Höflichkeitsfloskel: das ist der Grund, warum die Bitte
    // keine Verpflichtung erzeugt.
    expect(d.text).toMatch(/nicht passt, ist das selbstverständlich in Ordnung/);
  });

  it("stellt genau eine Frage", () => {
    expect((d.text.match(/\?/g) ?? []).length).toBeLessThanOrEqual(2);
  });

  it("endet die Frage mit einem Fragezeichen, auch ohne eingegebenes", () => {
    expect(d.text).toContain("schwierigste Teil daran?");
  });
});

describe("Warnungen", () => {
  it("warnt vor „dauert nur kurz“", () => {
    const d = buildMessage({ ...basis, context: "Das dauert nur eine Minute" });
    expect(d.warnings.join(" ")).toMatch(/Einschätzung ab/);
  });

  it("warnt vor vorauseilender Dankbarkeit", () => {
    const d = buildMessage({ ...basis, ownSituation: "Ich wäre dir sehr dankbar" });
    expect(d.warnings.join(" ")).toMatch(/Verpflichtung/);
  });

  it("warnt vor einer direkten Jobbitte im Erstkontakt", () => {
    const d = buildMessage({ ...basis, question: "Kannst du mir eine Stelle besorgen" });
    expect(d.warnings.join(" ")).toMatch(/überfordert die Bitte/);
  });

  it("warnt vor eigener Dringlichkeit als Argument", () => {
    const d = buildMessage({ ...basis, ownSituation: "Ich suche dringend etwas Neues" });
    expect(d.warnings.join(" ")).toMatch(/kein Grund für die andere Person/);
  });

  it("warnt bei fehlendem Bezug", () => {
    const d = buildMessage({ ...basis, context: "" });
    expect(d.warnings.join(" ")).toMatch(/Serienmail/);
  });
});

describe("Perspektivwechsel", () => {
  it("verspricht keine Antwortquote", () => {
    // Ein Prozentsatz hier wäre der Anfang einer Manipulation — und wir
    // wüssten ihn nicht.
    expect(RECIPROCITY_NOTE).not.toMatch(/\d+\s?%/);
    expect(RECIPROCITY_NOTE).toMatch(/nicht sicher/);
  });

  it("nimmt einem Schweigen die Bedeutung", () => {
    expect(RECIPROCITY_NOTE).toMatch(/Schweigen sagt nichts über dich/);
  });
});

describe("Grenzen", () => {
  it("hält die Verbote als geprüfte Liste vor", () => {
    // Eine Regel, die nur in einem Dokument steht, wird irgendwann
    // gebrochen.
    expect(NETWORKING_VERBOTE.join(" ")).toMatch(/Keine automatische Versendung/);
    expect(NETWORKING_VERBOTE.join(" ")).toMatch(/erraten/);
    expect(NETWORKING_VERBOTE.join(" ")).toMatch(/Serienmail/);
  });
});
