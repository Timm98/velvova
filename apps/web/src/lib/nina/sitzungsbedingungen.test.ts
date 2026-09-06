import { describe, expect, it } from "vitest";
import { UserConstraintsSchema } from "@paycheck/domain";
import { ueberlagern } from "./sitzungsbedingungen.ts";

/**
 * Die Richtung der Überlagerung ist das Ganze.
 *
 * „Nur für diese Suche" darf die dauerhaften Bedingungen für diese eine
 * Anfrage überschreiben — und sie dabei nicht anfassen. Wäre es
 * umgekehrt, wäre der dritte Knopf schlimmer als keiner: Er verspräche
 * Vergänglichkeit und schriebe ins Profil.
 */

const DAUERHAFT = UserConstraintsSchema.parse({
  minSalaryPerYear: 45000,
  baseLocation: "Karlsruhe",
  maxCommuteMinutes: 40,
  weeklyHoursMin: null,
  weeklyHoursMax: null,
  maxTravelPercent: null,
});

describe("Nur für diese Suche", () => {
  it("überschreibt für diese Anfrage", () => {
    const r = ueberlagern(DAUERHAFT, { baseLocation: "Berlin" });
    expect(r.baseLocation).toBe("Berlin");
  });

  it("lässt alles andere stehen", () => {
    // Eine Sitzungsbedingung ist ein Zusatz, kein Neuanfang. Wer heute
    // nach Berlin schaut, hebt damit nicht sein Mindestgehalt auf.
    const r = ueberlagern(DAUERHAFT, { baseLocation: "Berlin" });
    expect(r.minSalaryPerYear).toBe(45000);
    expect(r.maxCommuteMinutes).toBe(40);
  });

  it("verändert die dauerhaften Bedingungen nicht", () => {
    /*
     * Der wichtigste Test der Datei.
     *
     * Das Objekt, das hineingeht, muss unverändert wieder herauskommen
     * können. Eine Überlagerung, die ihre Vorlage anfasst, würde je
     * nach Aufrufreihenfolge mal wirken und mal nicht — und der Fehler
     * fiele erst weit entfernt auf, an einer Jobliste, die niemand
     * erklären kann.
     */
    const vorher = JSON.stringify(DAUERHAFT);
    ueberlagern(DAUERHAFT, { baseLocation: "Berlin", minSalaryPerYear: 90000 });
    expect(JSON.stringify(DAUERHAFT)).toBe(vorher);
  });

  it("gibt ohne Sitzungsbedingung genau das Original zurück", () => {
    expect(ueberlagern(DAUERHAFT, {})).toBe(DAUERHAFT);
  });

  it("fällt bei ungültigem Gemisch auf die dauerhaften zurück", () => {
    /*
     * Der Keks kommt von aussen und kann alles enthalten. Ein
     * ungültiger Wert darf die Suche nicht scheitern lassen — und schon
     * gar nicht irgendwo tief im Abgleich, weit weg von der Ursache.
     */
    const r = ueberlagern(DAUERHAFT, { minSalaryPerYear: "viel" as unknown as number });
    expect(r).toBe(DAUERHAFT);
  });

  it("bleibt ein gültiges Bedingungsobjekt", () => {
    const r = ueberlagern(DAUERHAFT, { baseLocation: "Hamburg", maxCommuteMinutes: 20 });
    expect(() => UserConstraintsSchema.parse(r)).not.toThrow();
  });
});
