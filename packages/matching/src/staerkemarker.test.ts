import { describe, expect, it } from "vitest";
import {
  satzteile,
  staerkeAusSatzteil,
  staerkeEntscheiden,
  staerkeFuerKriterium,
} from "./staerkemarker.ts";

describe("Marker im Satzteil", () => {
  const muss = [
    "das muss Vollzeit sein",
    "Vollzeit müssen es schon sein",
    "zwingend mit Führerschein",
    "unbedingt in Karlsruhe",
    "auf jeden Fall unbefristet",
    "mindestens 36.000 € brutto",
    "nicht unter 3000 im Monat",
    "nicht weniger als 40.000",
    "höchstens 30 km Fahrweg",
    "nicht mehr als eine Stunde Fahrt",
    "maximal 25 Kilometer",
    "Voraussetzung ist ein Staplerschein",
    "Bedingung: Frühschicht",
    "darf nicht befristet sein",
    "ausschließlich Tagschicht",
    "nur Festanstellung",
    "keine Zeitarbeit",
    "ohne Nachtschicht",
    "Nachtarbeit kommt nicht in Frage",
    "Wochenendarbeit geht gar nicht",
  ];
  for (const satz of muss) {
    it(`liest „${satz}“ als Muss`, () => {
      expect(staerkeAusSatzteil(satz).staerke).toBe("muss");
    });
  }

  const wunsch = [
    "möglichst geregelte Arbeitszeiten",
    "gerne im Homeoffice",
    "am liebsten Frühschicht",
    "bevorzugt in der Innenstadt",
    "vorzugsweise unbefristet",
    "idealerweise mit Weiterbildung",
    "im Idealfall Vollzeit",
    "wenn möglich ohne Schicht",
    "wäre schön mit Kantine",
    "eher kleinere Betriebe",
    "tendenziell Teilzeit",
  ];
  for (const satz of wunsch) {
    it(`liest „${satz}“ als Wunsch`, () => {
      expect(staerkeAusSatzteil(satz).staerke).toBe("wunsch");
    });
  }

  const interesse = [
    "vielleicht auch Teilzeit",
    "eventuell Schichtarbeit",
    "notfalls auch weiter weg",
    "zur Not auch befristet",
    "auch offen für Quereinstieg",
    "grundsätzlich offen für Reisen",
    "könnte ich mir vorstellen",
    "wäre auch ok",
  ];
  for (const satz of interesse) {
    it(`liest „${satz}“ als Interesse`, () => {
      expect(staerkeAusSatzteil(satz).staerke).toBe("interesse");
    });
  }

  it("legt sich ohne Marker nicht fest", () => {
    /*
     * „Ich suche Lagerarbeit" sagt nicht, ob das eine Bedingung ist.
     * Eine Stärke zu erfinden wäre eine Entscheidung, die niemand
     * getroffen hat.
     */
    expect(staerkeAusSatzteil("Ich suche Lagerarbeit in Karlsruhe").staerke).toBeNull();
    expect(staerkeAusSatzteil("").staerke).toBeNull();
  });
});

describe("Entkräftung — der gefährliche Fall", () => {
  const entkraeftet = [
    "Ich muss nicht unbedingt remote arbeiten",
    "Ich muss nicht remote arbeiten",
    "Remote müssen wir nicht",
    "nicht unbedingt Vollzeit",
    "nicht zwingend unbefristet",
    "Homeoffice ist kein Muss",
    "Schichtarbeit ist mir nicht so wichtig",
    "Kantine wäre nett",
    "Der Firmenwagen ist nicht entscheidend",
    "Auf das Jobticket kann ich verzichten",
  ];
  for (const satz of entkraeftet) {
    it(`macht aus „${satz}“ kein Muss`, () => {
      const b = staerkeAusSatzteil(satz);
      expect(b.staerke).toBe("wunsch");
      expect(b.quelle).toBe("entkraeftung");
    });
  }

  it("hält einen Ausschluss nicht für eine Entkräftung", () => {
    /*
     * Der Unterschied ist, worauf sich das „nicht" bezieht: auf das
     * Müssen oder auf die Sache.
     *
     * „Ich will nicht in die Zeitarbeit" ist ein Ausschluss — die
     * härteste Form eines Muss. Es als Wunsch zu führen hiesse, genau
     * die Anzeigen zu schicken, die die Person abgelehnt hat.
     */
    expect(staerkeAusSatzteil("keine Zeitarbeit").staerke).toBe("muss");
    expect(staerkeAusSatzteil("darf nicht befristet sein").staerke).toBe("muss");
    expect(staerkeAusSatzteil("Nachtschicht kommt nicht in Frage").staerke).toBe("muss");
  });
});

describe("Zerlegung eines Satzes", () => {
  it("trennt Aussagen an Komma und Bindewort", () => {
    const teile = satzteile(
      "Lager- oder Logistikjobs bis 30 km um Karlsruhe, mindestens 36.000 € brutto, keine Zeitarbeit und möglichst geregelte Arbeitszeiten.",
    );
    expect(teile).toHaveLength(4);
    expect(teile[1]).toContain("36.000");
    expect(teile[3]).toContain("geregelte");
  });
});

describe("Stärke für ein bestimmtes Kriterium", () => {
  const satz =
    "Such für mich Lager- oder Logistikjobs bis 30 km um Karlsruhe, mindestens 36.000 € brutto, keine Zeitarbeit und möglichst geregelte Arbeitszeiten.";

  it("holt für das Gehalt das „mindestens“", () => {
    /*
     * Das Kriterium trägt die blanke Zahl, der Satz den
     * Tausenderpunkt. Beide müssen sich finden, sonst geht mit dem
     * Betrag auch das „mindestens" verloren.
     */
    const b = staerkeFuerKriterium(satz, [36000]);
    expect(b.staerke).toBe("muss");
    expect(b.marker).toBe("mindestens");
  });

  it("holt für die Zeitarbeit das „keine“", () => {
    const b = staerkeFuerKriterium(satz, ["Zeitarbeit"]);
    expect(b.staerke).toBe("muss");
  });

  it("holt für die Arbeitszeit das „möglichst“ und nicht das „mindestens“", () => {
    /*
     * Der Kern des Moduls. Beide Marker stehen im selben Satz, nur
     * ein Komma auseinander. Wer den ganzen Satz durchsucht, macht aus
     * dem ausdrücklichen Wunsch eine harte Bedingung — und die Liste
     * wird kürzer, ohne dass jemand es merkt.
     */
    const b = staerkeFuerKriterium(satz, ["geregelte Arbeitszeiten", "arbeitszeit"]);
    expect(b.staerke).toBe("wunsch");
    expect(b.marker).toBe("möglichst");
  });

  it("legt sich für den Umkreis nicht fest, wenn im Satzteil kein Marker steht", () => {
    /* „bis 30 km um Karlsruhe" nennt eine Zahl, aber keine Stärke. */
    expect(staerkeFuerKriterium(satz, ["Karlsruhe"]).staerke).toBeNull();
  });

  it("erfindet nichts für einen Wert, der im Satz nicht vorkommt", () => {
    expect(staerkeFuerKriterium(satz, ["Pflegedienst"]).staerke).toBeNull();
  });

  it("trifft am Wortanfang und nicht mitten im Wort", () => {
    /*
     * Derselbe Fehler, der schon einmal einen Koch in eine Lagersuche
     * gebracht hat: „lager" fand „Lagerung" in einem Fliesstext.
     */
    const b = staerkeFuerKriterium("Die Verlagerung ist zwingend nötig", ["lager"]);
    expect(b.staerke).toBeNull();
  });
});

describe("Rangfolge", () => {
  const ausText = staerkeAusSatzteil("möglichst geregelte Arbeitszeiten");

  it("lässt den Satz der Person das Modell überstimmen", () => {
    const e = staerkeEntscheiden({ ausText, bestaetigt: "muss", modell: "muss" });
    expect(e.staerke).toBe("wunsch");
    expect(e.herkunft).toBe("text");
  });

  it("nimmt den bestätigten Auftrag, wenn der Satz schweigt", () => {
    const e = staerkeEntscheiden({
      ausText: staerkeAusSatzteil("Lagerarbeit"),
      bestaetigt: "muss",
      modell: "wunsch",
    });
    expect(e.staerke).toBe("muss");
    expect(e.herkunft).toBe("bestaetigt");
  });

  it("lässt das Modell nur entwerfen, wo sonst nichts steht", () => {
    const e = staerkeEntscheiden({ ausText: staerkeAusSatzteil("Lagerarbeit"), modell: "interesse" });
    expect(e.staerke).toBe("interesse");
    expect(e.herkunft).toBe("modell");
  });

  it("macht ohne jede Angabe einen Wunsch daraus, kein Muss", () => {
    /*
     * Von zwei Fehlern der kleinere: Ein erfundener Wunsch sortiert
     * eine Stelle nach hinten. Ein erfundenes Muss löscht sie.
     */
    const e = staerkeEntscheiden({ ausText: staerkeAusSatzteil("Lagerarbeit") });
    expect(e.staerke).toBe("wunsch");
    expect(e.herkunft).toBe("grundwert");
  });
});
