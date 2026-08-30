import { describe, expect, it } from "vitest";
import { autoSubmitAllowed, capabilityForJob } from "./capability-registry.ts";
import { buildPackage, statusAfterHandoff, type PackageInput } from "./package-builder.ts";

/**
 * Die technische Wahrheit: eine Webseite kann keine Formularfelder auf
 * einer fremden Domain ausfüllen. Ein Produkt, das „wir bewerben uns
 * für dich" verspricht, verspricht entweder etwas, das es nicht kann,
 * oder es umgeht etwas, das es nicht umgehen darf.
 */

describe("Bewerbungsweg", () => {
  it("nimmt den vorbereiteten Verweis als Standard", () => {
    const c = capabilityForJob({
      originalUrl: "https://boards.greenhouse.io/x/jobs/1",
      applyMethod: "external",
      applyTarget: null,
    });
    expect(c.mode).toBe("prepared_redirect");
    expect(c.explanation).toMatch(/Den letzten Schritt machst du selbst/);
  });

  it("erlaubt niemals automatisches Absenden", () => {
    // Weder Konfiguration noch Code können das ändern.
    expect(autoSubmitAllowed()).toBe(false);

    for (const url of [
      "https://boards.greenhouse.io/x/1",
      "https://jobs.lever.co/y/2",
      "https://de.indeed.com/viewjob?jk=z",
    ]) {
      const c = capabilityForJob({ originalUrl: url, applyMethod: "external", applyTarget: null });
      expect(c.autoSubmitAllowed, url).toBe(false);
      expect(c.userConfirmationRequired, url).toBe(true);
    }
  });

  it("nutzt einen autorisierten Weg nur, wenn er eingetragen UND freigegeben ist", () => {
    const registriert = {
      sourceKey: "ats_greenhouse",
      mode: "native_apply" as const,
      authorization: "authorized" as const,
      enabled: true,
      supportsScreeningQuestions: true,
      supportsResumeUpload: true,
      supportsStatusSync: true,
      allowedDomains: ["greenhouse.io"],
    };

    const mit = capabilityForJob({
      originalUrl: "https://boards.greenhouse.io/x/1",
      applyMethod: "external",
      applyTarget: null,
      registered: [registriert],
    });
    expect(mit.mode).toBe("native_apply");

    // Abgeschaltet: zurück zum Standard.
    const ohne = capabilityForJob({
      originalUrl: "https://boards.greenhouse.io/x/1",
      applyMethod: "external",
      applyTarget: null,
      registered: [{ ...registriert, enabled: false }],
    });
    expect(ohne.mode).toBe("prepared_redirect");

    // Nicht autorisiert: ebenfalls zurück.
    const unautorisiert = capabilityForJob({
      originalUrl: "https://boards.greenhouse.io/x/1",
      applyMethod: "external",
      applyTarget: null,
      registered: [{ ...registriert, authorization: "pending_review" }],
    });
    expect(unautorisiert.mode).toBe("prepared_redirect");
  });

  it("schreibt keine E-Mail an eine Adresse aus gesperrter Quelle", () => {
    // Eine erratene oder unzulässig beschaffte Adresse ist keine
    // Bewerbung, sondern eine Mail an jemanden, der nichts erwartet.
    const c = capabilityForJob({
      originalUrl: "https://de.indeed.com/viewjob?jk=abc",
      applyMethod: "email",
      applyTarget: "jobs@example.invalid",
    });
    expect(c.mode).not.toBe("email_draft");
  });

  it("sagt ohne Adresse, dass es nichts zu öffnen gibt", () => {
    const c = capabilityForJob({ originalUrl: null, applyMethod: "external", applyTarget: null });
    expect(c.mode).toBe("manual_only");
    expect(c.missingForBetterMode).toMatch(/keine Adresse/);
  });

  it("nennt, was für einen besseren Weg fehlte", () => {
    const c = capabilityForJob({
      originalUrl: "https://boards.greenhouse.io/x/1",
      applyMethod: "external",
      applyTarget: null,
    });
    expect(c.missingForBetterMode).toMatch(/Partnervereinbarung|keine Bewerbungsschnittstelle/);
  });
});

const basis: PackageInput = {
  capability: capabilityForJob({
    originalUrl: "https://boards.greenhouse.io/x/1",
    applyMethod: "external",
    applyTarget: null,
  }),
  claims: null,
  documents: [{ key: "cv", label: "Lebenslauf", present: true, approved: true, required: true }],
  screeningQuestions: [],
  passportFields: [{ key: "email", label: "E-Mail", filled: true, required: true }],
};

describe("Bewerbungspaket", () => {
  it("ist bereit, wenn alles geprüft ist", () => {
    const p = buildPackage(basis);
    expect(p.ready).toBe(true);
    expect(p.blockers).toEqual([]);
  });

  it("sperrt bei einer unbelegten Aussage", () => {
    // Nicht als Warnung — eine Warnung klickt man weg.
    const p = buildPackage({
      ...basis,
      claims: {
        claims: [],
        unsupported: [{ id: "1", artifactId: "a", text: "Ich habe ein Team geführt.", evidenceIds: [], status: "unsupported", note: "" }],
        supportedRatio: 0,
      },
    });
    expect(p.ready).toBe(false);
    expect(p.blockers.join(" ")).toMatch(/keinen Beleg/);
  });

  it("sperrt bei einem Dokument, das niemand angesehen hat", () => {
    const p = buildPackage({
      ...basis,
      documents: [{ key: "cv", label: "Lebenslauf", present: true, approved: false, required: true }],
    });
    expect(p.ready).toBe(false);
    expect(p.blockers.join(" ")).toMatch(/noch nicht angesehen/);
  });

  it("schlägt bei freiwilligen Fragen nichts vor", () => {
    // Eine vorgeschlagene Antwort auf eine freiwillige Frage ist ein
    // Vorschlag zu viel.
    const p = buildPackage({
      ...basis,
      screeningQuestions: [
        { question: "Möchtest du Angaben zur Diversität machen?", answered: false, approved: false, voluntary: true },
      ],
    });
    expect(p.ready).toBe(true);
    const eintrag = p.items.find((i) => i.key.startsWith("question:"))!;
    expect(eintrag.status).toBe("not_required");
    expect(eintrag.detail).toMatch(/wir schlagen nichts vor/);
  });

  it("sperrt bei einer Änderung ohne Beleg", () => {
    const p = buildPackage({
      ...basis,
      diffs: [
        {
          original: "Ich habe im Kundenservice gearbeitet.",
          revised: "Ich habe ein Serviceteam geleitet.",
          rationale: "Klingt stärker",
          evidenceIds: [],
          supported: false,
        },
      ],
    });
    expect(p.ready).toBe(false);
    expect(p.blockers.join(" ")).toMatch(/keine bestätigte Erfahrung/);
  });
});

describe("Nach der Übergabe", () => {
  it("hält einen Redirect nicht für einen Versand", () => {
    // Das Produkt weiss nach dem Öffnen der Originalseite genau so viel
    // wie vorher: nichts darüber, ob die Bewerbung abgeschickt wurde.
    expect(statusAfterHandoff(null)).toBe("handed_off");
    expect(statusAfterHandoff("not_yet")).toBe("handed_off");
    expect(statusAfterHandoff("later")).toBe("handed_off");
  });

  it("setzt den Versand erst auf Bestätigung", () => {
    expect(statusAfterHandoff("sent")).toBe("confirmed_sent");
  });

  it("merkt sich einen Abbruch als Abbruch", () => {
    expect(statusAfterHandoff("aborted")).toBe("abandoned");
  });
});
