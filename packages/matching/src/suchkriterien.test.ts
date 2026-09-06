import { describe, expect, it } from "vitest";
import {
  gruppieren,
  kriteriumBekannt,
  KRITERIEN_SCHLUESSEL,
  kriteriumPruefen,
  taetigkeitStamm,
  type Gehaltsangabe,
  type Staerke,
  type Stellenangaben,
  type Suchkriterium,
} from "./suchkriterien.ts";
import { empfehlungBestimmen, zulaessigkeitBestimmen } from "./zulaessigkeit.ts";

/**
 * Testfall D des Auftrags: kein false pass.
 *
 * Fünf Fallen, in denen ein System behauptet, eine Bedingung sei
 * erfüllt, obwohl die Anzeige das nicht hergibt. Jede davon führt in
 * der Praxis zu derselben Szene: Jemand liest „passt zu deinem
 * Mindestgehalt", bewirbt sich, und erfährt es im Gespräch besser.
 */

const LEER: Stellenangaben = {
  titel: "Sachbearbeiter (m/w/d)",
  arbeitgeber: "Muster GmbH",
  ort: "Karlsruhe",
  land: "DE",
  arbeitsmodell: null,
  remoteAnteil: null,
  vertragsform: null,
  befristet: null,
  wochenstunden: null,
  schichtarbeit: null,
  reiseanteil: null,
  erfahrungsniveau: null,
  gehalt: null,
  weitereGehaelter: [],
  aufgaben: [],
  anforderungen: [],
  wortmenge: "",
  lizenzen: [],
  sprachen: {},
  pendelminuten: null,
  entfernungKm: null,
  breitengrad: null,
  laengengrad: null,
};

function stelle(teil: Partial<Stellenangaben>): Stellenangaben {
  return { ...LEER, ...teil };
}

function kriterium(teil: Partial<Suchkriterium> & { kriterium: string }): Suchkriterium {
  return {
    id: teil.id ?? `k-${teil.kriterium}`,
    wert: teil.wert ?? null,
    einheit: teil.einheit ?? null,
    operator: teil.operator ?? "gleich",
    staerke: teil.staerke ?? "muss",
    gruppe: teil.gruppe ?? null,
    kriterium: teil.kriterium,
  };
}

function gehalt(teil: Partial<Gehaltsangabe>): Gehaltsangabe {
  return {
    min: null,
    max: null,
    waehrung: "EUR",
    zeitraum: "year",
    garantiert: true,
    basis: "brutto",
    herkunft: "provider",
    beleg: null,
    ...teil,
  };
}

describe("Gehalt", () => {
  it("erfüllt eine Untergrenze nur mit zugesagtem Betrag", () => {
    const k = kriterium({ kriterium: "mindestgehalt", wert: 45_000, operator: "mindestens" });
    const e = kriteriumPruefen(k, stelle({ gehalt: gehalt({ min: 48_000, max: 55_000 }) }));
    expect(e.status).toBe("erfuellt");
  });

  it("lässt „bis zu 50.000“ keine garantierten 45.000 erfüllen", () => {
    /*
     * Der Fall aus dem Auftrag. „Bis zu" ist eine Obergrenze, keine
     * Zusage — die Anzeige sagt nur, dass mehr nicht drin ist.
     */
    const k = kriterium({ kriterium: "mindestgehalt", wert: 45_000, operator: "mindestens" });
    const e = kriteriumPruefen(
      k,
      stelle({ gehalt: gehalt({ min: null, max: 50_000, garantiert: false, beleg: "bis zu 50.000 EUR" }) }),
    );
    expect(e.status).toBe("teilweise");
    expect(e.status).not.toBe("erfuellt");
    expect(e.fehlendesFeld).toBe("garantiertes_fixgehalt");
  });

  it("hält eine überlappende Spanne offen statt sie zu bestehen", () => {
    const k = kriterium({ kriterium: "mindestgehalt", wert: 45_000, operator: "mindestens" });
    const e = kriteriumPruefen(k, stelle({ gehalt: gehalt({ min: 40_000, max: 55_000 }) }));
    expect(e.status).toBe("teilweise");
  });

  it("erkennt eine nachgewiesene Unterschreitung", () => {
    const k = kriterium({ kriterium: "mindestgehalt", wert: 45_000, operator: "mindestens" });
    const e = kriteriumPruefen(k, stelle({ gehalt: gehalt({ min: 32_000, max: 38_000 }) }));
    expect(e.status).toBe("nicht_erfuellt");
  });

  it("bleibt bei fehlender Angabe unbekannt, nicht erfüllt", () => {
    const k = kriterium({ kriterium: "mindestgehalt", wert: 45_000, operator: "mindestens" });
    const e = kriteriumPruefen(k, stelle({}));
    expect(e.status).toBe("unbekannt");
    expect(e.fehlendesFeld).toBe("gehalt");
  });

  it("vergleicht nicht über Zeitbasen ohne Angabe", () => {
    const k = kriterium({ kriterium: "mindestgehalt", wert: 45_000, operator: "mindestens" });
    const e = kriteriumPruefen(k, stelle({ gehalt: gehalt({ min: 3_500, zeitraum: null }) }));
    expect(e.status).toBe("unbekannt");
  });

  it("rechnet einen Monatsbetrag korrekt aufs Jahr", () => {
    const k = kriterium({ kriterium: "mindestgehalt", wert: 45_000, operator: "mindestens" });
    const e = kriteriumPruefen(k, stelle({ gehalt: gehalt({ min: 4_000, zeitraum: "month" }) }));
    expect(e.status).toBe("erfuellt");
  });

  it("vergleicht kein Netto gegen ein Bruttoziel", () => {
    const k = kriterium({ kriterium: "mindestgehalt", wert: 45_000, operator: "mindestens" });
    const e = kriteriumPruefen(k, stelle({ gehalt: gehalt({ min: 46_000, basis: "netto" }) }));
    expect(e.status).toBe("unbekannt");
  });
});

describe("Wochenenden und Schichten", () => {
  it("bleibt unklar, wenn die Anzeige nichts dazu sagt", () => {
    const k = kriterium({ kriterium: "schichtarbeit", wert: false });
    expect(kriteriumPruefen(k, stelle({})).status).toBe("unbekannt");
  });

  it("verletzt die Bedingung bei ausgewiesener Schichtarbeit", () => {
    const k = kriterium({ kriterium: "schichtarbeit", wert: false });
    expect(kriteriumPruefen(k, stelle({ schichtarbeit: true })).status).toBe("nicht_erfuellt");
  });
});

describe("Vertragsachsen", () => {
  it("behandelt Befristung getrennt von der Vertragsform", () => {
    /*
     * „Unbefristet", „Teilzeit" und „Zeitarbeit" schliessen einander
     * nicht aus. Eine Teilzeitstelle darf unbefristet sein.
     */
    const form = kriterium({ kriterium: "vertragsform", wert: ["teilzeit"], operator: "einer_von" });
    const frist = kriterium({ kriterium: "befristung", wert: false });
    const s = stelle({ vertragsform: "teilzeit", befristet: false });
    expect(kriteriumPruefen(form, s).status).toBe("erfuellt");
    expect(kriteriumPruefen(frist, s).status).toBe("erfuellt");
  });

  it("erkennt einen widersprechenden Vertrag", () => {
    const k = kriterium({ kriterium: "vertragsform", wert: ["teilzeit"], operator: "einer_von" });
    expect(kriteriumPruefen(k, stelle({ vertragsform: "vollzeit" })).status).toBe("nicht_erfuellt");
  });
});

describe("Pflichtqualifikation", () => {
  it("meldet eine fehlende geforderte Lizenz", () => {
    const k = kriterium({ kriterium: "lizenz", wert: ["führerschein b"] });
    const e = kriteriumPruefen(k, stelle({ lizenzen: ["Führerschein C", "Führerschein B"] }));
    expect(e.status).toBe("nicht_erfuellt");
    expect(e.begruendung).toContain("Führerschein C");
  });
});

describe("Fahrtzeit", () => {
  it("behauptet ohne Routendaten keine Minuten", () => {
    const k = kriterium({ kriterium: "pendelzeit", wert: 30, operator: "hoechstens" });
    const e = kriteriumPruefen(k, stelle({ entfernungKm: 12 }));
    expect(e.status).toBe("unbekannt");
    expect(e.begruendung).not.toMatch(/\d+ Minuten/);
  });
});

describe("Alternativen mit ODER", () => {
  const stuttgart = kriterium({
    kriterium: "arbeitsort",
    wert: ["stuttgart"],
    gruppe: "ort",
    staerke: "muss",
  });
  const remote = kriterium({
    kriterium: "arbeitsmodell",
    wert: ["remote"],
    operator: "einer_von",
    gruppe: "ort",
    staerke: "muss",
  });

  it("erfüllt die Gruppe, wenn eine Alternative erfüllt ist", () => {
    const s = stelle({ ort: "Hamburg", arbeitsmodell: "remote" });
    const gruppen = gruppieren([kriteriumPruefen(stuttgart, s), kriteriumPruefen(remote, s)]);
    expect(gruppen).toHaveLength(1);
    expect(gruppen[0]!.status).toBe("erfuellt");
    expect(zulaessigkeitBestimmen(gruppen).zulaessigkeit).toBe("eligible");
  });

  it("verletzt die Gruppe erst, wenn beide Alternativen verletzt sind", () => {
    const s = stelle({ ort: "Hamburg", arbeitsmodell: "onsite" });
    const gruppen = gruppieren([kriteriumPruefen(stuttgart, s), kriteriumPruefen(remote, s)]);
    expect(gruppen[0]!.status).toBe("nicht_erfuellt");
    expect(zulaessigkeitBestimmen(gruppen).zulaessigkeit).toBe("ineligible");
  });

  it("hält die Gruppe offen, solange eine Alternative unbekannt ist", () => {
    const s = stelle({ ort: "Hamburg", arbeitsmodell: null });
    const gruppen = gruppieren([kriteriumPruefen(stuttgart, s), kriteriumPruefen(remote, s)]);
    expect(gruppen[0]!.status).toBe("unbekannt");
    expect(zulaessigkeitBestimmen(gruppen).zulaessigkeit).toBe("needs_clarification");
  });
});

describe("Zulässigkeit", () => {
  it("stuft ein teilweise erfülltes Muss nicht als bestanden ein", () => {
    const k = kriterium({ kriterium: "mindestgehalt", wert: 45_000, staerke: "muss" });
    const gruppen = gruppieren([
      kriteriumPruefen(k, stelle({ gehalt: gehalt({ min: 40_000, max: 55_000 }) })),
    ]);
    expect(zulaessigkeitBestimmen(gruppen).zulaessigkeit).toBe("needs_clarification");
  });

  it("lässt einen offenen Wunsch die Zulässigkeit unberührt", () => {
    const k = kriterium({ kriterium: "mindestgehalt", wert: 45_000, staerke: "wunsch" });
    const gruppen = gruppieren([kriteriumPruefen(k, stelle({}))]);
    expect(zulaessigkeitBestimmen(gruppen).zulaessigkeit).toBe("eligible");
  });
});

describe("Empfehlung", () => {
  const basis = { fitScore: 92, fitAbdeckung: 0.8, blockierendeHinweise: [], veraltet: false };

  it("empfiehlt nicht trotz hohem Score, wenn ein Muss verletzt ist", () => {
    const e = empfehlungBestimmen({ ...basis, zulaessigkeit: "ineligible" });
    expect(e.status).toBe("ausgeschlossen");
  });

  it("stellt bei offener Muss-Bedingung zurück statt zu empfehlen", () => {
    const e = empfehlungBestimmen({ ...basis, zulaessigkeit: "needs_clarification" });
    expect(e.status).toBe("zurueckgestellt");
  });

  it("empfiehlt ohne Fit-Zahl nicht", () => {
    const e = empfehlungBestimmen({ ...basis, zulaessigkeit: "eligible", fitScore: null });
    expect(e.status).toBe("zurueckgestellt");
    expect(e.gruende).toContain("profil_zu_duenn");
  });

  it("empfiehlt bei zu dünner Abdeckung nicht", () => {
    const e = empfehlungBestimmen({ ...basis, zulaessigkeit: "eligible", fitAbdeckung: 0.3 });
    expect(e.status).toBe("zurueckgestellt");
  });

  it("empfiehlt einen sauberen Treffer", () => {
    expect(empfehlungBestimmen({ ...basis, zulaessigkeit: "eligible" }).status).toBe("empfohlen");
  });

  it("schliesst eine veraltete Anzeige aus", () => {
    const e = empfehlungBestimmen({ ...basis, zulaessigkeit: "eligible", veraltet: true });
    expect(e.status).toBe("ausgeschlossen");
  });
});

describe("Wortanfang statt Teilzeichenkette", () => {
  it("hält „Lagerung“ in einer Küchenstelle nicht für einen Lagerjob", () => {
    /*
     * Der Fall aus dem Probelauf: Eine Anzeige für „Koch / Köchin"
     * enthielt „Lagerung", und die Prüfung nannte sie einen Treffer.
     */
    const k = kriterium({ kriterium: "taetigkeit", wert: ["lagerist"] });
    const e = kriteriumPruefen(
      k,
      stelle({ titel: "Koch / Köchin (m/w/d)", wortmenge: "hygiene küche lagerung speisen" }),
    );
    expect(e.status).toBe("unbekannt");
  });

  it("findet deutsche Zusammensetzungen im Titel", () => {
    const k = kriterium({ kriterium: "taetigkeit", wert: ["lager"] });
    const e = kriteriumPruefen(k, stelle({ titel: "Fachkraft für Lagerlogistik (m/w/d)" }));
    expect(e.status).toBe("erfuellt");
    expect(e.begruendung).toContain("lagerlogistik");
  });

  it("macht aus einer Erwähnung im Text keinen Treffer", () => {
    /*
     * Aus dem Probelauf: „Die Anzeige nennt lagerung" stand unter
     * einer Stelle für qualifizierte Pflegehelfer.
     */
    const k = kriterium({ kriterium: "taetigkeit", wert: ["lager"] });
    const e = kriteriumPruefen(
      k,
      stelle({ titel: "Qualifizierter Pflegehelfer (m/w/d)", wortmenge: "hygiene lagerung pflege" }),
    );
    expect(e.status).toBe("teilweise");
    expect(e.status).not.toBe("erfuellt");
  });

  it("greift nicht mitten im Wort", () => {
    const k = kriterium({ kriterium: "taetigkeit", wert: ["lager"] });
    const e = kriteriumPruefen(k, stelle({ titel: "Schlagermusiker (m/w/d)" }));
    expect(e.status).toBe("unbekannt");
  });

  it("nennt den Titel als Fundort, wenn er dort steht", () => {
    const k = kriterium({ kriterium: "taetigkeit", wert: ["pflege"] });
    const e = kriteriumPruefen(k, stelle({ titel: "Pflegefachkraft (m/w/d)", wortmenge: "team schichten" }));
    expect(e.begruendung).toContain("Titel");
  });

  it("schliesst über den Wortanfang aus", () => {
    const k = kriterium({ kriterium: "taetigkeit_ausschluss", wert: ["callcenter", "vertrieb"] });
    const treffer = kriteriumPruefen(k, stelle({ wortmenge: "kunden vertriebsinnendienst ziele" }));
    expect(treffer.status).toBe("nicht_erfuellt");
    const kein = kriteriumPruefen(k, stelle({ wortmenge: "montage werkstatt" }));
    expect(kein.status).toBe("erfuellt");
  });
});

describe("Bekannte Kriterien", () => {
  it("prüft jeden gelisteten Schlüssel tatsächlich", () => {
    /*
     * Der Fehler, den diese Prüfung verhindert: Ein Schlüssel steht in
     * der Liste, `kriteriumPruefen` kennt ihn nicht — dann existiert
     * das Kriterium im Auftrag der Person und bewirkt nie etwas.
     */
    for (const schluessel of KRITERIEN_SCHLUESSEL) {
      const e = kriteriumPruefen(kriterium({ kriterium: schluessel, wert: ["x"] }), LEER);
      expect(e.begruendung, schluessel).not.toContain("gibt es noch keine Prüfung");
    }
  });

  it("erkennt einen erfundenen Schlüssel", () => {
    expect(kriteriumBekannt("arbeitsatmosphaere")).toBe(false);
    expect(kriteriumBekannt("mindestgehalt")).toBe(true);
  });
});

describe("Stamm eines Suchbegriffs", () => {
  it("macht aus „Lagerstellen“ den Stamm", () => {
    /*
     * Ein echter Modellaufruf lieferte `taetigkeit: ["lagerstellen"]`.
     * Der Auftrag hätte im ganzen Bestand nichts gefunden — und eine
     * leere Liste sieht aus wie ein leerer Arbeitsmarkt.
     */
    expect(taetigkeitStamm("Lagerstellen")).toBe("lager");
    expect(taetigkeitStamm("Pflegejobs")).toBe("pflege");
    expect(taetigkeitStamm("Bürostellenangebote")).toBe("büro");
  });

  it("lässt einen Beruf in Ruhe", () => {
    expect(taetigkeitStamm("Lagerist")).toBe("lagerist");
    expect(taetigkeitStamm("Fachkraft")).toBe("fachkraft");
    expect(taetigkeitStamm("Erzieher")).toBe("erzieher");
  });

  it("lässt einen zu kurzen Rest stehen", () => {
    /* „Jobs" allein ist kein Beruf. */
    expect(taetigkeitStamm("Jobs")).toBe("jobs");
    expect(taetigkeitStamm("Stelle")).toBe("stelle");
  });

  it("findet mit dem Stamm, was der Vollform entgeht", () => {
    const roh = kriterium({ kriterium: "taetigkeit", wert: ["lagerstellen"] });
    const stamm = kriterium({ kriterium: "taetigkeit", wert: [taetigkeitStamm("lagerstellen")] });
    const s = stelle({ titel: "Lagerhelfer (m/w/d)" });
    expect(kriteriumPruefen(roh, s).status).toBe("unbekannt");
    expect(kriteriumPruefen(stamm, s).status).toBe("erfuellt");
  });
});

/**
 * Ort, Umkreis und Arbeitsmodell — die Fälle A bis G des Auftrags.
 *
 * Sie stehen zusammen, weil sie zusammengehören: Fast jeder davon geht
 * schief, wenn man Ort und Arbeitsmodell in ein Feld legt oder eine
 * fehlende Angabe als erfüllt liest.
 */
describe("Ort, Umkreis, Arbeitsmodell", () => {
  /* Koordinaten aus dem Auftrag — Luftlinie, gerundet. */
  const STUTTGART = { breite: 48.7758, laenge: 9.1829 };
  const LUDWIGSBURG = { breitengrad: 48.8974, laengengrad: 9.1916 };
  const MANNHEIM = { breitengrad: 49.4875, laengengrad: 8.4661 };

  function umkreis(km: number, staerke: Staerke = "muss"): Suchkriterium {
    return kriterium({
      kriterium: "umkreis",
      wert: { ...STUTTGART, km, ort: "Stuttgart" },
      staerke,
      gruppe: "ort",
    });
  }

  it("A · Karlsruhe ODER vollständig remote", () => {
    const ort = kriterium({ kriterium: "arbeitsort", wert: ["karlsruhe"], gruppe: "ort" });
    const remote = kriterium({
      kriterium: "arbeitsmodell",
      wert: ["remote"],
      operator: "einer_von",
      gruppe: "ort",
    });

    /* Ein Remote-Job in Hamburg erfüllt die Gruppe. */
    const remoteJob = stelle({ ort: "Hamburg", arbeitsmodell: "remote" });
    expect(gruppieren([kriteriumPruefen(ort, remoteJob), kriteriumPruefen(remote, remoteJob)])[0]!.status).toBe(
      "erfuellt",
    );

    /* Ein Vor-Ort-Job in Karlsruhe ebenso. */
    const vorOrt = stelle({ ort: "Karlsruhe", arbeitsmodell: "on_site" });
    expect(gruppieren([kriteriumPruefen(ort, vorOrt), kriteriumPruefen(remote, vorOrt)])[0]!.status).toBe("erfuellt");

    /* Ein Vor-Ort-Job in Hamburg keines von beidem. */
    const keins = stelle({ ort: "Hamburg", arbeitsmodell: "on_site" });
    expect(gruppieren([kriteriumPruefen(ort, keins), kriteriumPruefen(remote, keins)])[0]!.status).toBe(
      "nicht_erfuellt",
    );
  });

  it("B · Karlsruhe UND hybrid sind zwei Bedingungen", () => {
    const ort = kriterium({ kriterium: "arbeitsort", wert: ["karlsruhe"] });
    const hybrid = kriterium({ kriterium: "arbeitsmodell", wert: ["hybrid"], operator: "einer_von" });
    /* Verschiedene Gruppen — beide müssen stimmen. */
    const nurOrt = stelle({ ort: "Karlsruhe", arbeitsmodell: "on_site" });
    const gruppen = gruppieren([kriteriumPruefen(ort, nurOrt), kriteriumPruefen(hybrid, nurOrt)]);
    expect(gruppen).toHaveLength(2);
    expect(gruppen.some((g) => g.status === "nicht_erfuellt")).toBe(true);
  });

  it("C · 30 km um Stuttgart — mit Koordinaten", () => {
    const nah = kriteriumPruefen(umkreis(30), stelle({ ort: "Ludwigsburg", ...LUDWIGSBURG }));
    expect(nah.status).toBe("erfuellt");
    const fern = kriteriumPruefen(umkreis(30), stelle({ ort: "Mannheim", ...MANNHEIM }));
    expect(fern.status).toBe("nicht_erfuellt");
    /* Die Begründung nennt Luftlinie, nicht Fahrtzeit. */
    expect(nah.begruendung).toContain("Luftlinie");
  });

  it("C · ohne Koordinaten unbekannt, nicht erfüllt", () => {
    /*
     * Der Normalfall im Bestand: Elf von 1.215 analysierten Anzeigen
     * tragen Koordinaten.
     */
    const e = kriteriumPruefen(umkreis(30), stelle({ ort: "Ludwigsburg" }));
    expect(e.status).toBe("unbekannt");
    expect(e.fehlendesFeld).toBe("koordinaten");
  });

  it("D · Remote nur innerhalb Deutschlands", () => {
    const land = kriterium({ kriterium: "arbeitsland", wert: ["DE"] });
    expect(kriteriumPruefen(land, stelle({ land: "DE", arbeitsmodell: "remote" })).status).toBe("erfuellt");
    /* „Remote USA only" wird in Deutschland nicht besetzt. */
    expect(kriteriumPruefen(land, stelle({ land: "US", arbeitsmodell: "remote" })).status).toBe("nicht_erfuellt");
  });

  it("E · ein Hybridjob 200 km entfernt passt nicht", () => {
    /*
     * Er bietet Homeoffice-Tage — und verlangt trotzdem Anwesenheit.
     * Das Arbeitsmodell allein macht die Entfernung nicht kleiner.
     */
    const hybrid = kriterium({ kriterium: "arbeitsmodell", wert: ["hybrid"], operator: "einer_von" });
    const weit = stelle({ ort: "Mannheim", arbeitsmodell: "hybrid", ...MANNHEIM });
    const gruppen = gruppieren([kriteriumPruefen(hybrid, weit), kriteriumPruefen(umkreis(30), weit)]);
    /* Das Modell stimmt, der Umkreis nicht — und beide sind Muss. */
    expect(gruppen.find((g) => g.mitglieder[0]!.kriterium === "arbeitsmodell")!.status).toBe("erfuellt");
    expect(gruppen.find((g) => g.mitglieder[0]!.kriterium === "umkreis")!.status).toBe("nicht_erfuellt");
  });

  it("F · mehrere Orte bleiben eine ODER-Bedingung", () => {
    const orte = kriterium({ kriterium: "arbeitsort", wert: ["stuttgart", "karlsruhe"] });
    expect(kriteriumPruefen(orte, stelle({ ort: "Karlsruhe" })).status).toBe("erfuellt");
    expect(kriteriumPruefen(orte, stelle({ ort: "Stuttgart" })).status).toBe("erfuellt");
    expect(kriteriumPruefen(orte, stelle({ ort: "Hamburg" })).status).toBe("nicht_erfuellt");
  });

  it("G · ein befristeter Zusatz gilt neben dem Dauerkriterium", () => {
    /*
     * „Heute auch Hamburg" ist eine eigene Gruppe mit Frist. Das
     * Stuttgart-Kriterium bleibt daneben stehen — und morgen ist der
     * Zusatz weg, ohne dass jemand etwas zurücknehmen muss.
     */
    const dauer = kriterium({ kriterium: "arbeitsort", wert: ["stuttgart"], gruppe: "ort" });
    const heute = kriterium({ kriterium: "arbeitsort", wert: ["hamburg"], gruppe: "zusatz-heute" });
    const hh = stelle({ ort: "Hamburg" });
    const gruppen = gruppieren([kriteriumPruefen(dauer, hh), kriteriumPruefen(heute, hh)]);
    expect(gruppen).toHaveLength(2);
    expect(gruppen.find((g) => g.gruppe === "zusatz-heute")!.status).toBe("erfuellt");
    expect(gruppen.find((g) => g.gruppe === "ort")!.status).toBe("nicht_erfuellt");
  });
});

describe("Wo eine Tätigkeit stehen darf", () => {
  it("zählt die Aufgaben wie den Titel", () => {
    /*
     * „Kommissionierer", dessen Aufgaben Kommissionierung und
     * Warenannahme im Lager sind, ist eine Lagerstelle — auch wenn
     * das Wort nicht im Titel steht. Die erste Fassung liess nur den
     * Titel zählen und liess sie durchfallen.
     */
    const k = kriterium({ kriterium: "taetigkeit", wert: ["lager"] });
    const e = kriteriumPruefen(
      k,
      stelle({
        titel: "Kommissionierer (m/w/d)",
        aufgaben: ["Warenannahme", "Lagerarbeit"],
      }),
    );
    expect(e.status).toBe("erfuellt");
    expect(e.begruendung).toContain("Aufgaben");
  });

  it("zählt die Anforderungen mit", () => {
    const k = kriterium({ kriterium: "taetigkeit", wert: ["stapler"] });
    const e = kriteriumPruefen(
      k,
      stelle({ titel: "Mitarbeiter (m/w/d)", anforderungen: ["Staplerschein"] }),
    );
    expect(e.status).toBe("erfuellt");
  });

  it("lässt eine Erwähnung im Fliesstext nur teilweise gelten", () => {
    /* Der Pflegehelfer mit „Lagerung" im Text — unverändert. */
    const k = kriterium({ kriterium: "taetigkeit", wert: ["lager"] });
    const e = kriteriumPruefen(
      k,
      stelle({
        titel: "Qualifizierter Pflegehelfer (m/w/d)",
        aufgaben: ["Grundpflege"],
        wortmenge: "hygiene lagerung pflege",
      }),
    );
    expect(e.status).toBe("teilweise");
  });

  it("schliesst auch über den Fliesstext aus", () => {
    /* Bei einem Ausschluss ist Vorsicht der richtige Fehler. */
    const k = kriterium({ kriterium: "taetigkeit_ausschluss", wert: ["callcenter"] });
    const e = kriteriumPruefen(k, stelle({ wortmenge: "kunden callcenter ziele" }));
    expect(e.status).toBe("nicht_erfuellt");
  });
});

describe("Eine Werteliste ist ein Oder", () => {
  const suche = kriterium({
    kriterium: "taetigkeit",
    wert: ["lager", "logistik"],
    staerke: "muss",
    operator: "einer_von",
  });

  it("lässt einen Begriff im Titel genügen", () => {
    /*
     * Aus „Lager- oder Logistikjobs" wird `["lager","logistik"]`, und
     * die Bestätigung, die die Person liest, sagt „lager oder
     * logistik". Die erste Fassung verlangte beide — „Recycling- und
     * Lagerhelfer" bekam dadurch nur `teilweise` und reichte nie für
     * eine Empfehlung.
     */
    const e = kriteriumPruefen(suche, stelle({ titel: "Recycling- und Lagerhelfer" }));
    expect(e.status).toBe("erfuellt");
  });

  it("nimmt auch die Aufgaben als Rollenbeschreibung", () => {
    const e = kriteriumPruefen(
      suche,
      stelle({ titel: "Kommissionierer (m/w/d)", aufgaben: ["Waren im Lager kommissionieren"] }),
    );
    expect(e.status).toBe("erfuellt");
  });

  it("bleibt bei einem Fund allein im Fliesstext zurückhaltend", () => {
    /* In einem Probelauf stand „Lagerung" in einer Anzeige für
       Pflegehelfer. */
    const e = kriteriumPruefen(
      suche,
      stelle({ titel: "Pflegehelfer (m/w/d)", wortmenge: "sachgerechte Lagerung der Bewohner" }),
    );
    expect(e.status).toBe("teilweise");
  });
});
