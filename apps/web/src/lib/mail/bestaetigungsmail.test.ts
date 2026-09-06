import { describe, expect, it } from "vitest";
import { bestaetigungsmail } from "./bestaetigungsmail.ts";

/**
 * Die Bestätigungsmail.
 *
 * Geprüft wird, was in einem Mailprogramm bricht — nicht, wie sie
 * aussieht. Ein Schnappschussvergleich des HTML wäre bei jeder
 * Wortänderung rot und sagte nichts über Zustellbarkeit.
 */
describe("Bestätigungsmail", () => {
  const mail = bestaetigungsmail({ code: "042198", minuten: 10 });

  it("trägt den Code in beiden Fassungen", () => {
    /* Gruppiert dargestellt — der Code selbst bleibt sechsstellig. */
    expect(mail.html).toContain("042 198");
    expect(mail.text).toContain("042 198");
  });

  it("nennt die Gültigkeit", () => {
    expect(mail.html).toContain("10 Minuten");
    expect(mail.text).toContain("10 Minuten");
  });

  it("hat eine Nur-Text-Fassung", () => {
    /* Ohne sie bewerten Spamfilter schlechter, und die Vorschau auf
       dem Sperrbildschirm zeigt nichts Brauchbares. */
    expect(mail.text.length).toBeGreaterThan(80);
  });

  it("lädt keine externen Schriften oder Bilder", () => {
    /* Gmail holt externe Abrufe über einen Proxy, Outlook gar nicht.
       Eine Mail, die davon abhängt, sieht bei vielen anders aus. */
    expect(mail.html).not.toMatch(/@import|fonts\.googleapis|<img/i);
  });

  it("kennt beide Farbmodi", () => {
    expect(mail.html).toContain('name="color-scheme"');
    expect(mail.html).toContain('name="supported-color-schemes"');
  });

  it("baut das Layout aus Tabellen", () => {
    /* Outlook rendert mit der Word-Engine: kein Flexbox, kein Grid. */
    expect(mail.html).toContain("<table");
    expect(mail.html).not.toMatch(/display:\s*(flex|grid)/);
  });

  it("nennt die Marke im Betreff", () => {
    expect(mail.betreff).toMatch(/Bestätigungscode$/);
  });
});
