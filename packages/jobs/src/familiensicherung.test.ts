import { beforeEach, describe, expect, it } from "vitest";
import {
  breakerFor,
  familienBreakerFor,
  istKontoweiterFehler,
  quellenfamilie,
  resetBreakers,
} from "./health.ts";

/*
 * Der Fall, der diese Datei nötig gemacht hat, ist echt und datiert:
 * Am 9. September 2026 antworteten alle 32 Careerjet-Ländervarianten
 * mit „Unauthorized access from IP …". Eine Freigabeliste beim
 * Anbieter — also ein Zustand des KONTOS, nicht des Landes.
 *
 * Mit einer Sicherung je Land kostet das fast hundert Anfragen je
 * Lauf, deren Ausgang nach der ersten Antwort feststand.
 */

beforeEach(() => resetBreakers());

describe("Welcher Anbieter ist gemeint", () => {
  it("liest den Anbieter aus dem Adapterschlüssel", () => {
    expect(quellenfamilie("careerjet_de")).toBe("careerjet");
    expect(quellenfamilie("adzuna_gb")).toBe("adzuna");
    expect(quellenfamilie("jooble_pl")).toBe("jooble");
  });

  it("kommt mit einem Schlüssel ohne Land zurecht", () => {
    expect(quellenfamilie("arbeitnow")).toBe("arbeitnow");
  });

  it("teilt sich eine Sicherung über alle Länder eines Anbieters", () => {
    expect(familienBreakerFor("careerjet_de")).toBe(familienBreakerFor("careerjet_fr"));
  });

  it("trennt die Sicherungen verschiedener Anbieter", () => {
    expect(familienBreakerFor("careerjet_de")).not.toBe(familienBreakerFor("adzuna_de"));
  });

  it("lässt die Sicherung je Land davon unberührt", () => {
    /* Zwei Ebenen, nicht eine ersetzt durch die andere. */
    expect(breakerFor("careerjet_de")).not.toBe(breakerFor("careerjet_fr"));
  });
});

describe("Welcher Fehler meint das Konto", () => {
  it("erkennt die Careerjet-Meldung, die den Anlass gab", () => {
    expect(
      istKontoweiterFehler(
        new Error("Careerjet (DE) meldet: Unauthorized access from IP 203.0.113.7."),
      ),
    ).toBe(true);
  });

  it("erkennt 401, 403 und 429 im Satz", () => {
    for (const code of [401, 403, 429]) {
      expect(
        istKontoweiterFehler(new Error(`Adzuna antwortete mit ${code}.`)),
        String(code),
      ).toBe(true);
    }
  });

  it("bevorzugt einen Statuscode am Fehler, wenn es ihn gibt", () => {
    /* Damit die Texterkennung später ersatzlos wegfallen kann. */
    const fehler = Object.assign(new Error("irgendwas"), { status: 403 });
    expect(istKontoweiterFehler(fehler)).toBe(true);
    expect(istKontoweiterFehler(Object.assign(new Error("403 im Text"), { status: 500 }))).toBe(false);
  });

  it("hält einen Landesfehler NICHT für kontoweit", () => {
    /*
     * Der teurere der beiden möglichen Fehler: Ein Land mit 404 sperrt
     * sonst die anderen 31 mit.
     */
    expect(istKontoweiterFehler(new Error("Careerjet (SE) antwortete mit 404."))).toBe(false);
    expect(istKontoweiterFehler(new Error("Zeitüberschreitung nach 45 Sekunden."))).toBe(false);
    expect(istKontoweiterFehler(new Error("Antwort war kein JSON."))).toBe(false);
  });

  it("kommt mit allem zurecht, was kein Fehler ist", () => {
    expect(istKontoweiterFehler(null)).toBe(false);
    expect(istKontoweiterFehler(undefined)).toBe(false);
    expect(istKontoweiterFehler("403")).toBe(true);
  });
});

describe("Was die Anbietersicherung einspart", () => {
  it("sperrt nach drei Ländern alle übrigen desselben Anbieters", () => {
    /*
     * Der eigentliche Gewinn. Vorher: 32 × 3 = 96 vergebliche
     * Anfragen je Lauf. Jetzt: 3.
     */
    const familie = familienBreakerFor("careerjet_de");
    for (const land of ["de", "fr", "es"]) {
      familienBreakerFor(`careerjet_${land}`).recordFailure();
    }
    expect(familie.allows()).toBe(false);
    expect(familienBreakerFor("careerjet_it").allows()).toBe(false);
    expect(familienBreakerFor("careerjet_nl").allows()).toBe(false);
  });

  it("lässt andere Anbieter weiterlaufen", () => {
    for (const land of ["de", "fr", "es"]) {
      familienBreakerFor(`careerjet_${land}`).recordFailure();
    }
    expect(familienBreakerFor("adzuna_de").allows()).toBe(true);
    expect(familienBreakerFor("jooble_de").allows()).toBe(true);
  });

  it("öffnet sich wieder, sobald ein Land des Anbieters liefert", () => {
    /*
     * Sonst bliebe der Anbieter gesperrt, obwohl die Ursache behoben
     * ist — und die übrigen Länder blieben draussen, bis die
     * Wartezeit abläuft.
     */
    const familie = familienBreakerFor("careerjet_de");
    for (const land of ["de", "fr", "es"]) {
      familienBreakerFor(`careerjet_${land}`).recordFailure();
    }
    expect(familie.allows()).toBe(false);

    familienBreakerFor("careerjet_de").recordSuccess();
    expect(familienBreakerFor("careerjet_it").allows()).toBe(true);
  });

  it("löst bei zwei Fehlschlägen noch nicht aus", () => {
    familienBreakerFor("careerjet_de").recordFailure();
    familienBreakerFor("careerjet_fr").recordFailure();
    expect(familienBreakerFor("careerjet_es").allows()).toBe(true);
  });
});
