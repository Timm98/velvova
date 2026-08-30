import { describe, expect, it } from "vitest";
import {
  StimmeFehlgeschlagenError,
  inSprechstücke,
  istStimmeEingerichtet,
  stimmenkonfigurationsproblem,
} from "./voice.ts";

/** Eine Konfiguration bauen, ohne die echte zu lesen. */
function cfg(tts: { apiKey?: string; voiceId?: string; modelId?: string }) {
  return {
    voice: { provider: "browser", storeTranscripts: false, tts: { modelId: "m", ...tts } },
  } as never;
}

describe("Sprachkonfiguration", () => {
  it("nennt die fehlende Variable beim Namen, nie ihren Wert", () => {
    expect(stimmenkonfigurationsproblem(cfg({ voiceId: "v" }))).toEqual({
      missingVariable: "ELEVENLABS_API_KEY",
    });
    expect(stimmenkonfigurationsproblem(cfg({ apiKey: "k" }))).toEqual({
      missingVariable: "ELEVENLABS_VOICE_ID",
    });
  });

  it("gilt erst mit Schlüssel UND Stimme als eingerichtet", () => {
    expect(istStimmeEingerichtet(cfg({}))).toBe(false);
    expect(istStimmeEingerichtet(cfg({ apiKey: "k" }))).toBe(false);
    expect(istStimmeEingerichtet(cfg({ apiKey: "k", voiceId: "v" }))).toBe(true);
  });
});

describe("Fehlermeldung", () => {
  it("enthält nur den Statuscode, keinen Anbietertext", () => {
    /*
     * Fehlermeldungen wandern in Protokolle und manchmal bis zur
     * Oberfläche. Ein Anbieter, der bei einem ungültigen Schlüssel den
     * Schlüssel zurückspiegelt, hätte ihn dann dort stehen.
     */
    const f = new StimmeFehlgeschlagenError(401);
    expect(f.message).toBe("Die Sprachausgabe antwortete mit 401.");
    expect(f.message).not.toMatch(/sk_|xi-api-key/);
  });
});

describe("inSprechstücke", () => {
  it("schneidet an Satzenden, nie mitten im Wort", () => {
    const stücke = inSprechstücke(
      "Das ist ein erster Satz mit einigen Wörtern darin. Und hier folgt der zweite Satz. " +
        "Der dritte kommt danach und ist ebenfalls lang genug.",
      60,
    );
    expect(stücke.length).toBeGreaterThan(1);
    for (const s of stücke) {
      // Kein Stück endet mitten in einem Wort.
      expect(s).toMatch(/[.!?…"»)\]]$|\w$/);
      expect(s.trim()).toBe(s);
    }
  });

  it("verliert keinen Text", () => {
    const text = "Erster Satz. Zweiter Satz! Dritter Satz? Vierter ohne Punkt";
    const zusammen = inSprechstücke(text, 20).join(" ").replace(/\s+/g, " ");
    expect(zusammen.replace(/\s/g, "")).toBe(text.replace(/\s/g, ""));
  });

  it("erzeugt aus einem kurzen Satz genau ein Stück", () => {
    // Sonst entstünde eine Kette von Schnipseln mit hörbaren Lücken.
    expect(inSprechstücke("Kurz.", 120)).toEqual(["Kurz."]);
  });

  it("gibt bei leerem Text nichts zurück", () => {
    expect(inSprechstücke("")).toEqual([]);
    expect(inSprechstücke("   ")).toEqual([]);
  });
});
