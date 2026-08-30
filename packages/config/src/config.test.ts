import { describe, expect, it } from "vitest";
import type { Env } from "./env.ts";
import { brand, withBrand } from "./brand.ts";
import { integrationStatus, loadRuntimeConfig } from "./runtime.ts";

describe("brand", () => {
  it("liefert Standardnamen, wenn nichts konfiguriert ist", () => {
    expect(brand.name).toBeTruthy();
    expect(brand.assistantName).toBeTruthy();
  });

  it("ersetzt Platzhalter in Texten", () => {
    const out = withBrand("{assistant} von {brand} hilft dir.", {
      ...brand,
      name: "Testmarke",
      assistantName: "Ada",
    });
    expect(out).toBe("Ada von Testmarke hilft dir.");
  });
});

describe("runtime config", () => {
  it("startet ohne einen einzigen Schlüssel, aber ohne KI-Anbieter", () => {
    const cfg = loadRuntimeConfig({} as Env);
    expect(cfg.mode).toBe("demo");
    expect(cfg.db.driver).toBe("pglite");
    /*
     * "none", nicht "mock".
     *
     * Der simulierte Anbieter ist ersatzlos entfallen. Ohne
     * eingerichteten Anbieter antwortet Nina nicht — sie erfindet
     * nichts. Ein Wert namens "mock" hätte an dieser Stelle weiterhin
     * behauptet, es gäbe etwas, das antwortet.
     */
    expect(cfg.ai.provider).toBe("none");
    expect(cfg.mail.provider).toBe("draft");
  });

  it("meldet Integrationen ehrlich als nicht verbunden", () => {
    const cfg = loadRuntimeConfig({ AI_PROVIDER: "anthropic" } as Env);
    // Provider gewählt, aber kein Schlüssel: darf nicht als verbunden gelten.
    expect(integrationStatus(cfg).ai).toBe("not-connected");
  });

  it("weist Diktat im Browser nicht als vollwertige Sprachverbindung aus", () => {
    // "browser" ist eine echte, aber begrenzte Fähigkeit: Diktat auf dem
    // Gerät, keine sprechende Nina. Als "connected" ausgewiesen wäre es
    // genau die Verwechslung, die hier verboten ist.
    const cfg = loadRuntimeConfig({ VOICE_PROVIDER: "browser" } as Env);
    expect(integrationStatus(cfg).voice).toBe("dictation-only");
  });

  it("erkennt einen echten Provider erst mit Schlüssel", () => {
    const cfg = loadRuntimeConfig({
      AI_PROVIDER: "anthropic",
      ANTHROPIC_API_KEY: "test-schluessel",
    } as Env);
    expect(integrationStatus(cfg).ai).toBe("connected");
  });

  it("weist eine unbekannte Datenbank-Auswahl zurück", () => {
    expect(() => loadRuntimeConfig({ DATABASE_DRIVER: "mysql" } as Env)).toThrow();
  });
});
