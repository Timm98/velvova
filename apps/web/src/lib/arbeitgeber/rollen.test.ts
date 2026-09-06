import { describe, expect, it } from "vitest";
import { alsRolle, darf, ROLLENBESCHREIBUNG, ROLLENNAME, type Rolle } from "./rollen.ts";

/**
 * Die Rangfolge der Rollen.
 *
 * Reine Rechnung, und trotzdem der Kern der Autorisierung: Wenn `darf`
 * in die falsche Richtung vergleicht, darf ein Nur-Leser Stellen
 * veröffentlichen — und kein Test in der Oberfläche würde es merken,
 * weil dort alles wie erwartet aussieht.
 */

const ALLE: Rolle[] = ["viewer", "recruiter", "admin", "owner"];

describe("Wer was darf", () => {
  it("lässt jede Rolle ihre eigene Stufe", () => {
    for (const r of ALLE) expect(darf(r, r), r).toBe(true);
  });

  it("lässt höhere Rollen alles, was niedrigere dürfen", () => {
    expect(darf("owner", "viewer")).toBe(true);
    expect(darf("owner", "recruiter")).toBe(true);
    expect(darf("owner", "admin")).toBe(true);
    expect(darf("admin", "recruiter")).toBe(true);
    expect(darf("recruiter", "viewer")).toBe(true);
  });

  it("lässt niedrigere Rollen NICHT, was höhere dürfen", () => {
    /*
     * Die Richtung, die zählt.
     *
     * Ein vertauschtes Vorzeichen in `darf` macht aus „Nur Lesen" die
     * mächtigste Rolle — und die Oberfläche sähe unverändert aus.
     */
    expect(darf("viewer", "recruiter")).toBe(false);
    expect(darf("viewer", "admin")).toBe(false);
    expect(darf("viewer", "owner")).toBe(false);
    expect(darf("recruiter", "admin")).toBe(false);
    expect(darf("recruiter", "owner")).toBe(false);
    expect(darf("admin", "owner")).toBe(false);
  });

  it("ist eine vollständige Ordnung ohne Lücke", () => {
    // Jede Rolle darf genau das, was ihrem Rang und allem darunter
    // entspricht. Sonst gäbe es ein Paar, das sich gegenseitig nicht
    // einschliesst — und irgendwo eine Prüfung, die niemand versteht.
    for (const a of ALLE) {
      for (const b of ALLE) {
        expect(darf(a, b) || darf(b, a), `${a}/${b}`).toBe(true);
      }
    }
  });

  it("stuft eine unbekannte Rolle als niedrigste ein", () => {
    /*
     * Die sichere Richtung.
     *
     * In der Spalte steht `text`, und der Vorgabewert des alten Schemas
     * war „member" — ein Wert, den diese Rangfolge nicht kennt. Würde er
     * auf `owner` abgebildet, hätte jede alte Zeile volle Rechte.
     */
    expect(alsRolle("member")).toBe("viewer");
    expect(alsRolle("")).toBe("viewer");
    expect(alsRolle("Owner")).toBe("viewer");
    expect(alsRolle("owner")).toBe("owner");
  });

  it("hat für jede Rolle einen Namen und eine Beschreibung", () => {
    // Sonst steht in der Einladung „recruiter" statt „Recruiting" —
    // und niemand weiss, was er da vergibt.
    for (const r of ALLE) {
      expect(ROLLENNAME[r], r).toBeTruthy();
      expect(ROLLENBESCHREIBUNG[r].length, r).toBeGreaterThan(20);
    }
  });
});
