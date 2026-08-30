import { describe, expect, it } from "vitest";
import {
  assertAllowed,
  canPublish,
  decideForEntry,
  decideForProvider,
  decideForUrl,
  isAllowed,
  restrictFields,
} from "./policy-engine.ts";
import { SOURCE_REGISTRY, findByUrl } from "./source-registry.ts";
import { classifyCandidates, coverageStatement, ingestable } from "./web-discovery.ts";
import { statedOrUnknown, validateProvenance } from "./provenance.ts";
import { SourcePolicyError } from "./decision-types.ts";

/**
 * Die Sperre, geprüft.
 *
 * Diese Datei ist der Kern der rechtlichen Absicherung. Sie prüft nicht,
 * ob der Code kompiliert, sondern ob er das Falsche verhindert.
 */

const BLOCKED_PLATFORMS = [
  "https://www.linkedin.com/jobs/view/123456",
  "https://de.indeed.com/viewjob?jk=abc",
  "https://www.stepstone.de/stellenangebote--Foo--123.html",
  "https://www.monster.de/job/xyz",
  "https://www.xing.com/jobs/123",
  "https://www.kununu.com/de/firma",
  "https://www.glassdoor.de/Jobs/index.htm",
  "https://www.google.com/search?q=jobs",
];

describe("Gesperrte Plattformen", () => {
  it.each(BLOCKED_PLATFORMS)("erlaubt für %s keinen Abruf", (url) => {
    const decision = decideForUrl(url);
    expect(decision.decision).toBe("link_only");
    expect(isAllowed(decision, "FetchDetails")).toBe(false);
    expect(isAllowed(decision, "Cache")).toBe(false);
    expect(isAllowed(decision, "PublicDisplay")).toBe(false);
    expect(isAllowed(decision, "Embed")).toBe(false);
    expect(isAllowed(decision, "Rank")).toBe(false);
  });

  it("erkennt auch Unterdomains", () => {
    // Waere der Abgleich auf exakte Hostnamen beschraenkt, liesse sich
    // die Sperre mit einer Unterdomain umgehen.
    expect(findByUrl("https://de.linkedin.com/jobs/view/1")?.displayName).toBe("LinkedIn");
    expect(findByUrl("https://jobs.google.com/x")?.displayName).toBe("Google for Jobs");
  });

  it("wirft, wenn ein Aufrufer es trotzdem versucht", () => {
    const decision = decideForUrl("https://www.linkedin.com/jobs/view/1");
    expect(() => assertAllowed(decision, "FetchDetails")).toThrow(SourcePolicyError);
  });

  it("lässt eine Zusammenfassung nicht durch, wo das Lesen verboten ist", () => {
    // Der entscheidende Test gegen die Umgehung durch Umformulieren:
    // wer nicht lesen darf, darf auch nicht zusammenfassen.
    const decision = decideForUrl("https://de.indeed.com/viewjob?jk=abc");
    expect(isAllowed(decision, "Summarize")).toBe(false);
    expect(() => assertAllowed(decision, "Summarize")).toThrow(/nicht erlaubt/);
  });

  it("erlaubt trotzdem den Verweis auf das Original", () => {
    const decision = decideForUrl("https://www.stepstone.de/x");
    expect(decision.allowedFields).toEqual(["source_url"]);
  });
});

describe("Unbekannte Quellen", () => {
  it("gelten als ungeprüft, nicht als erlaubt", () => {
    const decision = decideForUrl("https://irgendein-jobportal.example/stelle/1");
    expect(decision.decision).toBe("pending_review");
    expect(decision.allowedOperations).toEqual([]);
    expect(decision.reasonCode).toBe("unknown_source");
  });

  it("behandelt eine unlesbare URL genauso vorsichtig", () => {
    expect(decideForUrl("keine-url").decision).toBe("pending_review");
  });
});

describe("Freigegebene Quellen", () => {
  it("erlaubt Arbeitnow den vollen Weg", () => {
    const decision = decideForProvider("arbeitnow");
    expect(decision.decision).toBe("approved");
    for (const op of ["Search", "FetchDetails", "Cache", "PublicDisplay", "Rank"] as const) {
      expect(isAllowed(decision, op)).toBe(true);
    }
  });

  it("erlaubt keiner Quelle die native Bewerbung ohne Freigabe", () => {
    for (const entry of SOURCE_REGISTRY) {
      if (!entry.nativeApplyAllowed) {
        expect(entry.allowedOperations).not.toContain("NativeApply");
      }
    }
  });

  it("sperrt Jooble und Adzuna, solange kein Schlüssel hinterlegt ist", () => {
    // enabled=false heisst: es gibt keinen Zugang. Der Verweis bleibt.
    for (const key of ["jooble_de", "adzuna_de"]) {
      const decision = decideForProvider(key);
      expect(decision.decision).toBe("link_only");
      expect(decision.reasonCode).toBe("provider_disabled");
      expect(isAllowed(decision, "FetchDetails")).toBe(false);
    }
  });

  it("erlaubt Jooble auch freigeschaltet keine Volltextanzeige", () => {
    // Jooble liefert Ausschnitte fremder Anzeigen. Angezeigt werden
    // Metadaten und der Originallink - nicht der uebernommene Text.
    const jooble = SOURCE_REGISTRY.find((s) => s.providerKey === "jooble_de")!;
    expect(jooble.fullTextAllowed).toBe(false);
    expect(jooble.allowedOperations).not.toContain("PublicDisplay");
    expect(jooble.requiresOriginalLink).toBe(true);
  });
});

describe("Abgelaufene Prüfung", () => {
  it("sperrt eine Quelle, deren Überprüfung fällig ist", () => {
    const entry = {
      ...SOURCE_REGISTRY.find((s) => s.providerKey === "arbeitnow")!,
      nextLegalReviewAt: "2026-01-01T00:00:00.000Z",
    };
    const decision = decideForEntry(entry, new Date("2026-08-30T00:00:00.000Z"));
    expect(decision.decision).toBe("pending_review");
    expect(decision.reasonCode).toBe("terms_review_overdue");
  });
});

describe("Felder beschneiden", () => {
  it("entfernt, was nicht erlaubt ist", () => {
    const decision = decideForProvider("jooble_de");
    const restricted = restrictFields(
      { ...decision, allowedFields: ["title", "source_url"] },
      { title: "Kundenbetreuung", source_url: "https://x.example/1", description_text: "…" },
    );
    expect(restricted).toEqual({ title: "Kundenbetreuung", source_url: "https://x.example/1" });
    expect(restricted).not.toHaveProperty("description_text");
  });
});

describe("Veröffentlichung", () => {
  it("verweigert eine Stelle ohne Verweis auf das Original", () => {
    const decision = decideForProvider("arbeitnow");
    expect(canPublish(decision, { sourceUrl: null }).ok).toBe(false);
    expect(canPublish(decision, { sourceUrl: "https://x.example/1" }).ok).toBe(true);
  });

  it("verweigert eine Stelle aus einer nur verlinkbaren Quelle", () => {
    const decision = decideForUrl("https://www.linkedin.com/jobs/view/1");
    expect(canPublish(decision, { sourceUrl: "https://www.linkedin.com/jobs/view/1" }).ok).toBe(
      false,
    );
  });
});

describe("Entdeckung", () => {
  const found = [
    { url: "https://www.arbeitnow.com/jobs/x", title: "Erlaubt" },
    { url: "https://www.linkedin.com/jobs/view/1", title: "Gesperrt" },
    { url: "https://unbekannt.example/job/1", title: "Ungeprüft" },
  ];

  it("gibt niemals Inhalt zurück, nur Entscheidungen", () => {
    const candidates = classifyCandidates(found, "web_search");
    expect(candidates).toHaveLength(3);
    for (const candidate of candidates) {
      expect(Object.keys(candidate)).not.toContain("content");
      expect(Object.keys(candidate)).not.toContain("description");
    }
  });

  it("lädt nur, was freigegeben ist", () => {
    const candidates = classifyCandidates(found, "web_search");
    const loadable = ingestable(candidates);
    expect(loadable).toHaveLength(1);
    expect(loadable[0]!.domain).toBe("arbeitnow.com");
  });

  it("beschreibt die Reichweite ehrlich statt vollmundig", () => {
    // Der Auftrag verbietet die Behauptung, "das gesamte Internet" zu
    // durchsuchen. Der Satz entsteht aus echten Zahlen.
    const statement = coverageStatement(classifyCandidates(found, "web_search"));
    expect(statement).toContain("1 aus freigegebenen Quellen geladen");
    expect(statement).toContain("nur verlinkt");
    expect(statement).not.toMatch(/alle|gesamte|jede/i);
  });
});

describe("Provenienz", () => {
  it("weist eine Zusammenfassung ohne Herkunft zurück", () => {
    const result = validateProvenance([
      {
        fieldName: "description_summary",
        transformType: "ai_summary",
        value: "Eine knappe Zusammenfassung.",
        sourceUrl: "https://x.example/1",
        fetchedAt: new Date().toISOString(),
        confidence: 0.8,
        displayAllowed: true,
        citationLabel: null,
        derivedFrom: [],
      },
    ]);
    expect(result.ok).toBe(false);
    expect(result.errors[0]!.message).toContain("Erfindung");
  });

  it("nimmt eine Zusammenfassung mit Herkunft an", () => {
    const result = validateProvenance([
      {
        fieldName: "description_summary",
        transformType: "ai_summary",
        value: "Eine knappe Zusammenfassung.",
        sourceUrl: "https://x.example/1",
        fetchedAt: new Date().toISOString(),
        confidence: 0.8,
        displayAllowed: true,
        citationLabel: "Arbeitnow",
        derivedFrom: ["description_text", "requirements"],
      },
    ]);
    expect(result.ok).toBe(true);
  });

  it("verlangt für wörtlich Übernommenes die Quelle", () => {
    const result = validateProvenance([
      {
        fieldName: "description_text",
        transformType: "verbatim_allowed",
        value: "Originaltext",
        sourceUrl: null,
        fetchedAt: null,
        confidence: 1,
        displayAllowed: true,
        citationLabel: null,
        derivedFrom: [],
      },
    ]);
    expect(result.ok).toBe(false);
  });
});

describe("Fehlende Angaben", () => {
  it("bleibt leer statt zu raten", () => {
    expect(statedOrUnknown(null)).toEqual({ known: false, label: "Nicht angegeben" });
    expect(statedOrUnknown("")).toEqual({ known: false, label: "Nicht angegeben" });
    expect(statedOrUnknown(45000)).toEqual({ known: true, value: 45000 });
  });
});

describe("Adapter und Verzeichnis passen zusammen", () => {
  it("kennt jeden Adapter-Schlüssel im Quellenverzeichnis", async () => {
    // Laufen Adapter-Schluessel und Provider-IDs auseinander, greift die
    // Sperre zwar - aber mit der Begruendung "unbekannte Quelle" statt
    // der richtigen. Fail-closed ist gut; falsch begruendet ist es
    // trotzdem ein Fehler.
    const { ArbeitnowAdapter, AdzunaAdapter, JoobleAdapter } = await import("@paycheck/jobs");
    const keys = [
      new ArbeitnowAdapter().key,
      new AdzunaAdapter().key,
      new JoobleAdapter().key,
    ];

    for (const key of keys) {
      const entry = SOURCE_REGISTRY.find((s) => s.providerKey === key);
      expect(entry, `Adapter „${key}" fehlt im Quellenverzeichnis`).toBeDefined();
    }
  });

  it("behandelt einen unbekannten Schlüssel vorsichtig", () => {
    const decision = decideForProvider("irgendein_neuer_adapter");
    expect(decision.decision).toBe("pending_review");
    expect(decision.allowedOperations).toEqual([]);
  });
});
