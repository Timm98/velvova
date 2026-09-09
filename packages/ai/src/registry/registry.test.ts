import { describe, expect, it } from "vitest";
import { KATALOG, type Modelldefinition } from "./katalog.ts";
import {
  ANBIETER_MIT_ADAPTER,
  anbietbareModelle,
  bestesModell,
  modellAuswaehlen,
  modellzustaende,
  rangfolge,
  type Umgebung,
} from "./registry.ts";

/*
 * Die Fälle sind nach dem benannt, was schiefgehen würde — nicht nach
 * der Funktion, die sie aufrufen. Wer eine rote Zeile sieht, soll
 * daran ablesen können, was einem Menschen passiert wäre.
 */

/** Ein vollständig eingerichteter Betrieb: beide Schlüssel, beide Freigaben. */
const ALLES_DA: Umgebung = {
  OPENAI_API_KEY: "sk-test",
  ANTHROPIC_API_KEY: "sk-ant-test",
  MONDAY_OPENAI_PRODUCTION_APPROVED: "true",
  MONDAY_ANTHROPIC_PRODUCTION_APPROVED: "true",
};

const schnell: Modelldefinition = {
  internId: "test-schnell", anbieter: "openai", apiModellId: "x-schnell",
  anzeigename: "Schnell", beschreibung: "", lebenszyklus: "stabil",
  faehigkeiten: { fastClassification: true, structuredOutput: true },
  eignung: { classification: 0.9 },
  kostenklasse: "guenstig", tempoklasse: "schnell", maxKontext: null,
  eingaben: ["text"], ersatz: [],
};
const gruendlich: Modelldefinition = {
  internId: "test-gruendlich", anbieter: "openai", apiModellId: "x-tief",
  anzeigename: "Gründlich", beschreibung: "", lebenszyklus: "stabil",
  faehigkeiten: { reasoning: true, documentAnalysis: true, structuredOutput: true },
  eignung: { classification: 0.6, career_analysis: 0.95 },
  kostenklasse: "teuer", tempoklasse: "langsam", maxKontext: null,
  eingaben: ["text", "pdf"], ersatz: [],
};
const ZWEI = [schnell, gruendlich];

describe("Nichts ist offen, solange es niemand geöffnet hat", () => {
  it("bietet ohne jede Umgebung kein einziges Modell an", () => {
    /*
     * Der wichtigste Fall überhaupt. Eine frische Installation, ein
     * vergessener Schlüssel, eine leere Vercel-Umgebung — überall
     * muss die Auswahl leer sein und nicht „irgendwas versuchen".
     */
    expect(anbietbareModelle({})).toEqual([]);
  });

  it("bietet ohne Freigabe nichts an, auch mit gültigem Schlüssel", () => {
    expect(anbietbareModelle({ OPENAI_API_KEY: "sk-test" })).toEqual([]);
  });

  it("liest 'false' als false und nicht als nicht-leere Zeichenkette", () => {
    /*
     * `Boolean("false")` ist `true`. Genau so schaltet man versehentlich
     * eine Freigabe ein, die ausgeschaltet sein sollte.
     */
    const zustaende = modellzustaende({
      OPENAI_API_KEY: "sk-test",
      MONDAY_OPENAI_PRODUCTION_APPROVED: "false",
    });
    expect(zustaende.every((z) => !z.anbietbar)).toBe(true);
  });

  it("bietet mit Schlüssel und Freigabe die Modelle dieses Anbieters an", () => {
    const namen = anbietbareModelle(ALLES_DA).map((m) => m.internId);
    expect(namen).toContain("openai-arbeit");
    expect(namen).toContain("anthropic-spitze");
  });
});

describe("Adapter und Freigabe sind zwei Türen", () => {
  it("bietet ein Gemini-Modell ohne Freigabe nicht an, obwohl der Adapter da ist", () => {
    /*
     * Der Adapter existiert seit dem 9.9.2026, wurde aber gegen keine
     * laufende API geprüft. Genau dafür ist die zweite Tür da.
     */
    const namen = anbietbareModelle({
      ...ALLES_DA, GEMINI_API_KEY: "gm-test",
    }).map((m) => m.internId);
    expect(namen.some((n) => n.startsWith("google-"))).toBe(false);
  });

  it("nennt die fehlende Freigabe als Grund, nicht den Adapter", () => {
    const google = modellzustaende({ ...ALLES_DA, GEMINI_API_KEY: "gm" })
      .find((z) => z.definition.anbieter === "google");
    expect(google?.grund).toMatch(/Nicht freigegeben/);
  });

  it("bietet ein Gemini-Modell an, sobald Schlüssel UND Freigabe stehen", () => {
    const namen = anbietbareModelle({
      ...ALLES_DA, GEMINI_API_KEY: "gm",
      MONDAY_GOOGLE_PRODUCTION_APPROVED: "true",
    }).map((m) => m.internId);
    expect(namen).toContain("google-flash");
  });

  it("nennt bei fehlendem Schlüssel den Schlüssel", () => {
    const google = modellzustaende({
      ...ALLES_DA, MONDAY_GOOGLE_PRODUCTION_APPROVED: "true",
    }).find((z) => z.definition.anbieter === "google");
    expect(google?.grund).toMatch(/GEMINI_API_KEY/);
  });

  it("hält fest, welche Anbieter einen Adapter haben", () => {
    /*
     * Wird rot, sobald jemand einen vierten Adapter baut — dann muss
     * auch der Katalog geprüft werden, nicht nur die Menge hier.
     */
    expect([...ANBIETER_MIT_ADAPTER].sort()).toEqual(["anthropic", "google", "openai"]);
  });
});

describe("Vorschaumodelle", () => {
  const mitGoogle: Umgebung = {
    ...ALLES_DA, GEMINI_API_KEY: "gm", MONDAY_GOOGLE_PRODUCTION_APPROVED: "true",
  };

  it("bleiben ohne ausdrücklichen Schalter draussen", () => {
    expect(anbietbareModelle(mitGoogle).some((m) => m.lebenszyklus === "vorschau")).toBe(false);
  });

  it("kommen erst mit dem Schalter dazu", () => {
    const namen = anbietbareModelle({
      ...mitGoogle, MONDAY_PREVIEW_MODELS_ENABLED: "true",
    }).map((m) => m.internId);
    expect(namen).toContain("google-pro-vorschau");
  });

  it("brauchen trotz Schalter die Freigabe des Anbieters", () => {
    /*
     * Zwei Sperren hintereinander. Die zweite darf die erste nicht
     * aufheben — ein Schalter für Vorschaumodelle ist keine Freigabe
     * für einen Anbieter, den niemand geprüft hat.
     */
    const namen = anbietbareModelle({
      ...ALLES_DA, GEMINI_API_KEY: "gm", MONDAY_PREVIEW_MODELS_ENABLED: "true",
    }).map((m) => m.internId);
    expect(namen).not.toContain("google-pro-vorschau");
  });
});

describe("Ausdrückliche Sperre", () => {
  it("nimmt ein einzelnes Modell aus der Auswahl", () => {
    const namen = anbietbareModelle({
      ...ALLES_DA, MONDAY_MODELLE_GESPERRT: "openai-spitze",
    }).map((m) => m.internId);
    expect(namen).not.toContain("openai-spitze");
    expect(namen).toContain("openai-arbeit");
  });

  it("schlägt jede andere Freigabe", () => {
    const z = modellzustaende({ ...ALLES_DA, MONDAY_MODELLE_GESPERRT: "openai-spitze" })
      .find((x) => x.definition.internId === "openai-spitze");
    expect(z?.anbietbar).toBe(false);
    expect(z?.grund).toMatch(/gesperrt/i);
  });
});

describe("Die Auswahl eines Menschen", () => {
  it("findet ein freigegebenes Modell", () => {
    expect(modellAuswaehlen("openai-arbeit", ALLES_DA)?.apiModellId).toBe("gpt-5");
  });

  it("gibt null für ein gesperrtes Modell — nicht das nächstbeste", () => {
    /*
     * Still auf ein anderes Modell auszuweichen wäre der Fehler, den
     * der Auftrag ausdrücklich verbietet: Wer ein Modell wählt, soll
     * dieses bekommen oder eine Erklärung.
     */
    expect(modellAuswaehlen("google-flash", ALLES_DA)).toBeNull();
  });

  it("gibt null für eine erfundene Kennung", () => {
    expect(modellAuswaehlen("gibt-es-nicht", ALLES_DA)).toBeNull();
  });
});

describe("Die Rangfolge rechnet, statt Anbieter zu bevorzugen", () => {
  const offen: Umgebung = { OPENAI_API_KEY: "k", MONDAY_OPENAI_PRODUCTION_APPROVED: "true" };

  it("nimmt beim Einsortieren das schnelle Modell", () => {
    const beste = bestesModell(
      { task: "classification", qualitaetVorKosten: 0.3 }, offen, ZWEI,
    );
    expect(beste?.modell.internId).toBe("test-schnell");
  });

  it("nimmt bei einer Karrierefrage das gründliche — dieselben Modelle", () => {
    const beste = bestesModell(
      { task: "career_analysis", qualitaetVorKosten: 0.95 }, offen, ZWEI,
    );
    expect(beste?.modell.internId).toBe("test-gruendlich");
  });

  it("schliesst ein Modell ohne benötigte Fähigkeit aus, statt es abzuwerten", () => {
    const liste = rangfolge(
      { task: "career_analysis", benoetigt: ["documentAnalysis"] }, offen, ZWEI,
    );
    expect(liste.map((r) => r.modell.internId)).toEqual(["test-gruendlich"]);
  });

  it("schliesst ein Modell aus, das die Eingabeart nicht lesen kann", () => {
    const liste = rangfolge({ task: "career_analysis", eingaben: ["pdf"] }, offen, ZWEI);
    expect(liste.map((r) => r.modell.internId)).toEqual(["test-gruendlich"]);
  });

  it("gibt eine leere Liste zurück, wenn nichts passt", () => {
    /*
     * Und eben nicht das am wenigsten unpassende Modell. Der Aufrufer
     * muss diesen Fall sehen und erklären können.
     */
    expect(rangfolge({ task: "career_analysis", eingaben: ["audio"] }, offen, ZWEI)).toEqual([]);
  });

  it("beachtet die Datenschutzliste erlaubter Anbieter", () => {
    const liste = rangfolge(
      { task: "cover_letter_draft", erlaubteAnbieter: ["anthropic"] }, ALLES_DA,
    );
    expect(liste.length).toBeGreaterThan(0);
    expect(liste.every((r) => r.modell.anbieter === "anthropic")).toBe(true);
  });

  it("begründet jede Platzierung nachvollziehbar", () => {
    const beste = bestesModell({ task: "classification" }, offen, ZWEI);
    expect(beste?.begruendung).toMatch(/Eignung .*classification/);
  });
});

describe("Der Katalog selbst", () => {
  it("hat eindeutige interne Kennungen", () => {
    /*
     * Zwei Einträge mit derselben Kennung bedeuten: Die Auswahl eines
     * Menschen trifft je nach Sortierung ein anderes Modell.
     */
    const ids = KATALOG.map((m) => m.internId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("verweist nur auf Ersatzmodelle, die es gibt", () => {
    const ids = new Set(KATALOG.map((m) => m.internId));
    for (const m of KATALOG) {
      for (const e of m.ersatz) expect(ids, `${m.internId} → ${e}`).toContain(e);
    }
  });

  it("hält jede Eignung zwischen 0 und 1", () => {
    for (const m of KATALOG) {
      for (const [task, wert] of Object.entries(m.eignung)) {
        expect(wert, `${m.internId}/${task}`).toBeGreaterThanOrEqual(0);
        expect(wert, `${m.internId}/${task}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it("behauptet für kein Modell, es sei geprüft", () => {
    /* Der Katalog ist eine Kandidatenliste. Geprüft wird anderswo. */
    expect(modellzustaende(ALLES_DA).every((z) => z.verfuegbarkeit === "ungeprueft")).toBe(true);
  });
});
