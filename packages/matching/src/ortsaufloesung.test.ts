import { describe, expect, it } from "vitest";
import {
  ortAufloesen,
  ortNormalisieren,
  ortZerlegen,
  type Referenzort,
} from "./ortsaufloesung.ts";

/**
 * Die Referenz ist ein Ausschnitt echter GeoNames-Zeilen aus
 * `DE.txt` (Stand 6. September 2026) — inklusive der Fälle, an denen
 * die erste Fassung dieses Moduls scheiterte.
 */
/*
 * Jeder Ort steht doppelt: einmal je Postleitzahl, einmal als
 * Mittelpunkt ohne Postleitzahl. So legt der Import ihn an, und die
 * Auflösung verlässt sich darauf — die Namenssuche liest nur die
 * Mittelpunktzeilen, damit die 190 Postleitzahlen Berlins nicht als
 * 190 mögliche Orte gelten.
 */
function ort(
  name: string,
  region: string | null,
  kreis: string | null,
  plz: string | null,
  latitude: number,
  longitude: number,
): Referenzort {
  return {
    name,
    nameNorm: ortNormalisieren(name),
    region,
    kreis,
    plz,
    latitude,
    longitude,
    plzAnzahl: 1,
  };
}

const REFERENZ: Referenzort[] = [
  ort("Karlsruhe", "Baden-Württemberg", "Stadtkreis Karlsruhe", "76131", 49.0078, 8.4199),
  ort("Karlsruhe", "Baden-Württemberg", "Stadtkreis Karlsruhe", null, 49.0078, 8.4199),
  ort("Griesheim", "Hessen", "Landkreis Darmstadt-Dieburg", "64347", 49.8609, 8.5725),
  ort("Griesheim", "Hessen", "Landkreis Darmstadt-Dieburg", null, 49.8609, 8.5725),
  ort("Burgthann", "Bayern", "Landkreis Nürnberger Land", "90559", 49.352, 11.3115),
  ort("Burgthann", "Bayern", "Landkreis Nürnberger Land", null, 49.352, 11.3115),
  ort("Deggendorf", "Bayern", "Landkreis Deggendorf", null, 48.8409, 12.9607),

  /* Zwei Neuenhagen in Brandenburg, 40 km auseinander — die
     ungekürzte Schreibweise unterscheidet sie. */
  ort("Neuenhagen bei Berlin", "Brandenburg", "Märkisch-Oderland", "15366", 52.5333, 13.6833),
  ort("Neuenhagen bei Berlin", "Brandenburg", "Märkisch-Oderland", null, 52.5333, 13.6833),
  ort("Neuenhagen", "Brandenburg", "Märkisch-Oderland", "16259", 52.8366, 14.053),
  ort("Neuenhagen", "Brandenburg", "Märkisch-Oderland", null, 52.8366, 14.053),

  /* Zwei Bernau, 600 km auseinander — nur der Kreis trennt sie. */
  ort("Bernau", "Brandenburg", "Barnim", null, 52.6786, 13.5878),
  ort("Bernau", "Baden-Württemberg", "Waldshut", null, 47.8, 8.0333),

  /* Hamburg steht in der Quelle unter zwei Bundesländern — dieselbe
     Stadt, ein paar Postleitzahlgebiete über der Landesgrenze. */
  ort("Hamburg", "Hamburg", "Hamburg", null, 53.5503, 9.9920),
  ort("Hamburg", "Schleswig-Holstein", "Herzogtum Lauenburg", null, 53.4863, 10.1832),

  ort("Berlin", "Land Berlin", "Berlin", null, 52.52, 13.405),
  ort("Frankfurt am Main", "Hessen", "Frankfurt am Main", null, 50.1109, 8.6821),
  ort("Frankfurt (Oder)", "Brandenburg", "Frankfurt (Oder)", null, 52.3412, 14.5486),
  ort("Neustadt", "Thüringen", "Saale-Orla-Kreis", null, 50.735, 11.121),
  ort("Neustadt an der Weinstraße", "Rheinland-Pfalz", null, null, 49.35, 8.1386),
  ort("Baden-Baden", "Baden-Württemberg", "Baden-Baden", null, 48.7606, 8.2396),
  ort("Fürstenwalde/Spree", "Brandenburg", "Oder-Spree", null, 52.3606, 14.0645),
  ort("Sankt Ingbert", "Saarland", "Saarpfalz-Kreis", "66386", 49.277, 7.1167),
  ort("Sankt Ingbert", "Saarland", "Saarpfalz-Kreis", null, 49.277, 7.1167),
  ort("München", "Bayern", "München", null, 48.1372, 11.5755),
  ort("Köln", "Nordrhein-Westfalen", "Köln", null, 50.9333, 6.95),

  /* Lichtenberg gibt es zweimal — und als Berliner Bezirk gar nicht. */
  ort("Lichtenberg", "Bayern", "Hof", null, 50.3667, 11.65),
  ort("Lichtenberg", "Sachsen", "Mittelsachsen", null, 50.8833, 13.3833),
];

describe("Normalisierung", () => {
  it("führt Umlaut und Umschrift zusammen", () => {
    expect(ortNormalisieren("Thüringen")).toBe(ortNormalisieren("Thueringen"));
    expect(ortNormalisieren("Baden-Württemberg")).toBe("baden-wuerttemberg");
  });

  it("behält den Bindestrich", () => {
    /* “Baden-Baden” ist nicht “Baden Baden” und erst recht nicht “Baden”. */
    expect(ortNormalisieren("Baden-Baden")).toBe("baden-baden");
  });
});

describe("Zerlegung", () => {
  it("liest die Postleitzahl heraus", () => {
    const t = ortZerlegen("90559 Burgthann");
    expect(t.plz).toBe("90559");
    expect(t.varianten[0]).toBe("Burgthann");
  });

  it("trennt Stadt und Bundesland", () => {
    const t = ortZerlegen("Karlsruhe, Baden-Württemberg");
    expect(t.varianten[0]).toBe("Karlsruhe");
    expect(t.region).toBe("Baden-Württemberg");
  });

  it("macht aus einem doppelten Namen keine Region", () => {
    /* “Karlsruhe, Karlsruhe (Kreis)” nennt zweimal dasselbe. */
    const t = ortZerlegen("Karlsruhe, Karlsruhe (Kreis)");
    expect(t.region).toBeNull();
  });

  it("behält die ungekürzte Form als erste Variante", () => {
    /*
     * Der Fehler der ersten Fassung: “bei” galt als Beiwerk, aus
     * “Neuenhagen bei Berlin” wurde “Neuenhagen Berlin”, und der Ort
     * war nicht mehr auffindbar — obwohl er genau so in der Referenz
     * steht.
     */
    const t = ortZerlegen("Neuenhagen bei Berlin, Märkisch-Oderland (Kreis)");
    expect(t.varianten[0]).toBe("Neuenhagen bei Berlin");
    expect(t.varianten).toContain("Neuenhagen");
  });

  it("erkennt Arbeitsformen als Nicht-Ort", () => {
    for (const wort of ["Remote", "homeoffice", "deutschlandweit", "-", "n/a"]) {
      expect(ortZerlegen(wort).brauchbar, wort).toBe(false);
    }
  });

  it("hält eine leere Angabe für unbrauchbar", () => {
    expect(ortZerlegen("").brauchbar).toBe(false);
    expect(ortZerlegen("  ").brauchbar).toBe(false);
  });
});

describe("Auflösung", () => {
  const loese = (roh: string) => ortAufloesen(ortZerlegen(roh), REFERENZ);

  it("nimmt die Postleitzahl vor dem Namen", () => {
    const a = loese("90559 Burgthann");
    expect(a.status).toBe("resolved_exact");
    expect(a.genauigkeit).toBe("plz");
    expect(a.latitude).toBeCloseTo(49.352);
  });

  it("findet eine schlichte Stadt", () => {
    const a = loese("Deggendorf");
    expect(a.status).toBe("resolved_city");
    expect(a.stadt).toBe("Deggendorf");
  });

  it("findet “Neuenhagen bei Berlin” als eigenen Ort", () => {
    const a = loese("Neuenhagen bei Berlin, Märkisch-Oderland (Kreis)");
    expect(a.status).toBe("resolved_city");
    expect(a.stadt).toBe("Neuenhagen bei Berlin");
    /* Nicht das andere Neuenhagen, 40 km weiter östlich. */
    expect(a.latitude).toBeCloseTo(52.5333);
  });

  it("unterscheidet Gleichnamige über den Kreis", () => {
    /*
     * Der Fall aus dem Bestand. Bernau in Brandenburg und Bernau in
     * Baden-Württemberg liegen 600 km auseinander, und das Bundesland
     * steht in der Anzeige nicht — der Kreis schon.
     */
    const a = loese("Bernau bei Berlin, Barnim (Kreis)");
    expect(a.status).toBe("resolved_city");
    expect(a.latitude).toBeCloseTo(52.6786);
  });

  it("wählt bei weit auseinanderliegenden Gleichnamigen keinen aus", () => {
    /*
     * Der eigentliche Punkt dieses Moduls. Ein geratener Punkt sieht
     * genauso aus wie ein richtiger — dieselbe Zahl, dieselbe Einheit,
     * dieselbe Zuversicht.
     */
    const a = loese("Bernau");
    expect(a.status).toBe("ambiguous");
    expect(a.latitude).toBeNull();
    expect(a.kandidaten).toBe(2);
  });

  it("hält dieselbe Stadt unter zwei Bundesländern nicht für zwei Städte", () => {
    /*
     * Die Quelle führt Hamburg unter “Hamburg” und unter
     * “Schleswig-Holstein”. Beide meinen Hamburg. Eine Regel, die nur
     * Namen zählt, liefert für die zweitgrösste Stadt des Landes
     * keine Koordinate.
     */
    const a = loese("Hamburg");
    expect(a.status).toBe("resolved_city");
    expect(a.latitude).toBeGreaterThan(53.4);
    expect(a.latitude).toBeLessThan(53.6);
    /* Der Mittelpunkt zweier Punkte ist gröber als eine Stadtangabe,
       und der Befund sagt das. */
    expect(a.genauigkeit).toBe("region");
  });

  it("behält den Schrägstrich im Ortsnamen", () => {
    /* “Fürstenwalde/Spree” ist ein Name, kein Paar. */
    const a = loese("Fürstenwalde/Spree, Oder-Spree (Kreis)");
    expect(a.status).toBe("resolved_city");
    expect(a.stadt).toBe("Fürstenwalde/Spree");
  });

  it("schreibt “St.” aus", () => {
    const a = loese("St. Ingbert, Saarland");
    expect(a.status).toBe("resolved_city");
    expect(a.stadt).toBe("Sankt Ingbert");
  });

  it("fällt bei einem Bezirk auf die Stadt zurück, statt mehrdeutig zu sein", () => {
    /*
     * “Lichtenberg, Berlin” an 14 Stellen im Bestand. Lichtenberg gibt
     * es in Bayern und in Sachsen; als Berliner Bezirk steht es in
     * keiner Postleitzahlenliste. Mit “Berlin” dahinter ist die Frage
     * beantwortet — ungenauer, aber beantwortet.
     */
    const a = loese("Lichtenberg, Berlin");
    expect(a.status).toBe("resolved_city");
    expect(a.stadt).toBe("Berlin");
    expect(a.quelle).toBe("geonames_ort_umgebend");
  });

  it("liest den englischen Namen einer deutschen Stadt", () => {
    expect(loese("Munich").stadt).toBe("München");
    expect(loese("Cologne, North Rhine-Westphalia").stadt).toBe("Köln");
  });

  it("trennt die Arbeitsform vom Ort", () => {
    /* “Remote - Berlin” und “London - Hybrid” stehen so im Bestand. */
    const a = loese("Remote - Berlin");
    expect(a.status).toBe("resolved_city");
    expect(a.stadt).toBe("Berlin");
  });

  it("nennt eine reine Landesangabe ungültig, nicht “nicht gefunden”", () => {
    /*
     * “Deutschland” steht an 29 Stellen als vollständige Ortsangabe.
     * Daraus lässt sich keine Entfernung rechnen — und das ist keine
     * Lücke in der Referenz, sondern eine in der Anzeige.
     */
    expect(loese("Deutschland").status).toBe("invalid_input");
    expect(loese("Nicht angegeben").status).toBe("invalid_input");
  });

  it("löst die Kurzform auf, wenn sie eindeutig ist", () => {
    const a = loese("Neustadt an der Weinstraße");
    expect(a.status).toBe("resolved_city");
    expect(a.longitude).toBeCloseTo(8.1386);
  });

  it("meldet “Frankfurt” als mehrdeutig", () => {
    /*
     * Bare “Frankfurt” steht in der Referenz gar nicht — es gibt nur
     * “Frankfurt am Main” und “Frankfurt (Oder)”. Fünfhundert
     * Kilometer auseinander.
     */
    const a = loese("Frankfurt");
    expect(a.status).toBe("ambiguous");
    expect(a.kandidaten).toBe(2);
  });

  it("löst “Frankfurt” mit Bundesland doch auf", () => {
    const a = loese("Frankfurt, Hessen");
    expect(a.status).toBe("resolved_city");
    expect(a.stadt).toBe("Frankfurt am Main");
    expect(a.quelle).toBe("geonames_ort_lang");
  });

  it("hält “Baden” nicht für “Baden-Baden”", () => {
    /* Der Bindestrich ist keine Wortgrenze — es sind zwei Orte. */
    expect(loese("Baden").status).toBe("not_found");
    expect(loese("Baden-Baden").status).toBe("resolved_city");
  });

  it("nimmt den exakten Namen vor der ausgeschriebenen Form", () => {
    /*
     * “Neustadt” gibt es genau einmal so. Dass es daneben zwanzig
     * Neustadt-an-der-Irgendwas gibt, ändert nichts daran, dass die
     * Anzeige genau diesen Namen geschrieben hat.
     */
    const a = loese("Neustadt");
    expect(a.status).toBe("resolved_city");
    expect(a.region).toBe("Thüringen");
  });

  it("fällt bei einem Stadtteil auf die Stadt zurück", () => {
    const a = loese("Moabit, Berlin");
    expect(a.status).toBe("resolved_city");
    expect(a.stadt).toBe("Berlin");
    expect(a.quelle).toBe("geonames_ort_umgebend");
  });

  it("erfindet für einen unbekannten Ort nichts", () => {
    const a = loese("Ostfriesland");
    expect(a.status).toBe("not_found");
    expect(a.latitude).toBeNull();
  });

  it("erfindet für das Ausland keinen deutschen Punkt", () => {
    const a = loese("Sydney, Australia");
    expect(a.status).toBe("not_found");
    expect(a.latitude).toBeNull();
  });

  it("nennt eine Arbeitsform ungültige Eingabe, nicht “nicht gefunden”", () => {
    /*
     * Für den Betrieb ist das ein Unterschied: Das eine ist eine
     * Lücke in der Referenz, das andere gar keine Ortsangabe.
     */
    expect(loese("Remote").status).toBe("invalid_input");
    expect(loese("Ostfriesland").status).toBe("not_found");
  });
});
