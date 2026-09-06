import { describe, expect, it } from "vitest";
import { deuteSuchintention } from "./suchintention.ts";

/**
 * Die Beispielsätze aus der Produktvorgabe.
 *
 * Sie stehen hier wörtlich, weil sie die Prüfung SIND — nicht als
 * Illustration. Wer den Parser umbaut, muss diese neun Sätze weiter
 * verstehen, sonst fällt es erst im Produkt auf.
 *
 * Gemessen vor dieser Runde: vier der neun gingen ins Leere oder
 * kehrten die Absicht um.
 */
describe("Beispielsätze aus der Vorgabe", () => {
  it("«Nur Karlsruhe» — genau diese Stadt, kein Umkreis", () => {
    /*
     * Vorher: keine Regel traf, der Satz wurde zur Volltextsuche nach
     * „karlsruhe". Getroffen hätte das jede Anzeige mit dem Wort
     * irgendwo im Text — und jede Karlsruher Stelle verfehlt, die es
     * nicht schreibt.
     */
    const r = deuteSuchintention("Nur Karlsruhe");
    expect(r.filter.ort).toBe("Karlsruhe");
    expect(r.filter.ortGenau).toBe(true);
    expect(r.filter.q).toBeUndefined();
    expect(r.rest).toBe("");
  });

  it("«Rund um Karlsruhe» — mit Umkreis, nicht genau", () => {
    const r = deuteSuchintention("Rund um Karlsruhe");
    expect(r.filter.ort).toBe("Karlsruhe");
    expect(r.filter.ortGenau).toBeUndefined();
  });

  it("«Maximal zwei Bürotage rund um Karlsruhe»", () => {
    const r = deuteSuchintention("Maximal zwei Bürotage rund um Karlsruhe");
    expect(r.filter.ort).toBe("Karlsruhe");
    expect(r.filter.remote).toBe("hybrid");
    expect(r.erkannt.join(" ")).toContain("2 Bürotage");
    expect(r.rest).toBe("");
  });

  it("«ab 45.000 €, wenn das Gehalt angegeben ist» verlangt die Angabe", () => {
    const r = deuteSuchintention("Nur Stellen ab 45.000 Euro, wenn das Gehalt angegeben ist");
    expect(r.filter.gehaltAb).toBe(45000);
    expect(r.filter.salary).toBe("disclosed");
    /* „Stellen" ist kein Ort. */
    expect(r.filter.ort).toBeUndefined();
    expect(r.rest).toBe("");
  });

  it("«ab 45.000 €, Schätzungen sind okay» verlangt sie NICHT", () => {
    /*
     * Der Fehler, der die Absicht umkehrte: Jedes Mindestgehalt setzte
     * „nur mit Gehaltsangabe" — auf einen Satz, der ausdrücklich das
     * Gegenteil sagt, antwortete das Produkt mit dem Filter, der
     * Schätzungen ausschliesst.
     */
    const r = deuteSuchintention("Ab 45.000 Euro, Schätzungen sind okay");
    expect(r.filter.gehaltAb).toBe(45000);
    expect(r.filter.salary).toBeUndefined();
    expect(r.rest).toBe("");
  });

  it("«mit Kundenkontakt, aber ohne Kaltakquise»", () => {
    const r = deuteSuchintention("Jobs mit Kundenkontakt, aber ohne Kaltakquise");
    expect(r.filter.nicht).toContain("kaltakquise");
    expect(r.filter.q).toContain("kundenkontakt");
  });

  it("«Unbefristet, Vollzeit und keine Nachtschicht» — drei Filter", () => {
    /*
     * Vorher wurde nur „unbefristet" erkannt; „Vollzeit" und
     * „Nachtschicht" fielen in die Volltextsuche und trafen damit nur
     * Anzeigen, die diese Wörter zufällig schreiben.
     */
    const r = deuteSuchintention("Unbefristet, Vollzeit und keine Nachtschicht");
    expect(r.filter.contract).toBe("permanent");
    expect(r.filter.arbeitszeit).toBe("vollzeit");
    expect(r.filter.schicht).toBe(false);
    expect(r.rest).toBe("");
  });

  it("«Mach den Gehaltsfilter wieder weg» nimmt beide Gehaltsfelder", () => {
    /*
     * Vorher eine Volltextsuche nach „mach gehaltsfilter weg" — drei
     * Wörter, die in keiner Anzeige stehen. Null Treffer auf einen
     * Satz, den jeder Mensch versteht.
     */
    const r = deuteSuchintention("Mach den Gehaltsfilter wieder weg");
    expect(r.entfernen).toContain("gehaltAb");
    expect(r.entfernen).toContain("salary");
    expect(r.filter.q).toBeUndefined();
  });

  it("«Doch lieber 25 Kilometer» ändert nur den Umkreis", () => {
    const r = deuteSuchintention("Doch lieber 25 Kilometer");
    expect(r.filter.umkreisKm).toBe(25);
    expect(r.filter.q).toBeUndefined();
    expect(r.rest).toBe("");
  });

  it("hebt «nur diese Stadt» auf, wenn ein Umkreis dazukommt", () => {
    /* Beides zugleich wäre widersprüchlich. */
    const r = deuteSuchintention("Nur Karlsruhe, 25 Kilometer");
    expect(r.filter.ort).toBe("Karlsruhe");
    expect(r.filter.ortGenau).toBeUndefined();
    expect(r.filter.umkreisKm).toBe(25);
  });

  it("hält «Nur Vollzeit» nicht für einen Ort", () => {
    const r = deuteSuchintention("Nur Vollzeit");
    expect(r.filter.ort).toBeUndefined();
    expect(r.filter.arbeitszeit).toBe("vollzeit");
  });
});
