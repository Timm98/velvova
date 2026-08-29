import { describe, expect, it } from "vitest";
import type { Env } from "./env.js";
import { brand, withBrand } from "./brand.js";
import { integrationStatus, loadRuntimeConfig } from "./runtime.js";

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
  it("startet ohne einen einzigen Schluessel im Demo-Modus", () => {
    const cfg = loadRuntimeConfig({} as Env);
    expect(cfg.mode).toBe("demo");
    expect(cfg.db.driver).toBe("pglite");
    expect(cfg.ai.provider).toBe("mock");
    expect(cfg.mail.provider).toBe("draft");
  });

  it("meldet Integrationen ehrlich als nicht verbunden", () => {
    const cfg = loadRuntimeConfig({ AI_PROVIDER: "anthropic" } as Env);
    // Provider gewaehlt, aber kein Schluessel: darf nicht als verbunden gelten.
    expect(integrationStatus(cfg).ai).toBe("mock");
  });

  it("erkennt einen echten Provider erst mit Schluessel", () => {
    const cfg = loadRuntimeConfig({
      AI_PROVIDER: "anthropic",
      ANTHROPIC_API_KEY: "test-schluessel",
    } as Env);
    expect(integrationStatus(cfg).ai).toBe("connected");
  });

  it("weist eine unbekannte Datenbank-Auswahl zurueck", () => {
    expect(() => loadRuntimeConfig({ DATABASE_DRIVER: "mysql" } as Env)).toThrow();
  });
});
