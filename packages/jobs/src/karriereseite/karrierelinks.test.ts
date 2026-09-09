import { describe, expect, it } from "vitest";
import { fundDerArt, karrierelinks } from "./karrierelinks.ts";

const BASIS = "https://www.landkreis-reutlingen.example/";

const seite = (...links: string[]) =>
  `<html><body><nav>${links.join("")}</nav></body></html>`;
const a = (href: string, text: string) => `<a href="${href}">${text}</a>`;

describe("Der Linktext entscheidet, nicht der Pfad", () => {
  it("findet die Stellen eines Landratsamts unter einem Pfad, den niemand raten würde", () => {
    /*
     * Der Fall, für den diese Datei existiert. Eine Pfadliste mit
     * /karriere und /jobs findet genau das hier NICHT — und das ist
     * die Sorte Arbeitgeber, bei der es sich lohnt.
     */
    const funde = karrierelinks(
      seite(a("/buergerservice/personalamt/ausschreibungen", "Stellenangebote")),
      BASIS,
    );
    expect(funde).toHaveLength(1);
    expect(funde[0]?.art).toBe("stellenliste");
    expect(funde[0]?.grund).toMatch(/Linktext/);
  });

  it("findet den Karrierebereich einer Klinik hinter einer Ueber-uns-Struktur", () => {
    const funde = karrierelinks(
      seite(a("/ueber-uns/menschen/wir-stellen-ein", "Arbeiten bei uns")),
      BASIS,
    );
    expect(funde[0]?.art).toBe("karriere");
  });

  it("nimmt den Pfad, wenn der Linktext nichts hergibt — aber schwächer", () => {
    const mitText = karrierelinks(seite(a("/x/y", "Karriere")), BASIS);
    const nurPfad = karrierelinks(seite(a("/karriere", "Mehr erfahren")), BASIS);
    expect(nurPfad[0]?.art).toBe("karriere");
    expect(nurPfad[0]!.punkte).toBeLessThan(mitText[0]!.punkte);
    expect(nurPfad[0]?.grund).toMatch(/Adresse/);
  });

  it("versteht Umlaute, Grossschreibung und Zeichen dazwischen", () => {
    for (const text of ["STELLENANGEBOTE", "Stellenbörse", "Offene Stellen »"]) {
      const funde = karrierelinks(seite(a("/x", text)), BASIS);
      expect(funde.length, text).toBeGreaterThan(0);
    }
  });

  it("sieht durch ein weiches Trennzeichen hindurch", () => {
    /*
     * U+00AD steht in deutscher Web-Typografie überall: „Stellen­-
     * angebote" bricht sauber um und sieht aus wie ein Wort. Für einen
     * Vergleich ist es zwei — und die Karriereseite wäre still
     * übersehen worden, ohne dass jemand wüsste, warum ausgerechnet
     * dieser Arbeitgeber nie auftaucht.
     */
    const funde = karrierelinks(seite(a("/x", "Stellen\u00ADangebote")), BASIS);
    expect(funde[0]?.art).toBe("stellenliste");
  });

  it("findet ein Wort auch, wenn ein Bindestrich es teilt", () => {
    /* `/stellen-angebote` ist eine völlig übliche Adresse. */
    const funde = karrierelinks(seite(a("/karriere/stellen-angebote", "Mehr")), BASIS);
    expect(funde[0]?.art).toBe("stellenliste");
  });
});

describe("Die Art des Fundes ist wichtiger als der Rang", () => {
  it("trennt Initiativbewerbung von der Stellenliste", () => {
    /*
     * Beide sind Treffer, aber sie beantworten verschiedene Fragen:
     * die Liste, ob wir überhaupt fragen müssen; die Initiativseite,
     * ob wir fragen dürfen.
     */
    const funde = karrierelinks(
      seite(
        a("/jobs", "Offene Stellen"),
        a("/karriere/initiativbewerbung", "Initiativbewerbung"),
      ),
      BASIS,
    );
    expect(fundDerArt(funde, "stellenliste")?.url).toMatch(/\/jobs$/);
    expect(fundDerArt(funde, "initiativbewerbung")?.url).toMatch(/initiativbewerbung$/);
  });

  it("erkennt den Talentpool als Initiativweg", () => {
    const funde = karrierelinks(seite(a("/tp", "Talent Pool")), BASIS);
    expect(funde[0]?.art).toBe("initiativbewerbung");
  });

  it("führt Ausbildung getrennt — andere Zielgruppe, anderer Weg", () => {
    const funde = karrierelinks(seite(a("/x", "Ausbildung und duales Studium")), BASIS);
    expect(funde[0]?.art).toBe("ausbildung");
  });

  it("gibt einen Kontaktweg nur schwach gewichtet zurück", () => {
    const funde = karrierelinks(
      seite(a("/a", "Ansprechpartner"), a("/b", "Stellenangebote")),
      BASIS,
    );
    expect(funde[0]?.art).toBe("stellenliste");
    expect(fundDerArt(funde, "kontakt")).not.toBeNull();
  });
});

describe("Was nicht in den Karrierebereich führt", () => {
  it("verwirft Presse und Aktuelles", () => {
    /*
     * "Wir suchen Zeugen" ist eine Pressemitteilung und kein
     * Stellenangebot — auf Behördenseiten steht beides nebeneinander.
     */
    const funde = karrierelinks(
      seite(a("/presse/wir-suchen-zeugen", "Presse: Wir suchen Zeugen")),
      BASIS,
    );
    expect(funde).toHaveLength(0);
  });

  it("verwirft Impressum und Datenschutz", () => {
    expect(
      karrierelinks(seite(a("/impressum", "Impressum"), a("/datenschutz", "Datenschutz")), BASIS),
    ).toHaveLength(0);
  });

  it("verwirft fremde Ziele, die kein Bewerbersystem sind", () => {
    const funde = karrierelinks(
      seite(a("https://facebook.example/landkreis", "Karriere bei uns auf Facebook")),
      BASIS,
    );
    expect(funde).toHaveLength(0);
  });

  it("verwirft alles, was keine Webseite ist", () => {
    expect(
      karrierelinks(
        seite(a("mailto:info@landkreis.example", "Jobs"), a("tel:+4971211", "Karriere")),
        BASIS,
      ),
    ).toHaveLength(0);
  });

  it("gibt eine leere Liste zurück, wenn es keinen Karrierebereich gibt", () => {
    /* Eine geratene Adresse wäre schlechter als keine. */
    expect(karrierelinks(seite(a("/", "Startseite"), a("/kontakt", "Kontakt")), BASIS))
      .toHaveLength(0);
  });
});

describe("Wohin ein Link zeigen darf", () => {
  it("nimmt eine Karriere-Unterdomain als eigene Seite", () => {
    const funde = karrierelinks(
      seite(a("https://karriere.landkreis-reutlingen.example/", "Karriere")),
      BASIS,
    );
    expect(funde).toHaveLength(1);
  });

  it("nimmt ein Bewerbersystem als offizielle Stellenliste", () => {
    /*
     * Viele Arbeitgeber führen ihre Stellen nicht selbst. Der Link
     * geht dann auf eine fremde Domain und ist trotzdem die offizielle
     * Liste — und das Produkt kann sie bereits lesen.
     */
    const funde = karrierelinks(
      seite(a("https://jobs.lever.co/landkreis", "Offene Stellen")),
      BASIS,
    );
    expect(funde).toHaveLength(1);
    expect(funde[0]?.grund).toMatch(/Bewerbersystem/);
  });

  it("nimmt interamt, den Stellenmarkt des öffentlichen Dienstes", () => {
    const funde = karrierelinks(
      seite(a("https://www.interamt.de/koop/app/stellensuche?id=1", "Stellenausschreibungen")),
      BASIS,
    );
    expect(funde).toHaveLength(1);
  });

  it("löst relative Verweise gegen die Basis auf", () => {
    const funde = karrierelinks(
      seite(a("../karriere/stellen", "Stellenangebote")),
      "https://www.landkreis-reutlingen.example/amt/uebersicht.html",
    );
    expect(funde[0]?.url).toBe("https://www.landkreis-reutlingen.example/karriere/stellen");
  });
});

describe("Aufräumen", () => {
  it("führt dieselbe Adresse nur einmal, mit dem besten Fund", () => {
    const funde = karrierelinks(
      seite(a("/karriere", "Mehr"), a("/karriere", "Stellenangebote")),
      BASIS,
    );
    expect(funde).toHaveLength(1);
    expect(funde[0]?.art).toBe("stellenliste");
  });

  it("entfernt Markierungen aus dem Linktext", () => {
    const funde = karrierelinks(
      seite('<a href="/x"><span class="icon"></span> Stellenangebote </a>'),
      BASIS,
    );
    expect(funde[0]?.text).toBe("Stellenangebote");
  });

  it("kommt mit leerem oder kaputtem HTML zurecht", () => {
    expect(karrierelinks("", BASIS)).toEqual([]);
    expect(karrierelinks("<a href=", BASIS)).toEqual([]);
    expect(karrierelinks(seite(a("/x", "Karriere")), "keine url")).toEqual([]);
  });
});
