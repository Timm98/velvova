import { describe, expect, it } from "vitest";
import { SOURCE_REGISTRY } from "@paycheck/sources";
import { ArbeitnowAdapter, AdzunaAdapter, JoobleAdapter } from "./index.ts";

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
  it("kennt jeden Adapter-Schlüssel", () => {
    const keys = [new ArbeitnowAdapter().key, new AdzunaAdapter().key, new JoobleAdapter().key];

    for (const key of keys) {
      const entry = SOURCE_REGISTRY.find((s) => s.providerKey === key);
      expect(entry, `Adapter „${key}" fehlt im Quellenverzeichnis`).toBeDefined();
    }
  });
});
