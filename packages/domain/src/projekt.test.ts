import { describe, expect, it } from "vitest";
import {
  MAX_AKTIVE_PROJEKTE,
  MAX_NAME,
  gleicherName,
  projektAnlegenPruefen,
  projektnameNormalisieren,
  type Vorhandenesprojekt,
} from "./projekt.ts";

const p = (name: string, status = "aktiv", id = name): Vorhandenesprojekt => ({ id, name, status });

describe("Der Name in der Seitenleiste", () => {
  it("wirft Zeilenumbrüche und doppelte Leerzeichen weg", () => {
    /*
     * Ein Modell liefert gern „Zürich\n(Projektmanagement)". In einer
     * einzeiligen Leiste wird daraus „Zürich (Projektmanagement" mit
     * abgeschnittenem Rest.
     */
    expect(projektnameNormalisieren("Zürich\n(Projektmanagement)")).toBe("Zürich (Projektmanagement)");
    expect(projektnameNormalisieren("  Berlin   Nord  ")).toBe("Berlin Nord");
  });

  it("kürzt auf eine Länge, die nicht abgeschnitten wird", () => {
    expect(projektnameNormalisieren("x".repeat(200))).toHaveLength(MAX_NAME);
  });

  it("hält zwei Schreibweisen für denselben Namen", () => {
    expect(gleicherName("Zürich", "  zürich ")).toBe(true);
    expect(gleicherName("Zürich", "Zug")).toBe(false);
  });
});

describe("Wann daraus ein Vorhaben wird", () => {
  it("legt an, wenn der Name taugt und es das noch nicht gibt", () => {
    const u = projektAnlegenPruefen("Zürich", []);
    expect(u.erlaubt).toBe(true);
    if (!u.erlaubt) return;
    expect(u.name).toBe("Zürich");
  });

  it("verlangt einen Namen, den man wiedererkennt", () => {
    const u = projektAnlegenPruefen(" ", []);
    expect(u.erlaubt).toBe(false);
    if (u.erlaubt || u.grund === "existiert") return;
    expect(u.grund).toBe("zu_kurz");
  });
});

describe("Ein vorhandenes Vorhaben ist kein Fehler", () => {
  it("gibt das vorhandene zurück, statt ein zweites anzulegen", () => {
    /*
     * Wer nach drei Wochen wieder über Zürich spricht, meint dasselbe
     * Vorhaben. Ein zweites daneben wäre nicht unterscheidbar, und
     * die Stellen lägen danach in zwei Töpfen.
     */
    const u = projektAnlegenPruefen("zürich", [p("Zürich", "aktiv", "id-1")]);
    expect(u.erlaubt).toBe(false);
    if (u.erlaubt || u.grund !== "existiert") throw new Error("sollte existieren");
    expect(u.vorhandenesId).toBe("id-1");
    expect(u.name).toBe("Zürich");
  });

  it("findet auch ein ruhendes", () => {
    /* Wer ein pausiertes Zürich hat und wieder darüber spricht, meint
       dieses — nicht ein neues daneben. */
    const u = projektAnlegenPruefen("Zürich", [p("Zürich", "ruht", "id-2")]);
    expect(u.erlaubt).toBe(false);
    if (u.erlaubt || u.grund !== "existiert") throw new Error("sollte existieren");
    expect(u.vorhandenesId).toBe("id-2");
  });
});

describe("Die Leiste bleibt lesbar", () => {
  it("verweigert ein weiteres, wenn zwölf offen sind", () => {
    /*
     * Was nicht ohne Scrollen in die Seitenleiste passt, wird nicht
     * mehr gelesen. Wer mehr braucht, schliesst zuerst eines ab — und
     * genau diese Entscheidung ist die nützliche.
     */
    const viele = Array.from({ length: MAX_AKTIVE_PROJEKTE }, (_, i) => p(`Vorhaben ${i}`));
    const u = projektAnlegenPruefen("Noch eins", viele);
    expect(u.erlaubt).toBe(false);
    if (u.erlaubt || u.grund === "existiert") return;
    expect(u.grund).toBe("zu_viele");
    expect(u.hinweis).toMatch(/Schliesse oder pausiere/);
  });

  it("zählt ruhende nicht mit", () => {
    /* Sie stehen nicht im Weg — sie sind der Ausweg. */
    const viele = Array.from({ length: MAX_AKTIVE_PROJEKTE }, (_, i) =>
      p(`Vorhaben ${i}`, "ruht"),
    );
    expect(projektAnlegenPruefen("Noch eins", viele).erlaubt).toBe(true);
  });
});
