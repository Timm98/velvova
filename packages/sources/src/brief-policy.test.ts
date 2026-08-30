import { describe, expect, it } from "vitest";
import { BRIEF_TTL_HOURS, briefDisclaimer, briefIsStale, decideBrief } from "./brief-policy.ts";
import { SOURCE_REGISTRY } from "./source-registry.ts";
import { decideForEntry, decideForProvider } from "./policy-engine.ts";

/**
 * Umschreiben ist keine Nutzungserlaubnis.
 *
 * Einen Anzeigentext durch ein Sprachmodell laufen zu lassen macht ihn
 * nicht zu unserem. Eine Zusammenfassung ist eine abgeleitete
 * Bearbeitung — wer den Ausgangstext nicht verwenden darf, darf auch
 * die Bearbeitung nicht veröffentlichen.
 */

const JETZT = new Date("2026-08-30T12:00:00Z");
const eintrag = (key: string) => SOURCE_REGISTRY.find((s) => s.providerKey === key) ?? null;

describe("Freigegebene Quelle", () => {
  const e = eintrag("arbeitnow")!;
  const p = decideBrief(e, decideForEntry(e, JETZT));

  it("erlaubt eine kurze Zusammenfassung", () => {
    expect(p.mayGenerate).toBe(true);
    expect(p.audience).toBe("public");
  });

  it("begrenzt sie auf wenige Sätze", () => {
    // Mehr wäre keine Kurzfassung, sondern ein Ersatz für die Anzeige.
    expect(p.maxFactSentences).toBeLessThanOrEqual(4);
    expect(p.maxFactSentences).toBeGreaterThan(0);
  });

  it("verlangt den Verweis auf das Original", () => {
    expect(p.requiresOriginalLink).toBe(true);
  });
});

describe("Gesperrte Quelle", () => {
  const p = decideBrief(
    eintrag("indeed_partner_pending"),
    decideForProvider("indeed_partner_pending"),
  );

  it("erzeugt keinen Brief", () => {
    // Der eigentliche Punkt: von einer Quelle, die wir nicht lesen
    // dürfen, gibt es auch keine Zusammenfassung.
    expect(p.mayGenerate).toBe(false);
    expect(p.renderMode).toBe("link_only");
    expect(p.maxFactSentences).toBe(0);
  });

  it("erlaubt weiterhin den Verweis", () => {
    expect(p.requiresOriginalLink).toBe(true);
    expect(p.reason).toMatch(/Verweis|Original/);
  });
});

describe("Vom Menschen mitgebrachter Text", () => {
  const p = decideBrief(
    eintrag("indeed_partner_pending"),
    decideForProvider("indeed_partner_pending"),
    true,
  );

  it("darf analysiert werden, auch wenn die Quelle gesperrt ist", () => {
    // Was die Person selbst gelesen und eingefügt hat, ist ihre
    // Recherche.
    expect(p.mayGenerate).toBe(true);
    expect(p.renderMode).toBe("private_summary_only");
  });

  it("bleibt privat", () => {
    expect(p.audience).toBe("private_user_only");
    expect(p.reason).toMatch(/bleibt in deinem Konto/);
  });

  it("landet in keiner öffentlichen Liste", () => {
    expect(p.reason).toMatch(/keiner öffentlichen Liste/);
  });
});

describe("Anzeigen erlaubt, Zusammenfassen nicht", () => {
  it("zeigt die Felder, erzeugt aber keine Fassung", () => {
    // Klingt widersprüchlich, ist es nicht: die erlaubten Felder dürfen
    // stehen, eine daraus abgeleitete Fassung ist eine Bearbeitung.
    const e = { ...eintrag("arbeitnow")!, attributionText: "Quelle X" };
    const entscheidung = {
      ...decideForEntry(e, JETZT),
      allowedOperations: ["Search", "FetchDetails", "PublicDisplay"] as never,
    };
    const p = decideBrief(e, entscheidung);

    expect(p.renderMode).toBe("metadata_only");
    expect(p.mayGenerate).toBe(false);
    expect(p.reason).toMatch(/keine abgeleitete Zusammenfassung/);
  });
});

describe("Alterung", () => {
  it("hält einen frischen Brief für gültig", () => {
    expect(briefIsStale(new Date(JETZT.getTime() - 3600_000), JETZT)).toBe(false);
  });

  it("erklärt einen alten Brief für ungültig", () => {
    // Eine Zusammenfassung altert mit ihrer Quelle. Steht sie noch da,
    // wenn die Anzeige längst geändert wurde, behauptet sie etwas über
    // eine Stelle, die es so nicht mehr gibt.
    const alt = new Date(JETZT.getTime() - (BRIEF_TTL_HOURS + 1) * 3600_000);
    expect(briefIsStale(alt, JETZT)).toBe(true);
  });
});

describe("Hinweis", () => {
  it("nennt Nina als Urheberin und verweist aufs Original", () => {
    const d = briefDisclaimer("Nina");
    expect(d).toContain("Nina");
    expect(d).toMatch(/Originalanzeige/);
  });
});

describe("Über das ganze Verzeichnis", () => {
  it("erzeugt für keine nicht freigegebene Quelle einen Brief", () => {
    for (const e of SOURCE_REGISTRY) {
      const entscheidung = decideForEntry(e, JETZT);
      const p = decideBrief(e, entscheidung);
      if (entscheidung.decision !== "approved") {
        expect(p.mayGenerate, e.providerKey).toBe(false);
      }
    }
  });

  it("verlangt überall entweder Verweis oder Nennung", () => {
    for (const e of SOURCE_REGISTRY) {
      const p = decideBrief(e, decideForEntry(e, JETZT));
      expect(p.requiresOriginalLink || p.attributionText !== null, e.providerKey).toBe(true);
    }
  });
});
