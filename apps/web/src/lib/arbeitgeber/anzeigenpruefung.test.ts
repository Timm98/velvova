import { describe, expect, it } from "vitest";
import { pruefeAnzeige, veroeffentlichbar, type Anzeigenentwurf } from "./anzeigenpruefung.ts";

/**
 * Die Prüfung einer Anzeige, bevor sie hinausgeht.
 *
 * Zwei Fehlerrichtungen, und die zweite ist die teurere:
 *
 *   **Etwas übersehen** kostet eine schlechtere Anzeige.
 *
 *   **Etwas beanstanden, das nicht dasteht** kostet das Vertrauen in
 *   ALLE Hinweise. Wer einmal eine Formulierung geändert bekommt, die
 *   gar nicht in seinem Text stand, liest den nächsten Hinweis nicht
 *   mehr. Deshalb hat der zweite Block hier mehr Tests als der erste.
 */

function entwurf(teil: Partial<Anzeigenentwurf> = {}): Anzeigenentwurf {
  return {
    title: "Disponent (m/w/d)",
    location: "Dortmund",
    description:
      "Wir suchen eine Disponentin für unseren Standort in Dortmund. Du planst Touren und " +
      "stimmst dich mit Fahrern ab. Wir bieten 30 Tage Urlaub und Homeoffice an zwei Tagen.",
    workModel: "hybrid",
    contractType: "permanent",
    weeklyHours: 40,
    salaryMin: 48000,
    salaryMax: 56000,
    salaryPeriod: "year",
    ...teil,
  };
}

const schluessel = (e: Partial<Anzeigenentwurf>) => pruefeAnzeige(entwurf(e)).map((b) => b.key);

describe("Was das Veröffentlichen blockiert", () => {
  it("verlangt eine Gehaltsangabe", () => {
    /*
     * Bei fremden Anzeigen können wir sie nicht verlangen. Hier schon —
     * und hier ist es auch richtig: Dieses Produkt dreht sich um die
     * Frage, was von einem Gehalt übrig bleibt.
     */
    const b = pruefeAnzeige(entwurf({ salaryMin: null, salaryMax: null }));
    expect(b.map((x) => x.key)).toContain("gehalt");
    expect(veroeffentlichbar(b)).toBe(false);
  });

  it("verlangt Ort und Beschreibung", () => {
    expect(schluessel({ location: "" })).toContain("ort");
    expect(schluessel({ description: "zu kurz" })).toContain("beschreibung");
  });

  it("merkt eine verdrehte Gehaltsspanne", () => {
    const b = pruefeAnzeige(entwurf({ salaryMin: 60000, salaryMax: 40000 }));
    expect(b.map((x) => x.key)).toContain("spanne_verdreht");
    expect(veroeffentlichbar(b)).toBe(false);
  });

  it("lässt eine vollständige Anzeige durch", () => {
    // Die Gegenprobe. Ohne sie könnte die Prüfung alles blockieren und
    // jeder Test oben bliebe grün.
    expect(veroeffentlichbar(pruefeAnzeige(entwurf()))).toBe(true);
  });
});

describe("Was ein Hinweis bleibt", () => {
  it("blockiert nicht wegen fehlender Wochenstunden", () => {
    /*
     * Wichtig, aber kein Blocker.
     *
     * Wer die Entscheidung wegnimmt, erzieht niemanden — er wird
     * umgangen. Und es gibt Rollen, in denen die Stundenzahl wirklich
     * offen ist.
     */
    const b = pruefeAnzeige(entwurf({ weeklyHours: null }));
    expect(b.find((x) => x.key === "stunden")?.gewicht).toBe("wichtig");
    expect(veroeffentlichbar(b)).toBe(true);
  });

  it("weist auf eine sehr weite Gehaltsspanne hin, ohne zu blockieren", () => {
    const b = pruefeAnzeige(entwurf({ salaryMin: 40000, salaryMax: 90000 }));
    expect(b.map((x) => x.key)).toContain("spanne_weit");
    expect(veroeffentlichbar(b)).toBe(true);
  });

  it("sortiert Blocker nach oben", () => {
    // Wer die Liste von oben abarbeitet, soll zuerst das erledigen, was
    // ihn aufhält.
    const b = pruefeAnzeige(entwurf({ salaryMin: null, salaryMax: null, weeklyHours: null }));
    expect(b[0]!.gewicht).toBe("blockiert");
  });
});

describe("Formulierungen", () => {
  it("erkennt den Altersbezug", () => {
    const b = pruefeAnzeige(
      entwurf({ description: entwurf().description + " Wir sind ein junges, dynamisches Team." }),
    );
    const treffer = b.find((x) => x.key === "alter");
    expect(treffer).toBeDefined();
    expect(treffer!.beleg).toMatch(/junges/);
  });

  it("erkennt „Muttersprachler“", () => {
    const b = pruefeAnzeige(
      entwurf({ description: entwurf().description + " Deutsch auf Muttersprachlerniveau." }),
    );
    expect(b.map((x) => x.key)).toContain("muttersprache");
  });

  it("verlangt den Zusatz im TITEL, nicht irgendwo im Text", () => {
    /*
     * Der Titel wird in Listen und Suchergebnissen gezeigt.
     *
     * Ein „(m/w/d)" im dritten Absatz macht aus „Sachbearbeiter" in der
     * Überschrift keine geschlechtsneutrale Ausschreibung — und genau
     * die Überschrift sieht man zuerst.
     */
    const b = pruefeAnzeige(
      entwurf({
        title: "Sachbearbeiter",
        description: entwurf().description + " Gesucht (m/w/d) für unser Team.",
      }),
    );
    expect(b.map((x) => x.key)).toContain("geschlecht");
  });

  it("ist zufrieden, wenn der Zusatz im Titel steht", () => {
    expect(schluessel({ title: "Disponent (m/w/d)" })).not.toContain("geschlecht");
    expect(schluessel({ title: "Disponent (w/m/d)" })).not.toContain("geschlecht");
    expect(schluessel({ title: "Disponent (all genders)" })).not.toContain("geschlecht");
  });
});

describe("Was NICHT beanstandet wird", () => {
  it("lässt eine gewöhnliche Anzeige ohne Formulierungsbefund", () => {
    /*
     * Der wichtigste Test der Datei.
     *
     * Wären die Muster zu weit, bekäme jede Anzeige dieselben Hinweise —
     * und der Autor würde alle ignorieren, auch den einen, der zählt.
     */
    const b = pruefeAnzeige(entwurf());
    const formulierungen = ["alter", "muttersprache", "aussehen", "familienstand", "geschlecht"];
    expect(b.filter((x) => formulierungen.includes(x.key))).toEqual([]);
  });

  it("verwechselt „Jungingenieur“ nicht mit einem Altersbezug", () => {
    // Grenzfall, bewusst festgehalten: Das Muster verlangt „junges Team"
    // und nicht das Wort „jung" irgendwo.
    expect(schluessel({ description: entwurf().description + " Auch für Jungingenieure geeignet." }))
      .not.toContain("alter");
  });

  it("nennt jeden Formulierungsbefund mit Beleg", () => {
    // Ohne Zitat kann der Autor nicht nachvollziehen, welche Stelle
    // gemeint ist — und ändert dann entweder nichts oder das Falsche.
    const b = pruefeAnzeige(
      entwurf({ description: entwurf().description + " Wir sind ein junges Team." }),
    );
    for (const x of b.filter((y) => y.key === "alter")) {
      expect(x.beleg, x.titel).toBeTruthy();
    }
  });

  it("beanstandet dieselbe Formulierung nur einmal", () => {
    const b = pruefeAnzeige(
      entwurf({
        description:
          entwurf().description + " Junges Team. Wirklich ein junges Team. Junges, dynamisches Team.",
      }),
    );
    expect(b.filter((x) => x.key === "alter")).toHaveLength(1);
  });
});
