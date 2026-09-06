import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { koennteEskalieren, tiefeAnalyse } from "./tiefeanalyse.ts";
import type { AiProvider } from "./provider.ts";
import type { RuntimeConfig } from "@paycheck/config";

const SCHEMA = z.object({ fit: z.number(), zuversicht: z.number() });

function cfg(ultra?: string): RuntimeConfig {
  return {
    ai: {
      provider: "openai",
      apiKey: "probe",
      modelInteractive: "gpt-5-mini",
      modelDeep: "gpt-5.6-sol",
      modelFast: "gpt-4.1-mini",
      modelRealtime: "gpt-realtime-2.1",
      modelEmbed: "text-embedding-3-large",
      modelInteractiveFallback: "gpt-4.1-mini",
      modelDeepFallback: "gpt-5",
      modelFastFallback: "gpt-5-mini",
      ...(ultra ? { modelUltraDeep: ultra } : {}),
    },
  } as unknown as RuntimeConfig;
}

/** Ein Anbieter, der je Aufruf ein anderes Ergebnis liefert. */
function anbieter(...antworten: { fit: number; zuversicht: number }[]): {
  provider: AiProvider;
  aufrufe: { modell?: string; eingabe: string }[];
} {
  const aufrufe: { modell?: string; eingabe: string }[] = [];
  let i = 0;
  const provider = {
    name: "probe",
    isLocal: true,
    structuredGenerate: vi.fn(async (o: Record<string, unknown>) => {
      aufrufe.push({
        modell: o.modell as string | undefined,
        eingabe: (o.messages as { content: string }[])[0]!.content,
      });
      return { data: antworten[Math.min(i++, antworten.length - 1)], usage: {} };
    }),
  } as unknown as AiProvider;
  return { provider, aufrufe };
}

const AUFTRAG = {
  aufgabe: "career_transition_analysis" as const,
  anweisung: "Beurteile.",
  fakten: "Vier Jahre Erfahrung, Branchenwechsel gewünscht.",
  schema: SCHEMA,
  schemaName: "probe",
  konfidenzAus: (e: { zuversicht: number }) => e.zuversicht,
};

describe("Tiefenanalyse", () => {
  it("läuft ohne eingerichtete Höchststufe genau einmal", async () => {
    const { provider, aufrufe } = anbieter({ fit: 70, zuversicht: 0.3 });
    const b = await tiefeAnalyse({
      ...AUFTRAG,
      cfg: cfg(),
      provider,
      last: { optionen: 6, widersprueche: 3 },
    });
    expect(aufrufe).toHaveLength(1);
    expect(b.zweitLief).toBe(false);
    expect(b.zweitmodell).toBeNull();
  });

  it("holt bei unsicherer und vielschichtiger Lage eine zweite Meinung", async () => {
    const { provider, aufrufe } = anbieter(
      { fit: 70, zuversicht: 0.3 },
      { fit: 68, zuversicht: 0.5 },
    );
    const b = await tiefeAnalyse({
      ...AUFTRAG,
      cfg: cfg("gpt-6-astra"),
      provider,
      last: { optionen: 6 },
    });
    expect(aufrufe).toHaveLength(2);
    expect(b.zweitmodell).toBe("gpt-6-astra");
    /* Beide sahen dieselben Fakten — und die zweite sah nichts sonst. */
    expect(aufrufe[0]!.eingabe).toBe(aufrufe[1]!.eingabe);
    expect(aufrufe[1]!.eingabe).not.toContain("70");
  });

  it("nennt beim zweiten Lauf ausdrücklich das Ultra-Modell", async () => {
    /*
     * Der Anbieter kennt keine Ultra-Stufe. Ohne diesen Namen liefe
     * die zweite Meinung mit demselben Modell wie die erste — und
     * wäre keine.
     */
    const { provider, aufrufe } = anbieter({ fit: 70, zuversicht: 0.2 }, { fit: 40, zuversicht: 0.6 });
    await tiefeAnalyse({ ...AUFTRAG, cfg: cfg("gpt-6-astra"), provider, last: { optionen: 6 } });
    expect(aufrufe[0]!.modell).toBeUndefined();
    expect(aufrufe[1]!.modell).toBe("gpt-6-astra");
  });

  it("macht eine Uneinigkeit sichtbar, statt zu entscheiden", async () => {
    const { provider } = anbieter({ fit: 78, zuversicht: 0.2 }, { fit: 41, zuversicht: 0.6 });
    const b = await tiefeAnalyse({
      ...AUFTRAG,
      cfg: cfg("gpt-6-astra"),
      provider,
      last: { optionen: 6 },
    });
    expect(b.einig).toBe(false);
    expect(b.erst.fit).toBe(78);
    expect(b.zweit!.fit).toBe(41);
    expect(b.hinweis).toContain("fit");
  });

  it("bleibt bei klarer Lage bei einem Lauf", async () => {
    const { provider, aufrufe } = anbieter({ fit: 80, zuversicht: 0.95 });
    const b = await tiefeAnalyse({
      ...AUFTRAG,
      cfg: cfg("gpt-6-astra"),
      provider,
      last: { optionen: 2 },
    });
    expect(aufrufe).toHaveLength(1);
    expect(b.zweitLief).toBe(false);
  });
});

describe("Vorabprüfung", () => {
  it("sagt ohne Ausführung, ob eine Eskalation möglich wäre", async () => {
    expect(
      koennteEskalieren(cfg("gpt-6-astra"), "career_transition_analysis", {
        optionen: 6,
        konfidenz: 0.2,
      }),
    ).toBe(true);
    expect(
      koennteEskalieren(cfg(), "career_transition_analysis", { optionen: 6, konfidenz: 0.2 }),
    ).toBe(false);
    expect(koennteEskalieren(cfg("gpt-6-astra"), "nina_chat", { optionen: 9 })).toBe(false);
  });
});
