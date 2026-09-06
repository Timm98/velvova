import { describe, expect, it } from "vitest";
import { rangbegruendung, stufenwort } from "./rangbegruendung";

describe("rangbegruendung", () => {
  it("nennt bei guter Lage die vorhandenen Werte als tragend", () => {
    // „alle drei" wäre falsch, sobald einer fehlt — und fehlen darf
    // jetzt jeder, ohne dass die Rechnung aussetzt.
    expect(rangbegruendung({ matching: 90, qualitaet: 85, sicherheit: 80 }).gesamt).toContain(
      "die vorhandenen Werte tragen",
    );
  });

  it("nennt bei mittlerer Lage den schwächsten Wert beim Namen", () => {
    /*
     * Ohne ihn liest man „62 von 100" und weiss nicht, ob die Stelle
     * nicht passt oder ob wir zu wenig wissen — zwei verschiedene
     * Lagen, dieselbe Zahl.
     */
    const b = rangbegruendung({ matching: 80, qualitaet: 80, sicherheit: 30 });
    expect(b.gesamt).toContain("meine Datengrundlage");
  });

  it("nennt einen Wert unter 50 als das, was das Ergebnis nach unten zieht", () => {
    /*
     * Vorher stand hier „deckelt das Ergebnis" — passend zur Sperre,
     * die Grün verhinderte, solange ein Einzelwert unter 50 lag.
     *
     * Die Sperre ist weg: Die Farbe folgt der Zahl, damit Rand und
     * Zahl in der Liste dasselbe sagen. 95 Passung und 40 Transparenz
     * ergeben mit der Datenlage 76 — und 76 ist grün, auch wenn ein Teilwert schwach ist.
     * Die Bestandteile stehen darunter und erklären es.
     */
    const gruen = rangbegruendung({ matching: 95, qualitaet: 40, sicherheit: 80 });
    expect(gruen.gesamt).toContain("76 von 100");
    expect(gruen.gesamt).not.toMatch(/deckelt/);

    /* Unterhalb der Schwelle wird der schwächste Wert benannt. */
    const gelb = rangbegruendung({ matching: 60, qualitaet: 40, sicherheit: 55 });
    expect(gelb.gesamt).toMatch(/zieht das Ergebnis nach unten/);
    expect(gelb.gesamt).not.toMatch(/deckelt/);
  });

  it("erklärt jede Leiste, den Fit Score eingeschlossen", () => {
    const b = rangbegruendung({ matching: 70, qualitaet: 60, sicherheit: 50 });
    expect(b.zeilen.map((z) => z.titel)).toEqual([
      "Fit Score",
      "Matching",
      "Transparenz der Anzeige",
      "Datenlage",
    ]);
    for (const z of b.zeilen) expect(z.satz.length).toBeGreaterThan(20);
  });

  it("nennt in jedem Leistensatz die Zahl", () => {
    const b = rangbegruendung({ matching: 71, qualitaet: 62, sicherheit: 53 });
    expect(b.zeilen[1]?.satz).toContain("71");
    expect(b.zeilen[2]?.satz).toContain("62");
    expect(b.zeilen[3]?.satz).toContain("53");
  });

  it("sagt bei niedriger Sicherheit, wie man sie hebt", () => {
    // Die einzige der drei Zahlen, die man selbst ändern kann.
    expect(rangbegruendung({ matching: 70, qualitaet: 70, sicherheit: 20 }).zeilen[3]?.satz)
      .toMatch(/Gespräch/);
  });

  it("urteilt bei dünner Anzeige nicht über den Arbeitgeber", () => {
    /*
     * „Die Anzeige lässt vieles offen" ist zulässig. „Der Arbeitgeber
     * verschweigt etwas" wäre eine Unterstellung.
     */
    const satz = rangbegruendung({ matching: 70, qualitaet: 20, sicherheit: 70 }).zeilen[2]!.satz;
    expect(satz).not.toMatch(/verschweigt|unseriös|Betrug/);
  });

  it("rechnet bei fehlendem Wert mit dem Rest und sagt es", () => {
    /*
     * Der Wert entsteht aus dem, was da ist. Ohne Hinweis läse sich
     * „80 von 100" aber wie eine vollständige Einstufung — der
     * Nachsatz sagt, worauf sie nicht beruht.
     */
    const b = rangbegruendung({ matching: null, qualitaet: 80, sicherheit: 80 });
    expect(b.gesamt).toContain("80 von 100");
    expect(b.gesamt).toContain("Ohne die Passung gerechnet");
  });

  it("erklärt auch die fehlende Zahl statt zu schweigen", () => {
    const b = rangbegruendung({ matching: null, qualitaet: 80, sicherheit: 80 });
    expect(b.zeilen[1]?.satz).toMatch(/Fähigkeiten|Arbeitsweise/);
  });
});

describe("stufenwort", () => {
  it("übersetzt die Stufen", () => {
    expect(stufenwort(90)).toBe("hoch");
    expect(stufenwort(60)).toBe("mittel");
    expect(stufenwort(20)).toBe("niedrig");
    expect(stufenwort(null)).toBe("unbekannt");
  });
});

describe("Beruf und Fazit", () => {
  const z = {
    sicherheit: 3.6,
    berufsgruppen: 84,
    nachfrage: "Die Zahl der Stellen bleibt überwiegend stabil.",
    automatisierung: "Teile der Tätigkeit sind automatisierbar.",
    konfidenz: "mittel" as const,
    herkunft: "Aus einer hinterlegten Einschätzung je Berufsgruppe.",
  };

  it("stellt den Beruf voran, auch wenn alles bekannt ist", () => {
    /*
     * Er gilt auch ohne Profil und beantwortet die Frage, mit der man
     * eine Anzeige öffnet — die persönlichen Zahlen kommen danach.
     */
    const b = rangbegruendung({ matching: 80, qualitaet: 80, sicherheit: 80 }, z);
    expect(b.beruf).toContain("stabil");
  });

  it("lässt den Beruf weg, wenn nichts vorliegt", () => {
    expect(rangbegruendung({ matching: 80, qualitaet: 80, sicherheit: 80 }, null).beruf).toBeNull();
  });

  it("erklärt auch den Fit Score selbst", () => {
    const b = rangbegruendung({ matching: 80, qualitaet: 80, sicherheit: 80 }, z);
    expect(b.zeilen[0]?.titel).toBe("Fit Score");
    expect(b.zeilen.map((r) => r.titel)).toEqual([
      "Fit Score",
      "Matching",
      "Transparenz der Anzeige",
      "Datenlage",
    ]);
  });

  it("sagt im Fazit, was zu tun ist, statt die Zahl zu wiederholen", () => {
    // Wer bis hierher gelesen hat, kennt die Zahl. Was er nicht weiss,
    // ist, was er als Nächstes tun soll.
    const b = rangbegruendung({ matching: 85, qualitaet: 85, sicherheit: 85 }, z);
    expect(b.fazit).not.toMatch(/\d+ von 100/);
    expect(b.fazit.length).toBeGreaterThan(30);
  });

  it("nennt ohne Passung das fehlende Profil als Grund", () => {
    const b = rangbegruendung({ matching: null, qualitaet: 80, sicherheit: 80 }, z);
    expect(b.fazit).toContain("dein Profil");
  });

  it("empfiehlt bei dünner Grundlage das Gespräch", () => {
    const b = rangbegruendung({ matching: 80, qualitaet: 80, sicherheit: 30 }, z);
    expect(b.fazit).toMatch(/Gespräch/);
  });
});
