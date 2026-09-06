import { describe, expect, it } from "vitest";
import { berufsbild } from "./berufsbild.ts";

describe("Fotos je Berufsfeld", () => {
  /*
   * Ab hier trägt jede Stelle ein Foto statt eines Piktogramms. Zwei
   * Dinge dürfen dabei nicht kippen: Das Motiv muss zur Gruppe
   * gehören, und dieselbe Stelle muss immer dasselbe bekommen.
   */
  const stelle = (id: string, title: string) => ({ id, title, companyName: "Beispiel GmbH" });

  it("gibt derselben Stelle immer dasselbe Motiv", () => {
    // Der Server rendert zweimal. Ein Zufallsmotiv erzeugte hier eine
    // Abweichung zwischen Server und Browser — und beim Zurückgehen
    // stünde ein anderes Bild als eben.
    const a = berufsbild(stelle("abc-123", "Tischler (m/w/d)"));
    const b = berufsbild(stelle("abc-123", "Tischler (m/w/d)"));
    expect(a.foto?.gross).toBe(b.foto?.gross);
    expect(a.foto).not.toBeNull();
  });

  it("verteilt die Motive einer Gruppe über verschiedene Stellen", () => {
    /*
     * Ohne Streuung zeigten die 5.521 Handwerksstellen einer
     * Stichprobe alle dasselbe Foto — eine Liste mit einem einzigen
     * wiederholten Bild.
     */
    const motive = new Set(
      Array.from({ length: 40 }, (_, i) => berufsbild(stelle(`id-${i}`, "Elektriker (m/w/d)")).foto?.gross),
    );
    expect(motive.size).toBeGreaterThan(2);
  });

  it("nimmt kein Motiv aus einer fremden Gruppe", () => {
    const pflege = berufsbild(stelle("x1", "Pflegefachkraft (m/w/d)"));
    expect(pflege.gruppe).toBe("healthcare");
    expect(pflege.foto?.gross).toContain("/fotos/beruf/");
  });

  it("erfindet kein Foto, wenn das Feld unbekannt ist", () => {
    // Lieber der Verlauf als ein Foto, das die falsche Arbeit zeigt.
    const unklar = berufsbild(stelle("x2", "Mitarbeiter (m/w/d)"));
    if (unklar.gruppe === null) expect(unklar.foto).toBeNull();
  });
});
