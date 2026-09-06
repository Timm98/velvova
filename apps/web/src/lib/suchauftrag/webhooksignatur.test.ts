import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { signaturPruefen, TOLERANZ_SEKUNDEN } from "./webhooksignatur.ts";

/* Ein Testgeheimnis — nicht aus einer Konfiguration, hier erzeugt. */
const ROH = Buffer.from("nur-fuer-den-test-nichts-echtes").toString("base64");
const GEHEIMNIS = `whsec_${ROH}`;
const JETZT = new Date("2026-09-06T12:00:00Z");

function signieren(rumpf: string, id: string, sekunden: number): string {
  const sig = createHmac("sha256", Buffer.from(ROH, "base64"))
    .update(`${id}.${sekunden}.${rumpf}`)
    .digest("base64");
  return `v1,${sig}`;
}

describe("Webhook-Signatur", () => {
  const rumpf = JSON.stringify({ type: "email.delivered", data: { email_id: "abc" } });
  const sekunden = Math.floor(JETZT.getTime() / 1000);

  it("nimmt ein richtig signiertes Ereignis an", () => {
    const befund = signaturPruefen(
      rumpf,
      { id: "msg_1", zeitstempel: String(sekunden), signatur: signieren(rumpf, "msg_1", sekunden) },
      GEHEIMNIS,
      JETZT,
    );
    expect(befund.ok).toBe(true);
  });

  it("weist einen veränderten Rumpf zurück", () => {
    const befund = signaturPruefen(
      `${rumpf} `,
      { id: "msg_1", zeitstempel: String(sekunden), signatur: signieren(rumpf, "msg_1", sekunden) },
      GEHEIMNIS,
      JETZT,
    );
    expect(befund).toEqual({ ok: false, grund: "falsch" });
  });

  it("weist ein Ereignis zurück, das für eine andere Kennung signiert wurde", () => {
    const befund = signaturPruefen(
      rumpf,
      { id: "msg_2", zeitstempel: String(sekunden), signatur: signieren(rumpf, "msg_1", sekunden) },
      GEHEIMNIS,
      JETZT,
    );
    expect(befund).toEqual({ ok: false, grund: "falsch" });
  });

  it("weist ein zu altes Ereignis zurück", () => {
    const alt = sekunden - TOLERANZ_SEKUNDEN - 60;
    const befund = signaturPruefen(
      rumpf,
      { id: "msg_1", zeitstempel: String(alt), signatur: signieren(rumpf, "msg_1", alt) },
      GEHEIMNIS,
      JETZT,
    );
    expect(befund).toEqual({ ok: false, grund: "zu_alt" });
  });

  it("nimmt ohne Geheimnis nichts an", () => {
    const befund = signaturPruefen(
      rumpf,
      { id: "msg_1", zeitstempel: String(sekunden), signatur: signieren(rumpf, "msg_1", sekunden) },
      undefined,
      JETZT,
    );
    expect(befund).toEqual({ ok: false, grund: "kein_geheimnis" });
  });

  it("verlangt alle drei Kopfzeilen", () => {
    const befund = signaturPruefen(
      rumpf,
      { id: "msg_1", zeitstempel: null, signatur: "v1,x" },
      GEHEIMNIS,
      JETZT,
    );
    expect(befund).toEqual({ ok: false, grund: "kopfzeilen_fehlen" });
  });

  it("akzeptiert eine von mehreren Signaturen", () => {
    /* Beim Schlüsselwechsel schickt der Anbieter eine Weile beide. */
    const echte = signieren(rumpf, "msg_1", sekunden);
    const befund = signaturPruefen(
      rumpf,
      { id: "msg_1", zeitstempel: String(sekunden), signatur: `v1,AAAA ${echte}` },
      GEHEIMNIS,
      JETZT,
    );
    expect(befund.ok).toBe(true);
  });
});
