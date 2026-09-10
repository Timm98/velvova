import { describe, expect, it } from "vitest";
import {
  HOECHSTDAUER,
  aufgabePruefen,
  probeBewerten,
  wirdFestgehalten,
  zeugnisGilt,
  zeugnisPruefen,
  type Aufgabe,
  type Zeugnis,
} from "./nachweis.ts";

/**
 * Ein Zeugnis, das Velvova ausstellt, ist nur so viel wert wie seine
 * Grenzen. Diese Tests halten sie.
 */

const aufgabe = (p: Partial<Aufgabe> = {}): Aufgabe => ({
  taetigkeit: "Prüfung von Förderanträgen auf Vollständigkeit",
  pruefpunkte: [
    { was: "Fehlende Unterschrift in Antrag 2", erwartet: "als fehlend benannt" },
    { was: "Widersprüchliche Summen in Antrag 4", erwartet: "Abweichung beziffert" },
  ],
  text:
    "Vier eingereichte Förderanträge liegen vor. Prüfe, welche Angaben fehlen oder " +
    "einander widersprechen, und halte je Antrag fest, was nachzufordern ist.",
  herkunft: "aus_anzeige",
  hilfsmittel: ["die Förderrichtlinie", "ein Textprogramm"],
  minuten: 45,
  ...p,
});

const zeugnis = (p: Partial<Zeugnis> = {}): Zeugnis => ({
  taetigkeit: "Prüfung von Förderanträgen auf Vollständigkeit",
  aufgabe: "Vier Anträge auf fehlende und widersprüchliche Angaben geprüft",
  bedingungen: "45 Minuten, mit Förderrichtlinie, ohne Rückfragen",
  ergebnis: "Hat alle vier Abweichungen gefunden, eine davon falsch begründet",
  aussteller: "Velvova",
  ausgestelltAm: new Date("2026-09-10"),
  gueltigBis: new Date("2028-09-10"),
  ...p,
});

describe("aufgabePruefen", () => {
  it("nimmt eine brauchbare Aufgabe an", () => {
    expect(aufgabePruefen(aufgabe())).toEqual({ art: "gueltig" });
  });

  it("verlangt, wofür die Aufgabe steht", () => {
    /* „Hat eine Aufgabe gelöst" sagt niemandem etwas. Ohne Tätigkeit
       ist das Zeugnis später nicht einzuordnen. */
    const b = aufgabePruefen(aufgabe({ taetigkeit: "  " }));
    expect(b.art).toBe("untauglich");
    if (b.art === "untauglich") expect(b.grund).toBe("keine_taetigkeit");
  });

  it("lehnt ab, was länger dauert als eine Arbeitsprobe", () => {
    /*
     * Über neunzig Minuten ist es keine Probe mehr, sondern
     * unbezahlte Arbeit — und der Unterschied ist genau der, an dem
     * sich seriöse Verfahren von Ausbeutung trennen.
     */
    const zulang = aufgabePruefen(aufgabe({ minuten: HOECHSTDAUER + 1 }));
    expect(zulang.art === "untauglich" && zulang.grund).toBe("zu_lang");
    expect(aufgabePruefen(aufgabe({ minuten: HOECHSTDAUER })).art).toBe("gueltig");
  });

  it("unterscheidet eine leere Angabe von einer fehlenden", () => {
    /* Eine leere Liste ist eine Angabe. Wer nichts sagt, hat nicht
       „keine" gemeint — er hat nicht daran gedacht, und der Geprüfte
       rät dann. */
    expect(aufgabePruefen(aufgabe({ hilfsmittel: [] })).art).toBe("gueltig");
    const ohne = aufgabePruefen(aufgabe({ hilfsmittel: undefined as unknown as string[] }));
    expect(ohne.art === "untauglich" && ohne.grund).toBe("keine_hilfsmittel_genannt");
  });

  it("lehnt eine zu knappe Aufgabenstellung ab", () => {
    const knapp = aufgabePruefen(aufgabe({ text: "Prüfe die Anträge." }));
    expect(knapp.art === "untauglich" && knapp.grund).toBe("zu_knapp");
  });
});

describe("zeugnisPruefen", () => {
  it("nimmt ein beschreibendes Zeugnis an", () => {
    expect(zeugnisPruefen(zeugnis())).toEqual({ art: "gueltig" });
  });

  it("lehnt jedes Gesamturteil ab", () => {
    /*
     * Der Kern. „Geeignet" behauptet etwas über einen Menschen; „hat
     * alle vier Abweichungen gefunden" beschreibt einen Vorgang — und
     * nur das lässt sich prüfen, bestreiten und richtigstellen.
     */
    for (const satz of [
      "Geeignet für die Position",
      "Überdurchschnittliches Talent für Verwaltungsarbeit",
      "Punktzahl 88 von 100",
      "Note 2",
    ]) {
      const b = zeugnisPruefen(zeugnis({ ergebnis: satz }));
      expect(b.art).toBe("unzulaessig");
      if (b.art === "unzulaessig") expect(b.grund).toBe("gesamturteil");
    }
  });

  it("erlaubt Urteilswörter in der Aufgabenbeschreibung", () => {
    /* Wenn die Aufgabe darin besteht, Noten zu berechnen, darf „Note"
       dort vorkommen. Verboten ist ein Urteil über den Menschen, und
       das stünde im Ergebnis. */
    expect(
      zeugnisPruefen(zeugnis({ aufgabe: "Noten aus vier Teilleistungen berechnet" })).art,
    ).toBe("gueltig");
  });

  it("nennt alles, was fehlt, auf einmal", () => {
    /* Ein Formular, das einen Fehler nach dem anderen meldet, ist
       eine Zumutung — und hier ist alles gleichzeitig prüfbar. */
    const b = zeugnisPruefen(
      zeugnis({ taetigkeit: "", aufgabe: "", bedingungen: "", ergebnis: "", aussteller: "" }),
    );
    expect(b.art).toBe("unvollstaendig");
    if (b.art === "unvollstaendig") expect(b.fehlt).toHaveLength(5);
  });

  it("verlangt die Bedingungen, unter denen geprüft wurde", () => {
    /*
     * Ohne sie ist das Ergebnis nicht einzuordnen: „hat alle vier
     * gefunden" heisst etwas anderes mit Nachschlagewerk als ohne.
     */
    const b = zeugnisPruefen(zeugnis({ bedingungen: "" }));
    expect(b.art === "unvollstaendig" && b.fehlt).toEqual(["bedingungen"]);
  });
});

describe("zeugnisGilt", () => {
  it("läuft ab", () => {
    /* Was jemand vor sechs Jahren konnte, sagt über heute wenig. Ein
       Nachweis ohne Ende wird mit der Zeit zur Behauptung. */
    const z = zeugnis({ gueltigBis: new Date("2027-01-01") });
    expect(zeugnisGilt(z, new Date("2026-12-31"))).toBe(true);
    expect(zeugnisGilt(z, new Date("2027-01-02"))).toBe(false);
  });

  it("gilt ohne Ende unbefristet", () => {
    expect(zeugnisGilt(zeugnis({ gueltigBis: null }), new Date("2099-01-01"))).toBe(true);
  });
});

describe("wirdFestgehalten", () => {
  it("hält nur bestandene Versuche fest", () => {
    /*
     * Die Regel, die niemand umgehen darf. Ein System, in dem Üben
     * aktenkundig wird, ist ein System, in dem niemand übt — und eine
     * gespeicherte Misserfolgsquote wäre genau die verdeckte
     * Negativliste, die ein Kompetenznachweis nie werden darf.
     */
    expect(wirdFestgehalten("bestanden")).toBe(true);
    expect(wirdFestgehalten("nicht_bestanden")).toBe(false);
    expect(wirdFestgehalten("abgebrochen")).toBe(false);
  });
});

describe("probeBewerten", () => {
  const punkte = [
    { was: "Fehlende Unterschrift in Antrag 2", erwartet: "als fehlend benannt" },
    { was: "Widersprüchliche Summen in Antrag 4", erwartet: "Abweichung beziffert" },
    { was: "Abgelaufene Frist in Antrag 1", erwartet: "Datum genannt" },
    { was: "Doppelte Position in Antrag 3", erwartet: "Dopplung benannt" },
  ];

  it("bewertet nicht ohne Prüfpunkte", () => {
    /*
     * „Schreibe einen Text über X" lässt sich nicht bewerten, ohne zu
     * urteilen — und ein Urteil ist genau das, was dieses Zeugnis
     * nicht enthalten darf.
     */
    const b = probeBewerten([], { getroffen: [], anmerkungen: [] });
    expect(b.art === "nicht_bewertbar" && b.grund).toBe("keine_pruefpunkte");
  });

  it("bewertet nicht, wenn zu einem Punkt nichts gesagt wurde", () => {
    /* Ein Ergebnis aus einer unvollständigen Bewertung wäre geraten.
       Lieber kein Zeugnis als eines, dessen Zustandekommen niemand
       nachvollziehen kann. */
    const b = probeBewerten(punkte, { getroffen: [true, true], anmerkungen: [] });
    expect(b.art === "nicht_bewertbar" && b.grund).toBe("unvollstaendig");
  });

  it("besteht ab drei von vier", () => {
    /* Nicht alle: Eine Probe, die nur bei Fehlerfreiheit besteht,
       misst Sorgfalt unter Zeitdruck. Nicht die Hälfte: Wer die
       Hälfte löst, hat nicht gelöst. */
    const drei = probeBewerten(punkte, { getroffen: [true, true, true, false], anmerkungen: [] });
    expect(drei.art).toBe("bestanden");
    const zwei = probeBewerten(punkte, { getroffen: [true, true, false, false], anmerkungen: [] });
    expect(zwei.art).toBe("nicht_bestanden");
  });

  it("nennt im Ergebnis auch, was verfehlt wurde", () => {
    /*
     * Ein Zeugnis, das nur die Treffer nennt, ist ein Werbetext. Wer
     * liest „hat drei von vier gefunden, die vierte übersehen", weiss
     * mehr — und glaubt den drei anderen deshalb.
     */
    const b = probeBewerten(punkte, { getroffen: [true, true, true, false], anmerkungen: [] });
    expect(b.art === "bestanden" && b.ergebnistext).toContain("3 von 4");
    expect(b.art === "bestanden" && b.ergebnistext).toContain("Doppelte Position");
  });

  it("erzeugt einen Ergebnistext, den zeugnisPruefen annimmt", () => {
    /*
     * Der Test, der die beiden Hälften zusammenhält: Was die
     * Bewertung schreibt, muss die Zeugnisprüfung durchlassen. Sonst
     * entsteht ein Ergebnis, das nie ein Zeugnis werden kann.
     */
    const b = probeBewerten(punkte, {
      getroffen: [true, true, true, true],
      anmerkungen: ["Begründung zu Antrag 4 war unvollständig"],
    });
    expect(b.art).toBe("bestanden");
    if (b.art !== "bestanden") return;
    expect(zeugnisPruefen(zeugnis({ ergebnis: b.ergebnistext }))).toEqual({ art: "gueltig" });
  });

  it("hält einen nicht bestandenen Versuch nicht fest", () => {
    const b = probeBewerten(punkte, { getroffen: [true, false, false, false], anmerkungen: [] });
    expect(b.art).toBe("nicht_bestanden");
    expect(wirdFestgehalten("nicht_bestanden")).toBe(false);
  });
});
