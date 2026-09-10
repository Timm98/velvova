import { describe, expect, it } from "vitest";
import {
  MINDESTSTICHPROBE,
  TRAGENDER_ANTEIL,
  gruppenlage,
  gruppenhinweisTrennen,
  gruppensatz,
  istGruppenhinweis,
  passtZurGruppe,
  type Gruppenzaehlung,
} from "./begriffsgruppen.ts";

const Z = (gruppe: string, titeltreffer: number): Gruppenzaehlung => ({ gruppe, titeltreffer });

describe("gruppenlage", () => {
  it("sagt bei zu kleiner Stichprobe nichts", () => {
    const l = gruppenlage([Z("51", 10), Z("72", 5)]);
    expect(l.belastbar).toBe(false);
    expect(l.tragend).toEqual([]);
  });

  it("nennt die Gruppen, die den Begriff tragen", () => {
    const l = gruppenlage([Z("51", 800), Z("62", 150), Z("72", 50)]);
    expect(l.belastbar).toBe(true);
    expect(l.tragend).toEqual(["51", "62"]);
  });

  it("lässt eine zweite Gruppe zu", () => {
    /*
     * „Lager" trägt Verkehr und Logistik, aber auch Lagerwirtschaft
     * im Handel. Eine Grenze, die nur die grösste Gruppe durchlässt,
     * würde die zweite fälschlich abwerten.
     */
    const l = gruppenlage([Z("51", 60), Z("62", 40)]);
    expect(l.tragend).toContain("62");
  });

  it("sortiert nach Häufigkeit", () => {
    expect(gruppenlage([Z("62", 200), Z("51", 800)]).tragend[0]).toBe("51");
  });

  it("zieht die Grenze bei der vereinbarten Stichprobe", () => {
    expect(gruppenlage([Z("51", MINDESTSTICHPROBE)]).belastbar).toBe(true);
    expect(gruppenlage([Z("51", MINDESTSTICHPROBE - 1)]).belastbar).toBe(false);
  });

  it("wirft eine Gruppe unterhalb des Anteils heraus", () => {
    const knapp = Math.floor(1000 * TRAGENDER_ANTEIL) - 1;
    const l = gruppenlage([Z("51", 1000 - knapp), Z("72", knapp)]);
    expect(l.tragend).not.toContain("72");
  });
});

describe("passtZurGruppe", () => {
  const lage = gruppenlage([Z("51", 800), Z("62", 150)]);

  it("erkennt die passende Gruppe", () => {
    expect(passtZurGruppe("5131", lage)).toBe(true);
  });

  it("erkennt die unpassende", () => {
    /* „Sachbearbeiter Debitorenbuchhaltung" trägt 72. */
    expect(passtZurGruppe("7222", lage)).toBe(false);
  });

  it("sagt ohne Berufskennung nichts", () => {
    /*
     * Von 1,24 Millionen deutschen Anzeigen tragen 928.242 eine
     * Kennung. Die übrigen dürfen nicht dadurch benachteiligt werden,
     * dass jemand sie nicht zugeordnet hat.
     */
    expect(passtZurGruppe(null, lage)).toBeNull();
    expect(passtZurGruppe("", lage)).toBeNull();
  });

  it("sagt ohne belastbare Stichprobe nichts", () => {
    expect(passtZurGruppe("7222", gruppenlage([Z("51", 5)]))).toBeNull();
  });
});

describe("gruppensatz", () => {
  it("erklärt nur die Abwertung", () => {
    expect(gruppensatz(false, ["Lager"])).toContain("anderen amtlichen Berufsgruppe");
    expect(gruppensatz(true, ["Lager"])).toBeNull();
    expect(gruppensatz(null, ["Lager"])).toBeNull();
  });

  it("nennt alle Begriffe, um die es geht", () => {
    const satz = gruppensatz(false, ["Lager", "Logistik"])!;
    expect(satz).toContain("Lager");
    expect(satz).toContain("Logistik");
  });

  it("schweigt ohne Begriff", () => {
    expect(gruppensatz(false, [])).toBeNull();
    expect(gruppensatz(false, ["  "])).toBeNull();
  });

  it("trägt die Kennung, an der der Hinweis wiederzufinden ist", () => {
    const satz = gruppensatz(false, ["Lager"])!;
    expect(istGruppenhinweis(satz)).toBe(true);
    expect(istGruppenhinweis("Mindestgehalt nicht genannt.")).toBe(false);
  });
});

describe("gruppenhinweisTrennen", () => {
  const hinweis = gruppensatz(false, ["Lager"])!;

  it("trennt den Satz von den Feldnamen", () => {
    const t = gruppenhinweisTrennen(["Gehalt", hinweis, "Wochenstunden"]);
    expect(t.hinweis).toBe(hinweis);
    expect(t.uebrige).toEqual(["Gehalt", "Wochenstunden"]);
  });

  it("lässt eine Liste ohne Hinweis unangetastet", () => {
    const t = gruppenhinweisTrennen(["Gehalt", "Ort"]);
    expect(t.hinweis).toBeNull();
    expect(t.uebrige).toEqual(["Gehalt", "Ort"]);
  });
});
