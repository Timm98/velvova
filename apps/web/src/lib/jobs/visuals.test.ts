import { describe, expect, it } from "vitest";
import { berufsgruppe, jobVisual, verlaufFür } from "./visuals.ts";

describe("Berufsgruppe", () => {
  it("erkennt die Gruppe am Titel", () => {
    expect(berufsgruppe("Senior Backend Engineer")).toBe("software_data");
    expect(berufsgruppe("Mitarbeiter Kundenservice")).toBe("customer_success");
    expect(berufsgruppe("Pflegefachkraft")).toBe("healthcare");
    expect(berufsgruppe("Account Manager Vertrieb")).toBe("sales");
  });

  it("richtet sich nach der Tätigkeit, nicht nach der Branche", () => {
    // Eine Entwicklerin in einer Klinik entwickelt — sie pflegt nicht.
    expect(berufsgruppe("Softwareentwickler", ["Klinik", "Gesundheitswesen"])).toBe("software_data");
  });

  it("gibt lieber nichts zurück als etwas Falsches", () => {
    /*
     * Ohne Treffer keine Gruppe — und damit keine Berufsillustration,
     * sondern ein Verlauf. Eine falsche Illustration wäre eine Aussage
     * über die Arbeit, die niemand geprüft hat.
     */
    expect(berufsgruppe("Zirkusdirektor (m/w/d)")).toBeNull();
  });
});

describe("Verlauf", () => {
  it("ist für dieselbe Stelle immer derselbe", () => {
    const a = verlaufFür("job-1");
    expect(verlaufFür("job-1")).toBe(a);
    expect(verlaufFür("job-2")).not.toBe(a);
  });

  it("bleibt in der Markenfamilie", () => {
    // 210–304 Grad: Eisblau bis Violett. Grün und Rot bedeuten im
    // Produkt etwas — bestätigt, Konflikt — und dürfen nicht als
    // Dekoration auftauchen.
    for (let i = 0; i < 200; i++) {
      const töne = [...verlaufFür(`job-${i}`).matchAll(/oklch\([\d.]+ [\d.]+ (\d+)\)/g)].map((m) =>
        Number(m[1]),
      );
      expect(töne.length).toBe(2);
      for (const t of töne) {
        expect(t, `job-${i}`).toBeGreaterThanOrEqual(210);
        expect(t, `job-${i}`).toBeLessThanOrEqual(304);
      }
    }
  });
});

describe("Jobvisual", () => {
  const job = { id: "abc", title: "Entwicklerin", companyName: "Beispiel GmbH" };
  /* Ein Titel, der bewusst zu keiner der fünfzehn Gruppen passt. */
  const ohneGruppe = { id: "xyz", title: "Zauberin", companyName: "Beispiel GmbH" };

  it("nimmt die Illustration der Berufsgruppe, wenn eine passt", () => {
    /*
     * Diese Erwartung stand vorher andersherum: „fällt ohne Bibliothek
     * auf den Verlauf zurück". Sie beschrieb damit einen Zustand, der
     * kein Ziel war, sondern eine Lücke — Stufe 3 wartete auf eine
     * Bibliothek, die niemand angelegt hatte, und deshalb bekam KEINE
     * Stelle je ein Bild.
     *
     * Seit die fünfzehn Berufsbilder ausgeliefert werden, ist der
     * Verlauf wieder das, was er sein soll: die letzte Stufe.
     */
    const v = jobVisual(job);
    expect(v.grund).toBe("role_family");
    expect(v.url).toBe("/berufsbilder/software_data.svg");
    expect(v.kennzeichnung).toBe("Illustration");
  });

  it("nennt die Berufsgruppe im Alternativtext, nicht den Arbeitgeber", () => {
    // Das Bild zeigt eine Berufsgruppe. „Büro von Beispiel GmbH“ wäre
    // erfunden — es ist keine Aufnahme aus diesem Betrieb.
    const v = jobVisual(job);
    expect(v.altText).toContain("Software");
    expect(v.altText).not.toContain("Beispiel GmbH");
  });

  it("fällt ohne passende Gruppe auf den Verlauf zurück, ohne Netzaufruf", () => {
    const v = jobVisual(ohneGruppe);
    expect(v.grund).toBe("gradient");
    expect(v.url).toBeUndefined();
    expect(v.gradient).toContain("linear-gradient");
  });

  it("beschreibt den Verlauf als das, was er ist", () => {
    // „Farbfläche“ ist ehrlich. „Büro“ wäre erfunden.
    const v = jobVisual(ohneGruppe);
    expect(v.altText).toContain("Farbfläche");
    expect(v.altText).toContain("Zauberin");
  });

  it("kennzeichnet erzeugte Bilder als Illustration", () => {
    const v = jobVisual(job, {
      grund: "role_family",
      url: "/visuals/software.webp",
      altText: "Abstrakte Darstellung von Softwarearbeit",
      aiGenerated: true,
    });
    expect(v.kennzeichnung).toBe("Illustration");
  });

  it("kennzeichnet ein echtes Logo nicht als Illustration", () => {
    const v = jobVisual(job, {
      grund: "company_logo",
      url: "https://beispiel.de/logo.svg",
      altText: "Logo der Beispiel GmbH",
      aiGenerated: false,
    });
    expect(v.kennzeichnung).toBeUndefined();
  });
});

describe("Bilderzeugung", () => {
  it("ist ohne ausdrückliche Freigabe aus", async () => {
    const { bilderzeugungErlaubt } = await import("./visuals.ts");
    expect(bilderzeugungErlaubt({ jobs: { imageGeneration: false } })).toBe(false);
    expect(bilderzeugungErlaubt({ jobs: { imageGeneration: true } })).toBe(true);
  });

  it("wird beim Anzeigen einer Stelle nicht gebraucht", () => {
    /*
     * `jobVisual` ist rein und kennt keine Konfiguration. Das ist die
     * Zusicherung aus §21.5: bei einem Seitenaufruf kann gar nichts
     * erzeugt werden, weil die Funktion nicht einmal weiss, ob sie
     * dürfte.
     */
    const v = jobVisual({ id: "x", title: "T", companyName: "C" });
    expect(v.grund).toBe("gradient");
  });
});

describe("Der Titel schlägt die Aufgaben", () => {
  /*
   * Vorher wurden Titel und Aufgaben zu einer Zeichenkette verbunden
   * und in einem Durchgang geprüft. Ein beliebiges Wort aus der
   * Aufgabenliste konnte damit einen eindeutigen Titel überstimmen —
   * und generische Aufgabenwörter tun das ständig.
   *
   * Sichtbar wurde es auf der Startseite: zwei von drei Karten trugen
   * dasselbe Codefenster, darunter eine Vertriebsstelle.
   */
  it("lässt „Kundenbetreuung“ eine Vertriebsstelle nicht kapern", () => {
    expect(
      berufsgruppe("Werkstudent Vertrieb Grünstrom (m/w/d)", [
        "Geschäftsentwicklung",
        "Kundenbetreuung",
      ]),
    ).toBe("sales");
  });

  it("lässt „Entwicklung“ im kaufmännischen Sinn keine Software daraus machen", () => {
    expect(berufsgruppe("Account Manager (m/w/d)", ["Geschäftsentwicklung"])).toBe("sales");
  });

  it("nutzt die Aufgaben weiterhin, wenn der Titel nichts hergibt", () => {
    // Der Grund, warum die Aufgaben überhaupt geprüft werden.
    expect(berufsgruppe("Werkstudent (m/w/d)", ["Kundenbetreuung", "Support"])).toBe(
      "customer_success",
    );
  });

  it("hält die ursprüngliche Absicht: der Titel entscheidet über die Branche", () => {
    // „Eine Entwicklerin in einer Klinik entwickelt, sie pflegt nicht.“
    expect(berufsgruppe("Softwareentwicklerin", ["Pflegedokumentation"])).toBe("software_data");
  });
});

describe("Die Lücken, die die Messung gezeigt hat", () => {
  /*
   * Beim ersten Durchgang blieben 526 von 1.447 Stellen ohne Gruppe —
   * gut ein Drittel bekam nur einen Farbverlauf. Die häufigsten Fälle
   * standen alle im Bestand und waren im Muster schlicht nicht
   * vorgesehen.
   */
  it("erkennt kaufmännische Ausbildungsberufe als Verwaltung", () => {
    // ~29 Stellen im Bestand. `office` fängt kein „Büromanagement".
    expect(berufsgruppe("Kaufleute für Büromanagement (m/w/d)")).toBe("administration");
    expect(berufsgruppe("Kaufmann für Büromanagement")).toBe("administration");
  });

  it("erkennt Leitungsrollen als Operations", () => {
    expect(berufsgruppe("Projektleiter (m/w/d)")).toBe("operations");
    expect(berufsgruppe("Teamleiter Logistik")).toBe("operations");
  });

  it("erkennt Account Executive als Vertrieb", () => {
    // `account manager` stand im Muster, `account executive` nicht.
    expect(berufsgruppe("Account Executive")).toBe("sales");
  });

  it("erkennt IT-Betrieb als Software", () => {
    /*
     * Der Anlass: „Senior IT Administrator" bekam Sprechblasen —
     * das Motiv für Kundenkontakt. Es kam aus der Aufgabenliste,
     * weil der Titel selbst zu gar keiner Gruppe passte.
     */
    expect(berufsgruppe("Senior IT Administrator (m/w/d) On-Site")).toBe("software_data");
    expect(berufsgruppe("Systemadministrator")).toBe("software_data");
    expect(berufsgruppe("Netzwerkadministrator")).toBe("software_data");
  });

  it("bleibt bei wirklich Unbekanntem still", () => {
    // Ein falsches Berufsbild behauptet etwas über die Arbeit. Ein
    // Verlauf behauptet nichts — und ist deshalb der bessere Ausgang.
    expect(berufsgruppe("Zauberin")).toBeNull();
  });
});
