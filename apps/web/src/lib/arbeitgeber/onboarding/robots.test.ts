import { describe, expect, it } from "vitest";
import { darfAbrufen, regelnLesen } from "./robots";

const regeln = (s: string, pfad: string) => darfAbrufen(regelnLesen(s), pfad);

describe("regelnLesen", () => {
  it("nimmt die eigene Gruppe statt der Sternchengruppe", () => {
    const txt = ["User-agent: *", "Disallow: /", "", "User-agent: VelvovaOnboarding", "Disallow: /intern"].join("\n");
    expect(regeln(txt, "/karriere")).toBe(true);
    expect(regeln(txt, "/intern/x")).toBe(false);
  });

  it("fasst mehrere User-agent-Zeilen zu einer Gruppe zusammen", () => {
    const txt = ["User-agent: Googlebot", "User-agent: *", "Disallow: /geheim"].join("\n");
    expect(regeln(txt, "/geheim/x")).toBe(false);
  });

  it("überliest Kommentare", () => {
    expect(regeln("User-agent: *\nDisallow: /a # kein Zutritt", "/a")).toBe(false);
  });

  it("erlaubt alles ohne Regeln", () => {
    expect(regeln("", "/beliebig")).toBe(true);
  });
});

describe("darfAbrufen", () => {
  it("lässt ein leeres Disallow alles zu", () => {
    expect(regeln("User-agent: *\nDisallow:", "/a")).toBe(true);
  });

  it("gibt der längeren Regel recht", () => {
    const txt = ["User-agent: *", "Disallow: /a", "Allow: /a/oeffentlich"].join("\n");
    expect(regeln(txt, "/a/intern")).toBe(false);
    expect(regeln(txt, "/a/oeffentlich/x")).toBe(true);
  });

  it("versteht das Sternchen", () => {
    expect(regeln("User-agent: *\nDisallow: /*.pdf", "/dok/bericht.pdf")).toBe(false);
    expect(regeln("User-agent: *\nDisallow: /*.pdf", "/dok/bericht.html")).toBe(true);
  });

  it("versteht das Zeilenende", () => {
    expect(regeln("User-agent: *\nDisallow: /a$", "/a")).toBe(false);
    expect(regeln("User-agent: *\nDisallow: /a$", "/ab")).toBe(true);
  });

  it("behandelt Sonderzeichen im Pfad als Zeichen, nicht als Muster", () => {
    expect(regeln("User-agent: *\nDisallow: /a+b", "/axb")).toBe(true);
    expect(regeln("User-agent: *\nDisallow: /a+b", "/a+b")).toBe(false);
  });

  it("sperrt bei Disallow: /", () => {
    expect(regeln("User-agent: *\nDisallow: /", "/")).toBe(false);
    expect(regeln("User-agent: *\nDisallow: /", "/tief/drin")).toBe(false);
  });
});
