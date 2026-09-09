import { beforeEach, describe, expect, it } from "vitest";
import {
  SCHALTERGRENZEN, alleSchalterlagen, anbieterGestoert, anbieterMelden,
  fehlerart, schalterlage, schalterZuruecksetzen,
} from "./anbieterbreaker.ts";

beforeEach(() => schalterZuruecksetzen());

describe("fehlerart", () => {
  it("erkennt eigene Fehler als eigene", () => {
    /* Der wichtigste Fall: Ein abgelehntes PDF darf keinen gesunden
       Anbieter aus dem Betrieb nehmen. */
    expect(fehlerart("400 invalid_request_error: unsupported file type")).toBe("eingabe");
    expect(fehlerart("context_length_exceeded")).toBe("eingabe");
  });

  it("erkennt Kontosachen", () => {
    expect(fehlerart("401 Unauthorized")).toBe("konto");
    expect(fehlerart("You exceeded your current quota")).toBe("konto");
    expect(fehlerart("Invalid API key provided")).toBe("konto");
  });

  it("hält den Rest für Überlast", () => {
    expect(fehlerart("429 Too Many Requests")).toBe("ueberlast");
    expect(fehlerart("503 Service Unavailable")).toBe("ueberlast");
    expect(fehlerart("The operation was aborted due to timeout")).toBe("ueberlast");
  });
});

describe("anbieterMelden", () => {
  it("zählt Eingabefehler gar nicht", () => {
    for (let i = 0; i < 10; i++) anbieterMelden("openai", false, "400 invalid_request_error");
    expect(anbieterGestoert("openai")).toBe(false);
    expect(schalterlage("openai").zustand).toBe("zu");
  });

  it("schliesst bei einem Kontofehler sofort", () => {
    /* Ein Schlüssel repariert sich nicht in dreissig Sekunden. Bis
       dahin ist jede weitere Anfrage vergeudet. */
    anbieterMelden("anthropic", false, "401 Unauthorized");
    expect(anbieterGestoert("anthropic")).toBe(true);
    expect(schalterlage("anthropic").ruheMs).toBe(SCHALTERGRENZEN.kontoRuheMs);
  });

  it("schliesst bei Überlast erst nach der Schwelle", () => {
    anbieterMelden("google", false, "429");
    anbieterMelden("google", false, "429");
    expect(anbieterGestoert("google")).toBe(false);
    anbieterMelden("google", false, "429");
    expect(anbieterGestoert("google")).toBe(true);
  });

  it("macht ein Erfolg alles wieder gut", () => {
    anbieterMelden("openai", false, "429");
    anbieterMelden("openai", false, "429");
    anbieterMelden("openai", true);
    anbieterMelden("openai", false, "429");
    expect(anbieterGestoert("openai")).toBe(false);
    expect(schalterlage("openai").fehler).toBe(1);
  });
});

describe("die Probe nach der Ruhezeit", () => {
  function oeffnen(jetzt: number) {
    for (let i = 0; i < SCHALTERGRENZEN.schwelle; i++)
      anbieterMelden("openai", false, "429", SCHALTERGRENZEN, jetzt);
  }

  it("lässt nach Ablauf genau einen durch, nicht alle", () => {
    /* Sonst träfe die volle Last einen Anbieter, von dem wir nur
       vermuten, dass er wieder kann — der Schalter hätte den
       Zusammenbruch bloss verschoben. */
    const t0 = 1_000_000;
    oeffnen(t0);
    const danach = t0 + SCHALTERGRENZEN.ruheMs + 1;
    expect(anbieterGestoert("openai", danach)).toBe(false);
    expect(anbieterGestoert("openai", danach)).toBe(true);
    expect(anbieterGestoert("openai", danach)).toBe(true);
  });

  it("verdoppelt die Ruhezeit, wenn die Probe scheitert", () => {
    const t0 = 1_000_000;
    oeffnen(t0);
    const danach = t0 + SCHALTERGRENZEN.ruheMs + 1;
    anbieterGestoert("openai", danach);
    anbieterMelden("openai", false, "429", SCHALTERGRENZEN, danach);
    expect(schalterlage("openai", danach).ruheMs).toBe(SCHALTERGRENZEN.ruheMs * 2);
  });

  it("öffnet wieder ganz, wenn die Probe gelingt", () => {
    const t0 = 1_000_000;
    oeffnen(t0);
    const danach = t0 + SCHALTERGRENZEN.ruheMs + 1;
    anbieterGestoert("openai", danach);
    anbieterMelden("openai", true, "", SCHALTERGRENZEN, danach);
    expect(schalterlage("openai", danach).zustand).toBe("zu");
    expect(anbieterGestoert("openai", danach)).toBe(false);
  });

  it("wächst nicht über die Obergrenze hinaus", () => {
    let t = 1_000_000;
    oeffnen(t);
    for (let i = 0; i < 20; i++) {
      t += schalterlage("openai", t).ruheMs + 1;
      anbieterGestoert("openai", t);
      anbieterMelden("openai", false, "429", SCHALTERGRENZEN, t);
    }
    expect(schalterlage("openai", t).ruheMs).toBe(SCHALTERGRENZEN.maxRuheMs);
  });
});

describe("alleSchalterlagen", () => {
  it("zeigt dem Betreiber, wer gerade draussen ist", () => {
    anbieterMelden("anthropic", false, "401");
    anbieterMelden("openai", true);
    const lagen = Object.fromEntries(alleSchalterlagen().map((l) => [l.anbieter, l.lage.zustand]));
    expect(lagen.anthropic).toBe("offen");
    expect(lagen.openai).toBe("zu");
  });
});

/*
 * ══════════════════════════════════════════════════════════════════
 * Die Verdrahtung — der Teil, der sonst fehlt
 * ══════════════════════════════════════════════════════════════════
 *
 * Ein Schalter, den niemand liest, ist eine Statistik. Alle Tests
 * darüber können grün sein, während der Router unbeirrt weiter an den
 * ausgefallenen Anbieter schickt.
 *
 * Dieser Test geht deshalb nicht über den Schalter, sondern über die
 * Auswahl: Fällt OpenAI aus, darf kein OpenAI-Modell mehr vorne
 * stehen.
 */
describe("Wirkung auf die Auswahl", () => {
  const env = {
    OPENAI_API_KEY: "x", ANTHROPIC_API_KEY: "x", GEMINI_API_KEY: "x",
    MONDAY_OPENAI_PRODUCTION_APPROVED: "true",
    MONDAY_ANTHROPIC_PRODUCTION_APPROVED: "true",
    MONDAY_GOOGLE_PRODUCTION_APPROVED: "true",
  };

  it("nimmt einen gestörten Anbieter aus der automatischen Auswahl", async () => {
    const { rangfolge } = await import("./registry.ts");

    const vorher = rangfolge({ task: "conversation" }, env);
    expect(vorher.some((r) => r.modell.anbieter === "openai")).toBe(true);

    anbieterMelden("openai", false, "401 Unauthorized");

    const nachher = rangfolge({ task: "conversation" }, env);
    expect(nachher.some((r) => r.modell.anbieter === "openai")).toBe(false);
    /* Und es bleibt etwas übrig — genau dafür gibt es die Registry. */
    expect(nachher.length).toBeGreaterThan(0);
  });

  it("lässt eine ausdrückliche Modellwahl trotzdem durch", async () => {
    /* Sie ist eine Handlung eines Menschen, keine Schleife — und
       zugleich die Probe, die den Schalter wieder öffnet. */
    const { modellAuswaehlen, anbietbareModelle } = await import("./registry.ts");
    anbieterMelden("openai", false, "401 Unauthorized");

    const eines = anbietbareModelle(env).find((m) => m.anbieter === "openai");
    expect(eines).toBeDefined();
    expect(modellAuswaehlen(eines!.internId, env)).not.toBeNull();
  });
});

/*
 * ══════════════════════════════════════════════════════════════════
 * Denkintensität nur, wo sie ankommt
 * ══════════════════════════════════════════════════════════════════
 *
 * `denktiefeMoeglich` entscheidet, ob die Oberfläche ein Bedienelement
 * zeigt. Ein Schalter, der nichts tut, ist schlimmer als ein
 * fehlender: Man stellt ihn ein, glaubt an eine Wirkung und erklärt
 * sich damit jede spätere Antwort.
 *
 * Der Test hängt deshalb an derselben Regel wie der Adapter — und
 * schlägt an, wenn jemand die Prüfung durch eine eigene Liste ersetzt.
 */
describe("denktiefeMoeglich", () => {
  const openai = (apiModellId: string) =>
    ({ anbieter: "openai", apiModellId }) as never;

  it("erkennt die Denkmodelle von OpenAI", async () => {
    const { denktiefeMoeglich } = await import("./registry.ts");
    expect(denktiefeMoeglich(openai("gpt-5"))).toBe(true);
    expect(denktiefeMoeglich(openai("gpt-6-astra"))).toBe(true);
    expect(denktiefeMoeglich(openai("o3"))).toBe(true);
  });

  it("verneint bei älteren OpenAI-Modellen", async () => {
    const { denktiefeMoeglich } = await import("./registry.ts");
    expect(denktiefeMoeglich(openai("gpt-4o"))).toBe(false);
  });

  it("verneint bei Anbietern, deren Adapter den Parameter nicht setzt", async () => {
    /*
     * Anthropic und Google kennen Denkbudgets — unsere Adapter setzen
     * sie nicht. Solange das so ist, wäre ein Schalter dort eine
     * Zusage ohne Gegenstück. Bekommen sie es, ändert sich EINE
     * Zeile in `denktiefeMoeglich` und nicht eine Liste an fünf Orten.
     */
    const { denktiefeMoeglich } = await import("./registry.ts");
    expect(
      denktiefeMoeglich({ anbieter: "anthropic", apiModellId: "claude-opus-5" } as never),
    ).toBe(false);
    expect(
      denktiefeMoeglich({ anbieter: "google", apiModellId: "gemini-3.8-flash" } as never),
    ).toBe(false);
  });
});
