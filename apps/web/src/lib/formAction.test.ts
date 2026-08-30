import { describe, expect, it } from "vitest";
import { __test, withRedirectSafety } from "./formAction.ts";

/**
 * `redirect()` in einer Server Action bricht die laufende Anfrage ab.
 * WebKit meldet das als `TypeError: Load failed`, und React reicht es
 * an die nächste Fehlergrenze weiter.
 *
 * Für die Person sah das so aus: sie legt ein Konto an, kurz erscheint
 * „Da ist etwas schiefgegangen", dann ist sie angemeldet. Die
 * Registrierung hatte funktioniert — nur der Bildschirm behauptete das
 * Gegenteil.
 *
 * Die Gegenprobe ist hier wichtiger als der Erfolgsfall: ein echter
 * Fehler darf nicht mitverschluckt werden.
 */

const { istNavigationsabbruch } = __test;

const typeError = (msg: string) => {
  const e = new TypeError(msg);
  return e;
};

describe("Abbruch durch Weiterleitung erkennen", () => {
  it("erkennt die Meldungen der Browser", () => {
    expect(istNavigationsabbruch(typeError("Load failed"))).toBe(true);          // WebKit
    expect(istNavigationsabbruch(typeError("Failed to fetch"))).toBe(true);      // Chromium
    expect(istNavigationsabbruch(typeError("NetworkError when attempting to fetch resource."))).toBe(true);
  });

  it("erkennt einen ausdrücklichen Abbruch", () => {
    const e = new Error("The operation was aborted.");
    e.name = "AbortError";
    expect(istNavigationsabbruch(e)).toBe(true);
  });

  it("verschluckt keinen echten Serverfehler", () => {
    // Der teure Fall: ein Fehler aus dem Anwendungscode, der nur zufällig
    // ähnlich klingt, darf nicht stillschweigend verschwinden.
    expect(istNavigationsabbruch(new Error("Load failed"))).toBe(false);
    expect(istNavigationsabbruch(typeError("Cannot read properties of undefined"))).toBe(false);
    expect(istNavigationsabbruch(new RangeError("Load failed"))).toBe(false);
  });

  it("hält nichts für einen Abbruch, was kein Fehler ist", () => {
    expect(istNavigationsabbruch("Load failed")).toBe(false);
    expect(istNavigationsabbruch(null)).toBe(false);
    expect(istNavigationsabbruch(undefined)).toBe(false);
  });
});

describe("Hülle", () => {
  it("reicht den Erfolgsfall durch", async () => {
    const action = withRedirectSafety(async (_s: string, p: string) => `ok:${p}`);
    expect(await action("vorher", "eingabe")).toBe("ok:eingabe");
  });

  it("behält den vorigen Zustand bei einem Abbruch", async () => {
    const action = withRedirectSafety<string, string>(async () => {
      throw typeError("Load failed");
    });
    expect(await action("vorher", "eingabe")).toBe("vorher");
  });

  it("lässt einen echten Fehler durch", async () => {
    const action = withRedirectSafety<string, string>(async () => {
      throw new Error("Die Datenbank ist nicht erreichbar.");
    });
    await expect(action("vorher", "eingabe")).rejects.toThrow(/Datenbank/);
  });
});
