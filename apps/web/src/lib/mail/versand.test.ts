import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

/**
 * Die Versandbereitschaft.
 *
 * Der wichtigste Fall ist der stille: Entwurfsmodus in der Produktion.
 * Er sieht wie Betrieb aus — die Oberfläche meldet „Code gesendet",
 * niemand bekommt etwas, und im Protokoll steht nichts Auffälliges.
 */
describe("Versandbereitschaft", () => {
  const alt = { ...process.env };

  /*
   * `NODE_ENV` ist in den Next-Typen schreibgeschützt.
   *
   * `vi.stubEnv` setzt es trotzdem — es ist der dafür vorgesehene Weg
   * und macht die Änderung ausserdem am Ende von selbst rückgängig.
   */
  const setzeModus = (wert: string) => vi.stubEnv("NODE_ENV", wert);

  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    process.env = { ...alt };
  });

  async function laden() {
    const modul = await import("./bereitschaft.ts");
    return modul.mailBereit();
  }

  it("lässt den Entwurfsmodus in der Entwicklung zu", async () => {
    setzeModus("development");
    process.env.MAIL_PROVIDER = "draft";
    const r = await laden();
    expect(r.bereit).toBe(true);
    expect(r.entwurf).toBe(true);
  });

  it("verweigert den Entwurfsmodus in der Produktion", async () => {
    setzeModus("production");
    process.env.MAIL_PROVIDER = "draft";
    const r = await laden();
    expect(r.bereit).toBe(false);
    expect(r.fehlt.join(" ")).toContain("MAIL_PROVIDER");
  });

  it("nennt den fehlenden Schlüssel beim Namen", async () => {
    setzeModus("production");
    process.env.MAIL_PROVIDER = "resend";
    delete process.env.RESEND_API_KEY;
    process.env.MAIL_FROM = "Velvova <noreply@example.invalid>";
    const r = await laden();
    expect(r.bereit).toBe(false);
    expect(r.fehlt).toContain("RESEND_API_KEY");
  });

  it("nennt die fehlende Absenderadresse", async () => {
    setzeModus("production");
    process.env.MAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "re_test";
    delete process.env.MAIL_FROM;
    const r = await laden();
    expect(r.bereit).toBe(false);
    expect(r.fehlt).toContain("MAIL_FROM");
  });

  it("ist bereit, wenn beides dasteht", async () => {
    setzeModus("production");
    process.env.MAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "re_test";
    process.env.MAIL_FROM = "Velvova <noreply@example.invalid>";
    const r = await laden();
    expect(r.bereit).toBe(true);
    expect(r.entwurf).toBe(false);
  });
});
