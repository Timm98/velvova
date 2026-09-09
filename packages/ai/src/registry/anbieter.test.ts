import { describe, expect, it } from "vitest";
import { KATALOG } from "./katalog.ts";
import { ModellNichtVerfuegbarError, adapterplan } from "./anbieter.ts";
import type { Umgebung } from "./registry.ts";

const finde = (id: string) => {
  const m = KATALOG.find((k) => k.internId === id);
  if (!m) throw new Error(`Katalogeintrag ${id} fehlt`);
  return m;
};

const openai = finde("openai-arbeit");
const claude = finde("anthropic-spitze");
const gemini = finde("google-flash");

describe("Der Adapterplan", () => {
  it("bindet den Aufruf an die API-Kennung des gewählten Modells", () => {
    const plan = adapterplan(claude, { ANTHROPIC_API_KEY: "sk-ant" });
    expect(plan.anbieter).toBe("anthropic");
    expect(plan.apiModellId).toBe(claude.apiModellId);
  });

  it("nimmt für jeden Anbieter den eigenen Schlüssel", () => {
    /*
     * Ein gemeinsamer Schlüsselname wäre die Sorte Abkürzung, bei der
     * irgendwann der falsche Schlüssel an den falschen Anbieter geht.
     */
    const env: Umgebung = { OPENAI_API_KEY: "sk-oa", ANTHROPIC_API_KEY: "sk-ant" };
    expect(adapterplan(openai, env).schluessel).toBe("sk-oa");
    expect(adapterplan(claude, env).schluessel).toBe("sk-ant");
  });
});

describe("Was schiefgehen kann, geht laut schief", () => {
  it("plant auch für Google, seit es dort einen Adapter gibt", () => {
    const plan = adapterplan(gemini, { GEMINI_API_KEY: "gm" });
    expect(plan.anbieter).toBe("google");
    expect(plan.apiModellId).toBe(gemini.apiModellId);
  });

  it("verweigert einen Anbieter, für den es keinen Adapter gibt", () => {
    /*
     * `Anbieter` ist eine geschlossene Aufzählung, ein vierter
     * Anbieter also nur über die Typgrenze hinweg zu bauen. Genau so
     * käme er aber auch in echt an: als Katalogeintrag, den jemand
     * geschrieben hat, bevor der Adapter da war.
     */
    const erfunden = { ...openai, internId: "x", anbieter: "cohere" } as unknown as typeof openai;
    expect(() => adapterplan(erfunden, { OPENAI_API_KEY: "sk" })).toThrow(
      ModellNichtVerfuegbarError,
    );
  });

  it("nennt bei fehlendem Adapter nicht den Schlüssel als Ursache", () => {
    /*
     * Sonst besorgt jemand einen Schlüssel, der nichts nützt — der
     * Adapter fehlt ja weiterhin.
     */
    const erfunden = { ...openai, anbieter: "cohere" } as unknown as typeof openai;
    try {
      adapterplan(erfunden, {});
      expect.unreachable("hätte werfen müssen");
    } catch (e) {
      expect((e as Error).message).toMatch(/Adapter/);
      expect((e as Error).message).not.toMatch(/Schlüssel gesetzt/);
    }
  });

  it("verweigert ein Modell ohne Schlüssel", () => {
    expect(() => adapterplan(openai, {})).toThrow(ModellNichtVerfuegbarError);
  });

  it("behandelt einen leeren Schlüssel wie einen fehlenden", () => {
    /* Eine gesetzte, aber leere Variable ist der häufigste Fall in CI. */
    expect(() => adapterplan(openai, { OPENAI_API_KEY: "   " })).toThrow(
      ModellNichtVerfuegbarError,
    );
  });

  it("schreibt den Schlüsselwert in keine Fehlermeldung", () => {
    /*
     * Diese Meldungen landen in Protokollen. Der Name der Variablen
     * gehört hinein, ihr Wert nie.
     */
    const erfunden = { ...openai, anbieter: "cohere" } as unknown as typeof openai;
    try {
      adapterplan(erfunden, { OPENAI_API_KEY: "sk-geheim-123" });
      expect.unreachable("hätte werfen müssen");
    } catch (e) {
      expect((e as Error).message).not.toContain("sk-geheim-123");
    }
    try {
      adapterplan(openai, {});
      expect.unreachable("hätte werfen müssen");
    } catch (e) {
      expect((e as Error).message).toContain("OPENAI_API_KEY");
    }
  });
});
