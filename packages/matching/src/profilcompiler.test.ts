import { describe, expect, it } from "vitest";
import {
  giltNoch,
  ortUndModellTrennen,
  verdichten,
  VERHALTEN_VERFALL_TAGE,
  type Aenderungsvorschlag,
  type Bestandskriterium,
  type Signal,
} from "./profilcompiler.ts";

const JETZT = new Date("2026-09-06T06:00:00Z");

function signal(teil: Partial<Signal> & { id: string }): Signal {
  return {
    ausdruecklich: true,
    quelle: "chat",
    art: "nachricht",
    beobachtetAm: JETZT,
    ...teil,
  };
}

function bestand(teil: Partial<Bestandskriterium> & { kriterium: string }): Bestandskriterium {
  return {
    wert: teil.wert ?? "x",
    einheit: null,
    operator: "gleich",
    staerke: "muss",
    gruppe: null,
    geltungsbereich: "auftrag",
    herkunft: "nutzer_aussage",
    bestaetigungsstatus: "bestaetigt",
    bestaetigtAm: new Date("2026-08-01T00:00:00Z"),
    gueltigBis: null,
    signalIds: [],
    ...teil,
  };
}

function vorschlag(teil: Partial<Aenderungsvorschlag> & { kriterium: string }): Aenderungsvorschlag {
  return {
    wert: teil.wert ?? "y",
    staerke: teil.staerke ?? "wunsch",
    herkunft: teil.herkunft ?? "nutzer_aussage",
    signalIds: teil.signalIds ?? ["s1"],
    ...teil,
  };
}

describe("Belegpflicht", () => {
  it("verwirft eine Änderung ohne Signal", () => {
    const e = verdichten([], [vorschlag({ kriterium: "arbeitsort", signalIds: [] })], [], JETZT);
    expect(e.kriterien).toHaveLength(0);
    expect(e.verworfen[0]!.grund).toBe("beleg_fehlt");
  });

  it("verwirft eine Änderung mit einer erfundenen Signal-ID", () => {
    const e = verdichten(
      [],
      [vorschlag({ kriterium: "arbeitsort", signalIds: ["gibts-nicht"] })],
      [signal({ id: "s1" })],
      JETZT,
    );
    expect(e.verworfen[0]!.grund).toBe("unbekanntes_signal");
  });
});

describe("Angaben über andere Personen", () => {
  it("macht aus „ich suche für meinen Bruder“ keine eigene Präferenz", () => {
    const e = verdichten(
      [],
      [vorschlag({ kriterium: "taetigkeit", wert: ["lagerist"] })],
      [signal({ id: "s1", fremdbezug: true })],
      JETZT,
    );
    expect(e.kriterien).toHaveLength(0);
    expect(e.verworfen[0]!.grund).toBe("fremdbezug");
  });
});

describe("Verhaltenssignale", () => {
  it("erzeugen keine Muss-Bedingung", () => {
    const e = verdichten(
      [],
      [vorschlag({ kriterium: "berufsfeld", staerke: "muss", herkunft: "verhalten" })],
      [signal({ id: "s1", ausdruecklich: false, art: "gespeichert" })],
      JETZT,
    );
    expect(e.kriterien).toHaveLength(0);
    expect(e.verworfen[0]!.grund).toBe("verhalten_kein_muss");
  });

  it("dürfen einen Wunsch erzeugen", () => {
    const e = verdichten(
      [],
      [vorschlag({ kriterium: "berufsfeld", staerke: "wunsch", herkunft: "verhalten" })],
      [signal({ id: "s1", ausdruecklich: false })],
      JETZT,
    );
    expect(e.kriterien).toHaveLength(1);
    expect(e.kriterien[0]!.bestaetigungsstatus).toBe("offen");
  });

  it("überschreiben keine bestätigte Angabe, sondern fragen nach", () => {
    const alt = bestand({ kriterium: "arbeitsort", wert: ["karlsruhe"] });
    const e = verdichten(
      [alt],
      [vorschlag({ kriterium: "arbeitsort", wert: ["berlin"], herkunft: "verhalten", staerke: "wunsch" })],
      [signal({ id: "s1", ausdruecklich: false })],
      JETZT,
    );
    expect(e.kriterien[0]!.wert).toEqual(["karlsruhe"]);
    expect(e.rueckfragen).toHaveLength(1);
  });

  it("verfallen unbestätigt nach der Startfrist", () => {
    const frisch = bestand({
      kriterium: "berufsfeld",
      herkunft: "verhalten",
      bestaetigungsstatus: "offen",
      bestaetigtAm: new Date(JETZT.getTime() - (VERHALTEN_VERFALL_TAGE - 1) * 86_400_000),
    });
    const alt = { ...frisch, bestaetigtAm: new Date(JETZT.getTime() - (VERHALTEN_VERFALL_TAGE + 1) * 86_400_000) };
    expect(giltNoch(frisch, JETZT)).toBe(true);
    expect(giltNoch(alt, JETZT)).toBe(false);
  });

  it("lassen Bestätigtes nicht verfallen", () => {
    const uralt = bestand({
      kriterium: "arbeitsort",
      bestaetigungsstatus: "bestaetigt",
      bestaetigtAm: new Date("2020-01-01T00:00:00Z"),
    });
    expect(giltNoch(uralt, JETZT)).toBe(true);
  });
});

describe("Ausdrücklicher Änderungsauftrag", () => {
  it("ersetzt eine bestätigte Angabe", () => {
    const alt = bestand({ kriterium: "vertragsform", wert: ["vollzeit"] });
    const e = verdichten(
      [alt],
      [
        vorschlag({
          kriterium: "vertragsform",
          wert: ["teilzeit"],
          staerke: "muss",
          aenderungsauftrag: true,
        }),
      ],
      [signal({ id: "s1", ausdruecklich: true, art: "auftrag_geaendert" })],
      JETZT,
    );
    expect(e.kriterien[0]!.wert).toEqual(["teilzeit"]);
    expect(e.kriterien[0]!.bestaetigungsstatus).toBe("bestaetigt");
    expect(e.rueckfragen).toHaveLength(0);
  });

  it("fragt ohne ausdrücklichen Auftrag nach", () => {
    const alt = bestand({ kriterium: "vertragsform", wert: ["vollzeit"] });
    const e = verdichten(
      [alt],
      [vorschlag({ kriterium: "vertragsform", wert: ["teilzeit"], staerke: "wunsch" })],
      [signal({ id: "s1" })],
      JETZT,
    );
    expect(e.kriterien[0]!.wert).toEqual(["vollzeit"]);
    expect(e.rueckfragen[0]!.grund).toBe("widerspruch");
  });
});

describe("Befristete Zusätze", () => {
  it("gelten befristet und ändern den Bestand nicht dauerhaft", () => {
    const morgen = new Date(JETZT.getTime() + 86_400_000);
    const e = verdichten(
      [],
      [
        vorschlag({
          kriterium: "arbeitsort",
          wert: ["hamburg"],
          geltungsbereich: "befristet",
          gueltigBisIso: morgen.toISOString(),
        }),
      ],
      [signal({ id: "s1" })],
      JETZT,
    );
    expect(e.kriterien[0]!.gueltigBis?.toISOString()).toBe(morgen.toISOString());
    /* Und nach Ablauf ist es weg. */
    expect(giltNoch(e.kriterien[0]!, new Date(morgen.getTime() + 1000))).toBe(false);
  });

  it("verwirft eine Befristung ohne Frist", () => {
    const e = verdichten(
      [],
      [vorschlag({ kriterium: "arbeitsort", geltungsbereich: "befristet" })],
      [signal({ id: "s1" })],
      JETZT,
    );
    expect(e.verworfen[0]!.grund).toBe("frist_fehlt");
  });

  it("überschreibt mit einem befristeten Zusatz keine bestätigte Angabe dauerhaft", () => {
    const alt = bestand({ kriterium: "arbeitsort", wert: ["stuttgart"], gruppe: "ort" });
    const morgen = new Date(JETZT.getTime() + 86_400_000);
    const e = verdichten(
      [alt],
      [
        vorschlag({
          kriterium: "arbeitsort",
          wert: ["hamburg"],
          gruppe: "zusatz-heute",
          geltungsbereich: "befristet",
          gueltigBisIso: morgen.toISOString(),
        }),
      ],
      [signal({ id: "s1" })],
      JETZT,
    );
    /* Beide stehen nebeneinander: der Dauerwunsch und der Zusatz. */
    expect(e.kriterien).toHaveLength(2);
    const uebermorgen = new Date(JETZT.getTime() + 2 * 86_400_000);
    expect(e.kriterien.filter((k) => giltNoch(k, uebermorgen))).toHaveLength(1);
  });
});

describe("Alternativen", () => {
  it("hält zwei ODER-Alternativen als zwei Kriterien einer Gruppe", () => {
    const e = verdichten(
      [],
      [
        vorschlag({ kriterium: "arbeitsort", wert: ["stuttgart"], gruppe: "ort", staerke: "muss" }),
        vorschlag({ kriterium: "arbeitsmodell", wert: ["remote"], gruppe: "ort", staerke: "muss" }),
      ],
      [signal({ id: "s1" })],
      JETZT,
    );
    expect(e.kriterien).toHaveLength(2);
    expect(new Set(e.kriterien.map((k) => k.gruppe))).toEqual(new Set(["ort"]));
  });
});

describe("Ort und Arbeitsmodell", () => {
  it("trennt „Karlsruhe oder remote“ in zwei Kriterien einer Gruppe", () => {
    /*
     * Ein echter Modellaufruf lieferte genau das: eine Ortsliste mit
     * „remote" darin. Die Ortsprüfung vergleicht mit `jobs.location`,
     * dort steht nie „remote" — die Alternative wäre stillschweigend
     * nie erfüllt gewesen.
     */
    const raus = ortUndModellTrennen([
      vorschlag({ kriterium: "arbeitsort", wert: ["Karlsruhe", "remote"], operator: "einer_von" }),
    ]);
    expect(raus).toHaveLength(2);
    expect(raus.map((r) => r.kriterium).sort()).toEqual(["arbeitsmodell", "arbeitsort"]);
    /* Dieselbe Gruppe — sonst wären es zwei gleichzeitig zwingende
       Standortbedingungen, und die Suche fände gar nichts. */
    expect(new Set(raus.map((r) => r.gruppe))).toEqual(new Set(["ort"]));
    expect(raus.find((r) => r.kriterium === "arbeitsort")!.wert).toEqual(["karlsruhe"]);
    expect(raus.find((r) => r.kriterium === "arbeitsmodell")!.wert).toEqual(["remote"]);
  });

  it("lässt eine reine Ortsliste unangetastet", () => {
    const raus = ortUndModellTrennen([
      vorschlag({ kriterium: "arbeitsort", wert: ["Karlsruhe", "Stuttgart"] }),
    ]);
    expect(raus).toHaveLength(1);
    expect(raus[0]!.kriterium).toBe("arbeitsort");
  });

  it("kommt mit „nur remote“ ohne Ort aus", () => {
    const raus = ortUndModellTrennen([
      vorschlag({ kriterium: "arbeitsort", wert: ["Homeoffice"] }),
    ]);
    expect(raus).toHaveLength(1);
    expect(raus[0]!.kriterium).toBe("arbeitsmodell");
    expect(raus[0]!.wert).toEqual(["remote"]);
  });

  it("behält eine vorhandene Gruppe", () => {
    const raus = ortUndModellTrennen([
      vorschlag({ kriterium: "arbeitsort", wert: ["Berlin", "hybrid"], gruppe: "wo" }),
    ]);
    expect(new Set(raus.map((r) => r.gruppe))).toEqual(new Set(["wo"]));
  });

  it("lässt andere Kriterien in Ruhe", () => {
    const raus = ortUndModellTrennen([vorschlag({ kriterium: "mindestgehalt", wert: 32000 })]);
    expect(raus).toEqual([vorschlag({ kriterium: "mindestgehalt", wert: 32000 })]);
  });
});

describe("Ort und Remote getrennt geliefert", () => {
  it("fasst sie zu einer Gruppe zusammen", () => {
    /*
     * Der zweite echte Lauf lieferte beide als eigene Kriterien, ohne
     * Gruppe. Zwei Muss-Kriterien ohne Gruppe sind ein UND —
     * „in Karlsruhe UND vollständig remote" findet fast nichts.
     */
    const raus = ortUndModellTrennen([
      vorschlag({ kriterium: "arbeitsort", wert: ["karlsruhe"], staerke: "muss" }),
      vorschlag({ kriterium: "arbeitsmodell", wert: ["remote"], staerke: "muss" }),
      vorschlag({ kriterium: "mindestgehalt", wert: 32000, staerke: "muss" }),
    ]);
    const ort = raus.find((r) => r.kriterium === "arbeitsort")!;
    const modell = raus.find((r) => r.kriterium === "arbeitsmodell")!;
    expect(ort.gruppe).toBe("ort");
    expect(modell.gruppe).toBe("ort");
    /* Das Gehalt bleibt eigenständig — es ist keine Alternative. */
    expect(raus.find((r) => r.kriterium === "mindestgehalt")!.gruppe ?? null).toBeNull();
  });

  it("lässt hybrid mit dem Ort zusammen gelten", () => {
    /* Wer hybrid in Karlsruhe sucht, meint beides. */
    const raus = ortUndModellTrennen([
      vorschlag({ kriterium: "arbeitsort", wert: ["karlsruhe"], staerke: "muss" }),
      vorschlag({ kriterium: "arbeitsmodell", wert: ["hybrid"], staerke: "muss" }),
    ]);
    expect(raus.every((r) => (r.gruppe ?? null) === null)).toBe(true);
  });

  it("rührt eine schon gesetzte Gruppe nicht an", () => {
    const raus = ortUndModellTrennen([
      vorschlag({ kriterium: "arbeitsort", wert: ["karlsruhe"], gruppe: "wo" }),
      vorschlag({ kriterium: "arbeitsmodell", wert: ["remote"], gruppe: "wo" }),
    ]);
    expect(new Set(raus.map((r) => r.gruppe))).toEqual(new Set(["wo"]));
  });
});
