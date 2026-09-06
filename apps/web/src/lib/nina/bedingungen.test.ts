import { describe, expect, it } from "vitest";
import { UserConstraintsSchema } from "@paycheck/domain";
import {
  anwenden,
  aufheben,
  bedingungenAusSatz,
  gesetzteBedingungen,
} from "./bedingungen.ts";

/**
 * Aus einem Satz wird ein Vorschlag — und aus einem Vorschlag eine
 * Bedingung, die Stellen ausschliesst.
 *
 * Zwei Fehlerrichtungen, und beide sind teuer:
 *
 *   **Zu grosszügig.** Aus „wäre schön" wird eine harte Grenze, und
 *   passende Stellen verschwinden lautlos. Wer sie nie sieht, kann sie
 *   nicht vermissen.
 *
 *   **Zu zurückhaltend.** Aus „mindestens 45.000, sonst lohnt es nicht"
 *   wird nichts, und die Jobseite schreibt weiter „Du hast keine
 *   Untergrenze festgelegt" — genau der Zustand, der repariert werden
 *   sollte.
 *
 * Beide Richtungen stehen hier.
 */

const LEER = UserConstraintsSchema.parse({
  minSalaryPerYear: null,
  baseLocation: null,
  maxCommuteMinutes: null,
  weeklyHoursMin: null,
  weeklyHoursMax: null,
  maxTravelPercent: null,
});

describe("Grenze erkennen", () => {
  it("erkennt ein Mindestgehalt als harte Bedingung", () => {
    const v = bedingungenAusSatz("Mindestens 45.000 Euro brutto im Jahr, das ist meine Grenze.");
    const gehalt = v.find((x) => x.feld === "minSalaryPerYear");
    expect(gehalt).toBeDefined();
    expect(gehalt!.wert).toBe(45000);
    expect(gehalt!.sicherheit).toBeGreaterThan(0.8);
  });

  it("versteht Kurzschreibweisen wie im Suchfeld", () => {
    // Derselbe Parser wie die Jobsuche — sonst verstünden die beiden
    // irgendwann Verschiedenes, und niemand fände heraus, welcher recht
    // hat.
    for (const satz of [
      "Mindestens 45k",
      "Mindestens 45.000 €",
      "Nicht unter 45000 Euro",
    ]) {
      const g = bedingungenAusSatz(satz).find((x) => x.feld === "minSalaryPerYear");
      expect(g?.wert, satz).toBe(45000);
    }
  });

  it("erkennt Ausschlüsse", () => {
    const v = bedingungenAusSatz("Auf keinen Fall Kaltakquise.");
    expect(v.some((x) => x.feld === "hardNoGos")).toBe(true);
  });

  it("erkennt eine Pendelgrenze", () => {
    const v = bedingungenAusSatz("Maximal 40 Minuten Arbeitsweg, mehr geht nicht.");
    const p = v.find((x) => x.feld === "maxCommuteMinutes");
    expect(p?.wert).toBe(40);
  });

  it("erkennt „keine Schichtarbeit“", () => {
    const v = bedingungenAusSatz("Keine Schichtarbeit, das ist zwingend.");
    expect(v.find((x) => x.feld === "acceptsShiftWork")?.wert).toBe(false);
  });

  it("belegt jeden Vorschlag mit dem Satz, aus dem er stammt", () => {
    // Ohne Beleg kann die Person nicht nachvollziehen, warum eine
    // Bedingung vorgeschlagen wird — und eine Bedingung, die man nicht
    // versteht, bestätigt man entweder blind oder gar nicht.
    for (const v of bedingungenAusSatz("Mindestens 45.000 Euro, keine Kaltakquise.")) {
      expect(v.beleg.length, v.label).toBeGreaterThan(0);
      expect(v.anzeige.length, v.label).toBeGreaterThan(0);
    }
  });
});

describe("Wunsch ist keine Grenze", () => {
  it("schlägt bei einem Wunsch nichts vor", () => {
    /*
     * Der gefährlichere Fehler.
     *
     * Aus „gerne ab 45.000" eine harte Grenze zu machen hiesse: jede
     * Stelle darunter verschwindet, ohne dass jemand es merkt. Wer sie
     * nie sieht, kann sie nicht vermissen.
     */
    for (const satz of [
      "Gerne ab 45.000 Euro.",
      "Idealerweise Homeoffice.",
      "Am liebsten unbefristet.",
      "Vielleicht etwas in Karlsruhe.",
    ]) {
      expect(bedingungenAusSatz(satz), satz).toEqual([]);
    }
  });

  it("bleibt bei gemischten Signalen zurückhaltend", () => {
    // „mindestens … gerne" ist ein halber Satz in beide Richtungen.
    // Er darf vorschlagen, aber nicht mit hoher Sicherheit.
    const v = bedingungenAusSatz("Mindestens 45.000, aber gerne auch mehr.");
    for (const x of v) expect(x.sicherheit).toBeLessThan(0.8);
  });

  it("lässt einen gewöhnlichen Erzählsatz in Ruhe", () => {
    // Die meisten Sätze in einem Karrieregespräch enthalten keine
    // Grenze. Jeden mit einer Rückfrage zu unterbrechen wäre schlimmer
    // als gar keine Erkennung.
    expect(bedingungenAusSatz("Ich arbeite seit vier Jahren in der Disposition.")).toEqual([]);
    expect(bedingungenAusSatz("Zuletzt hatte ich viel mit Kunden zu tun.")).toEqual([]);
  });
});

describe("Anwenden und Aufheben", () => {
  it("setzt das Mindestgehalt", () => {
    const [v] = bedingungenAusSatz("Mindestens 45.000 Euro, das ist Bedingung.");
    const c = anwenden(LEER, v!);
    expect(c.minSalaryPerYear).toBe(45000);
  });

  it("ersetzt Listen, statt sie zu ergänzen", () => {
    /*
     * „Nur unbefristet" heisst nicht „unbefristet zusätzlich zu allem
     * bisherigen". Wer die Liste ergänzte, machte aus einer Verengung
     * eine Erweiterung — und die Bedingung wirkte nie.
     */
    const mitBefristet = { ...LEER, acceptedContractTypes: ["fixed_term" as const] };
    const [v] = bedingungenAusSatz("Nur unbefristete Stellen.");
    if (v) {
      const c = anwenden(mitBefristet, v);
      expect(c.acceptedContractTypes).not.toContain("temporary");
    }
  });

  it("sammelt Ausschlüsse, statt sie zu ersetzen", () => {
    // Die eine Ausnahme: wer zwei Dinge ausschliesst, meint beide.
    let c = LEER;
    for (const satz of ["Auf keinen Fall Kaltakquise.", "Auf keinen Fall Aussendienst."]) {
      for (const v of bedingungenAusSatz(satz)) c = anwenden(c, v);
    }
    expect(c.hardNoGos.length).toBeGreaterThanOrEqual(2);
  });

  it("hebt eine Bedingung wieder auf", () => {
    const c = anwenden(LEER, {
      feld: "minSalaryPerYear",
      wert: 45000,
      label: "",
      anzeige: "",
      beleg: "",
      sicherheit: 1,
      geltung: "dauerhaft",
    });
    expect(aufheben(c, "minSalaryPerYear").minSalaryPerYear).toBeNull();
  });

  it("setzt Arbeitsmodelle auf „alles erlaubt“ zurück, nicht auf leer", () => {
    /*
     * Eine leere Liste erlaubter Arbeitsmodelle würde JEDE Stelle
     * ausschliessen. „Bedingung entfernen" darf nicht die schärfste
     * denkbare Bedingung erzeugen.
     */
    const c = { ...LEER, acceptedWorkModels: ["remote" as const] };
    expect(aufheben(c, "acceptedWorkModels").acceptedWorkModels).toHaveLength(3);
  });

  it("bleibt gültig nach dem Anwenden", () => {
    let c = LEER;
    for (const satz of [
      "Mindestens 45.000 Euro, zwingend.",
      "Maximal 40 Minuten Arbeitsweg.",
      "Keine Schichtarbeit, unbedingt.",
    ]) {
      for (const v of bedingungenAusSatz(satz)) c = anwenden(c, v);
    }
    // Das Ergebnis muss weiterhin durch das Schema gehen — sonst
    // scheitert erst das Speichern, weit weg von der Ursache.
    expect(() => UserConstraintsSchema.parse(c)).not.toThrow();
  });
});

describe("Was gerade gilt", () => {
  it("zeigt gesetzte Bedingungen als Karten", () => {
    let c = LEER;
    for (const satz of ["Mindestens 45.000 Euro, zwingend.", "Keine Schichtarbeit, unbedingt."]) {
      for (const v of bedingungenAusSatz(satz)) c = anwenden(c, v);
    }
    const karten = gesetzteBedingungen(c);
    expect(karten.map((k) => k.label)).toContain("Mindestgehalt");
    expect(karten.map((k) => k.label)).toContain("Schichtarbeit");
  });

  it("zeigt nichts, wenn nichts gesetzt ist", () => {
    // Wichtig: „alle drei Arbeitsmodelle erlaubt" ist keine Bedingung,
    // sondern deren Abwesenheit. Sie als Karte zu zeigen suggerierte
    // eine Einschränkung, die es nicht gibt.
    expect(gesetzteBedingungen(LEER)).toEqual([]);
  });
});

describe("Geltung am Vorschlag", () => {
  /*
   * Die Verbindung zwischen den beiden Modulen.
   *
   * `geltung.ts` allein sagt nur, wie ein Satz gemeint ist.
   * `bedingungen.ts` allein sagt nur, welche Grenze darin steckt. Erst
   * zusammen ergeben sie die Frage, die die Oberfläche stellen muss:
   * „ab jetzt — oder nur für diese Suche?"
   *
   * Ohne diesen Test könnte die Geltung stillschweigend wegfallen, und
   * der dritte Knopf verschwände, ohne dass ein Test rot wird.
   */
  it("kennzeichnet eine Tagesabsicht als Sitzung", () => {
    const v = bedingungenAusSatz("Heute mal maximal 30 Minuten Arbeitsweg, mehr nicht.");
    expect(v.length).toBeGreaterThan(0);
    expect(v[0]!.geltung).toBe("sitzung");
  });

  it("kennzeichnet eine dauerhafte Absicht als dauerhaft", () => {
    const v = bedingungenAusSatz("Ab jetzt nur noch mindestens 60.000 Euro, das ist Bedingung.");
    expect(v.length).toBeGreaterThan(0);
    expect(v[0]!.geltung).toBe("dauerhaft");
  });

  it("lässt die Geltung offen, wenn der Satz sie nicht nennt", () => {
    // Dann fragt die Oberfläche — sie rät nicht.
    const v = bedingungenAusSatz("Maximal 40 Minuten Arbeitsweg, mehr geht nicht.");
    expect(v.length).toBeGreaterThan(0);
    expect(v[0]!.geltung).toBe("unklar");
  });

  it("gibt allen Vorschlägen eines Satzes dieselbe Geltung", () => {
    // Wer „heute mal" sagt, meint beides für heute.
    const v = bedingungenAusSatz(
      "Heute mal mindestens 50.000 Euro und maximal 30 Minuten Arbeitsweg, das ist Bedingung.",
    );
    if (v.length > 1) {
      expect(new Set(v.map((x) => x.geltung)).size).toBe(1);
    }
  });
});
