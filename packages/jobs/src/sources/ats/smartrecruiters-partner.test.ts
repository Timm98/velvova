import { describe, expect, it, afterEach } from "vitest";
import {
  partnerfeedAbrufen,
  partnerfeedKopfzeilen,
  partnerfeedStand,
} from "./smartrecruiters-partner.ts";

const alt = { ...process.env };
afterEach(() => {
  process.env = { ...alt };
});

describe("der Partnerfeed bleibt aus, bis beides stimmt", () => {
  it("ist ohne Schalter nicht verfügbar", () => {
    delete process.env.ENABLE_SMARTRECRUITERS_PARTNER_FEED;
    process.env.SMARTRECRUITERS_PARTNER_TOKEN = "tok";
    const s = partnerfeedStand();
    expect(s.verfuegbar).toBe(false);
    expect(s.grund).toMatch(/ENABLE_SMARTRECRUITERS_PARTNER_FEED/);
  });

  it("ist mit Schalter, aber ohne Token nicht verfügbar", () => {
    /* Ein Zugang, der da ist, ist noch keine Freigabe — und
       umgekehrt nützt eine Freigabe ohne Zugang nichts. */
    process.env.ENABLE_SMARTRECRUITERS_PARTNER_FEED = "true";
    delete process.env.SMARTRECRUITERS_PARTNER_TOKEN;
    const s = partnerfeedStand();
    expect(s.verfuegbar).toBe(false);
    expect(s.grund).toMatch(/TOKEN fehlt/);
  });

  it("ist erst mit beidem verfügbar", () => {
    process.env.ENABLE_SMARTRECRUITERS_PARTNER_FEED = "true";
    process.env.SMARTRECRUITERS_PARTNER_TOKEN = "tok";
    expect(partnerfeedStand().verfuegbar).toBe(true);
  });

  it("gibt bei fehlendem Zugang keine leere Liste zurück", async () => {
    /* Eine leere Liste sähe aus wie eine Quelle ohne Stellen. */
    delete process.env.ENABLE_SMARTRECRUITERS_PARTNER_FEED;
    await expect(partnerfeedAbrufen()).rejects.toThrow(/nicht verfügbar/);
  });

  it("sagt auch bei Freigabe, dass das Modell noch fehlt", async () => {
    /*
     * Ich habe diese API nie gesehen — sie antwortet ohne Token
     * nicht. Ein aus der Dokumentation abgeschriebenes Modell als
     * geprüft auszugeben wäre genau der Fehler, den die
     * Nomado24-Integration vermeiden sollte.
     */
    process.env.ENABLE_SMARTRECRUITERS_PARTNER_FEED = "true";
    process.env.SMARTRECRUITERS_PARTNER_TOKEN = "tok";
    await expect(partnerfeedAbrufen()).rejects.toThrow(/noch nicht gebaut/);
  });
});

describe("die Kopfzeile", () => {
  it("heisst X-SmartToken, nicht Authorization", () => {
    /* Wer den Bearer-Weg nimmt, bekommt 401 und sucht den Fehler
       beim Token. */
    const k = partnerfeedKopfzeilen("geheim");
    expect(k["X-SmartToken"]).toBe("geheim");
    expect(k.Authorization).toBeUndefined();
  });
});
