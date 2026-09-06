import { describe, expect, it } from "vitest";
import { absichtErkennen } from "./absicht";

const a = (t: string) => absichtErkennen(t).absicht;

describe("absichtErkennen", () => {
  it("erkennt eine Angabe mit Zahl", () => {
    expect(a("Ich verdiene gerade ungefähr 62k")).toBe("profil_angabe");
    expect(a("Zwei Tage Homeoffice wären mir wichtig")).toBe("profil_angabe");
  });

  it("hält einen Satz ohne Zahl für Unterhaltung", () => {
    /* „Ich bin unzufrieden" ist eine Angabe — aber keine, die sich
       als Wert speichern liesse. */
    expect(a("Ich bin gerade ziemlich unzufrieden im Job")).toBe("unterhaltung");
  });

  it("hält eine Zahl ohne Selbstbezug für Unterhaltung", () => {
    expect(a("Die Stelle zahlt 70.000 Euro")).toBe("unterhaltung");
  });

  it("erkennt die Frage nach der Begründung", () => {
    expect(a("Warum passt diese Stelle zu mir?")).toBe("match_erklaerung");
  });

  it("erkennt eine Ablehnung", () => {
    expect(a("Das passt nicht")).toBe("rueckmeldung");
    expect(a("Zu weit weg")).toBe("rueckmeldung");
  });

  it("erkennt eine Handlung", () => {
    expect(a("Bewirb mich da")).toBe("handlung");
    expect(a("Merk dir die Stelle")).toBe("handlung");
  });

  it("erkennt eine Suche", () => {
    expect(a("Zeig mir Stellen in Karlsruhe")).toBe("jobsuche");
  });

  it("erkennt die Frage nach dem Profil", () => {
    expect(a("Was weisst du über mich?")).toBe("profil_frage");
  });

  it("nimmt im Zweifel Unterhaltung", () => {
    /* Eine falsch erkannte Absicht schreibt etwas ins Profil, das
       niemand sagen wollte. Eine nicht erkannte kostet eine
       Rückfrage. */
    expect(a("Guten Morgen")).toBe("unterhaltung");
    expect(a("Danke, das hilft")).toBe("unterhaltung");
    expect(a("")).toBe("unterhaltung");
  });

  it("stellt Handlung vor Suche", () => {
    /* „Bewirb mich auf die Stelle" enthält beides. Die Handlung wiegt
       schwerer — sie hat Folgen. */
    expect(a("Bewirb mich auf die Stelle in Karlsruhe")).toBe("handlung");
  });

  it("begründet jede Erkennung", () => {
    expect(absichtErkennen("Zeig mir Jobs").grund.length).toBeGreaterThan(5);
  });
});
