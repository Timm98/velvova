import { describe, expect, it } from "vitest";
import { MIN_TAGE, standzeit, standzeitFolge, type Standzeitreferenz } from "./standzeit.ts";

const JETZT = new Date("2026-09-04T12:00:00Z");
const vorTagen = (n: number) => new Date(JETZT.getTime() - n * 86400000);

/* Informatik: gemessener Median 25, p90 239. */
const IT: Standzeitreferenz = { gruppe: "43", stellen: 27860, medianTage: 25, p90Tage: 239 };
/* Hoch- und Tiefbau: gemessener Median 108, p90 434. */
const BAU: Standzeitreferenz = { gruppe: "32", stellen: 16259, medianTage: 108, p90Tage: 434 };

describe("standzeit", () => {
  it("schweigt ohne Veröffentlichungsdatum", () => {
    expect(standzeit(null, IT, JETZT)).toBeNull();
  });

  it("schweigt bei einer frischen Anzeige", () => {
    /* Jede Stelle ist mal neu. Darüber gibt es nichts zu sagen. */
    expect(standzeit(vorTagen(MIN_TAGE - 1), IT, JETZT)).toBeNull();
  });

  it("nennt dieselbe Standzeit je nach Berufsfeld verschieden", () => {
    /*
     * Der Kern der Sache: 200 Tage sind im IT ein Ausreisser und im
     * Hochbau normal. Eine absolute Grenze würde jede Baustelle
     * anschwärzen und jede alte IT-Stelle durchlassen.
     */
    expect(standzeit(vorTagen(200), IT, JETZT)!.befund).toBe("laenger");
    expect(standzeit(vorTagen(200), BAU, JETZT)!.befund).toBe("unauffaellig");
  });

  it("meldet auffällig erst oberhalb des p90", () => {
    expect(standzeit(vorTagen(240), IT, JETZT)!.befund).toBe("auffaellig");
    expect(standzeit(vorTagen(239), IT, JETZT)!.befund).toBe("laenger");
  });

  it("nennt die Vergleichszahl im Satz", () => {
    /* Ohne Grundlage wäre „auffällig" ein Urteil statt einer Messung. */
    const s = standzeit(vorTagen(300), IT, JETZT)!;
    expect(s.satz).toContain("300 Tagen");
    expect(s.satz).toContain("25 Tagen");
    expect(s.satz).toContain("239");
  });

  it("deutet nicht, wenn die Gruppe zu klein ist", () => {
    const duenn: Standzeitreferenz = { gruppe: "99", stellen: 120, medianTage: 12, p90Tage: 30 };
    const s = standzeit(vorTagen(400), duenn, JETZT)!;
    expect(s.befund).toBe("unauffaellig");
    expect(s.medianTage).toBeNull();
    expect(s.satz).toBe("Diese Anzeige steht seit 400 Tagen.");
  });

  it("nennt ohne Referenz nur die eigene Zahl", () => {
    const s = standzeit(vorTagen(90), null, JETZT)!;
    expect(s.medianTage).toBeNull();
    expect(s.satz).not.toContain("üblich");
  });
});

describe("standzeitFolge", () => {
  it("lässt beide Möglichkeiten offen", () => {
    /*
     * Über die Absicht eines Arbeitgebers wissen wir nichts. Eine
     * Behauptung darüber wäre dieselbe unbelegte Aussage, gegen die
     * dieses Produkt gebaut ist.
     */
    const t = standzeitFolge("auffaellig")!;
    expect(t).toContain("schwer zu besetzen");
    expect(t).toContain("niemand gesucht");
  });

  it("schweigt bei allem darunter", () => {
    expect(standzeitFolge("laenger")).toBeNull();
    expect(standzeitFolge("unauffaellig")).toBeNull();
  });
});
