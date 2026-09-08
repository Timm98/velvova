import { describe, expect, it } from "vitest";
import {
  BESTAETIGUNGEN,
  LEERER_STAND,
  fortschreiben,
  giltAlsAktiv,
  linkpruefungEinarbeiten,
  standAusFundstellen,
  verfuegbarkeitstext,
  type Verfuegbarkeitsstand,
} from "./verfuegbarkeit.ts";

const T = (s: string) => new Date(s);
const MO = T("2026-09-08T02:00:00Z");
const DI = T("2026-09-09T02:00:00Z");
const MI = T("2026-09-10T02:00:00Z");

const aktiv: Verfuegbarkeitsstand = {
  zustand: "active",
  grund: null,
  fehltSeitLaeufen: 0,
  geprueftAm: MO,
  zuletztGesehenAm: MO,
};

describe("ein unvollständiger Lauf schliesst nichts", () => {
  it("lässt den Stand bei einem Fehler unverändert", () => {
    /*
     * Die wichtigste Eigenschaft dieser Datei. Ohne sie schliesst ein
     * fünfminütiger Ausfall eines ATS tausende Stellen auf einmal —
     * und das ist kein hypothetisches Risiko, sondern der Normalfall
     * bei jeder Störung.
     */
    const danach = fortschreiben(aktiv, { gesehen: false, feedVollstaendig: false, jetzt: DI });
    expect(danach).toEqual(aktiv);
  });

  it("setzt dabei auch keinen Prüfzeitpunkt", () => {
    /* Es gab keine Prüfung. Ein Zeitstempel liesse den Stand frischer
       aussehen, als er ist. */
    const danach = fortschreiben(aktiv, { gesehen: false, feedVollstaendig: false, jetzt: DI });
    expect(danach.geprueftAm).toEqual(MO);
  });

  it("zählt ein Fehlen im Teilabruf nicht mit", () => {
    let s = aktiv;
    for (let i = 0; i < 10; i++) {
      s = fortschreiben(s, { gesehen: false, feedVollstaendig: false, jetzt: DI });
    }
    expect(s.fehltSeitLaeufen).toBe(0);
    expect(s.zustand).toBe("active");
  });

  it("nimmt ein Gesehenwerden trotzdem an", () => {
    /* Gesehen ist gesehen — auch aus einem halben Abruf. */
    const danach = fortschreiben(aktiv, { gesehen: true, feedVollstaendig: false, jetzt: DI });
    expect(danach.zuletztGesehenAm).toEqual(DI);
  });
});

describe("verschwinden braucht eine Bestätigung", () => {
  it("wartet beim ersten Fehlen ab", () => {
    const danach = fortschreiben(aktiv, { gesehen: false, feedVollstaendig: true, jetzt: DI });
    expect(danach.zustand).toBe("verification_pending");
    expect(danach.fehltSeitLaeufen).toBe(1);
    /* Noch aktiv genug für die Liste — es ist eine Vermutung. */
    expect(giltAlsAktiv(danach.zustand)).toBe(true);
  });

  it("urteilt beim zweiten Fehlen", () => {
    const eins = fortschreiben(aktiv, { gesehen: false, feedVollstaendig: true, jetzt: DI });
    const zwei = fortschreiben(eins, { gesehen: false, feedVollstaendig: true, jetzt: MI });
    expect(zwei.zustand).toBe("no_longer_published");
    expect(zwei.fehltSeitLaeufen).toBe(BESTAETIGUNGEN);
    expect(giltAlsAktiv(zwei.zustand)).toBe(false);
  });

  it("setzt den Zähler zurück, wenn die Stelle wiederkommt", () => {
    const eins = fortschreiben(aktiv, { gesehen: false, feedVollstaendig: true, jetzt: DI });
    const zurueck = fortschreiben(eins, { gesehen: true, feedVollstaendig: true, jetzt: MI });
    expect(zurueck.zustand).toBe("active");
    expect(zurueck.fehltSeitLaeufen).toBe(0);
  });

  it("behält das letzte Gesehen-Datum, wenn die Stelle fehlt", () => {
    /* „Zuletzt aktiv gesehen: 8. September" — das ist die Angabe, die
       einen Menschen interessiert. */
    const eins = fortschreiben(aktiv, { gesehen: false, feedVollstaendig: true, jetzt: DI });
    expect(eins.zuletztGesehenAm).toEqual(MO);
  });
});

describe("was die Quelle selbst sagt, steht über allem", () => {
  it("schliesst sofort, ohne Bestätigungslauf", () => {
    const danach = fortschreiben(aktiv, {
      gesehen: false,
      feedVollstaendig: false,
      quelleSagtBeendet: true,
      jetzt: DI,
    });
    expect(danach.zustand).toBe("source_reported_closed");
  });

  it("gilt auch bei unvollständigem Lauf", () => {
    /* `toUnpost` ist die Auskunft des Arbeitgebers, kein Rückschluss
       aus einem Feed — dafür braucht es keinen vollständigen Abruf. */
    const danach = fortschreiben(LEERER_STAND, {
      gesehen: true,
      feedVollstaendig: false,
      quelleSagtBeendet: true,
      jetzt: DI,
    });
    expect(danach.zustand).toBe("source_reported_closed");
  });
});

describe("eine abgelaufene Frist ist nicht „besetzt“", () => {
  it("erkennt sie, solange die Stelle im Feed steht", () => {
    const danach = fortschreiben(aktiv, {
      gesehen: true,
      feedVollstaendig: true,
      fristBis: T("2026-09-01T00:00:00Z"),
      jetzt: DI,
    });
    expect(danach.zustand).toBe("deadline_expired");
    expect(danach.grund).toMatch(/Ob die Stelle besetzt ist, sagt die Quelle nicht/);
  });

  it("stört sich nicht an einer Frist in der Zukunft", () => {
    const danach = fortschreiben(aktiv, {
      gesehen: true,
      feedVollstaendig: true,
      fristBis: T("2026-12-01T00:00:00Z"),
      jetzt: DI,
    });
    expect(danach.zustand).toBe("active");
  });
});

describe("die Linkprüfung ist Ergänzung, nicht Urteil", () => {
  it("ändert bei 403, 429 oder Zeitablauf nichts", () => {
    /* Dahinter steht meistens ein Botschutz — und der weiss nichts
       über Ausschreibungen. */
    expect(linkpruefungEinarbeiten(aktiv, "unklar", DI)).toEqual(aktiv);
  });

  it("merkt einen dauerhaften 404 an", () => {
    const danach = linkpruefungEinarbeiten(aktiv, "weg", DI);
    expect(danach.zustand).toBe("application_unavailable");
    expect(danach.grund).toMatch(/nicht gesagt/);
  });

  it("überstimmt kein ausdrückliches Quellsignal", () => {
    const zu = fortschreiben(aktiv, { gesehen: false, feedVollstaendig: true, quelleSagtBeendet: true, jetzt: DI });
    expect(linkpruefungEinarbeiten(zu, "weg", MI).zustand).toBe("source_reported_closed");
  });

  it("nimmt die Aussage zurück, wenn die Seite wieder antwortet", () => {
    const weg = linkpruefungEinarbeiten(aktiv, "weg", DI);
    expect(linkpruefungEinarbeiten(weg, "ok", MI).zustand).toBe("active");
  });
});

describe("die nähere Quelle entscheidet", () => {
  const ats = (z: Verfuegbarkeitsstand["zustand"]) => ({ naehe: 0, stand: { ...aktiv, zustand: z } });
  const agg = (z: Verfuegbarkeitsstand["zustand"]) => ({ naehe: 50, stand: { ...aktiv, zustand: z } });

  it("hält die Stelle aktiv, wenn nur der Aggregator sie verliert", () => {
    /* Der Aggregator hat womöglich nur seinen Feed geändert. */
    expect(standAusFundstellen([ats("active"), agg("no_longer_published")]).zustand).toBe("active");
  });

  it("folgt dem ATS, wenn der Aggregator eine alte Kopie behält", () => {
    expect(standAusFundstellen([ats("no_longer_published"), agg("active")]).zustand).toBe(
      "no_longer_published",
    );
  });

  it("nimmt bei gleichem Rang die aktivste Aussage", () => {
    /*
     * Eine zu viel gezeigte Stelle ärgert; eine zu wenig gezeigte
     * fehlt. Bei Gleichstand ist die teurere Verwechslung das
     * Stilllegen.
     */
    expect(standAusFundstellen([agg("no_longer_published"), agg("active")]).zustand).toBe("active");
  });

  it("gibt ohne Fundstelle den leeren Stand zurück", () => {
    expect(standAusFundstellen([])).toEqual(LEERER_STAND);
  });
});

describe("die Sätze für die Oberfläche", () => {
  it("sagt nie „besetzt“", () => {
    for (const z of [
      "active", "deadline_expired", "no_longer_published",
      "source_reported_closed", "application_unavailable",
      "verification_pending", "unknown",
    ] as const) {
      const text = verfuegbarkeitstext({ ...aktiv, zustand: z });
      expect(text.toLowerCase()).not.toContain("besetzt");
      expect(text.length).toBeGreaterThan(10);
    }
  });

  it("unterscheidet die drei Formulierungen", () => {
    expect(verfuegbarkeitstext({ ...aktiv, zustand: "active" })).toBe("Laut Quelle aktiv.");
    expect(verfuegbarkeitstext({ ...aktiv, zustand: "deadline_expired" })).toMatch(/Ausschreibungsfrist laut Quelle abgelaufen/);
    expect(verfuegbarkeitstext({ ...aktiv, zustand: "no_longer_published" })).toMatch(/nicht mehr veröffentlicht/);
  });

  it("nennt, wann die Stelle zuletzt aktiv war", () => {
    expect(verfuegbarkeitstext({ ...aktiv, zustand: "no_longer_published" })).toMatch(
      /Zuletzt aktiv gesehen: 8\. September/,
    );
  });
});
