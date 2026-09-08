import { describe, expect, it } from "vitest";
import { identitaet } from "./arbeitgeberidentitaet.ts";

const beleg = ["fundstelle-1"];

describe("Arbeitgeberidentität (Prüffall B11)", () => {
  it("macht aus einem Fachgebietslabel keinen geprüften Arbeitgeber", () => {
    /*
     * Der Fall aus der Wettbewerbsprüfung: Anzeigen im
     * Unternehmensbereich unter „Augenheilkunde". Daraus lässt sich die
     * beschäftigende Einrichtung nicht bestimmen.
     */
    const b = identitaet([
      { rolle: "veroeffentlicher", name: "Augenheilkunde", belege: beleg },
    ]);
    expect(b.arbeitgeberBekannt).toBe(false);
    expect(b.arbeitgeber).toBeNull();
    expect(b.bewertungErlaubt).toBe(false);
    expect(b.direktVomArbeitgeber).toBe(false);
  });

  it("behandelt eine Anzeige ohne Arbeitgebernamen nicht als unecht", () => {
    const b = identitaet([{ rolle: "vermittler", name: "Medipool", belege: beleg }]);
    expect(b.satz).toContain("Wer einstellt, steht nicht in der Anzeige");
    expect(b.anzeigename).toBe("Medipool");
  });

  it("nennt es nur dann vertraulich, wenn die Quelle das sagt", () => {
    /*
     * „Vertraulich" klingt nach einer Entscheidung des Arbeitgebers. Wo
     * in Wahrheit nur eine Angabe fehlt, ist das eine erfundene
     * Begründung.
     */
    const ohne = identitaet([{ rolle: "vermittler", name: "Medipool", belege: beleg }]);
    expect(ohne.vertraulich).toBe(false);

    const mit = identitaet([{ rolle: "vermittler", name: "Medipool", belege: beleg }], {
      quelleSagtVertraulich: true,
    });
    expect(mit.vertraulich).toBe(true);
    expect(mit.satz).toContain("vertraulich");
  });

  it("erlaubt die Bewertung erst bei belegter Identität", () => {
    const b = identitaet([
      { rolle: "arbeitgeber", name: "Husmann Metallbau", belege: beleg },
    ]);
    expect(b.arbeitgeberBekannt).toBe(true);
    expect(b.bewertungErlaubt).toBe(true);
  });

  it("behauptet nicht „direkt vom Arbeitgeber“, wenn ein Vermittler dazwischensteht", () => {
    const b = identitaet([
      { rolle: "arbeitgeber", name: "Klinikum Nord", belege: beleg },
      { rolle: "vermittler", name: "Medipool", belege: beleg },
    ]);
    expect(b.arbeitgeberBekannt).toBe(true);
    expect(b.direktVomArbeitgeber).toBe(false);
    expect(b.satz).toContain("über Medipool");
  });

  it("zählt eine Angabe ohne Beleg nicht", () => {
    const b = identitaet([{ rolle: "arbeitgeber", name: "Klinikum Nord", belege: [] }]);
    expect(b.arbeitgeberBekannt).toBe(false);
  });
});
