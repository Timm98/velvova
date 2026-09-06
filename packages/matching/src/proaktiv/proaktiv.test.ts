import { describe, expect, it } from "vitest";
import {
  darfSelbstHandeln,
  handlungBekannt,
  handlungenDerKlasse,
  klasseVon,
  HANDLUNGEN,
} from "./handlungsklassen.ts";
import {
  entdoppeln,
  interesseAusEreignissen,
  musterAusEreignissen,
  type Ereignis,
} from "./signale.ts";
import {
  darfJetzt,
  freigeben,
  gelegenheitenAusSignalen,
  ZURUECKHALTUNG,
  type Gelegenheit,
  type Zustand,
} from "./engine.ts";

const JETZT = new Date("2026-09-06T12:00:00Z");
const JOB = "job-1";

let zaehler = 0;
function ereignis(art: string, teil: Partial<Ereignis> = {}): Ereignis {
  zaehler++;
  return {
    id: `e${zaehler}`,
    art: art as Ereignis["art"],
    urheber: teil.urheber ?? "user",
    jobId: teil.jobId !== undefined ? teil.jobId : JOB,
    auftragId: null,
    sitzungId: "s1",
    geschehenAm: teil.geschehenAm ?? new Date(JETZT.getTime() - zaehler * 60_000),
    kontext: teil.kontext ?? {},
  };
}

function zustand(teil: Partial<Zustand> = {}): Zustand {
  return {
    letzteNachricht: null,
    inSitzung: 0,
    themenDerSitzung: new Set(),
    abgelehnt: new Map(),
    abgeschaltet: new Set(),
    einstellung: "ausgeglichen",
    ...teil,
  };
}

/* ═══════════════════════════════════════════════════════════════
   Die Policy
   ═══════════════════════════════════════════════════════════════ */

describe("Handlungsklassen", () => {
  it("lässt Nina nur die elf vorgesehenen Handlungen selbst ausführen", () => {
    expect(handlungenDerKlasse("auto_allowed")).toHaveLength(11);
  });

  it("hält Bewerbung, Kündigung und Zahlung von jeder Automatik fern", () => {
    for (const art of [
      "bewerbung_senden",
      "arbeitgeber_kontaktieren",
      "kuendigung_senden",
      "vertrag_unterschreiben",
      "zahlung_ausloesen",
      "daten_weitergeben",
      "profil_freigeben",
    ]) {
      expect(klasseVon(art), art).toBe("explicit_only");
      expect(darfSelbstHandeln(art), art).toBe(false);
    }
  });

  it("verlangt für jede Änderung am Suchauftrag Zustimmung", () => {
    for (const art of ["suchauftrag_aendern", "gehalt_lockern", "umkreis_erweitern", "mail_aktivieren"]) {
      expect(klasseVon(art), art).toBe("propose_first");
    }
  });

  it("kennt keine erfundene Handlung", () => {
    /*
     * Ein Tippfehler im Modellausgabefeld darf keine erlaubte
     * Handlung ergeben. Was nicht in der Tabelle steht, existiert
     * für Nina nicht.
     */
    expect(handlungBekannt("job_bewerben")).toBe(false);
    expect(darfSelbstHandeln("job_bewerben")).toBe(false);
    expect(klasseVon("job_bewerben")).toBeNull();
  });

  it("merkt sich Stellen vor, statt sie zu speichern", () => {
    /*
     * „Gespeichert" heisst: Ich will diese Stelle bewusst behalten.
     * Das ist eine Aussage der Person über sich selbst.
     */
    expect(HANDLUNGEN.job_vormerken!.klasse).toBe("auto_allowed");
    expect(handlungBekannt("job_speichern")).toBe(false);
  });
});

/* ═══════════════════════════════════════════════════════════════
   Signale
   ═══════════════════════════════════════════════════════════════ */

describe("Interesse aus Ereignissen", () => {
  it("A — ein kurzer Blick ergibt nichts", () => {
    const s = interesseAusEreignissen(JOB, [ereignis("job_viewed")], JETZT);
    expect(s).toBeNull();
  });

  it("B — mehrfach geöffnet und Details angesehen ergibt ein Signal", () => {
    const s = interesseAusEreignissen(
      JOB,
      [
        ereignis("job_viewed"),
        ereignis("job_reopened"),
        ereignis("salary_opened"),
        ereignis("requirements_opened"),
      ],
      JETZT,
    );
    expect(s).not.toBeNull();
    expect(s!.art).toBe("interesse_an_stelle");
    expect(s!.status).toBe("inferred");
    expect(s!.belege.length).toBeGreaterThan(2);
  });

  it("nennt die Beobachtung, nicht die Absicht", () => {
    const s = interesseAusEreignissen(
      JOB,
      [ereignis("job_viewed"), ereignis("job_reopened"), ereignis("job_compared")],
      JETZT,
    );
    expect(s!.beobachtung).toMatch(/^Du hast diese Stelle/);
    expect(s!.beobachtung).not.toMatch(/willst|möchtest|brauchst/i);
    /* Höchstens ein „und" — der Satz soll lesbar bleiben. */
    expect(s!.beobachtung.split(/\bund\b/).length).toBeLessThanOrEqual(3);
  });

  it("bleibt unter voller Gewissheit", () => {
    /* Es gibt immer eine andere Erklärung. */
    const s = interesseAusEreignissen(
      JOB,
      [
        ereignis("job_viewed"),
        ereignis("job_reopened"),
        ereignis("salary_opened"),
        ereignis("requirements_opened"),
        ereignis("job_compared"),
        ereignis("apply_started"),
      ],
      JETZT,
    );
    expect(s!.staerke).toBeLessThan(1);
  });

  it("C — eine Ablehnung schlägt jede Beobachtung", () => {
    /*
     * Jemand sieht eine Anzeige dreimal an, WEIL er nicht versteht,
     * was die Stelle ist, und lehnt sie dann ab. Das lange Ansehen
     * war Verwirrung, kein Interesse.
     */
    const s = interesseAusEreignissen(
      JOB,
      [
        ereignis("job_viewed"),
        ereignis("job_reopened"),
        ereignis("salary_opened"),
        ereignis("requirements_opened"),
        ereignis("job_dismissed"),
      ],
      JETZT,
    );
    expect(s).toBeNull();
  });

  it("L — auch nach langer Betrachtung entsteht aus einer Ablehnung kein Profil", () => {
    const s = interesseAusEreignissen(
      JOB,
      [
        ereignis("job_view_duration", { kontext: { sekunden: 400 } }),
        ereignis("job_reopened"),
        ereignis("job_viewed"),
        ereignis("job_dismissed"),
      ],
      JETZT,
    );
    expect(s).toBeNull();
  });

  it("zählt eine kurze Betrachtung nicht als lange", () => {
    const s = interesseAusEreignissen(
      JOB,
      [ereignis("job_viewed"), ereignis("job_view_duration", { kontext: { sekunden: 12 } })],
      JETZT,
    );
    expect(s).toBeNull();
  });
});

describe("Muster über mehrere Stellen", () => {
  const remote = new Map([
    ["r1", true],
    ["r2", true],
    ["r3", true],
    ["x1", false],
  ]);

  it("D — mehrere Remote-Stellen ergeben nur eine Vermutung", () => {
    const s = musterAusEreignissen(
      [
        ereignis("job_viewed", { jobId: "r1" }),
        ereignis("job_viewed", { jobId: "r2" }),
        ereignis("job_viewed", { jobId: "r3" }),
      ],
      { remote },
      JETZT,
    );
    const treffer = s.find((x) => x.art === "remote_interesse");
    expect(treffer).toBeDefined();
    expect(treffer!.status).toBe("inferred");
    /* Beobachtung, keine Diagnose. */
    expect(treffer!.beobachtung).toMatch(/angesehen/);
    expect(treffer!.beobachtung).not.toMatch(/bist|willst|typ/i);
  });

  it("erkennt wiederholtes Interesse am Gehalt", () => {
    const s = musterAusEreignissen(
      [
        ereignis("salary_opened", { jobId: "a" }),
        ereignis("salary_opened", { jobId: "b" }),
        ereignis("salary_opened", { jobId: "c" }),
      ],
      { remote: new Map() },
      JETZT,
    );
    expect(s.some((x) => x.art === "gehalt_wichtig")).toBe(true);
  });

  it("macht aus zwei Stellen noch kein Muster", () => {
    const s = musterAusEreignissen(
      [ereignis("salary_opened", { jobId: "a" }), ereignis("salary_opened", { jobId: "b" })],
      { remote: new Map() },
      JETZT,
    );
    expect(s).toHaveLength(0);
  });
});

describe("N — mehrere Tabs", () => {
  it("zählt dasselbe Ereignis nur einmal", () => {
    const gleich = new Date("2026-09-06T11:30:10Z");
    const roh = [
      ereignis("job_viewed", { geschehenAm: gleich }),
      ereignis("job_viewed", { geschehenAm: new Date("2026-09-06T11:30:40Z") }),
    ];
    expect(entdoppeln(roh)).toHaveLength(1);
  });

  it("behält zwei echte Aufrufe in verschiedenen Minuten", () => {
    const roh = [
      ereignis("job_viewed", { geschehenAm: new Date("2026-09-06T11:30:00Z") }),
      ereignis("job_viewed", { geschehenAm: new Date("2026-09-06T11:35:00Z") }),
    ];
    expect(entdoppeln(roh)).toHaveLength(2);
  });

  it("M — aus einem doppelten Ereignis wird keine doppelte Handlung", () => {
    const gleich = new Date("2026-09-06T11:30:05Z");
    const roh = [
      ereignis("job_viewed", { geschehenAm: gleich }),
      ereignis("job_viewed", { geschehenAm: gleich }),
      ereignis("salary_opened", { geschehenAm: gleich }),
    ];
    const s = interesseAusEreignissen(JOB, entdoppeln(roh), JETZT);
    /* Ein Aufruf und ein Gehaltsklick reichen nicht für zwei Hinweise. */
    expect(s).toBeNull();
  });
});

/* ═══════════════════════════════════════════════════════════════
   Die Engine
   ═══════════════════════════════════════════════════════════════ */

function interessensignal() {
  return interesseAusEreignissen(
    JOB,
    [
      ereignis("job_viewed"),
      ereignis("job_reopened"),
      ereignis("salary_opened"),
      ereignis("requirements_opened"),
    ],
    JETZT,
  )!;
}

describe("Von Signalen zu Handlungen", () => {
  it("B — starkes Interesse führt zum Vormerken", () => {
    const g = gelegenheitenAusSignalen([interessensignal()]);
    expect(g.map((x) => x.handlung)).toContain("job_vormerken");
    expect(g[0]!.brauchtZustimmung).toBe(false);
  });

  it("K — ein Muster ändert den Suchauftrag nie von selbst", () => {
    const s = musterAusEreignissen(
      [
        ereignis("salary_opened", { jobId: "a" }),
        ereignis("salary_opened", { jobId: "b" }),
        ereignis("salary_opened", { jobId: "c" }),
      ],
      { remote: new Map() },
      JETZT,
    );
    const g = gelegenheitenAusSignalen(s);
    const aenderung = g.find((x) => x.handlung === "suchauftrag_aendern");
    expect(aenderung).toBeDefined();
    expect(aenderung!.brauchtZustimmung).toBe(true);
    expect(aenderung!.nachricht).toMatch(/\?$/);
  });

  it("D — Remote bleibt eine Vermerkung, keine Profiländerung", () => {
    const s = musterAusEreignissen(
      [
        ereignis("job_viewed", { jobId: "r1" }),
        ereignis("job_viewed", { jobId: "r2" }),
        ereignis("job_viewed", { jobId: "r3" }),
      ],
      { remote: new Map([["r1", true], ["r2", true], ["r3", true]]) },
      JETZT,
    );
    const g = gelegenheitenAusSignalen(s);
    expect(g.map((x) => x.handlung)).toContain("hypothese_merken");
    expect(g.map((x) => x.handlung)).not.toContain("profil_uebernehmen");
  });

  it("O — ohne Signal keine Handlung", () => {
    expect(gelegenheitenAusSignalen([])).toHaveLength(0);
  });

  it("übergeht ein zurückgewiesenes Signal", () => {
    const s = { ...interessensignal(), status: "rejected" as const };
    expect(gelegenheitenAusSignalen([s])).toHaveLength(0);
  });
});

describe("Zurückhaltung", () => {
  const g: Gelegenheit = {
    handlung: "job_vormerken",
    begruendung: "Du hast dir diese Stelle mehrfach angesehen.",
    jobId: JOB,
    belegEreignisse: ["e1"],
    brauchtZustimmung: false,
    dringlichkeit: "niedrig",
    nachricht: "Ich habe sie für dich vorgemerkt.",
  };

  it("I — abgeschaltete Automatik hält Nina zurück", () => {
    const z = zustand({ abgeschaltet: new Set(["job_vormerken"]) });
    expect(darfJetzt(g, z, JETZT)).toEqual({ erlaubt: false, grund: "abgeschaltet" });
  });

  it("hält den Mindestabstand ein", () => {
    const z = zustand({ letzteNachricht: new Date(JETZT.getTime() - 2 * 60_000) });
    expect(darfJetzt(g, z, JETZT).grund).toBe("zu_frueh");
  });

  it("H — „zurückhaltend“ schweigt länger, ohne Rechte zu ändern", () => {
    const vorhin = new Date(JETZT.getTime() - 20 * 60_000);
    expect(darfJetzt(g, zustand({ letzteNachricht: vorhin }), JETZT).erlaubt).toBe(true);
    expect(
      darfJetzt(g, zustand({ letzteNachricht: vorhin, einstellung: "zurueckhaltend" }), JETZT).grund,
    ).toBe("zu_frueh");
    /* Die Einstellung ändert die Häufigkeit, nicht die Berechtigung. */
    expect(darfSelbstHandeln("job_vormerken")).toBe(true);
    expect(darfSelbstHandeln("bewerbung_senden")).toBe(false);
  });

  it("bringt dasselbe Thema nicht zweimal in einer Sitzung", () => {
    const z = zustand({ themenDerSitzung: new Set(["job_vormerken"]) });
    expect(darfJetzt(g, z, JETZT).grund).toBe("thema_schon_dran");
  });

  it("hört auf, wenn die Sitzung ihr Mass erreicht hat", () => {
    const z = zustand({ inSitzung: ZURUECKHALTUNG.ausgeglichen.jeSitzung });
    expect(darfJetzt(g, z, JETZT).grund).toBe("genug_fuer_diese_sitzung");
  });

  it("bietet einen abgelehnten Vorschlag sieben Tage nicht erneut an", () => {
    const gestern = new Date(JETZT.getTime() - 24 * 60 * 60 * 1000);
    const z = zustand({ abgelehnt: new Map([["job_vormerken", gestern]]) });
    expect(darfJetzt(g, z, JETZT).grund).toBe("kuerzlich_abgelehnt");

    const vorLangem = new Date(JETZT.getTime() - 30 * 24 * 60 * 60 * 1000);
    const z2 = zustand({ abgelehnt: new Map([["job_vormerken", vorLangem]]) });
    expect(darfJetzt(g, z2, JETZT).erlaubt).toBe(true);
  });

  it("lässt stilles Arbeiten von den Sprechpausen unberührt", () => {
    /*
     * Eine Handlung ohne Nachricht stört niemanden. Die Abstände
     * gelten dem Unterbrechen, nicht dem Arbeiten.
     */
    const still: Gelegenheit = { ...g, nachricht: null };
    const z = zustand({
      letzteNachricht: new Date(JETZT.getTime() - 60_000),
      inSitzung: 99,
      themenDerSitzung: new Set(["job_vormerken"]),
    });
    expect(darfJetzt(still, z, JETZT).erlaubt).toBe(true);
  });
});

describe("Freigabe — die letzte Prüfung", () => {
  it("J — eine Bewerbung kommt hier nie durch", () => {
    const g: Gelegenheit = {
      handlung: "bewerbung_senden" as never,
      begruendung: "sieht passend aus",
      jobId: JOB,
      belegEreignisse: [],
      brauchtZustimmung: false,
      dringlichkeit: "hoch",
      nachricht: "Ich habe mich für dich beworben.",
    };
    expect(freigeben(g, zustand(), JETZT)).toBeNull();
  });

  it("setzt die Zustimmungspflicht selbst, statt sie zu glauben", () => {
    /*
     * `brauchtZustimmung` ist genau das Feld, das ein Modell falsch
     * setzen kann. Es wird deshalb nicht geprüft, sondern ersetzt.
     */
    const gelogen: Gelegenheit = {
      handlung: "umkreis_erweitern",
      begruendung: "keine Treffer im Umkreis",
      jobId: null,
      belegEreignisse: [],
      brauchtZustimmung: false,
      dringlichkeit: "mittel",
      nachricht: "Ich habe den Radius auf 60 km erhöht.",
    };
    const f = freigeben(gelogen, zustand(), JETZT)!;
    expect(f.brauchtZustimmung).toBe(true);
  });

  it("gibt eine erlaubte Handlung mit ihrer Policy-Fassung frei", () => {
    const g = gelegenheitenAusSignalen([interessensignal()])[0]!;
    const f = freigeben(g, zustand(), JETZT)!;
    expect(f.handlung).toBe("job_vormerken");
    expect(f.brauchtZustimmung).toBe(false);
    expect(f.policyFassung).toBe("proaktiv-2");
    expect(f.belegEreignisse.length).toBeGreaterThan(0);
  });

  it("gibt eine unbekannte Handlung nicht frei", () => {
    const g: Gelegenheit = {
      handlung: "job_loeschen" as never,
      begruendung: "",
      jobId: JOB,
      belegEreignisse: [],
      brauchtZustimmung: false,
      dringlichkeit: "niedrig",
      nachricht: null,
    };
    expect(freigeben(g, zustand(), JETZT)).toBeNull();
  });
});


describe("C — Nina verstärkt sich nicht selbst", () => {
  it("zählt Ninas eigene Handlungen nicht als Interesse", () => {
    /*
     * Würde Ninas Vormerkung als Nutzerhandlung zählen, bestätigte
     * sie ihre eigene Vermutung — beim nächsten Lauf stärker, beim
     * übernächsten noch stärker. Am Ende stünde ein sehr starkes
     * Signal da, dessen Belege ausschliesslich Nina sind.
     */
    const s = interesseAusEreignissen(
      JOB,
      [
        ereignis("job_viewed", { urheber: "nina" }),
        ereignis("job_reopened", { urheber: "nina" }),
        ereignis("salary_opened", { urheber: "nina" }),
        ereignis("requirements_opened", { urheber: "nina" }),
      ],
      JETZT,
    );
    expect(s).toBeNull();
  });

  it("zählt auch Systemereignisse nicht", () => {
    const s = interesseAusEreignissen(
      JOB,
      [
        ereignis("job_viewed", { urheber: "system" }),
        ereignis("job_reopened", { urheber: "system" }),
        ereignis("salary_opened", { urheber: "system" }),
      ],
      JETZT,
    );
    expect(s).toBeNull();
  });

  it("lässt echte Handlungen neben Ninas gelten", () => {
    /* Die Vermischung darf die echten Hinweise nicht entwerten. */
    const s = interesseAusEreignissen(
      JOB,
      [
        ereignis("job_viewed", { urheber: "user" }),
        ereignis("job_reopened", { urheber: "user" }),
        ereignis("salary_opened", { urheber: "nina" }),
        ereignis("requirements_opened", { urheber: "nina" }),
        ereignis("job_compared", { urheber: "user" }),
      ],
      JETZT,
    );
    expect(s).not.toBeNull();
    /* Nur die beiden echten Hinweise tragen die Stärke. */
    expect(s!.belege).toHaveLength(3);
  });

  it("hält ein Muster aus Ninas Handlungen nicht für eine Tendenz", () => {
    const s = musterAusEreignissen(
      [
        ereignis("salary_opened", { jobId: "a", urheber: "nina" }),
        ereignis("salary_opened", { jobId: "b", urheber: "nina" }),
        ereignis("salary_opened", { jobId: "c", urheber: "nina" }),
      ],
      { remote: new Map() },
      JETZT,
    );
    expect(s).toHaveLength(0);
  });

  it("unterscheidet beim Entdoppeln nach Urheber", () => {
    /* Eine Handlung Ninas und eine der Person zur selben Minute sind
       zwei Ereignisse, kein Doppel. */
    const gleich = new Date("2026-09-06T11:30:00Z");
    const roh = [
      ereignis("job_viewed", { geschehenAm: gleich, urheber: "user" }),
      ereignis("job_viewed", { geschehenAm: gleich, urheber: "nina" }),
    ];
    expect(entdoppeln(roh)).toHaveLength(2);
  });
});
