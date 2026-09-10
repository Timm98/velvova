import { describe, expect, it } from "vitest";
import {
  TREFFERGRENZE,
  stellenZusammenfuehren,
  type Merkzeile,
  type Trefferzeile,
} from "./projekttreffer";

/**
 * Was hier geprüft wird, ist nicht die Abfrage — die prüft die
 * Datenbank. Geprüft wird die Frage, die sich danach stellt: Eine
 * Stelle steht in beiden Listen. Welche gewinnt, und was passiert mit
 * der anderen?
 *
 * Die falsche Antwort wäre in der Oberfläche nicht als Fehler zu
 * sehen, sondern als dieselbe Stelle zweimal untereinander — oder als
 * ein Fit, der plötzlich verschwindet, weil jemand die Stelle
 * zusätzlich gemerkt hat.
 */

function treffer(p: Partial<Trefferzeile> & { jobId: string }): Trefferzeile {
  return {
    titel: `Stelle ${p.jobId}`,
    firma: "Beispiel AG",
    fit: null,
    zulaessigkeit: "eligible",
    gruende: [],
    ...p,
  };
}

function merk(p: Partial<Merkzeile> & { jobId: string }): Merkzeile {
  return {
    merkId: `merk-${p.jobId}`,
    titel: `Stelle ${p.jobId}`,
    firma: "Beispiel AG",
    ...p,
  };
}

describe("stellenZusammenfuehren", () => {
  it("nimmt beide Herkünfte auf und kennzeichnet sie", () => {
    const liste = stellenZusammenfuehren([treffer({ jobId: "a", fit: 70 })], [merk({ jobId: "b" })]);

    expect(liste).toHaveLength(2);
    expect(liste[0]).toMatchObject({ jobId: "a", herkunft: "suche", fit: 70 });
    expect(liste[1]).toMatchObject({ jobId: "b", herkunft: "hand", fit: null });
  });

  it("zeigt eine Stelle, die in beiden steht, genau einmal", () => {
    const liste = stellenZusammenfuehren(
      [treffer({ jobId: "a", fit: 55 })],
      [merk({ jobId: "a" })],
    );

    expect(liste).toHaveLength(1);
  });

  it("behält bei doppelter Stelle den Fit der Suche und die Merkkennung", () => {
    /*
     * Das ist der Fall, der beides braucht: Der Fit stammt aus dem
     * Lauf und darf nicht verschwinden, weil jemand die Stelle
     * zusätzlich gemerkt hat. Die Merkkennung muss trotzdem
     * mitkommen, sonst lässt sich die Zuordnung nicht mehr lösen und
     * die Stelle klebt am Vorhaben.
     */
    const [eintrag] = stellenZusammenfuehren(
      [treffer({ jobId: "a", fit: 55 })],
      [merk({ jobId: "a", merkId: "merk-1" })],
    );

    expect(eintrag).toMatchObject({ herkunft: "suche", fit: 55, merkId: "merk-1" });
  });

  it("sortiert nach Fit, absteigend", () => {
    const liste = stellenZusammenfuehren(
      [treffer({ jobId: "a", fit: 40 }), treffer({ jobId: "b", fit: 90 })],
      [],
    );

    expect(liste.map((s) => s.jobId)).toEqual(["b", "a"]);
  });

  it("stellt einen fehlenden Fit hinten an, nicht vorn", () => {
    /*
     * „Keine Zahl" ist nicht „null Punkte". Als 0 gelesen stünde eine
     * ungeprüfte Stelle unter allen anderen — als -1 behandelt steht
     * sie dort, wo sie hingehört: hinter allem Bewerteten, aber ohne
     * die Behauptung, sie sei schlecht.
     */
    const liste = stellenZusammenfuehren(
      [treffer({ jobId: "ohne", fit: null }), treffer({ jobId: "mit", fit: 10 })],
      [],
    );

    expect(liste.map((s) => s.jobId)).toEqual(["mit", "ohne"]);
  });

  it("stellt Gefundenes immer vor Handzugeordnetes", () => {
    /* Auch wenn das Gefundene keinen Fit hat: Für es ist eine Prüfung
       gelaufen, für das andere nicht. */
    const liste = stellenZusammenfuehren([treffer({ jobId: "a", fit: null })], [merk({ jobId: "b" })]);

    expect(liste.map((s) => s.herkunft)).toEqual(["suche", "hand"]);
  });

  it("hält die Grenze ein", () => {
    const viele = Array.from({ length: 60 }, (_, i) => treffer({ jobId: `j${i}`, fit: i }));
    expect(stellenZusammenfuehren(viele, [], 5)).toHaveLength(5);
    expect(stellenZusammenfuehren(viele, [])).toHaveLength(TREFFERGRENZE);
  });

  it("reicht Zulässigkeit und Gründe unverändert durch", () => {
    /* Beide kommen aus dem Lauf. Sie hier zu ergänzen oder zu
       glätten hiesse, eine Begründung zu erfinden. */
    const [eintrag] = stellenZusammenfuehren(
      [treffer({ jobId: "a", zulaessigkeit: "needs_clarification", gruende: ["Gehalt unklar"] })],
      [],
    );

    expect(eintrag!.zulaessigkeit).toBe("needs_clarification");
    expect(eintrag!.gruende).toEqual(["Gehalt unklar"]);
  });

  it("gibt für ein Vorhaben ohne alles eine leere Liste", () => {
    expect(stellenZusammenfuehren([], [])).toEqual([]);
  });
});
