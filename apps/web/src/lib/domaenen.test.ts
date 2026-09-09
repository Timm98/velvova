import { afterEach, describe, expect, it } from "vitest";
import { mondayLink, trennungAktiv, umleitungFuer, zustaendigFuer } from "./domaenen.ts";

const alt = { ...process.env };
afterEach(() => {
  process.env = { ...alt };
});

function trennungEinrichten() {
  process.env.NEXT_PUBLIC_SEITEN_HOST = "velvova.com";
  process.env.NEXT_PUBLIC_MONDAY_HOST = "monday.ai";
}

describe("Ohne eingerichtete Trennung ändert sich nichts", () => {
  it("leitet nirgendwohin um", () => {
    delete process.env.NEXT_PUBLIC_SEITEN_HOST;
    delete process.env.NEXT_PUBLIC_MONDAY_HOST;
    expect(trennungAktiv()).toBe(false);
    expect(umleitungFuer("velvova.com", "/app/monday")).toBeNull();
    expect(umleitungFuer("velvova.com", "/pricing")).toBeNull();
  });

  it("gibt einen relativen Link statt eines Sprungs über das Netz", () => {
    delete process.env.NEXT_PUBLIC_MONDAY_HOST;
    expect(mondayLink()).toBe("/app/monday");
  });

  it("bleibt aus, wenn nur eine der beiden Adressen gesetzt ist", () => {
    /* Eine halbe Trennung leitet in eine Richtung um und in die andere
       nicht — das wäre schlimmer als keine. */
    process.env.NEXT_PUBLIC_MONDAY_HOST = "monday.ai";
    delete process.env.NEXT_PUBLIC_SEITEN_HOST;
    expect(trennungAktiv()).toBe(false);
    expect(umleitungFuer("velvova.com", "/app/monday")).toBeNull();
  });
});

describe("Wohin ein Pfad gehört", () => {
  it("schickt die Anwendung auf die Anwendungsdomain", () => {
    for (const p of ["/app", "/app/monday", "/app/jobs/abc", "/business/matches"]) {
      expect(zustaendigFuer(p), p).toBe("anwendung");
    }
  });

  it("schickt die Anmeldung mit — dort entsteht das Cookie", () => {
    /*
     * Eine Anmeldung auf der öffentlichen Seite legte eine Sitzung an,
     * die dort nichts zu suchen hat. Genau das vermeidet die Trennung.
     */
    for (const p of ["/login", "/register", "/firma", "/setup"]) {
      expect(zustaendigFuer(p), p).toBe("anwendung");
    }
  });

  it("lässt das Marketing auf der öffentlichen Seite", () => {
    for (const p of ["/", "/pricing", "/product", "/for-business", "/security", "/about"]) {
      expect(zustaendigFuer(p), p).toBe("seite");
    }
  });

  it("lässt Rechtliches und Schnittstellen auf beiden", () => {
    /* Wer auf der Anwendung ein Impressum sucht, soll es dort finden
       und nicht die Domain wechseln müssen. */
    for (const p of ["/imprint", "/privacy", "/terms", "/api/nina/chat", "/_next/static/x.js"]) {
      expect(zustaendigFuer(p), p).toBe("beide");
    }
  });

  it("verwechselt keinen Pfad, der nur so anfängt", () => {
    /* `/applications` ist nicht `/app`. */
    expect(zustaendigFuer("/applications")).toBe("seite");
    expect(zustaendigFuer("/loginhilfe")).toBe("seite");
  });
});

describe("Mit eingerichteter Trennung", () => {
  it("schickt die Anwendung von der öffentlichen Seite weg", () => {
    trennungEinrichten();
    expect(umleitungFuer("velvova.com", "/app/jobs")).toBe("https://monday.ai/app/jobs");
    expect(umleitungFuer("www.velvova.com", "/login")).toBe("https://monday.ai/login");
  });

  it("schickt das Marketing von der Anwendung weg", () => {
    trennungEinrichten();
    expect(umleitungFuer("monday.ai", "/pricing")).toBe("https://velvova.com/pricing");
    expect(umleitungFuer("monday.ai", "/")).toBe("https://velvova.com/");
  });

  it("lässt jeden Pfad dort, wo er hingehört", () => {
    trennungEinrichten();
    expect(umleitungFuer("monday.ai", "/app/monday")).toBeNull();
    expect(umleitungFuer("velvova.com", "/pricing")).toBeNull();
  });

  it("leitet Rechtliches auf keiner der beiden um", () => {
    trennungEinrichten();
    expect(umleitungFuer("monday.ai", "/imprint")).toBeNull();
    expect(umleitungFuer("velvova.com", "/imprint")).toBeNull();
  });

  it("beachtet den Port nicht", () => {
    /* Sonst leitet die lokale Entwicklung sich selbst im Kreis. */
    trennungEinrichten();
    expect(umleitungFuer("monday.ai:3021", "/app/monday")).toBeNull();
  });

  it("baut den Link auf die Anwendung absolut", () => {
    trennungEinrichten();
    expect(mondayLink()).toBe("https://monday.ai/app/monday");
    expect(mondayLink("/app/jobs")).toBe("https://monday.ai/app/jobs");
  });

  it("kommt mit einer Adresse mit Schema zurecht", () => {
    process.env.NEXT_PUBLIC_SEITEN_HOST = "https://velvova.com/";
    process.env.NEXT_PUBLIC_MONDAY_HOST = "https://monday.ai";
    expect(mondayLink()).toBe("https://monday.ai/app/monday");
    expect(umleitungFuer("velvova.com", "/app")).toBe("https://monday.ai/app");
  });
});
