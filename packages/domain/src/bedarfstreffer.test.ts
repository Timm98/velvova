import { describe, expect, it } from "vitest";
import {
  MAX_VORSCHLAEGE,
  type Bedarfskandidat,
  bedingungPruefen,
  darfGesuchtWerden,
  grundlageAus,
  istVeraltet,
  offeneTrefferpunkte,
  preisbandSatz,
  trefferlage,
} from "./bedarfstreffer.ts";

const K = (teil: Partial<Bedarfskandidat> & { userId: string }): Bedarfskandidat => ({
  passung: 70,
  abdeckung: 0.6,
  bedingungen: [],
  freigegebeneNachweise: ["Projektbeitrag bestätigt"],
  ...teil,
});

describe("Wann überhaupt gesucht werden darf", () => {
  it("nicht bei einem bestätigten Problem", () => {
    expect(darfGesuchtWerden("bestaetigtes_problem", "rolle_schaffen").ja).toBe(false);
  });

  it("nicht beim Lösungsbedarf ohne Freigabe", () => {
    expect(darfGesuchtWerden("loesungsbedarf", "rolle_schaffen").ja).toBe(false);
  });

  it("nicht, wenn der Weg keinen Menschen braucht", () => {
    const a = darfGesuchtWerden("freigegebene_moeglichkeit", "zustaendigkeit_klaeren");
    expect(a.ja).toBe(false);
    expect(a.grund).toMatch(/keinen Menschen/);
  });

  it("nicht ohne gewählten Weg", () => {
    expect(darfGesuchtWerden("freigegebene_moeglichkeit", null).ja).toBe(false);
  });

  it("erst mit Freigabe und Personenweg", () => {
    expect(darfGesuchtWerden("freigegebene_moeglichkeit", "auftrag_vergeben").ja).toBe(true);
    expect(darfGesuchtWerden("freigegebene_moeglichkeit", "rolle_schaffen").ja).toBe(true);
  });
});

describe("Harte Bedingungen kennen drei Antworten", () => {
  const gleich = (a: string | number, b: string | number) => a === b;

  it("sagt „unbekannt“, wenn der Bedarf schweigt", () => {
    expect(bedingungPruefen("Startzeitpunkt", null, "sofort", gleich).stand).toBe("unbekannt");
  });

  it("sagt „unbekannt“, wenn die Person schweigt", () => {
    const u = bedingungPruefen("Startzeitpunkt", "sofort", null, gleich);
    expect(u.stand).toBe("unbekannt");
    expect(u.begruendung).toMatch(/keine Angabe der Person/);
  });

  it("rundet Unbekanntes weder nach oben noch nach unten", () => {
    const u = bedingungPruefen("Startzeitpunkt", "sofort", null, gleich);
    expect(u.stand).not.toBe("erfuellt");
    expect(u.stand).not.toBe("nicht_erfuellt");
  });

  it("entscheidet, wenn beide etwas gesagt haben", () => {
    expect(bedingungPruefen("Ort", "Berlin", "Berlin", gleich).stand).toBe("erfuellt");
    expect(bedingungPruefen("Ort", "Berlin", "Hamburg", gleich).stand).toBe("nicht_erfuellt");
  });
});

describe("Die Vorschlagsliste", () => {
  const frei = "freigegebene_moeglichkeit" as const;

  it("bleibt gesperrt, solange nicht freigegeben ist", () => {
    const l = trefferlage("hypothese", "rolle_schaffen", [K({ userId: "a" })], 10);
    expect(l.art).toBe("gesperrt");
  });

  it("sortiert eine verletzte harte Bedingung aus", () => {
    const l = trefferlage(
      frei,
      "rolle_schaffen",
      [
        K({
          userId: "a",
          bedingungen: [{ bedingung: "Ort", stand: "nicht_erfuellt", begruendung: "x" }],
        }),
      ],
      1,
    );
    expect(l.art).toBe("keine");
  });

  it("behält eine unbekannte harte Bedingung — als offenen Punkt", () => {
    const l = trefferlage(
      frei,
      "rolle_schaffen",
      [
        K({
          userId: "a",
          bedingungen: [{ bedingung: "Start", stand: "unbekannt", begruendung: "fehlt" }],
        }),
      ],
      1,
    );
    expect(l.art).toBe("vorschlaege");
  });

  it("nennt beim leeren Ergebnis, wie viele geprüft wurden", () => {
    const l = trefferlage(frei, "rolle_schaffen", [], 412);
    expect(l.art).toBe("keine");
    if (l.art === "keine") expect(l.geprueft).toBe(412);
  });

  it("zeigt höchstens fünf und zählt den Rest", () => {
    const viele = Array.from({ length: 9 }, (_, i) => K({ userId: `u${i}`, passung: 90 - i }));
    const l = trefferlage(frei, "rolle_schaffen", viele, 9);
    if (l.art === "vorschlaege") {
      expect(l.kandidaten).toHaveLength(MAX_VORSCHLAEGE);
      expect(l.weitere).toBe(4);
      expect(l.kandidaten[0]!.userId).toBe("u0");
    }
  });

  it("stellt eine Person ohne Passungswert hinten an, wirft sie aber nicht heraus", () => {
    const l = trefferlage(
      frei,
      "rolle_schaffen",
      [K({ userId: "ohne", passung: null }), K({ userId: "mit", passung: 60 })],
      2,
    );
    if (l.art === "vorschlaege") {
      expect(l.kandidaten.map((k) => k.userId)).toEqual(["mit", "ohne"]);
    }
  });
});

describe("Was neben einem Vorschlag steht", () => {
  it("nennt jede unbekannte Bedingung", () => {
    const s = offeneTrefferpunkte(
      K({
        userId: "a",
        bedingungen: [{ bedingung: "Startzeitpunkt", stand: "unbekannt", begruendung: "fehlt" }],
      }),
    );
    expect(s[0]).toMatch(/Startzeitpunkt/);
  });

  it("sagt es, wenn die Datenlage dünn ist", () => {
    const s = offeneTrefferpunkte(K({ userId: "a", abdeckung: 0.1 }));
    expect(s.join(" ")).toMatch(/wenig bekannt/);
  });

  it("sagt es, wenn nur Selbstauskunft vorliegt", () => {
    const s = offeneTrefferpunkte(K({ userId: "a", freigegebeneNachweise: [] }));
    expect(s.join(" ")).toMatch(/Selbstauskunft/);
  });
});

describe("Ein überlappendes Preisband ist keine Vereinbarung", () => {
  it("sagt das ausdrücklich", () => {
    expect(preisbandSatz(true)).toMatch(/keine Vereinbarung/);
  });

  it("behauptet ohne Angabe nichts", () => {
    expect(preisbandSatz(null)).toMatch(/liegt auf mindestens einer Seite nichts vor/);
  });
});

describe("Veraltete Empfehlungen werden sichtbar", () => {
  it("erkennt einen geänderten Bedarf", () => {
    const damals = grundlageAus({ bedarfStand: "1", profilStand: "a", nachweisStand: "x" });
    const jetzt = grundlageAus({ bedarfStand: "2", profilStand: "a", nachweisStand: "x" });
    expect(istVeraltet(damals, jetzt)).toBe(true);
  });

  it("erkennt ein geändertes Profil", () => {
    const damals = grundlageAus({ bedarfStand: "1", profilStand: "a", nachweisStand: "x" });
    const jetzt = grundlageAus({ bedarfStand: "1", profilStand: "b", nachweisStand: "x" });
    expect(istVeraltet(damals, jetzt)).toBe(true);
  });

  it("hält Gleiches für gleich", () => {
    const g = grundlageAus({ bedarfStand: "1", profilStand: "a", nachweisStand: "x" });
    expect(istVeraltet(g, g)).toBe(false);
  });
});
