import { describe, expect, it, vi } from "vitest";
import { route } from "./router.ts";
import { vergleichen, zweiteMeinung } from "./zweitemeinung.ts";

const TIEF = route("career_transition_analysis");
const FAKTEN = "Vier Jahre Erfahrung, Branchenwechsel gewünscht, ab 70.000 €.";

/* Eine Analyse, wie sie aus einem strukturierten Lauf käme. */
const ERST = { overallFit: 72, empfehlung: "passt", risiken: 2 };

describe("Vergleich zweier Analysen", () => {
  it("hält kleine Zahlenunterschiede für Rauschen", () => {
    /* Fünf Punkte auf einer Skala bis 100 sind keine andere Meinung. */
    expect(vergleichen({ fit: 70 }, { fit: 75 })).toHaveLength(0);
  });

  it("meldet einen deutlichen Unterschied", () => {
    const a = vergleichen({ fit: 70 }, { fit: 40 });
    expect(a).toHaveLength(1);
    expect(a[0]!.abstand).toBe(30);
  });

  it("vergleicht kurze Entscheidungen, nicht ganze Absätze", () => {
    /*
     * Zwei Analysen schreiben denselben Gedanken nie gleich auf. Ein
     * Absatzvergleich ergäbe immer eine Abweichung — und damit nie
     * eine Aussage.
     */
    expect(vergleichen({ empfehlung: "passt" }, { empfehlung: "passt nicht" })).toHaveLength(1);
    const lang = "a".repeat(200);
    expect(vergleichen({ text: lang }, { text: "b".repeat(200) })).toHaveLength(0);
  });

  it("meldet einen gekippten Ja-Nein-Wert", () => {
    expect(vergleichen({ empfohlen: true }, { empfohlen: false })).toHaveLength(1);
  });
});

describe("Wann eine zweite Meinung eingeholt wird", () => {
  const grund = { entscheidung: TIEF, fakten: FAKTEN, erst: ERST };

  it("bleibt aus, wenn die höchste Stufe nicht eingerichtet ist", async () => {
    const lauf = vi.fn();
    const b = await zweiteMeinung({ ...grund, zweitlauf: lauf, ultraVerfuegbar: false });
    expect(b.zweitLief).toBe(false);
    expect(lauf).not.toHaveBeenCalled();
    expect(b.grund).toMatch(/Keine höchste Stufe/);
  });

  it("bleibt bei klarer Lage aus", async () => {
    /* Sie kostet einen Lauf des teuersten Modells. Bei einer klaren
       Lage ist das Geld für eine Bestätigung. */
    const lauf = vi.fn();
    const b = await zweiteMeinung({
      ...grund,
      konfidenz: 0.9,
      last: { optionen: 2 },
      zweitlauf: lauf,
      ultraVerfuegbar: true,
    });
    expect(b.zweitLief).toBe(false);
    expect(lauf).not.toHaveBeenCalled();
  });

  it("läuft bei unsicherer Lage mit mehreren Optionen", async () => {
    const b = await zweiteMeinung({
      ...grund,
      konfidenz: 0.3,
      last: { optionen: 5 },
      zweitlauf: async () => ({ ...ERST }),
      ultraVerfuegbar: true,
    });
    expect(b.zweitLief).toBe(true);
    expect(b.einig).toBe(true);
    expect(b.hinweis).toBeNull();
  });

  it("bekommt nur die Fakten, nicht die erste Antwort", async () => {
    /*
     * Der ganze Punkt. Bekäme die zweite Analyse die erste
     * mitgeliefert, hätte man keine zweite Meinung, sondern eine
     * Bestätigung.
     */
    const lauf = vi.fn(async (f: string) => {
      expect(f).toBe(FAKTEN);
      expect(f).not.toContain("72");
      expect(f).not.toContain("passt");
      return { ...ERST };
    });
    await zweiteMeinung({
      ...grund,
      konfidenz: 0.3,
      last: { optionen: 5 },
      zweitlauf: lauf,
      ultraVerfuegbar: true,
    });
    expect(lauf).toHaveBeenCalledTimes(1);
  });
});

describe("Wenn beide auseinandergehen", () => {
  it("entscheidet nicht, sondern macht es sichtbar", async () => {
    /*
     * „Das teurere Modell hat recht" wäre keine Prüfung, sondern eine
     * Rangordnung. Zwei auseinandergehende Analysen sind eine
     * Auskunft über die Frage: Sie ist offen.
     */
    const b = await zweiteMeinung({
      entscheidung: TIEF,
      fakten: FAKTEN,
      erst: ERST,
      konfidenz: 0.3,
      last: { optionen: 5 },
      zweitlauf: async () => ({ overallFit: 41, empfehlung: "passt nicht", risiken: 2 }),
      ultraVerfuegbar: true,
    });

    expect(b.einig).toBe(false);
    expect(b.abweichungen.map((a) => a.feld)).toContain("overallFit");
    /* Beide Ergebnisse bleiben erhalten — keines wird verworfen. */
    expect(b.erst).toEqual(ERST);
    expect(b.zweit).not.toBeNull();
  });

  it("nennt der Person das Thema, nicht die Modelle", async () => {
    const b = await zweiteMeinung({
      entscheidung: TIEF,
      fakten: FAKTEN,
      erst: ERST,
      konfidenz: 0.3,
      last: { optionen: 5 },
      zweitlauf: async () => ({ ...ERST, overallFit: 30 }),
      ultraVerfuegbar: true,
    });
    expect(b.hinweis).toContain("overallFit");
    /* Ein Blick in unsere Maschine ist für sie keine Auskunft. */
    expect(b.hinweis).not.toMatch(/astra|sol|gpt|Modell/i);
  });
});

describe("Wenn die zweite Analyse scheitert", () => {
  it("lässt die erste stehen", async () => {
    /* Die erste war nie von der zweiten abhängig — das wäre auch der
       falsche Aufbau. */
    const b = await zweiteMeinung({
      entscheidung: TIEF,
      fakten: FAKTEN,
      erst: ERST,
      konfidenz: 0.3,
      last: { optionen: 5 },
      zweitlauf: async () => {
        throw new Error("Zeitüberschreitung");
      },
      ultraVerfuegbar: true,
    });
    expect(b.zweitLief).toBe(false);
    expect(b.erst).toEqual(ERST);
    expect(b.grund).toMatch(/nicht möglich/);
  });
});
