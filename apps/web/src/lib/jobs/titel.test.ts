import { describe, expect, it } from "vitest";
import { titelOhneEmoji } from "./titel.ts";

describe("Emojis aus Stellentiteln", () => {
  it("nimmt sie heraus und räumt die Lücke auf", () => {
    expect(titelOhneEmoji("Pflegefachkraft (m/w/d) 🚀 in Mainz")).toBe(
      "Pflegefachkraft (m/w/d) in Mainz",
    );
  });

  it("lässt einen Titel ohne Emoji unangetastet", () => {
    const t = "Fachkraft für Lagerlogistik (m/w/d) – 36.000 €";
    expect(titelOhneEmoji(t)).toBe(t);
  });

  it("fasst Umlaute, Euro und Klammerzusätze nicht an", () => {
    const t = "Bürokauffrau (m/w/d), 45.000 € – Vollzeit";
    expect(titelOhneEmoji(t)).toBe(t);
  });

  it("lässt das Mal-Zeichen stehen", () => {
    /*
     * Die erste Fassung entfernte Zeichenbereiche statt Emojis und
     * nahm „3× die Woche" das ×.
     */
    expect(titelOhneEmoji("Aushilfe 3× die Woche ⭐")).toBe("Aushilfe 3× die Woche");
  });

  it("entfernt zusammengesetzte Emojis vollständig", () => {
    /* Hautton und Verbinder gehören zum Emoji, nicht zum Text. */
    expect(titelOhneEmoji("Team 👩🏽‍💻 gesucht")).toBe("Team gesucht");
  });

  it("räumt Trennzeichen auf, die ins Leere zeigen", () => {
    expect(titelOhneEmoji("Koch (m/w/d) ⭐")).toBe("Koch (m/w/d)");
    expect(titelOhneEmoji("🔥 Staplerfahrer")).toBe("Staplerfahrer");
  });

  it("behält einen Titel, der nur aus Emojis besteht", () => {
    /* Eine leere Zeile in der Liste sähe aus wie ein Datenfehler. */
    expect(titelOhneEmoji("🚀🔥")).toBe("🚀🔥");
  });
});
