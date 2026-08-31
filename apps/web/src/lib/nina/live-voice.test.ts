import { describe, expect, it } from "vitest";
import { START, weiter, type LiveEreignis, type LiveStand } from "./live-voice.ts";

/**
 * Die Reihenfolgefragen eines Sprachgesprächs.
 *
 * Alles hier prüft denselben Grundfall in Varianten: etwas trifft ein,
 * nachdem es nicht mehr gilt. Diese Fehler sind im Betrieb kaum zu
 * finden — sie brauchen genaues Timing, sie treten selten auf, und wenn
 * sie auftreten, klingen sie wie ein Aussetzer und nicht wie ein Fehler.
 * In einer reinen Funktion sind sie in einer Millisekunde reproduzierbar.
 */

function spiele(ereignisse: LiveEreignis[], start: LiveStand = START) {
  let stand = start;
  const wirkungen = [];
  for (const e of ereignisse) {
    const schritt = weiter(stand, e);
    stand = schritt.stand;
    wirkungen.push(schritt.wirkung);
  }
  return { stand, wirkungen, letzte: wirkungen[wirkungen.length - 1]! };
}

const bisZugehört: LiveEreignis[] = [{ art: "verbinden" }, { art: "verbunden" }];

describe("Live-Gespräch", () => {
  it("geht den normalen Weg: hören, denken, sprechen, wieder hören", () => {
    let stand = spiele(bisZugehört).stand;
    expect(stand.zustand).toBe("hört");

    stand = weiter(stand, { art: "sprache_beginnt" }).stand;
    stand = weiter(stand, { art: "teiltranskript", text: "Ich arbeite im" }).stand;
    expect(stand.teiltranskript).toBe("Ich arbeite im");

    const fertig = weiter(stand, { art: "redebeitrag_fertig", text: "Ich arbeite im Vertrieb." });
    expect(fertig.wirkung.sende).toBe("Ich arbeite im Vertrieb.");
    expect(fertig.stand.zustand).toBe("denkt");
    expect(fertig.stand.teiltranskript, "Teiltranskript verschwindet beim Absenden").toBe("");

    stand = weiter(fertig.stand, { art: "ton_beginnt", zug: fertig.stand.zug }).stand;
    expect(stand.zustand).toBe("spricht");

    stand = weiter(stand, { art: "ton_endet", zug: stand.zug }).stand;
    expect(stand.zustand, "nach dem Ton wird von allein weiter zugehört").toBe("hört");
  });

  it("bricht Nina ab, sobald jemand dazwischenspricht", () => {
    const bisSpricht = spiele([
      ...bisZugehört,
      { art: "sprache_beginnt" },
      { art: "redebeitrag_fertig", text: "Erzähl mir was." },
    ]);
    const sprechend = weiter(bisSpricht.stand, { art: "ton_beginnt", zug: bisSpricht.stand.zug }).stand;
    expect(sprechend.zustand).toBe("spricht");

    const unterbrochen = weiter(sprechend, { art: "sprache_beginnt" });
    expect(unterbrochen.stand.zustand).toBe("hört");
    expect(unterbrochen.wirkung.brichAb, "Ton und Erzeugung müssen sofort enden").toBe(true);
    expect(unterbrochen.stand.zug, "der Zug steigt, damit Altes ungültig wird").toBe(sprechend.zug + 1);
  });

  it("bricht auch während des Denkens ab", () => {
    // Der teurere Fall: die Anfrage läuft schon, der Ton noch nicht.
    // Ohne Abbruch bezahlt man eine Antwort, die niemand hören will.
    const denkend = spiele([
      ...bisZugehört,
      { art: "sprache_beginnt" },
      { art: "redebeitrag_fertig", text: "Eine Frage —" },
    ]).stand;
    expect(denkend.zustand).toBe("denkt");

    const unterbrochen = weiter(denkend, { art: "sprache_beginnt" });
    expect(unterbrochen.wirkung.brichAb).toBe(true);
    expect(unterbrochen.stand.zustand).toBe("hört");
  });

  it("spielt eine Antwort nicht mehr ab, die zu einem abgebrochenen Zug gehört", () => {
    /*
     * Der Fehler, um den es eigentlich geht.
     *
     * Jemand unterbricht Nina. Die Tonerzeugung des alten Zuges war
     * aber schon unterwegs und trifft eine Sekunde später ein. Ohne
     * Zugnummer fängt Nina dann an, die alte Antwort zu sprechen —
     * mitten in den neuen Satz hinein.
     */
    const sprechend = (() => {
      const s = spiele([
        ...bisZugehört,
        { art: "sprache_beginnt" },
        { art: "redebeitrag_fertig", text: "Erste Frage." },
      ]).stand;
      return weiter(s, { art: "ton_beginnt", zug: s.zug }).stand;
    })();

    const alterZug = sprechend.zug;
    const nachUnterbrechung = weiter(sprechend, { art: "sprache_beginnt" }).stand;

    const verspätet = weiter(nachUnterbrechung, { art: "ton_beginnt", zug: alterZug });
    expect(verspätet.stand.zustand, "der alte Ton darf nichts mehr auslösen").toBe("hört");
  });

  it("antwortet nicht auf ein Geräusch", () => {
    // Ein Husten erzeugt einen leeren Redebeitrag. Ohne diese Regel
    // schickt er eine leere Anfrage los, und Nina antwortet auf nichts.
    const stand = spiele([...bisZugehört, { art: "sprache_beginnt" }]).stand;
    const leer = weiter(stand, { art: "redebeitrag_fertig", text: "   " });
    expect(leer.wirkung.sende).toBeUndefined();
    expect(leer.stand.zustand).toBe("hört");
  });

  it("zeigt kein Teiltranskript mehr, wenn nicht mehr zugehört wird", () => {
    const denkend = spiele([
      ...bisZugehört,
      { art: "sprache_beginnt" },
      { art: "redebeitrag_fertig", text: "Fertig." },
    ]).stand;
    const spät = weiter(denkend, { art: "teiltranskript", text: "…noch ein Rest" });
    expect(spät.stand.teiltranskript).toBe("");
  });

  it("räumt beim Beenden auf und macht alles Laufende ungültig", () => {
    const sprechend = (() => {
      const s = spiele([
        ...bisZugehört,
        { art: "sprache_beginnt" },
        { art: "redebeitrag_fertig", text: "Frage." },
      ]).stand;
      return weiter(s, { art: "ton_beginnt", zug: s.zug }).stand;
    })();

    const beendet = weiter(sprechend, { art: "beenden" });
    expect(beendet.stand.zustand).toBe("aus");
    expect(beendet.wirkung.brichAb).toBe(true);
    expect(beendet.wirkung.schliesse).toBe(true);
    expect(beendet.stand.zug).toBeGreaterThan(sprechend.zug);
  });

  it("meldet einen Fehler, ohne etwas laufen zu lassen", () => {
    const stand = spiele(bisZugehört).stand;
    const kaputt = weiter(stand, { art: "fehler", text: "Mikrofon nicht verfügbar." });
    expect(kaputt.stand.zustand).toBe("fehler");
    expect(kaputt.stand.fehler).toBe("Mikrofon nicht verfügbar.");
    expect(kaputt.wirkung.schliesse).toBe(true);
  });

  it("ignoriert Sprache, solange das Gespräch aus ist", () => {
    const aus = weiter(START, { art: "sprache_beginnt" });
    expect(aus.stand.zustand).toBe("aus");
    expect(aus.wirkung.brichAb).toBeUndefined();
  });
});
