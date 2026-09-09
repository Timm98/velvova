import { describe, expect, it } from "vitest";
import { lagebild } from "./lagebild.ts";
import type { Agentenlauf } from "./lauf.ts";
import type { Prueflauf, Pruefurteil } from "./pruefung.ts";
import type { Rolle } from "./aufstellung.ts";
import { syntheseVorlage } from "./synthese.ts";

function lauf(rolle: Rolle, befunde: string[], belege: string[] = []): Agentenlauf {
  return {
    rolle, modellId: `m-${rolle}`, anbieter: "openai", status: "erfolg",
    ergebnis: { schluss: "…", befunde, risiken: [], unsicherheiten: [], empfehlungen: [], belege, sicherheit: 0.5 },
    fehler: null, dauerMs: 5,
  };
}
function pruefer(rolle: Rolle, urteile: Pruefurteil[]): Prueflauf {
  return { rolle, modellId: `m-${rolle}`, anbieter: "google", status: "erfolg",
    ergebnis: { urteile }, fehler: null, dauerMs: 5 };
}

describe("syntheseVorlage", () => {
  it("hält Verworfenes komplett aus dem Material heraus", () => {
    /* Ein Modell, das eine widerlegte Behauptung sieht, erwähnt sie
       — und sei es als „manche meinen". Dann war die Widerlegung
       umsonst. */
    const bild = lagebild(
      [lauf("hauptanalyse", ["Widerlegte Behauptung"])],
      [pruefer("gegenpruefung", [
        { aussage: "Widerlegte Behauptung", urteil: "widersprochen", begruendung: "Falsch.", beleg: "Q" },
      ])],
      true,
    );
    const v = syntheseVorlage(bild);
    expect(JSON.stringify(v.abschnitte)).not.toMatch(/Widerlegte/);
    expect(v.verworfen).toBe(1);
  });

  it("ordnet Belegtes vor Ungeprüftes — nicht das häufiger Gesagte", () => {
    const bild = lagebild(
      [
        lauf("hauptanalyse", ["Einmal, aber belegt"], ["Quelle"]),
        lauf("gegenpruefung", ["Dreimal gesagt"]),
        lauf("alternative", ["Dreimal gesagt"]),
      ],
      [pruefer("gegenpruefung", [
        { aussage: "Einmal, aber belegt", urteil: "gestuetzt", begruendung: "ok", beleg: null },
      ])],
      true,
    );
    expect(bild.staende[0]!.aussage).toBe("Einmal, aber belegt");
    expect(syntheseVorlage(bild).abschnitte[0]!.stand).toBe("gesichert");
  });

  it("sagt es, wenn nicht gegengeprüft wurde", () => {
    const v = syntheseVorlage(lagebild([lauf("hauptanalyse", ["Irgendwas"], ["Q"])], [], false));
    expect(v.hinweis).toMatch(/nicht gegengeprüft/);
  });

  it("benennt offene Punkte als offen", () => {
    const bild = lagebild(
      [lauf("hauptanalyse", ["Strittige Sache"], ["Q"])],
      [pruefer("gegenpruefung", [
        { aussage: "Strittige Sache", urteil: "widersprochen", begruendung: "Andere Zahl.", beleg: "Q2" },
      ])],
      true,
    );
    expect(syntheseVorlage(bild).hinweis).toMatch(/1 Punkt blieb offen/);
  });
});
