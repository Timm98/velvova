import { describe, expect, it } from "vitest";
import { brauchtUebersetzung, MIN_WOERTER, spracheErkennen } from "./sprache.ts";

const DEUTSCH =
  "Wir suchen für unser Team in Karlsruhe eine Fachkraft, die mit uns die Anlagen betreut. " +
  "Du hast eine abgeschlossene Ausbildung und arbeitest gern selbstständig. Bei uns bekommst " +
  "du eine unbefristete Stelle, eine faire Vergütung und die Möglichkeit, dich weiterzubilden.";

const ENGLISCH =
  "We are looking for a colleague who will join our team and help us build the platform. " +
  "You have experience with modern tools and you are comfortable working on your own. " +
  "This is what we offer: a permanent contract, fair pay and the chance to grow with us.";

describe("spracheErkennen", () => {
  it("erkennt eine deutsche Anzeige", () => {
    expect(spracheErkennen(DEUTSCH).sprache).toBe("de");
  });

  it("erkennt eine englische Anzeige", () => {
    expect(spracheErkennen(ENGLISCH).sprache).toBe("en");
  });

  it("schweigt bei einem zu kurzen Text", () => {
    /*
     * Ein zu kurzer Text hat keine erkennbare Sprache. Ihn zu raten
     * hiesse, eine deutsche Anzeige zu übersetzen oder eine englische
     * stehenzulassen.
     */
    expect(spracheErkennen("Verkäufer gesucht").sprache).toBe("unbekannt");
    expect(spracheErkennen(null).sprache).toBe("unbekannt");
  });

  it("schweigt bei einem gemischten Text", () => {
    /* Zweisprachige Anzeigen gibt es. Dort ist „unbekannt" richtiger
       als eine Entscheidung, die zur Hälfte falsch ist. */
    const gemischt = `${DEUTSCH} ${ENGLISCH}`;
    expect(spracheErkennen(gemischt).sprache).toBe("unbekannt");
  });

  it("lässt sich nicht von Fachbegriffen täuschen", () => {
    /*
     * „Manager", „Team", „Service" und „Software" stehen in deutschen
     * Anzeigen genauso oft wie in englischen. Sie dürfen die Zählung
     * nicht verderben.
     */
    const deutschMitAnglizismen =
      "Als Team Lead im Service Management übernimmst du die Verantwortung für unser " +
      "Software Team. Du hast Erfahrung mit agilen Methoden und arbeitest eng mit den " +
      "Stakeholdern zusammen. Wir bieten dir eine unbefristete Stelle und die Chance, " +
      "dich fachlich weiterzuentwickeln.";
    expect(spracheErkennen(deutschMitAnglizismen).sprache).toBe("de");
  });

  it("schweigt bei einer reinen Aufzählung", () => {
    /* Eine Liste von Techniken hat keine Funktionswörter — und damit
       keine erkennbare Sprache. */
    const liste = Array.from({ length: MIN_WOERTER + 5 }, (_, i) => `python${i}`).join(" ");
    expect(spracheErkennen(liste).sprache).toBe("unbekannt");
  });

  it("nennt die Zählung mit, damit man sie nachprüfen kann", () => {
    const r = spracheErkennen(DEUTSCH);
    expect(r.deutsch).toBeGreaterThan(r.englisch);
    expect(r.woerter).toBeGreaterThan(MIN_WOERTER);
  });
});

describe("brauchtUebersetzung", () => {
  it("übersetzt Englisches für eine deutsche Oberfläche", () => {
    expect(brauchtUebersetzung("en", "de")).toBe(true);
  });

  it("lässt Deutsches für eine deutsche Oberfläche stehen", () => {
    expect(brauchtUebersetzung("de", "de-DE")).toBe(false);
  });

  it("übersetzt nichts, was es nicht sicher erkannt hat", () => {
    /*
     * Eine deutsche Anzeige durch die Übersetzung zu schicken kostet
     * Geld und macht sie schlechter.
     */
    expect(brauchtUebersetzung("unbekannt", "de")).toBe(false);
    expect(brauchtUebersetzung("unbekannt", "en")).toBe(false);
  });
});
