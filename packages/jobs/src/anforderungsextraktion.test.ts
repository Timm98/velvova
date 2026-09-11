import { describe, expect, it } from "vitest";
import { anforderungenExtrahieren, verteilung } from "./anforderungsextraktion.ts";

/**
 * Der Fall aus dem Auftrag, Wort für Wort.
 *
 * Er ist der Massstab: Aus diesem Absatz müssen mehrere Einträge
 * entstehen, nicht einer — und die Tätigkeit darf keine Hürde werden.
 */
const BEISPIEL = `Ihre Aufgaben
Sie kommissionieren Waren
Sie führen Wareneingangskontrollen durch
Sie bedienen Flurförderzeuge
Ihr Profil
Voraussetzung ist ein gültiger Staplerschein
Erfahrung mit SAP ist von Vorteil`;

describe("Der Beispielabsatz aus dem Auftrag", () => {
  const e = anforderungenExtrahieren(BEISPIEL);

  it("ergibt mehrere Einträge, nicht einen", () => {
    expect(e.eintraege.length).toBeGreaterThanOrEqual(5);
  });

  it("erkennt die drei Tätigkeiten als Tätigkeiten", () => {
    const tasks = e.eintraege.filter((x) => x.kategorie === "TASK");
    expect(tasks).toHaveLength(3);
    expect(tasks.map((t) => t.bedeutung).join(" ")).toMatch(/kommissionieren/i);
    expect(tasks.map((t) => t.bedeutung).join(" ")).toMatch(/Wareneingangskontrollen/i);
  });

  it("macht aus keiner Tätigkeit eine Pflicht", () => {
    for (const t of e.eintraege.filter((x) => x.kategorie === "TASK")) {
      expect(t.verbindlichkeit).toBe("unklar");
    }
  });

  it("liest den Staplerschein als rechtliche Voraussetzung und als Muss", () => {
    const s = e.eintraege.find((x) => /staplerschein/i.test(x.original))!;
    expect(s.kategorie).toBe("LEGAL_REQUIREMENT");
    expect(s.verbindlichkeit).toBe("muss");
    expect(s.belegstelle).toMatch(/Voraussetzung/i);
  });

  it("liest SAP als Wunsch, nicht als Pflicht", () => {
    const sap = e.eintraege.find((x) => /sap/i.test(x.original))!;
    expect(sap.verbindlichkeit).toBe("wunsch");
    expect(sap.belegstelle).toMatch(/Vorteil/i);
  });
});

describe("Eine Tätigkeit ist keine Fähigkeit", () => {
  it("macht aus „Sie bedienen einen Scanner“ keine Anforderung", () => {
    const e = anforderungenExtrahieren("Ihre Aufgaben\nSie bedienen einen Scanner");
    expect(e.eintraege[0]!.kategorie).toBe("TASK");
    expect(e.eintraege[0]!.verbindlichkeit).toBe("unklar");
  });

  it("macht daraus eine Anforderung, sobald Erfahrung verlangt wird", () => {
    const e = anforderungenExtrahieren("Ihr Profil\nErfahrung im Umgang mit Scannern erforderlich");
    expect(e.eintraege[0]!.verbindlichkeit).toBe("muss");
    expect(e.eintraege[0]!.kategorie).not.toBe("TASK");
  });
});

describe("Verbindlichkeit", () => {
  it("lässt aus „idealerweise“ nie ein Muss werden", () => {
    for (const wort of ["idealerweise", "von Vorteil", "wünschenswert", "nice to have", "kein Muss"]) {
      const e = anforderungenExtrahieren(`Ihr Profil\nSAP-Kenntnisse ${wort}`);
      expect(e.eintraege[0]!.verbindlichkeit).toBe("wunsch");
    }
  });

  it("setzt Muss nur bei eindeutigen Wendungen oder im Profilblock", () => {
    for (const wort of ["zwingend erforderlich", "ist Voraussetzung", "setzen wir voraus"]) {
      const e = anforderungenExtrahieren(`Staplerschein ${wort} für diese Stelle`);
      expect(e.eintraege[0]!.verbindlichkeit).toBe("muss");
    }
  });

  it("sagt „unklar“ statt zu raten", () => {
    /*
     * Ein Signalwort ohne Modalwort und ohne Abschnitt: Die Zeile
     * sagt etwas über die Stelle, aber nicht, ob sie Pflicht ist.
     */
    const e = anforderungenExtrahieren("Erfahrung mit Gabelstaplern und Hubwagen");
    expect(e.eintraege[0]!.verbindlichkeit).toBe("unklar");
    expect(e.eintraege[0]!.konfidenz).toBeLessThan(50);
  });

  it("nimmt vor der ersten Überschrift nur Zeilen mit Signal auf", () => {
    /*
     * Firmenwerbung am Anfang einer Anzeige ist kein Anspruch an
     * einen Menschen. Gemessen: In einer Anzeige entstanden so
     * neun Einträge, von denen keiner eine Anforderung war.
     */
    const e = anforderungenExtrahieren(
      "Wir sind an über 120 Standorten für unsere Kunden im Einsatz.\nErfahrung im Lager erforderlich",
    );
    expect(e.eintraege).toHaveLength(1);
  });

  it("liest den Wunsch auch dann, wenn ein Mussewort danebensteht", () => {
    const e = anforderungenExtrahieren("Ihr Profil\nSAP ist zwingend von Vorteil");
    expect(e.eintraege[0]!.verbindlichkeit).toBe("wunsch");
  });
});

describe("Was nicht hineingehört", () => {
  it("nimmt den Angebotsblock nicht auf", () => {
    const e = anforderungenExtrahieren("Wir bieten\n30 Urlaubstage\nBetriebliche Altersvorsorge");
    expect(e.eintraege).toHaveLength(0);
  });

  it("nimmt Überschriften nicht als Anforderung", () => {
    const e = anforderungenExtrahieren("Ihre Aufgaben\nSie kommissionieren Waren");
    expect(e.eintraege.some((x) => /^ihre aufgaben$/i.test(x.bedeutung))).toBe(false);
  });

  it("zählt dieselbe Aussage nur einmal", () => {
    const e = anforderungenExtrahieren("Ihr Profil\nStaplerschein erforderlich\nStaplerschein erforderlich");
    expect(e.eintraege).toHaveLength(1);
  });
});

describe("Erfahrung mit Bezug", () => {
  it("liest Feld und Mass, wenn der Text sie hergibt", () => {
    const e = anforderungenExtrahieren("Ihr Profil\nMehrjährige Erfahrung in der LKW-Disposition");
    const x = e.eintraege[0]!;
    expect(x.kategorie).toBe("EXPERIENCE");
    expect(x.erfahrungsfeld).toMatch(/disposition/i);
    expect(x.erfahrungsmass).toBe("mehrjährig");
  });

  it("lässt das Feld leer, wenn keines dasteht", () => {
    const e = anforderungenExtrahieren("Ihr Profil\nMehrjährige Berufserfahrung erforderlich");
    expect(e.eintraege[0]!.erfahrungsfeld).toBeNull();
    expect(e.eintraege[0]!.erfahrungsmass).toBe("mehrjährig");
  });
});

describe("Arbeitsbedingungen bleiben in ihrer Kette", () => {
  it("führt Schichtbereitschaft nicht als Fähigkeit", () => {
    const e = anforderungenExtrahieren("Ihr Profil\nBereitschaft zur Arbeit im 2-Schicht-Betrieb");
    expect(e.eintraege[0]!.kategorie).toBe("WORK_CONDITION");
  });
});

describe("Die Verteilung", () => {
  it("zählt je Kategorie", () => {
    const v = verteilung(anforderungenExtrahieren(BEISPIEL));
    expect(v.TASK).toBe(3);
    expect(v.LEGAL_REQUIREMENT).toBe(1);
  });
});
