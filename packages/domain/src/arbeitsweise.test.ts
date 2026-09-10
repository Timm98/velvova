import { describe, expect, it } from "vitest";
import {
  BELEGART,
  DIMENSIONEN,
  KENNUNG,
  MINDESTLAENGE,
  TEXTE,
  aussagenPruefen,
  eintragPruefen,
  profilfortschritt,
  VORSATZ,
  istLeerformel,
  spiegel,
  type Profileintrag,
} from "./arbeitsweise.ts";

describe("Die Kennungen", () => {
  it("trifft die Zeichenketten, die der Passungswert liest", () => {
    /*
     * `profilkontext.ts` sucht über `source_ref like '%…%'`. Ein
     * Tippfehler hier erzeugt Belege, die niemand liest — und der
     * Passungswert bliebe leer, während die Oberfläche ein volles
     * Profil zeigt.
     */
    expect(KENNUNG.energie).toBe("tasks_and_energy");
    expect(KENNUNG.arbeitsstil).toBe("work_style_and_environment");
    expect(KENNUNG.haltegruende).toBe("values_and_motives");
    expect(KENNUNG.lernrichtung).toBe("learning_goals");
  });

  it("gibt jeder Dimension eine Kennung und eine Belegart", () => {
    for (const d of DIMENSIONEN) {
      expect(KENNUNG[d], d).toBeTruthy();
      expect(BELEGART[d], d).toBeTruthy();
    }
  });

  it("fragt in jeder Dimension nach einem Beispiel", () => {
    /* „Bist du teamfähig?" beantwortet jeder mit ja. */
    for (const d of DIMENSIONEN) {
      expect(TEXTE[d].frage, d).toMatch(/\?$/);
      expect(TEXTE[d].nachfrage, d).toMatch(/\?$/);
      expect(TEXTE[d].ueberschrift.length, d).toBeGreaterThan(5);
    }
  });
});

describe("Die Vorsätze", () => {
  /*
   * Wörtlich aus `profilkontext.ts` übernommen. Ändert sich dort
   * etwas, muss dieser Test rot werden — sonst zählt still das, was
   * jemanden auslaugt, als das, was ihm Kraft gibt.
   */
  const LIEST_ENERGIE = /energie gibt|geben energie|leicht/i;
  const LIEST_ZEHREND = /kostet|laugt|vermeide|falsch an/i;

  it("wird vom Leser als energiegebend erkannt", () => {
    expect(LIEST_ENERGIE.test(VORSATZ.gibt)).toBe(true);
    expect(LIEST_ZEHREND.test(VORSATZ.gibt)).toBe(false);
  });

  it("wird vom Leser als zehrend erkannt", () => {
    expect(LIEST_ZEHREND.test(VORSATZ.kostet)).toBe(true);
    expect(LIEST_ENERGIE.test(VORSATZ.kostet)).toBe(false);
  });

  it("bleibt auch mit angehängter Aussage eindeutig", () => {
    const satz = VORSATZ.kostet + "ständige Umpriorisierung mitten am Tag";
    expect(LIEST_ZEHREND.test(satz)).toBe(true);
    expect(LIEST_ENERGIE.test(satz)).toBe(false);
  });
});

describe("Die Schutzgrenze", () => {
  it("hält Gesundheit aus dem Profil", () => {
    const { bleiben, ausgeschlossen } = aussagenPruefen([
      "Ich arbeite am besten mit festem Plan",
      "Wegen meiner Bandscheibe kann ich nicht schwer heben",
    ]);
    expect(bleiben).toHaveLength(1);
    expect(ausgeschlossen[0]!.merkmal).toBe("Gesundheit");
  });

  it("erkennt die geschützten Merkmale in gebeugten Formen", () => {
    /*
     * Derselbe Fehler wie in `wunschprofil.ts`: `\bkrank\b` trifft
     * „kranken" nicht. Deutsch beugt.
     */
    const faelle = [
      "Ich war lange krankgeschrieben",
      "Ich hole meine Kinder um vier ab",
      "Mit 58 Jahren fange ich nicht mehr neu an",
      "Wegen meiner Herkunft habe ich es schwerer",
      "Ich gehe sonntags in die Kirche",
    ];
    for (const a of faelle) {
      expect(aussagenPruefen([a]).ausgeschlossen, a).toHaveLength(1);
    }
  });

  it("erklärt, warum etwas nicht gespeichert wird", () => {
    /*
     * Ein Feld, das Gesagtes verschluckt, sieht aus wie ein Fehler —
     * und beim nächsten Mal erzählt jemand es wieder.
     */
    const { ausgeschlossen } = aussagenPruefen(["Ich bin oft krank"]);
    expect(ausgeschlossen[0]!.erklaerung).toContain("Suchkriterien");
    expect(ausgeschlossen[0]!.erklaerung).toContain("Bedingung");
  });

  it("lässt Aussagen über die Arbeit selbst stehen", () => {
    const echte = [
      "Ich arbeite am besten, wenn der Plan morgens steht",
      "Ständige Umpriorisierung kostet mich mehr als die Arbeit",
      "Ich mag Kundenkontakt, aber nicht am Telefon",
      "Geteilte Dienste will ich nicht mehr",
    ];
    const { bleiben, ausgeschlossen } = aussagenPruefen(echte);
    expect(bleiben).toEqual(echte);
    expect(ausgeschlossen).toEqual([]);
  });
});

describe("Leerformeln", () => {
  it("erkennt, was in jeder Stellenanzeige steht", () => {
    for (const w of ["teamfähig", "Belastbar", "sehr flexibel", "motiviert."]) {
      expect(istLeerformel(w), w).toBe(true);
    }
  });

  it("hält einen Satz mit Inhalt nicht für eine Leerformel", () => {
    expect(istLeerformel("Ich bin belastbar, solange der Plan steht")).toBe(false);
  });
});

describe("eintragPruefen", () => {
  it("übernimmt, was trägt", () => {
    const lage = eintragPruefen(["Ich arbeite am besten mit festem Plan und festen Patienten"]);
    expect(lage.art).toBe("uebernommen");
  });

  it("speichert nichts, wenn nichts übrig bleibt", () => {
    /*
     * Ein leerer Eintrag wäre schlimmer als keiner: Er markiert die
     * Frage als beantwortet.
     */
    const lage = eintragPruefen(["teamfähig", "flexibel"]);
    expect(lage.art).toBe("zu_duenn");
  });

  it("verwirft zu Kurzes", () => {
    expect(eintragPruefen(["ja"]).art).toBe("zu_duenn");
    expect(eintragPruefen(["x".repeat(MINDESTLAENGE)]).art).toBe("uebernommen");
  });

  it("meldet Ausgeschlossenes auch dann, wenn der Rest trägt", () => {
    const lage = eintragPruefen([
      "Ich arbeite am besten mit festem Plan",
      "Ich bin oft krank",
    ]);
    expect(lage.art).toBe("uebernommen");
    expect(lage.ausgeschlossen).toHaveLength(1);
  });

  it("meldet Ausgeschlossenes auch dann, wenn nichts übrig bleibt", () => {
    const lage = eintragPruefen(["Wegen meiner Bandscheibe geht das nicht"]);
    expect(lage.art).toBe("zu_duenn");
    expect(lage.ausgeschlossen).toHaveLength(1);
  });
});

describe("profilfortschritt", () => {
  it("zählt gefüllte Dimensionen, keine Prozente einer Vollständigkeit", () => {
    const e: Profileintrag[] = [
      { dimension: "energie", aussagen: ["Fester Plan, feste Patienten"], freigegeben: false },
      { dimension: "arbeitsstil", aussagen: [], freigegeben: false },
    ];
    const f = profilfortschritt(e);
    expect(f.gefuellt).toBe(1);
    expect(f.gesamt).toBe(DIMENSIONEN.length);
    expect(f.offen).toContain("arbeitsstil");
    expect(f.offen).not.toContain("energie");
  });

  it("nennt bei leerem Profil alle Dimensionen offen", () => {
    expect(profilfortschritt([]).offen).toEqual([...DIMENSIONEN]);
  });
});

describe("spiegel", () => {
  it("gibt in jeder Dimension zurück und fragt nach", () => {
    for (const d of DIMENSIONEN) {
      const s = spiegel(d, ["fester Plan", "feste Patienten"]);
      expect(s, d).toContain("fester Plan");
      expect(s, d).toMatch(/\?$/);
    }
  });

  it("überschüttet nicht mit allem Gesagten", () => {
    const s = spiegel("energie", ["eins", "zwei", "drei", "vier", "fünf"]);
    expect(s).not.toContain("vier");
  });
});
