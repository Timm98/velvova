import { describe, expect, it } from "vitest";
import { isStale } from "./matching.ts";

/**
 * §24B: eine abgelaufene oder entfernte Stelle verschwindet aus dem
 * Ranking.
 *
 * Der Grund ist nicht Ordnungsliebe. Eine Bewerbung auf eine tote
 * Anzeige kostet eine Stunde Arbeit und bringt nicht einmal eine
 * Absage — sie verschwindet. Wer ohnehin unter Druck steht, darf diese
 * Stunde nicht von uns bekommen.
 */

const stelle = (over: Partial<Parameters<typeof isStale>[0]> = {}) =>
  ({ expiresAt: null, lastLinkCheckOk: null, ...over }) as Parameters<typeof isStale>[0];

const jetzt = new Date("2026-08-30T12:00:00Z");

describe("Aktualität einer Stelle", () => {
  it("hält eine Anzeige ohne Ablaufdatum für aktuell", () => {
    expect(isStale(stelle(), jetzt)).toBe(false);
  });

  it("erkennt ein überschrittenes Ablaufdatum", () => {
    expect(isStale(stelle({ expiresAt: new Date("2026-08-29T23:59:00Z") }), jetzt)).toBe(true);
  });

  it("lässt eine Anzeige gelten, die heute noch läuft", () => {
    expect(isStale(stelle({ expiresAt: new Date("2026-08-30T23:59:00Z") }), jetzt)).toBe(false);
  });

  it("erkennt eine tote Verknüpfung", () => {
    expect(isStale(stelle({ lastLinkCheckOk: false }), jetzt)).toBe(true);
  });

  it("verwechselt eine ungeprüfte Verknüpfung nicht mit einer toten", () => {
    // null heisst "noch nie geprüft", nicht "kaputt". Der Unterschied
    // entscheidet, ob eine frisch eingelesene Stelle überhaupt
    // erscheint — bei einer Verwechslung wäre die Liste leer.
    expect(isStale(stelle({ lastLinkCheckOk: null }), jetzt)).toBe(false);
  });
});
