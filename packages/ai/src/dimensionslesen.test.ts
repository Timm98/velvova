import { describe, expect, it } from "vitest";
import { dimensionenAusAntwort, offeneAchsenTreffer } from "./dimensionslesen.ts";

/**
 * Der Gesprächsleser — und vor allem sein Schweigen.
 *
 * Die gefährliche Fassung wäre eine, die jeder Antwort zehn Zahlen
 * entnimmt. Sie sähe vollständig aus, und das Meiste wäre geraten —
 * und es stünde anschliessend als Aussage über einen Menschen in
 * seinem Profil.
 */

describe("Was nichts hergibt, gibt nichts her", () => {
  it("schweigt bei einer kurzen Antwort", () => {
    expect(dimensionenAusAntwort("own_decisions", "Ja.")).toEqual([]);
    expect(dimensionenAusAntwort("own_decisions", "weiss nicht")).toEqual([]);
  });

  it("schweigt bei einer Frage, die es nicht liest", () => {
    expect(dimensionenAusAntwort("gibt_es_nicht", "Ich arbeite gern eigenverantwortlich.")).toEqual([]);
  });

  it("schweigt bei einem Widerspruch", () => {
    /*
     * „Klare Abläufe, aber auch mal etwas Neues" sagt zur Struktur
     * nichts Verwertbares. Ein Mittelwert von 0,5 wäre eine Zahl, die
     * niemand geäussert hat.
     */
    const r = dimensionenAusAntwort(
      "structure_vs_building",
      "Ich mag klare Abläufe, aber ich will auch mal etwas Neues aufbauen.",
    );
    expect(r.find((x) => x.dimension === "struktur")).toBeUndefined();
  });
});

describe("Was eindeutig ist, wird gelesen", () => {
  it("erkennt den Wunsch nach Autonomie", () => {
    const r = dimensionenAusAntwort(
      "own_decisions",
      "Am liebsten hätte ich freie Hand bei der Umsetzung, ohne Rücksprache für jede Kleinigkeit.",
    );
    const a = r.find((x) => x.dimension === "autonomie");
    expect(a?.wert).toBe(1);
    expect(a?.beleg).toContain("freie Hand");
  });

  it("erkennt das Gegenteil genauso", () => {
    const r = dimensionenAusAntwort(
      "responsibility_wanted",
      "Ich möchte fachlich bleiben und keine Führung übernehmen.",
    );
    expect(r.find((x) => x.dimension === "verantwortung")?.wert).toBe(0);
  });

  it("liest mehrere Achsen aus einer Antwort", () => {
    const r = dimensionenAusAntwort(
      "structure_vs_building",
      "Ich brauche klare Abläufe und eingespielte Routine, das gibt mir Halt.",
    );
    const achsen = new Set(r.map((x) => x.dimension));
    expect(achsen.has("struktur")).toBe(true);
    expect(achsen.has("wiederholung")).toBe(true);
  });
});

describe("Die Frage entscheidet mit", () => {
  it("deutet dieselben Worte je nach Frage verschieden", () => {
    /*
     * „Kunden" in der Antwort auf `avoided_tasks` heisst: will keinen
     * Kundenkontakt. Dieselbe Zeichenkette in einer Frage, die der
     * Leser nicht kennt, heisst gar nichts.
     */
    const gemieden = dimensionenAusAntwort(
      "avoided_tasks",
      "Telefonate mit Kunden vermeide ich, wo es geht.",
    );
    expect(gemieden.find((x) => x.dimension === "kundenkontakt")?.wert).toBe(0);

    const andere = dimensionenAusAntwort(
      "value_ranking",
      "Telefonate mit Kunden vermeide ich, wo es geht.",
    );
    expect(andere.find((x) => x.dimension === "kundenkontakt")).toBeUndefined();
  });
});

describe("Verneinungen drehen die Richtung", () => {
  /*
   * Der Fehler, den diese Tests gefunden haben: „ohne Rücksprache"
   * traf das Muster für WENIG Autonomie und sagt das Gegenteil.
   * Deutsch verneint vorangestellt und dicht am Wort.
   */
  it("liest „ohne Rücksprache“ als mehr Autonomie, nicht als weniger", () => {
    const r = dimensionenAusAntwort("own_decisions", "Ich arbeite am liebsten ohne Rücksprache.");
    expect(r.find((x) => x.dimension === "autonomie")?.wert).toBe(1);
  });

  it("liest „keine Führung“ als weniger Verantwortung", () => {
    const r = dimensionenAusAntwort("responsibility_wanted", "Ich will keine Führung übernehmen.");
    expect(r.find((x) => x.dimension === "verantwortung")?.wert).toBe(0);
  });

  it("dreht nicht, wenn die Verneinung weit weg steht", () => {
    // „nicht" bezieht sich hier auf das Wetter, nicht auf die Führung.
    const r = dimensionenAusAntwort(
      "responsibility_wanted",
      "Das Wetter war nicht gut, aber ich möchte gern Personalverantwortung übernehmen.",
    );
    expect(r.find((x) => x.dimension === "verantwortung")?.wert).toBe(1);
  });
});

describe("Die Kündigungsfrage ist die ehrlichste", () => {
  /*
   * „Was würde dich nach drei Monaten gehen lassen?" fragt nach dem,
   * was jemand NICHT aushält — und darauf antworten Menschen
   * deutlicher als auf die Frage nach ihren Wünschen. Sie trägt
   * deshalb die meisten Achsen im ganzen Leser.
   */
  it("liest mehrere Achsen aus einer Kündigungsantwort", () => {
    const r = dimensionenAusAntwort(
      "quit_after_three_months",
      "Wenn ständig Überstunden anfallen und mich jemand mikromanagt, bin ich weg.",
    );
    const nach = new Map(r.map((x) => [x.dimension, x.wert]));
    expect(nach.get("belastung")).toBe(0);
    expect(nach.get("autonomie")).toBe(1);
  });

  it("liest Unverhandelbares als Sicherheitsbedürfnis", () => {
    const r = dimensionenAusAntwort(
      "non_negotiables",
      "Eine unbefristete Festanstellung ist mir wichtig, und keine Nachtschicht.",
    );
    const nach = new Map(r.map((x) => [x.dimension, x.wert]));
    expect(nach.get("sicherheit")).toBe(1);
    expect(nach.get("belastung")).toBe(0);
  });
});

describe("Die Fragereihenfolge folgt dem, was fehlt", () => {
  /*
   * Monday konnte den Career Twin bisher nur zufällig füllen: Sie nahm
   * die erste offene Frage eines Themas, unabhängig davon, ob deren
   * Antwort überhaupt eine Achse trifft — und ob die Achse schon
   * beantwortet war.
   */
  it("zählt, wie viele offene Achsen eine Frage treffen kann", () => {
    const alleOffen = [
      "autonomie", "belastung", "kundenkontakt", "struktur", "teamarbeit",
      "tempo", "sicherheit", "lernen", "verantwortung", "wiederholung",
    ] as const;
    /* Die Kündigungsfrage trägt die meisten Achsen im ganzen Leser. */
    expect(offeneAchsenTreffer("quit_after_three_months", alleOffen)).toBeGreaterThan(
      offeneAchsenTreffer("own_decisions", alleOffen),
    );
  });

  it("zählt eine schon beantwortete Achse nicht mit", () => {
    expect(offeneAchsenTreffer("own_decisions", ["autonomie"])).toBe(1);
    expect(offeneAchsenTreffer("own_decisions", ["belastung"])).toBe(0);
  });

  it("gibt null für eine Frage, die der Leser nicht kennt", () => {
    /*
     * Sie kann trotzdem sinnvoll sein — sie liefert Belege und
     * Erfahrungen, die mit den Achsen nichts zu tun haben. Sie steht
     * nur nicht vorn.
     */
    expect(offeneAchsenTreffer("goal_change", ["autonomie"])).toBe(0);
  });
});
