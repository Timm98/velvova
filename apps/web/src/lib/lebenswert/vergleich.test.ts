import { describe, expect, it } from "vitest";
import { beste, vergleichsdaten, type VergleichsStelle } from "./vergleich.ts";

/**
 * Ein Vergleich, der niemanden in die Irre führt.
 *
 * Der teuerste Fehler ist hier nicht eine falsche Zahl, sondern eine
 * FEHLENDE, die wie eine schlechte aussieht. Eine Stelle ohne
 * Gehaltsangabe ist nicht schlechter bezahlt als eine mit 45.000 € — man
 * weiss es nur nicht. Wer die Lücke als Nachteil verbucht, bevorzugt
 * systematisch Anzeigen, die viel schreiben, statt solcher, die viel
 * bieten.
 */

function stelle(teil: Partial<VergleichsStelle>): VergleichsStelle {
  return {
    id: "a",
    titel: "Stelle",
    untertitel: null,
    istEigene: false,
    bruttoVon: null,
    bruttoBis: null,
    waehrung: "EUR",
    nettoMonat: null,
    nettoGrund: null,
    wochenstunden: null,
    pendelMinuten: null,
    buerotage: null,
    arbeitsmodell: null,
    vertragsart: null,
    leistungen: [],
    urlaubstage: null,
    ...teil,
  };
}

function zeile(daten: ReturnType<typeof vergleichsdaten>, key: string) {
  const z = daten.zeilen.find((x) => x.key === key);
  if (!z) throw new Error(`Zeile ${key} fehlt`);
  return z;
}

describe("Was nebeneinandersteht", () => {
  it("baut je Stelle eine Spalte", () => {
    const d = vergleichsdaten([
      stelle({ id: "a", titel: "A" }),
      stelle({ id: "b", titel: "B" }),
      stelle({ id: "c", titel: "Deine Stelle", istEigene: true }),
    ]);
    expect(d.spalten.map((s) => s.id)).toEqual(["a", "b", "c"]);
    expect(d.spalten[2]!.istEigene).toBe(true);
    for (const z of d.zeilen) expect(z.zellen, z.key).toHaveLength(3);
  });

  it("zeigt eine Gehaltsspanne als Spanne", () => {
    const d = vergleichsdaten([stelle({ bruttoVon: 54_000, bruttoBis: 72_000 })]);
    const z = zeile(d, "brutto").zellen[0]!;
    expect(z.art).toBe("spanne");
    expect(z.art === "spanne" && z.anzeige).toContain("54.000");
    expect(z.art === "spanne" && z.anzeige).toContain("72.000");
  });

  it("rechnet den Stundenwert aus Netto und Wochenstunden", () => {
    const d = vergleichsdaten([stelle({ nettoMonat: 3466.67, wochenstunden: 40 })]);
    const z = zeile(d, "jeStunde").zellen[0]!;
    expect(z.art).toBe("zahl");
    expect(z.art === "zahl" && z.wert).toBeCloseTo(20, 1);
  });
});

describe("Fehlende Angaben bleiben fehlend", () => {
  it("macht aus einer fehlenden Angabe keine Null", () => {
    /*
     * Der Kern.
     *
     * Wäre die Zelle eine Zahl mit dem Wert 0, gewönne jede andere
     * Spalte den Vergleich — und zwar mit einer Zahl, die niemand
     * behauptet hat.
     */
    const d = vergleichsdaten([stelle({ bruttoVon: null }), stelle({ bruttoVon: 45_000, bruttoBis: 45_000 })]);
    expect(zeile(d, "brutto").zellen[0]!.art).toBe("fehlt");
  });

  it("nennt bei jeder Lücke einen Grund", () => {
    const d = vergleichsdaten([stelle({})]);
    for (const z of d.zeilen) {
      const c = z.zellen[0]!;
      if (c.art === "fehlt") expect(c.grund.length, z.key).toBeGreaterThan(0);
    }
  });

  it("reicht den Grund der Nettorechnung durch", () => {
    // „Für CH habe ich kein Steuerregelwerk" ist eine andere Auskunft
    // als „nicht angegeben" — und die Person kann nur mit der ersten
    // etwas anfangen.
    const d = vergleichsdaten([stelle({ nettoMonat: null, nettoGrund: "Für CH fehlt mir das Regelwerk." })]);
    const z = zeile(d, "netto").zellen[0]!;
    expect(z.art === "fehlt" && z.grund).toMatch(/CH/);
  });

  it("übernimmt einen Stundenlohn nicht als Jahresgehalt", () => {
    // Wird in `stelleAusJob` entschieden; hier steht die Erwartung, dass
    // eine Stelle ohne Jahresangabe im Vergleich als Lücke erscheint —
    // nicht als hochgerechnete Zahl neben echten.
    const d = vergleichsdaten([stelle({ bruttoVon: null, bruttoBis: null })]);
    expect(zeile(d, "brutto").zellen[0]!.art).toBe("fehlt");
  });
});

describe("Wer vorn liegt", () => {
  it("markiert die höhere Zahl, wo höher besser ist", () => {
    const d = vergleichsdaten([stelle({ nettoMonat: 2800 }), stelle({ nettoMonat: 3200 })]);
    expect(beste(zeile(d, "netto"))).toBe(1);
  });

  it("markiert die kleinere Zahl, wo kleiner besser ist", () => {
    const d = vergleichsdaten([
      stelle({ pendelMinuten: 45, buerotage: 3 }),
      stelle({ pendelMinuten: 15, buerotage: 3 }),
    ]);
    // Der Arbeitsweg wird als Text gezeigt, nicht als Zahl — also gibt
    // es hier bewusst keine Auszeichnung. Sie käme sonst aus einer
    // Zelle, die die Bürotage mitträgt und damit nicht vergleichbar ist.
    expect(beste(zeile(d, "weg"))).toBeNull();
  });

  it("zeichnet nichts aus, wenn nur eine Spalte eine Zahl hat", () => {
    /*
     * Eine Auszeichnung auf Grundlage einer einzigen bekannten Zahl ist
     * kein Vergleich, sondern eine Feststellung — sie sieht aber
     * genauso aus wie ein gewonnener Vergleich.
     */
    const d = vergleichsdaten([stelle({ nettoMonat: 2800 }), stelle({ nettoMonat: null })]);
    expect(beste(zeile(d, "netto"))).toBeNull();
  });

  it("zeichnet bei Gleichstand niemanden aus", () => {
    const d = vergleichsdaten([stelle({ nettoMonat: 3000 }), stelle({ nettoMonat: 3000 })]);
    expect(beste(zeile(d, "netto"))).toBeNull();
  });

  it("kennt kein Besser bei Wochenstunden", () => {
    /*
     * Wer Vollzeit sucht, für den sind 20 Stunden ein Ausschluss und
     * kein Vorteil. Ein Pfeil wäre eine Behauptung über den
     * Lebensentwurf der Person.
     */
    const d = vergleichsdaten([stelle({ wochenstunden: 40 }), stelle({ wochenstunden: 20 })]);
    expect(zeile(d, "stunden").hoeherIstBesser).toBeNull();
    expect(beste(zeile(d, "stunden"))).toBeNull();
  });

  it("kennt kein Besser bei der Zahl der Leistungen", () => {
    // Vier Stichworte sind nicht besser als eines — eine Rangfolge
    // daraus wäre eine Rangfolge der Textlänge.
    const d = vergleichsdaten([
      stelle({ leistungen: ["Homeoffice", "Urlaub", "Weiterbildung", "Kantine"] }),
      stelle({ leistungen: ["Firmenwagen"] }),
    ]);
    expect(beste(zeile(d, "leistungen"))).toBeNull();
  });

  it("gibt es keine Gesamtnote", () => {
    /*
     * Bewusst festgehalten.
     *
     * Eine Gesamtzahl entstünde aus Gewichten, die niemand gewählt hat
     * — wie viel ist eine Stunde Arbeitsweg gegen zweihundert Euro? Das
     * ist keine Rechenfrage. Wenn jemand später eine Note einbaut, wird
     * dieser Test rot, und das ist der Zweck.
     */
    const d = vergleichsdaten([stelle({ nettoMonat: 3000 }), stelle({ nettoMonat: 2800 })]);
    expect(d.zeilen.map((z) => z.key)).not.toContain("gesamt");
    expect(d.zeilen.map((z) => z.key)).not.toContain("score");
  });
});
