import { describe, expect, it } from "vitest";
import {
  belegeVerschmelzen,
  betreffZahlStimmt,
  mailtextPruefen,
  matchbelegePruefen,
  type Matchbelegeingabe,
  type Modellkriterium,
  type Modelltransfer,
} from "./modellpruefung.ts";

const RAHMEN = {
  erlaubteJobs: new Set(["job-a", "job-b"]),
  erlaubteKriterien: new Set(["mindestgehalt", "arbeitsort", "taetigkeit"]),
  erlaubteJobbelege: new Set(["beleg-1"]),
  erlaubteProfilbelege: new Set(["profil-1"]),
};

function kriterium(teil: Partial<Modellkriterium> = {}): Modellkriterium {
  return {
    criterion_id: "taetigkeit",
    status: "fulfilled",
    profile_evidence_ids: [],
    job_evidence_ids: ["beleg-1"],
    reason: "passt",
    missing_information: null,
    ...teil,
  };
}

function transfer(teil: Partial<Modelltransfer> = {}): Modelltransfer {
  return {
    job_requirement: "Kundenanfragen bearbeiten",
    profile_basis: "Beschwerden von Gästen geklärt",
    art: "transferable_skill_match",
    profile_evidence_ids: ["profil-1"],
    job_evidence_ids: ["beleg-1"],
    reason: "Beides ist Klärung im direkten Kontakt.",
    ...teil,
  };
}

function beleg(teil: Partial<Matchbelegeingabe> & { job_id: string }): Matchbelegeingabe {
  return {
    criteria: [],
    transferable_skill_matches: [],
    soft_hits: [],
    soft_misses: [],
    unknowns: [],
    conflicts: [],
    reason_candidates: [],
    caveat: null,
    ...teil,
  };
}

describe("Matchingbelege prüfen", () => {
  it("weist eine Stelle zurück, die nie geliefert wurde", () => {
    const e = matchbelegePruefen([beleg({ job_id: "fremde-stelle" })], RAHMEN);
    expect(e.gueltig).toHaveLength(0);
    expect(e.verworfen[0]!.grund).toBe("fremde_stelle");
  });

  it("weist ein Kriterium zurück, das es im Profil nicht gibt", () => {
    const e = matchbelegePruefen(
      [beleg({ job_id: "job-a", criteria: [kriterium({ criterion_id: "erfunden" })] })],
      RAHMEN,
    );
    expect(e.gueltig[0]!.criteria).toHaveLength(0);
    expect(e.verworfen[0]!.grund).toBe("fremdes_kriterium");
  });

  it("entfernt Belegkennungen, die auf nichts zeigen", () => {
    const e = matchbelegePruefen(
      [
        beleg({
          job_id: "job-a",
          criteria: [
            kriterium({
              criterion_id: "arbeitsort",
              profile_evidence_ids: ["profil-1", "erfunden"],
              job_evidence_ids: ["beleg-1", "erfunden"],
            }),
          ],
        }),
      ],
      RAHMEN,
    );
    const r = e.gueltig[0]!.criteria[0]!;
    expect(r.profile_evidence_ids).toEqual(["profil-1"]);
    expect(r.job_evidence_ids).toEqual(["beleg-1"]);
    expect(e.verworfen.map((v) => v.grund)).toContain("erfundener_jobbeleg");
  });

  it("stuft „erfüllt“ ohne Jobbeleg auf unbekannt herunter", () => {
    /*
     * Der Systemprompt verlangt es, aber eine Bitte im Prompt ist
     * keine Regel. Ein Modell, das ohne Beleg „erfüllt" sagt,
     * behauptet etwas über eine Anzeige, das niemand nachlesen kann.
     */
    const e = matchbelegePruefen(
      [
        beleg({
          job_id: "job-a",
          criteria: [kriterium({ criterion_id: "taetigkeit", status: "fulfilled", job_evidence_ids: [] })],
        }),
      ],
      RAHMEN,
    );
    expect(e.gueltig[0]!.criteria[0]!.status).toBe("unknown");
    expect(e.verworfen.map((v) => v.grund)).toContain("erfuellt_ohne_beleg");
  });

  it("lässt „nicht erfüllt“ ohne Jobbeleg stehen", () => {
    /* Eine Verletzung lässt sich auch aus dem Fehlen begründen. */
    const e = matchbelegePruefen(
      [
        beleg({
          job_id: "job-a",
          criteria: [
            kriterium({ criterion_id: "taetigkeit", status: "not_fulfilled", job_evidence_ids: [] }),
          ],
        }),
      ],
      RAHMEN,
    );
    expect(e.gueltig[0]!.criteria[0]!.status).toBe("not_fulfilled");
  });

  it("lässt dieselbe Stelle nicht zweimal durch", () => {
    const e = matchbelegePruefen([beleg({ job_id: "job-a" }), beleg({ job_id: "job-a" })], RAHMEN);
    expect(e.gueltig).toHaveLength(1);
    expect(e.verworfen[0]!.grund).toBe("doppelt");
  });
});

describe("Übertragbare Fähigkeiten", () => {
  it("stuft einen Transfer ohne Profilbeleg zur Vermutung herab", () => {
    /*
     * „Gastronomie" beweist keine Kundenbetreuungskompetenz. Ohne
     * belegte Erfahrung ist es eine Vermutung — und Vermutungen
     * fliessen nicht in einen Fit ein.
     */
    const e = matchbelegePruefen(
      [
        beleg({
          job_id: "job-a",
          transferable_skill_matches: [
            transfer({ art: "transferable_skill_match", profile_evidence_ids: [] }),
          ],
        }),
      ],
      RAHMEN,
    );
    expect(e.gueltig[0]!.transferable_skill_matches[0]!.art).toBe("unverified_possible_transfer");
    expect(e.verworfen.map((v) => v.grund)).toContain("transfer_ohne_profilbeleg");
  });

  it("lässt einen belegten Transfer stehen", () => {
    const e = matchbelegePruefen(
      [
        beleg({
          job_id: "job-a",
          transferable_skill_matches: [
            transfer({ art: "transferable_skill_match", profile_evidence_ids: ["profil-1"] }),
          ],
        }),
      ],
      RAHMEN,
    );
    expect(e.gueltig[0]!.transferable_skill_matches[0]!.art).toBe("transferable_skill_match");
  });

  it("entfernt erfundene Profilbelege auch beim Transfer", () => {
    const e = matchbelegePruefen(
      [
        beleg({
          job_id: "job-a",
          transferable_skill_matches: [
            transfer({ art: "direct_skill_match", profile_evidence_ids: ["erfunden"] }),
          ],
        }),
      ],
      RAHMEN,
    );
    const t = e.gueltig[0]!.transferable_skill_matches[0]!;
    expect(t.profile_evidence_ids).toEqual([]);
    /* Ohne Beleg keine Behauptung. */
    expect(t.art).toBe("unverified_possible_transfer");
  });
});

describe("Zusammenführung mit dem Code", () => {
  const deterministisch = [
    { kriteriumId: "k1", kriterium: "mindestgehalt", status: "nicht_erfuellt" },
    { kriteriumId: "k2", kriterium: "taetigkeit", status: "unbekannt" },
  ];

  it("lässt das Modell ein berechnetes Urteil nicht überstimmen", () => {
    /*
     * Ob 42.000 unter 45.000 liegt, ist keine Ermessensfrage. Ein
     * Modell, das das überstimmen darf, hebt eine Bedingung auf, die
     * eine Person ausdrücklich gesetzt hat.
     */
    const v = belegeVerschmelzen(deterministisch, [
      { criterion_id: "mindestgehalt", status: "fulfilled", profile_evidence_ids: [], job_evidence_ids: ["beleg-1"], reason: "passt schon", missing_information: null },
    ]);
    expect(v.status.get("k1")).toBe("nicht_erfuellt");
    expect(v.geaendert).toHaveLength(0);
  });

  it("lässt das Modell bei einer Tätigkeit bewegen — mit Beleg", () => {
    const v = belegeVerschmelzen(deterministisch, [
      { criterion_id: "taetigkeit", status: "fulfilled", profile_evidence_ids: [], job_evidence_ids: ["beleg-1"], reason: "Die Aufgaben nennen Kommissionierung.", missing_information: null },
    ]);
    expect(v.status.get("k2")).toBe("erfuellt");
    expect(v.begruendung.get("k2")).toContain("Kommissionierung");
    expect(v.geaendert[0]).toEqual({ kriterium: "taetigkeit", von: "unbekannt", nach: "erfuellt" });
  });

  it("lässt ein belegloses Unbekannt kein belegtes Urteil verdrängen", () => {
    const mitTreffer = [{ kriteriumId: "k2", kriterium: "taetigkeit", status: "erfuellt" }];
    const v = belegeVerschmelzen(mitTreffer, [
      { criterion_id: "taetigkeit", status: "unknown", profile_evidence_ids: [], job_evidence_ids: [], reason: "weiss nicht", missing_information: "aufgaben" },
    ]);
    expect(v.status.get("k2")).toBe("erfuellt");
  });

  it("darf einen Titeltreffer widerlegen", () => {
    /* „Ein ähnlicher Berufstitel beweist keine passende Tätigkeit." */
    const mitTreffer = [{ kriteriumId: "k2", kriterium: "taetigkeit", status: "erfuellt" }];
    const v = belegeVerschmelzen(mitTreffer, [
      { criterion_id: "taetigkeit", status: "not_fulfilled", profile_evidence_ids: [], job_evidence_ids: ["beleg-1"], reason: "Die Aufgaben sind Buchhaltung.", missing_information: null },
    ]);
    expect(v.status.get("k2")).toBe("nicht_erfuellt");
  });
});

describe("Mailtext prüfen", () => {
  const rahmen = {
    ausgewaehlt: ["job-a", "job-b"],
    gruende: new Map([
      ["job-a", ["Zwölf Minuten von dir entfernt."]],
      ["job-b", ["Unbefristet und in Teilzeit."]],
    ]),
    caveats: new Map<string, string | null>([
      ["job-a", "Zum Gehalt sagt die Anzeige nichts."],
      ["job-b", null],
    ]),
  };

  it("lässt keine zusätzliche Stelle in die Mail", () => {
    const e = mailtextPruefen(
      [
        { job_id: "job-a", reason: "Zwölf Minuten von dir entfernt.", caveat: "Zum Gehalt sagt die Anzeige nichts." },
        { job_id: "job-c", reason: "auch schön", caveat: null },
      ],
      rahmen,
    );
    expect(e.posten.map((p) => p.job_id)).toEqual(["job-a", "job-b"]);
    expect(e.auswahlVeraendert).toBe(true);
  });

  it("hält die Reihenfolge der Auswahl", () => {
    const e = mailtextPruefen(
      [
        { job_id: "job-b", reason: "Unbefristet und in Teilzeit.", caveat: null },
        { job_id: "job-a", reason: "Zwölf Minuten von dir entfernt.", caveat: "Zum Gehalt sagt die Anzeige nichts." },
      ],
      rahmen,
    );
    expect(e.posten.map((p) => p.job_id)).toEqual(["job-a", "job-b"]);
  });

  it("ersetzt einen frei erfundenen Grund durch den validierten", () => {
    const e = mailtextPruefen([{ job_id: "job-a", reason: "Top-Arbeitgeber mit super Team!", caveat: null }], rahmen);
    expect(e.posten[0]!.reason).toBe("Zwölf Minuten von dir entfernt.");
    expect(e.hinweise).toContain("grund_ersetzt:job-a");
  });

  it("erfindet keinen Nachteil, wo keiner belegt ist", () => {
    const e = mailtextPruefen(
      [{ job_id: "job-b", reason: "Unbefristet und in Teilzeit.", caveat: "Etwas weit weg." }],
      rahmen,
    );
    const b = e.posten.find((p) => p.job_id === "job-b")!;
    expect(b.caveat).toBeNull();
    expect(e.hinweise).toContain("caveat_ersetzt:job-b");
  });
});

describe("Betreffzahl", () => {
  it("erkennt eine falsche Trefferzahl", () => {
    expect(betreffZahlStimmt("5 neue Stellen für dich", 3)).toBe(false);
    expect(betreffZahlStimmt("3 neue Stellen für dich", 3)).toBe(true);
  });

  it("lässt einen Betreff ohne Zahl durch", () => {
    expect(betreffZahlStimmt("Neue Stellen für dich", 3)).toBe(true);
  });
});
