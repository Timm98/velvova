import { describe, expect, it } from "vitest";
import { geltungAusSatz } from "./geltung.ts";

/**
 * Die teure Fehlerrichtung steht zuerst.
 *
 * Eine Sitzungssuche, die als dauerhafte Präferenz im Profil landet,
 * verschlechtert jede spätere Jobliste — und niemand kann es
 * zurückverfolgen, weil im Profil nur das Ergebnis steht und nicht der
 * beiläufige Satz, aus dem es kam.
 */

describe("Nur für diese Suche", () => {
  it("erkennt den Beispielsatz aus der Anforderung", () => {
    const b = geltungAusSatz("Zeig mir heute mal Jobs in Berlin.");
    expect(b.geltung).toBe("sitzung");
    expect(b.sicherheit).toBeGreaterThan(0.8);
  });

  it("erkennt weitere gebräuchliche Formulierungen", () => {
    for (const satz of [
      "Zeig mir für diese Suche mal Hamburg.",
      "Ich will diesmal nur Remote sehen.",
      "Lass mich testweise nach München schauen.",
      "Nur mal schauen, was es in Köln gibt.",
      "Interessehalber: was gibt es in Leipzig?",
    ]) {
      expect(geltungAusSatz(satz).geltung, satz).toBe("sitzung");
    }
  });

  it("braucht zwei schwache Marker, nicht einen", () => {
    /*
     * „mal“ steht in fast jedem gesprochenen deutschen Satz. Ein
     * einzelnes „mal“ als Sitzungssignal zu werten hiesse, praktisch
     * jede Äusserung zur Sitzung zu erklären — und damit wäre die
     * dauerhafte Präferenz gar nicht mehr erreichbar.
     */
    expect(geltungAusSatz("Zeig mir mal Stellen in Berlin.").geltung).toBe("unklar");
    expect(geltungAusSatz("Zeig mir kurz mal Stellen in Berlin.").geltung).toBe("sitzung");
  });
});

describe("Ab jetzt allgemein", () => {
  it("erkennt den Gegensatz aus der Anforderung", () => {
    const b = geltungAusSatz("Ich möchte zukünftig eigentlich nur noch in Berlin arbeiten.");
    expect(b.geltung).toBe("dauerhaft");
    expect(b.sicherheit).toBeGreaterThan(0.8);
  });

  it("erkennt weitere Dauerformulierungen", () => {
    for (const satz of [
      "Ab jetzt bitte nur noch Remote.",
      "Grundsätzlich keine Schichtarbeit mehr.",
      "Ich will künftig in Karlsruhe bleiben.",
      "Merk dir das bitte.",
      "Nie wieder Kaltakquise.",
    ]) {
      expect(geltungAusSatz(satz).geltung, satz).toBe("dauerhaft");
    }
  });

  it("lässt Dauer die Zeitpartikel schlagen", () => {
    /*
     * „Ab jetzt möchte ich mal nur noch Remote“ enthält beides. „mal“
     * ist hier Füllwort, „ab jetzt … nur noch“ ist die Aussage. Wer
     * zuerst auf die schwachen Zeitmarker prüft, kommt zum falschen
     * Ergebnis — und speichert eine Lebensentscheidung als Tagessuche.
     */
    expect(geltungAusSatz("Ab jetzt möchte ich mal nur noch Remote.").geltung).toBe("dauerhaft");
  });
});

describe("Wenn der Satz es nicht sagt", () => {
  it("rät nicht, sondern bleibt unklar", () => {
    /*
     * Der wichtigste Test der Datei.
     *
     * Die Voreinstellung ist NICHT „dauerhaft“. Wäre sie es, würde
     * jeder beiläufige Satz das Profil verändern — genau der Fehler,
     * gegen den dieses Modul gebaut ist.
     */
    for (const satz of [
      "Ich suche etwas in Berlin.",
      "Berlin wäre interessant.",
      "Was gibt es in Hamburg?",
      "Ich könnte mir Remote vorstellen.",
    ]) {
      const b = geltungAusSatz(satz);
      expect(b.geltung, satz).toBe("unklar");
      expect(b.sicherheit, satz).toBe(0);
    }
  });

  it("kommt mit leerer Eingabe zurecht", () => {
    expect(geltungAusSatz("").geltung).toBe("unklar");
    expect(geltungAusSatz("   ").geltung).toBe("unklar");
  });
});
