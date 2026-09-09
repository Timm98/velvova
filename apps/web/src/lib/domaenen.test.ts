import { readdirSync } from "node:fs";
import { join } from "node:path";
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
    expect(mondayLink("/app/monday", "velvova.com")).toBe("/app/monday");
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
    for (const p of ["/", "/product", "/for-business", "/security", "/about"]) {
      expect(zustaendigFuer(p), p).toBe("seite");
    }
  });

  it("zählt /pricing zur Anwendung, obwohl es öffentlich aussieht", () => {
    /*
     * Es gibt keine Preisseite mehr — die Adresse leitet auf
     * /app/settings/abo. Als „Seite" eingeordnet ergäbe das einen
     * Umweg über beide Domains, der dort endet, wo er anfing.
     */
    expect(zustaendigFuer("/pricing")).toBe("anwendung");
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
    expect(umleitungFuer("monday.ai", "/product")).toBe("https://velvova.com/product");
  });

  it("holt den Anmeldecode von der öffentlichen Wurzel zur Anwendung", () => {
    /*
     * Der gemessene Fall: Supabase ersetzt jedes nicht freigegebene
     * Ziel durch seine Site-URL — hier die öffentliche Seite. Der
     * Google-Code kam damit auf der Startseite an, niemand löste ihn
     * ein, und das Anmelden sah aus, als hätte es nichts getan.
     */
    trennungEinrichten();
    expect(
      umleitungFuer("velvova.com", "/", new URLSearchParams("code=abc123")),
    ).toBe("https://monday.ai/auth/callback");
  });

  it("lässt die öffentliche Wurzel ohne Code in Ruhe", () => {
    /* Sonst landete jeder gewöhnliche Besuch in der Anmeldung. */
    trennungEinrichten();
    expect(umleitungFuer("velvova.com", "/", new URLSearchParams("utm=x"))).toBeNull();
    expect(umleitungFuer("velvova.com", "/")).toBeNull();
  });

  it("greift nur auf der Wurzel, nicht auf jeder Marketingseite", () => {
    /* Ein Kampagnenverweis mit ?code= darf nicht in der Anmeldung
       enden. */
    trennungEinrichten();
    /* `null` heisst: bleibt, wo es ist. Die Rettung greift nicht. */
    expect(
      umleitungFuer("velvova.com", "/product", new URLSearchParams("code=abc")),
    ).toBeNull();
  });

  it("führt den Rückweg des Anmeldeanbieters auf die Anwendungsdomain", () => {
    /*
     * `/auth` stand unter „überall". Der Callback legt aber die
     * Sitzung an, und der PKCE-Prüfwert liegt als Cookie auf dem
     * Host, auf dem die Anmeldung begann — auf der falschen Domain
     * scheitert der Austausch lautlos.
     */
    trennungEinrichten();
    expect(zustaendigFuer("/auth/callback")).toBe("anwendung");
    expect(umleitungFuer("velvova.com", "/auth/callback")).toBe(
      "https://monday.ai/auth/callback",
    );
  });

  it("führt die Wurzel der Anwendung in die Anwendung, nicht ins Marketing", () => {
    /*
     * Der Fehler, den ein Blick in den Browser gefunden hat: `/` lag
     * in einem Topf mit dem übrigen Marketing, und damit schickte die
     * Anwendungsdomain jeden auf die öffentliche Seite. Beide Domains
     * zeigten dasselbe — die Trennung sah aus, als täte sie nichts.
     */
    trennungEinrichten();
    expect(umleitungFuer("monday.ai", "/")).toBe("https://monday.ai/app/monday");
  });

  it("lässt die Wurzel der öffentlichen Seite in Ruhe", () => {
    trennungEinrichten();
    expect(umleitungFuer("velvova.com", "/")).toBeNull();
  });

  it("lässt jeden Pfad dort, wo er hingehört", () => {
    trennungEinrichten();
    expect(umleitungFuer("monday.ai", "/app/monday")).toBeNull();
    expect(umleitungFuer("velvova.com", "/product")).toBeNull();
    /* `/pricing` gehört zur Anwendung — von dort weg wäre der Umweg. */
    expect(umleitungFuer("monday.ai", "/pricing")).toBeNull();
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

  it("baut den Link absolut, wenn wir auf der öffentlichen Seite stehen", () => {
    trennungEinrichten();
    expect(mondayLink("/app/monday", "velvova.com")).toBe("https://monday.ai/app/monday");
    expect(mondayLink("/app/jobs", "www.velvova.com")).toBe("https://monday.ai/app/jobs");
  });

  it("bleibt INNERHALB der Anwendung relativ", () => {
    /*
     * Der wichtigere Fall. Ein absoluter Link auf derselben Domain
     * macht aus jeder Navigation im Browser einen vollen
     * Seitenwechsel — gleicher Server, nur langsamer und mit weissem
     * Blitz dazwischen.
     */
    trennungEinrichten();
    expect(mondayLink("/app/jobs", "monday.ai")).toBe("/app/jobs");
  });

  it("bleibt relativ, wenn der Host unbekannt ist", () => {
    /*
     * Der sichere Vorgabewert. Ein relativer Pfad ist nie falsch: Die
     * Weiche in der Middleware leitet ihn ohnehin an die richtige
     * Adresse. Der absolute Link spart nur einen Sprung — und ihn zu
     * raten wäre der teurere Fehler.
     */
    trennungEinrichten();
    expect(mondayLink("/app/monday")).toBe("/app/monday");
    expect(mondayLink("/app/monday", null)).toBe("/app/monday");
  });

  it("bleibt auf localhost relativ", () => {
    /* Sonst verlässt in der Entwicklung jeder Klick den Rechner. */
    trennungEinrichten();
    expect(mondayLink("/app/monday", "localhost:3021")).toBe("/app/monday");
  });

  it("kommt mit einer Adresse mit Schema zurecht", () => {
    process.env.NEXT_PUBLIC_SEITEN_HOST = "https://velvova.com/";
    process.env.NEXT_PUBLIC_MONDAY_HOST = "https://monday.ai";
    expect(mondayLink("/app/monday", "velvova.com")).toBe("https://monday.ai/app/monday");
    expect(umleitungFuer("velvova.com", "/app")).toBe("https://monday.ai/app");
  });
});

/*
 * ══════════════════════════════════════════════════════════════════
 * Die Liste gegen den Dateibaum
 * ══════════════════════════════════════════════════════════════════
 *
 * `ANWENDUNG` ist eine von Hand gepflegte Liste, und von Hand
 * gepflegte Listen laufen dem Code davon. Genau das war passiert:
 * `/magic`, `/bestaetigen`, `/forgot-password` und `/admin` fehlten,
 * und die Weiche schickte sie gemessen auf die öffentliche Seite —
 * Anmeldewege, die eine Sitzung anlegen, auf der Domain ohne
 * Anwendung.
 *
 * Der Fehler fällt nicht auf, weil nichts abstürzt. Man kommt an,
 * die Seite lädt, sie ist nur die falsche.
 *
 * Deshalb prüft dieser Test nicht die Liste, sondern den Dateibaum:
 * Jede Route in der Anmeldegruppe und unter `/admin` MUSS zur
 * Anwendung gehören. Wer morgen `(auth)/neuer-weg` anlegt und die
 * Liste vergisst, bekommt hier ein rotes Ergebnis statt in drei
 * Wochen eine Sitzung auf der Marketingdomain.
 */
describe("Einordnung gegen den tatsächlichen Dateibaum", () => {
  const wurzel = new URL("../app/", import.meta.url).pathname;

  /** Der Pfad, unter dem eine Datei im Browser erreichbar ist. */
  function routen(verzeichnis: string, praefix = ""): string[] {
    const gefunden: string[] = [];
    for (const eintrag of readdirSync(verzeichnis, { withFileTypes: true })) {
      if (eintrag.isDirectory()) {
        /* Klammergruppen sind Ordnung im Code, kein Teil der Adresse. */
        const teil = /^\(.*\)$/.test(eintrag.name) ? praefix : `${praefix}/${eintrag.name}`;
        gefunden.push(...routen(join(verzeichnis, eintrag.name), teil));
      } else if (eintrag.name === "page.tsx" || eintrag.name === "route.ts") {
        gefunden.push(praefix === "" ? "/" : praefix);
      }
    }
    return gefunden;
  }

  it("ordnet jede Route der Anmeldegruppe der Anwendung zu", () => {
    const pfade = routen(join(wurzel, "(auth)"));
    expect(pfade.length).toBeGreaterThan(4);
    for (const pfad of pfade) {
      expect(zustaendigFuer(pfad), `${pfad} gehört zur Anwendung`).not.toBe("seite");
    }
  });

  it("ordnet jede Verwaltungsroute der Anwendung zu", () => {
    const pfade = routen(join(wurzel, "admin"), "/admin");
    expect(pfade.length).toBeGreaterThan(0);
    for (const pfad of pfade) {
      expect(zustaendigFuer(pfad), `${pfad} gehört zur Anwendung`).not.toBe("seite");
    }
  });
});
