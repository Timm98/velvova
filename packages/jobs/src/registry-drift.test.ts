import { describe, expect, it } from "vitest";
import { SOURCE_REGISTRY } from "@paycheck/sources";
import { ATS_BOARDS, adapterByKey } from "./registry.ts";
import { ArbeitnowAdapter, AdzunaAdapter, JoobleAdapter } from "./index.ts";
import { UserTextImportAdapter } from "./sources/userImport.ts";

/**
 * Jeder Adapter braucht einen Eintrag im Quellenverzeichnis.
 *
 * Laufen die Schlüssel auseinander, greift die Sperre zwar — aber mit
 * der Begründung „unbekannte Quelle" statt der richtigen. Genau das ist
 * passiert: der Adapter hiess `adzuna`, der Eintrag `adzuna_de`.
 * Fail-closed ist gut; falsch begründet versteckt sich der Fehler
 * hinter einem korrekten Verhalten und wird nie gefunden.
 *
 * Die Prüfung steht hier und nicht im Quellenpaket: die Adapterseite
 * muss sich an das Verzeichnis halten, nicht umgekehrt. Andersherum
 * hinge das Verzeichnis an den Adaptern und der Abhängigkeitsgraph
 * liefe im Kreis.
 */
describe("Adapter und Quellenverzeichnis", () => {
  const alleSchluessel = [
    new ArbeitnowAdapter().key,
    new AdzunaAdapter().key,
    new JoobleAdapter().key,
    new UserTextImportAdapter().key,
    ...ATS_BOARDS.map((b) => `ats_${b}`),
  ];

  it("kennt jeden Adapter-Schlüssel", () => {
    for (const key of alleSchluessel) {
      const entry = SOURCE_REGISTRY.find((s) => s.providerKey === key);
      expect(entry, `Adapter „${key}" fehlt im Quellenverzeichnis`).toBeDefined();
    }
  });

  it("findet zu jedem Schlüssel auch den Adapter", () => {
    // Die Gegenrichtung. Ein Eintrag ohne Adapter ist harmloser, aber
    // er erscheint in der Betriebsansicht als "kein Adapter" — und
    // jemand fragt sich, ob da etwas fehlt.
    for (const key of alleSchluessel) {
      expect(adapterByKey(key), `Kein Adapter für „${key}"`).toBeDefined();
    }
  });

  it("führt jedes ATS-Board als Arbeitgeberquelle, nicht als Aggregator", () => {
    // Der Unterschied ist die ganze Rechtsgrundlage: die Erlaubnis kommt
    // vom Arbeitgeber, nicht vom ATS-Anbieter.
    for (const board of ATS_BOARDS) {
      const entry = SOURCE_REGISTRY.find((s) => s.providerKey === `ats_${board}`)!;
      expect(entry.sourceType, board).toBe("ats");
      expect(entry.legalBasis, board).toBe("employer_authorization");
    }
  });
});
