import { describe, expect, it } from "vitest";
import {
  BERECHTIGUNG_AB,
  GRENZEN,
  HINWEIS_TEXT,
  PLAENE,
  PLAN_RANG,
  PLAN_REIHENFOLGE,
  preisText,
  type Berechtigung,
  type PlanKey,
} from "./plaene.ts";

/**
 * Die Pläne sind Konfiguration — und genau deshalb geprüft.
 *
 * Konfiguration wird nicht ausgeführt, also fällt ein Fehler darin nie
 * beim Übersetzen auf. Ein Plan ohne Preis, eine Berechtigung ohne
 * Text, eine Grenze, die bei Max kleiner ist als bei Free: alles das
 * würde die Anwendung klaglos ausliefern, und bemerkt würde es von
 * der Person, die dafür bezahlt hat.
 */

const PLAENE_LISTE = PLAN_REIHENFOLGE;
const BERECHTIGUNGEN = Object.keys(BERECHTIGUNG_AB) as Berechtigung[];

describe("Planaufbau", () => {
  it("kennt genau drei Pläne, aufsteigend im Preis", () => {
    expect(PLAENE_LISTE).toEqual(["free", "premium", "max"]);
    const preise = PLAENE_LISTE.map((k) => PLAENE[k].preisMonatCent);
    expect(preise).toEqual([...preise].sort((a, b) => a - b));
    expect(PLAENE.free.preisMonatCent).toBe(0);
  });

  it("ordnet Rang und Reihenfolge gleich", () => {
    // Zwei Quellen für dieselbe Aussage laufen irgendwann auseinander.
    // Solange es sie gibt, muss geprüft sein, dass sie übereinstimmen.
    PLAENE_LISTE.forEach((k, i) => expect(PLAN_RANG[k]).toBe(i));
  });

  it("gibt jedem Plan fünf Hauptvorteile", () => {
    // Fünf ist die Zahl, auf die die Karte ausgelegt ist. Sechs
    // brechen das Raster, vier lassen es leer aussehen.
    for (const k of PLAENE_LISTE) {
      expect(PLAENE[k].hauptvorteile, `${k}`).toHaveLength(5);
    }
  });

  it("lässt keinen Text leer", () => {
    for (const k of PLAENE_LISTE) {
      const p = PLAENE[k];
      expect(p.name.length, `${k}.name`).toBeGreaterThan(0);
      expect(p.claim.length, `${k}.claim`).toBeGreaterThan(0);
      expect(p.label.length, `${k}.label`).toBeGreaterThan(0);
      expect(p.gruppen.length, `${k}.gruppen`).toBeGreaterThan(0);
      for (const g of p.gruppen) expect(g.punkte.length, `${k}/${g.titel}`).toBeGreaterThan(0);
    }
  });
});

describe("Berechtigungen", () => {
  it("hat für jede einen Hinweistext", () => {
    // Ohne Text erschiene an der Stelle, wo Monday etwas anbietet, ein
    // leerer Kasten — sichtbar, aber ohne Aussage.
    for (const b of BERECHTIGUNGEN) {
      expect(HINWEIS_TEXT[b], b).toBeDefined();
      expect(HINWEIS_TEXT[b].titel.length, b).toBeGreaterThan(0);
      expect(HINWEIS_TEXT[b].angebot.length, b).toBeGreaterThan(0);
    }
  });

  it("gibt Free keine kostenpflichtige Fähigkeit", () => {
    for (const b of BERECHTIGUNGEN) {
      expect(PLAN_RANG[BERECHTIGUNG_AB[b]], b).toBeGreaterThan(0);
    }
  });

  it("ist monoton: was Premium darf, darf Max auch", () => {
    /*
     * Die Eigenschaft, auf der die ganze Prüfung beruht.
     *
     * `zugangFür` entscheidet über `rang >= rang(nötig)`. Wäre eine
     * Fähigkeit bei Premium erlaubt und bei Max nicht, würde jemand
     * durch ein Upgrade etwas VERLIEREN — und niemand würde es
     * bemerken, weil kein Code diesen Fall je prüft.
     */
    const darf = (plan: PlanKey, b: Berechtigung) =>
      PLAN_RANG[plan] >= PLAN_RANG[BERECHTIGUNG_AB[b]];
    for (const b of BERECHTIGUNGEN) {
      for (let i = 1; i < PLAENE_LISTE.length; i++) {
        const niedriger = PLAENE_LISTE[i - 1]!;
        const hoeher = PLAENE_LISTE[i]!;
        if (darf(niedriger, b)) expect(darf(hoeher, b), `${b}: ${niedriger}→${hoeher}`).toBe(true);
      }
    }
  });

  it("verspricht in keinem Hinweis einen Erfolg", () => {
    /*
     * Die Grenze, die nicht verhandelbar ist.
     *
     * „Mit Max findest du garantiert einen Job" wäre eine Aussage über
     * eine Zukunft, die niemand kennt — und für eine arbeitssuchende
     * Person die teuerste Sorte Falschaussage. Sie steht heute
     * nirgends; dieser Test sorgt dafür, dass sie auch morgen nirgends
     * steht.
     */
    const verboten = /garantier|sicher einen job|erfolg garantiert|versprechen wir|nur noch heute|nur jetzt|letzte chance/i;
    for (const b of BERECHTIGUNGEN) {
      const t = HINWEIS_TEXT[b];
      expect(verboten.test(t.angebot), `${b}: ${t.angebot}`).toBe(false);
      expect(verboten.test(t.titel), `${b}: ${t.titel}`).toBe(false);
    }
    for (const k of PLAENE_LISTE) {
      expect(verboten.test(PLAENE[k].claim), `${k}.claim`).toBe(false);
    }
  });
});

describe("Grenzen", () => {
  it("wird nach oben nie enger", () => {
    // Ein höherer Plan mit einer kleineren Zahl wäre ein Tippfehler,
    // der wie eine Entscheidung aussieht.
    const felder = [
      "tiefenanalysenProMonat",
      "dokumenteProMonat",
      "ninaNachrichtenProTag",
      "jobsSichtbar",
    ] as const;
    const alsZahl = (n: number | null) => (n === null ? Number.POSITIVE_INFINITY : n);

    for (const feld of felder) {
      for (let i = 1; i < PLAENE_LISTE.length; i++) {
        const unten = alsZahl(GRENZEN[PLAENE_LISTE[i - 1]!][feld]);
        const oben = alsZahl(GRENZEN[PLAENE_LISTE[i]!][feld]);
        expect(oben, `${feld}: ${PLAENE_LISTE[i - 1]} → ${PLAENE_LISTE[i]}`).toBeGreaterThanOrEqual(
          unten,
        );
      }
    }
    for (let i = 1; i < PLAENE_LISTE.length; i++) {
      expect(GRENZEN[PLAENE_LISTE[i]!].jobsImVergleich).toBeGreaterThanOrEqual(
        GRENZEN[PLAENE_LISTE[i - 1]!].jobsImVergleich,
      );
      expect(GRENZEN[PLAENE_LISTE[i]!].beobachteteStellen).toBeGreaterThanOrEqual(
        GRENZEN[PLAENE_LISTE[i - 1]!].beobachteteStellen,
      );
    }
  });

  it("lässt Free ehrlich nützlich bleiben", () => {
    /*
     * Die Zusage aus der Kopfdokumentation, als Prüfung.
     *
     * Free darf kleiner sein — nicht unbrauchbar. Wer die Grenzen
     * später auf null zieht, um Premium attraktiver zu machen, bricht
     * diesen Test und muss die Entscheidung ausdrücklich treffen,
     * statt sie nebenbei zu machen.
     */
    expect(GRENZEN.free.jobsSichtbar ?? 0).toBeGreaterThanOrEqual(20);
    expect(GRENZEN.free.tiefenanalysenProMonat ?? 0).toBeGreaterThan(0);
    expect(GRENZEN.free.dokumenteProMonat ?? 0).toBeGreaterThan(0);
    expect(GRENZEN.free.ninaNachrichtenProTag ?? 0).toBeGreaterThanOrEqual(20);
  });

  it("bindet die Fähigkeiten an die Grenzen, die dazu passen", () => {
    // Vergleichen ohne Vergleichsplätze wäre eine Fähigkeit ohne
    // Wirkung: erlaubt, aber mit Kontingent null.
    expect(GRENZEN.max.jobsImVergleich).toBeGreaterThan(1);
    expect(GRENZEN.max.beobachteteStellen).toBeGreaterThan(0);
    expect(BERECHTIGUNG_AB.can_compare_jobs).toBe("max");
    expect(BERECHTIGUNG_AB.can_use_job_monitoring).toBe("max");
  });
});

describe("Preisdarstellung", () => {
  it("zeigt Null als Null, nicht als Wort im Preisfeld", () => {
    expect(preisText(0)).toBe("0 €");
  });

  it("rundet auf ganze Euro und hängt das Zeichen an", () => {
    expect(preisText(900)).toMatch(/^9\s?€$/);
    expect(preisText(1900)).toMatch(/^19\s?€$/);
  });
});
