import { describe, expect, it } from "vitest";
import {
  abschluss, BEDIENUNG, berechtigungen, BRIEFING, HINTERGRUND, NIEMALS, STUFEN, VERTRAUEN, weiterZu,
  type Kontotyp, type Stufe,
} from "./texte";

const TYPEN: Kontotyp[] = ["arbeitnehmer", "unternehmen"];
const ALLE: Stufe[] = ["manual", "observe_and_save", "prepare_and_connect"];

describe("Texte je Kontotyp", () => {
  it("spricht Arbeitnehmer und Unternehmen verschieden an", () => {
    expect(HINTERGRUND.arbeitnehmer.titel).toContain("Chancen");
    expect(HINTERGRUND.unternehmen.titel).toContain("passenden Menschen");
    expect(BEDIENUNG.unternehmen.text).toContain("euer Unternehmen");
    expect(BRIEFING.unternehmen.titel).toContain("Recruiting");
  });

  it("nennt für Unternehmen die Veröffentlichung im ersten Vertrauenspunkt", () => {
    expect(VERTRAUEN.unternehmen[0]).toContain("keine Stelle");
    expect(VERTRAUEN.arbeitnehmer[0]).toContain("ohne deine Freigabe");
  });

  it("empfiehlt Sprache, wählt sie aber nicht vor", () => {
    for (const t of TYPEN) {
      const sprache = BEDIENUNG[t].karten.find((k) => k.wert === "sprache");
      expect(sprache?.badge).toBe("Empfohlen");
      /* Es gibt kein „standard"-Feld — die Empfehlung ist ein
         Abzeichen und keine Vorbelegung. */
      expect(Object.keys(sprache ?? {})).not.toContain("standard");
    }
  });

  it("empfiehlt Stufe 2, ohne sie zu setzen", () => {
    for (const t of TYPEN) {
      const mitBadge = STUFEN[t].filter((s) => s.badge);
      expect(mitBadge).toHaveLength(1);
      expect(mitBadge[0]!.wert).toBe("observe_and_save");
    }
  });

  it("schreibt den Hinweis auf gegenseitige Zustimmung an Stufe 3", () => {
    for (const t of TYPEN) {
      const drei = STUFEN[t].find((s) => s.wert === "prepare_and_connect");
      expect(drei?.nachsatz).toContain("gegenseitiger Zustimmung");
    }
  });
});

describe("Berechtigungen", () => {
  it("erweitert das Dürfen mit jeder Stufe", () => {
    for (const t of TYPEN) {
      const laengen = ALLE.map((s) => berechtigungen(t, s).darf.length);
      expect(laengen[0]).toBeLessThan(laengen[1]!);
      expect(laengen[1]).toBeLessThan(laengen[2]!);
    }
  });

  it("lässt die Verbote von keiner Stufe berühren — das ist der ganze Punkt", () => {
    for (const t of TYPEN) {
      for (const s of ALLE) {
        expect(berechtigungen(t, s).niemals).toEqual(NIEMALS[t]);
      }
    }
  });

  it("verbietet Arbeitnehmern gegenüber das Versenden und Offenlegen", () => {
    const n = NIEMALS.arbeitnehmer.join(" ");
    expect(n).toContain("Bewerbung verbindlich versenden");
    expect(n).toContain("Kontaktdaten offenlegen");
    expect(n).toContain("Kündigung");
  });

  it("verbietet Unternehmen gegenüber Veröffentlichen und Entscheiden", () => {
    const n = NIEMALS.unternehmen.join(" ");
    expect(n).toContain("Stelle veröffentlichen");
    expect(n).toContain("Einstellungsentscheidung");
    expect(n).toContain("verbindliches Jobangebot");
  });

  it("erlaubt in keiner Stufe etwas, das die Verbotsliste nennt", () => {
    for (const t of TYPEN) {
      for (const s of ALLE) {
        const darf = berechtigungen(t, s).darf.join(" ").toLowerCase();
        expect(darf).not.toContain("versenden");
        expect(darf).not.toContain("veröffentlich");
        expect(darf).not.toContain("entscheid");
      }
    }
  });
});

describe("Abschlusstext", () => {
  const b = { briefingAktiv: false, rhythmus: "werktags" as const, zeit: "08:00" };

  it("sagt bei Stufe 1 nicht, dass Nina im Hintergrund sucht", () => {
    const a = abschluss({ kontotyp: "arbeitnehmer", bedienart: "text", stufe: "manual", ...b });
    expect(a.text).toContain("nur, wenn du sie öffnest");
    expect(a.text).not.toContain("im Hintergrund");
  });

  it("nennt den Hintergrund ab Stufe 2", () => {
    const a = abschluss({ kontotyp: "arbeitnehmer", bedienart: "sprache", stufe: "observe_and_save", ...b });
    expect(a.text).toContain("im Hintergrund");
    expect(a.text).toContain("Du sprichst mit Nina");
  });

  it("nennt das Briefing nur, wenn es an ist", () => {
    const aus = abschluss({ kontotyp: "arbeitnehmer", bedienart: "text", stufe: "observe_and_save", ...b });
    expect(aus.text).not.toContain("Briefing");

    const an = abschluss({
      kontotyp: "arbeitnehmer", bedienart: "text", stufe: "observe_and_save",
      briefingAktiv: true, rhythmus: "werktags", zeit: "08:00",
    });
    expect(an.text).toContain("werktags um 08:00 Uhr");
  });

  it("siezt Unternehmen im Plural und nennt ihre Grenzen", () => {
    const a = abschluss({ kontotyp: "unternehmen", bedienart: "sprache", stufe: "prepare_and_connect", ...b });
    expect(a.titel).toContain("euer Unternehmen");
    expect(a.text).toContain("Ihr sprecht mit Nina");
    expect(a.text).toContain("eure Freigabe");
    expect(a.knoepfe.primaer).toContain("unser Unternehmen");
  });

  it("verspricht Arbeitnehmern, dass nichts ohne Freigabe rausgeht", () => {
    const a = abschluss({ kontotyp: "arbeitnehmer", bedienart: "text", stufe: "prepare_and_connect", ...b });
    expect(a.text).toContain("niemals ohne deine Freigabe");
  });
});

describe("Weiterleitung", () => {
  it("führt Kontotypen an verschiedene Orte", () => {
    expect(weiterZu("arbeitnehmer")).toBe("/app/nina");
    expect(weiterZu("unternehmen")).toBe("/business/onboarding");
  });
});
