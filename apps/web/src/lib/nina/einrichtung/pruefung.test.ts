import { describe, expect, it } from "vitest";
import { gueltigeZeitzone, pruefe, type Wunsch } from "./pruefung";

const basis: Wunsch = {
  bedienart: "text",
  sprachspeicherung: "nur_bestaetigte",
  stufe: "manual",
  briefingAktiv: false,
  briefingRhythmus: "werktags",
  briefingZeit: "08:00",
  zeitzone: "Europe/Berlin",
  kanaele: [],
};
const mit = (t: Partial<Wunsch>): Wunsch => ({ ...basis, ...t });
const werte = (w: Wunsch) => {
  const e = pruefe(w);
  if (!e.ok) throw new Error(e.fehler);
  return e.werte;
};

describe("Pflichtangaben", () => {
  it("verlangt eine Bedienart", () => {
    expect(pruefe(mit({ bedienart: null }))).toMatchObject({ ok: false });
    expect(pruefe(mit({ bedienart: "telepathie" }))).toMatchObject({ ok: false });
  });

  it("verlangt eine Stufe — nichts ist vorausgewählt", () => {
    expect(pruefe(mit({ stufe: null }))).toMatchObject({ ok: false });
  });

  it("lässt keine erfundene Stufe durch", () => {
    expect(pruefe(mit({ stufe: "alles_erlaubt" }))).toMatchObject({ ok: false });
    expect(pruefe(mit({ stufe: "prepare_and_connect " }))).toMatchObject({ ok: false });
  });

  it("nimmt die drei echten Stufen an", () => {
    for (const s of ["manual", "observe_and_save", "prepare_and_connect"]) {
      expect(werte(mit({ stufe: s })).stufe).toBe(s);
    }
  });
});

describe("Sprache und Transkript", () => {
  it("speichert das Transkript nur, wenn wirklich gesprochen wird", () => {
    expect(werte(mit({ bedienart: "sprache", sprachspeicherung: "transkript" })).sprachspeicherung)
      .toBe("transkript");
  });

  it("verwirft die Transkriptzustimmung beim Schreiben", () => {
    /* Sonst läge sie beim späteren Wechsel zur Sprache bereits vor,
       ohne je gegeben worden zu sein. */
    expect(werte(mit({ bedienart: "text", sprachspeicherung: "transkript" })).sprachspeicherung)
      .toBe("nur_bestaetigte");
  });

  it("nimmt im Zweifel die datenschutzfreundliche Fassung", () => {
    expect(werte(mit({ bedienart: "sprache", sprachspeicherung: "irgendwas" })).sprachspeicherung)
      .toBe("nur_bestaetigte");
  });
});

describe("Briefing", () => {
  it("bleibt aus, wenn Monday nur auf Zuruf sucht", () => {
    const w = werte(mit({ stufe: "manual", briefingAktiv: true, kanaele: ["email"] }));
    expect(w.briefingAktiv).toBe(false);
    expect(w.kanaele).toEqual([]);
  });

  it("geht ab Stufe 2", () => {
    expect(werte(mit({ stufe: "observe_and_save", briefingAktiv: true })).briefingAktiv).toBe(true);
    expect(werte(mit({ stufe: "prepare_and_connect", briefingAktiv: true })).briefingAktiv).toBe(true);
  });

  it("ist nicht von selbst an", () => {
    expect(werte(mit({ stufe: "observe_and_save" })).briefingAktiv).toBe(false);
  });

  it("bekommt einen Zustellweg, wenn keiner gewählt wurde", () => {
    expect(werte(mit({ stufe: "observe_and_save", briefingAktiv: true, kanaele: [] })).kanaele)
      .toEqual(["in_app"]);
  });

  it("nimmt In-App, E-Mail und Push", () => {
    const w = werte(mit({ stufe: "observe_and_save", briefingAktiv: true, kanaele: ["in_app", "email", "push"] }));
    expect(w.kanaele).toEqual(["in_app", "email", "push"]);
  });

  it("verwirft erfundene Zustellwege", () => {
    const w = werte(mit({ stufe: "observe_and_save", briefingAktiv: true, kanaele: ["fax", "email"] }));
    expect(w.kanaele).toEqual(["email"]);
  });

  it("nimmt jeden Zustellweg nur einmal", () => {
    const w = werte(mit({ stufe: "observe_and_save", briefingAktiv: true, kanaele: ["email", "email"] }));
    expect(w.kanaele).toEqual(["email"]);
  });

  it("kennt die drei Rhythmen", () => {
    for (const r of ["taeglich", "werktags", "woechentlich"]) {
      expect(werte(mit({ briefingRhythmus: r })).briefingRhythmus).toBe(r);
    }
    expect(werte(mit({ briefingRhythmus: "stündlich" })).briefingRhythmus).toBe("werktags");
  });

  it("nimmt nur eine echte Uhrzeit", () => {
    expect(werte(mit({ briefingZeit: "06:30" })).briefingZeit).toBe("06:30");
    expect(werte(mit({ briefingZeit: "23:59" })).briefingZeit).toBe("23:59");
    expect(werte(mit({ briefingZeit: "24:00" })).briefingZeit).toBe("08:00");
    expect(werte(mit({ briefingZeit: "8:00" })).briefingZeit).toBe("08:00");
    expect(werte(mit({ briefingZeit: "morgens" })).briefingZeit).toBe("08:00");
  });
});

describe("Zeitzone", () => {
  it("nimmt echte Zonen", () => {
    expect(gueltigeZeitzone("America/New_York")).toBe("America/New_York");
    expect(gueltigeZeitzone("Asia/Tokyo")).toBe("Asia/Tokyo");
    expect(gueltigeZeitzone("Pacific/Auckland")).toBe("Pacific/Auckland");
  });

  it("fällt bei Unsinn auf die Vorgabe zurück", () => {
    expect(gueltigeZeitzone("Mars/Olympus")).toBe("Europe/Berlin");
    expect(gueltigeZeitzone("")).toBe("Europe/Berlin");
    expect(gueltigeZeitzone(null)).toBe("Europe/Berlin");
    expect(gueltigeZeitzone("x".repeat(200))).toBe("Europe/Berlin");
  });
});
