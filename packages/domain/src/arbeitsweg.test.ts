import { describe, expect, it } from "vitest";
import { stundenJeMonat, stundenText, wegvergleich } from "./arbeitsweg.ts";

describe("Arbeitsweg", () => {
  it("rechnet den Beispielfall des Konzepts nach", () => {
    /*
     * (45 − 25) × 2 × 5 × 52 / 12 / 60 = 14,444… Stunden.
     * Die Zahl steht so im Beispielbildschirm; wenn sie hier nicht
     * herauskommt, stimmt der Bildschirm nicht mehr mit der Rechnung.
     */
    const v = wegvergleich(
      { minutenJeRichtung: 45, vorOrtTageJeWoche: 5 },
      { minutenJeRichtung: 25, vorOrtTageJeWoche: 5 },
    );
    expect(v.ersparnisStunden).toBeCloseTo(14.4444, 3);
    expect(v.richtung).toBe("weniger");
    expect(v.satz).toContain("14,4 Stunden");
  });

  it("nennt die Annahme, statt sie im Ergebnis verschwinden zu lassen", () => {
    const v = wegvergleich(
      { minutenJeRichtung: 45, vorOrtTageJeWoche: 5 },
      { minutenJeRichtung: 25, vorOrtTageJeWoche: 5 },
    );
    expect(v.annahme).toContain("ohne Urlaub und Feiertage");
  });

  it("erkennt den kürzeren Weg, der mehr Zeit kostet (Prüffall B04)", () => {
    /*
     * Der eigentliche Grund für diese Datei: 45 Minuten an zwei Tagen
     * sind 13,0 Stunden, 25 Minuten an fünf Tagen sind 18,1. Die
     * einzelne Fahrt wird kürzer, der Monat länger.
     */
    const v = wegvergleich(
      { minutenJeRichtung: 45, vorOrtTageJeWoche: 2 },
      { minutenJeRichtung: 25, vorOrtTageJeWoche: 5 },
    );
    expect(stundenJeMonat({ minutenJeRichtung: 45, vorOrtTageJeWoche: 2 })).toBeCloseTo(13.0, 1);
    expect(stundenJeMonat({ minutenJeRichtung: 25, vorOrtTageJeWoche: 5 })).toBeCloseTo(18.06, 1);
    expect(v.richtung).toBe("mehr");
    expect(v.gegenlaeufig).toBe(true);
    expect(v.satz).toContain("länger unterwegs");
  });

  it("behauptet keinen Unterschied, wo keiner spürbar ist", () => {
    const v = wegvergleich(
      { minutenJeRichtung: 30, vorOrtTageJeWoche: 3 },
      { minutenJeRichtung: 30, vorOrtTageJeWoche: 3 },
    );
    expect(v.richtung).toBe("gleich");
  });

  it("schreibt Stunden so, wie man sie sagt", () => {
    expect(stundenText(14.4444)).toBe("14,4 Stunden");
  });
});
