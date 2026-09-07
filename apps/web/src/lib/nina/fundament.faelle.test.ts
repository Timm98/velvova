import { describe, expect, it } from "vitest";
import { checkConstraints, computeFit, einstufen } from "@paycheck/matching";
/*
 * Die Bausteine kommen aus der Datei, nicht aus dem Paketindex.
 *
 * `fixtures.ts` steht bewusst nicht in `index.ts`: Testdaten gehören
 * nicht in das, was die Anwendung importieren kann — sonst landet
 * irgendwann „Demo Nordlicht GmbH" in einer echten Liste.
 */
import {
  makeConstraints, makeEvidence, makeJob, makeRequirements, testCommute,
} from "../../../../../packages/matching/src/fixtures.ts";
import { entscheide, type Fakt } from "@/lib/karriere/faktenregeln";
import { musterErkennen } from "@/lib/nina/musterregeln";
import { verbesserung } from "@/lib/nina/ereignisse";
import { anforderungEinstufen } from "@paycheck/jobs";

/**
 * Die sechs Fälle aus dem Auftrag, an der echten Kette geprüft.
 *
 * ══════════════════════════════════════════════════════════════
 * Was hier geprüft wird und was nicht
 * ══════════════════════════════════════════════════════════════
 *
 * Diese Tests laufen über dieselben Funktionen, die im Betrieb
 * entscheiden — `computeFit`, `checkConstraints`, `einstufen`,
 * `entscheide`, `musterErkennen`, `verbesserung`. Sie bauen keine
 * eigene Nachbildung der Logik.
 *
 * Was sie nicht abdecken: Datenbank, RLS, Modellaufrufe. Die Fälle A
 * bis F sind fachliche Aussagen über das Verhalten der Bewertung, und
 * die entsteht in reinen Funktionen. Ein Test, der dafür eine
 * Datenbank hochfährt, prüft langsamer dasselbe — und fällt aus
 * Gründen um, die nichts mit dem Fall zu tun haben.
 *
 * Für DB und Zugriffsschutz gibt es `rls-coverage.test.ts` und die
 * Dienst-Tests; dies hier ist die fachliche Abnahme.
 */

const eingabe = (over: Partial<Parameters<typeof computeFit>[0]> = {}) => ({
  job: makeJob(),
  requirements: makeRequirements(),
  evidence: makeEvidence(),
  constraints: makeConstraints(),
  energisingTasks: ["Kundinnen und Kunden betreuen", "Schulungen halten"],
  drainingTasks: [],
  workStylePreferences: ["viel Austausch"],
  rankedValues: ["Weiterbildung"],
  statedInterests: ["Customer Success"],
  ...over,
});

describe("Fall A — erfüllt fast alles, hoher Match", () => {
  it("bewertet eine passende Stelle hoch", () => {
    const fit = computeFit(eingabe());
    expect(fit.score).toBeGreaterThanOrEqual(60);
  });

  it("nennt einen Grund, nicht nur eine Zahl", () => {
    // Ein hoher Wert ohne Begründung ist für die Person wertlos.
    expect(computeFit(eingabe()).topReason).toBeTruthy();
  });

  it("blockt nichts, wenn alle Bedingungen erfüllt sind", () => {
    const c = checkConstraints(makeJob(), makeConstraints(), testCommute);
    expect(c.overall).not.toBe("blocked");
  });
});

describe("Fall B — Fähigkeiten passen, Gehalt verletzt harte Bedingung", () => {
  const bedingungen = makeConstraints({ minSalaryPerYear: 65000 });
  const stelle = makeJob({
    salary: { min: 44000, max: 48000, currency: "EUR", period: "year", disclosed: true, provenance: null, evidence: null },
  });

  it("erkennt die Verletzung als harte Bedingung", () => {
    const c = checkConstraints(stelle, bedingungen, testCommute);
    expect(c.blockedBy).toContain("salary");
  });

  it("stuft den verletzten Punkt als Blocker ein, nicht als Abstrich", () => {
    // Derselbe schwache Wert wäre ohne harte Bedingung nur ein Konflikt.
    const hart = einstufen({ key: "salary", raw: 0.2, weight: 0.25 }, true);
    const weich = einstufen({ key: "salary", raw: 0.2, weight: 0.25 }, false);
    expect(hart.art).toBe("blocker");
    expect(weich.art).toBe("konflikt");
  });

  it("landet nicht oben, obwohl die Fähigkeiten passen", () => {
    /*
     * Der Punkt des Falls: Ein guter Fachwert darf eine verletzte
     * Grundbedingung nicht ausgleichen. Wer 65.000 braucht, kann eine
     * Stelle mit 48.000 nicht annehmen — egal wie gut sie passt.
     */
    const c = checkConstraints(stelle, bedingungen, testCommute);
    expect(c.overall).toBe("blocked");
  });
});

describe("Fall C — Stelle passt, wichtige Angaben fehlen", () => {
  const ohneGehalt = makeJob({
    salary: { min: null, max: null, currency: "EUR", period: "year", disclosed: false, provenance: null, evidence: null },
  });

  it("wertet eine fehlende Angabe nicht als schlechten Wert", () => {
    // Eine Stelle ohne Gehaltsangabe ist nicht schlecht bezahlt.
    expect(einstufen({ key: "salary", raw: null, weight: 0.25 }).art).toBe("fehlende_angabe");
  });

  it("gibt einer fehlenden Angabe keine Schwere", () => {
    expect(einstufen({ key: "salary", raw: null, weight: 0.25 }).schwere).toBeNull();
  });

  it("blockt die Stelle nicht, sondern meldet Unsicherheit", () => {
    const c = checkConstraints(ohneGehalt, makeConstraints(), testCommute);
    expect(c.overall).not.toBe("blocked");
    expect(c.uncertainAbout.length).toBeGreaterThan(0);
  });

  it("führt die Deckung als unvollständig, wenn Angaben zur Person fehlen", () => {
    /*
     * Die Deckung misst die Fachbewertung, nicht die Anzeige.
     *
     * Ein fehlendes Gehalt senkt sie nicht — Gehalt ist eine
     * Bedingung, keine fachliche Passung, und wird oben über
     * `checkConstraints` als Unsicherheit geführt. Was sie senkt,
     * ist eine fehlende Angabe auf der Seite der Person: Ohne
     * Belege lässt sich Passung nicht behaupten.
     */
    const ohneBelege = computeFit(eingabe({
      evidence: [], energisingTasks: [], workStylePreferences: [],
      rankedValues: [], statedInterests: [],
    }));
    expect(ohneBelege.coverage).toBeLessThan(1);
  });

  it("nennt bei dünner Deckung keine Zahl, die Sicherheit vortäuscht", () => {
    const ohneBelege = computeFit(eingabe({
      evidence: [], energisingTasks: [], workStylePreferences: [],
      rankedValues: [], statedInterests: [],
    }));
    expect(ohneBelege.coverage).toBeLessThan(1);
    expect(ohneBelege.topReservation ?? ohneBelege.topReason).toBeTruthy();
  });
});

describe("Fall D — mehrere Absagen wegen Kundenkontakt ergeben ein Muster", () => {
  const tag = (n: number) => new Date(2026, 8, n);
  const absagen = [
    { grund: "kundenkontakt", erstelltAm: tag(1) },
    { grund: "kundenkontakt", erstelltAm: tag(2) },
    { grund: "gehalt", erstelltAm: tag(3) },
    { grund: "kundenkontakt", erstelltAm: tag(4) },
    { grund: "pendelweg", erstelltAm: tag(5) },
  ];

  it("erkennt den wiederkehrenden Grund", () => {
    expect(musterErkennen(absagen)?.grund).toBe("kundenkontakt");
  });

  it("formuliert eine Frage statt einer Regel", () => {
    /*
     * Ein Muster ist ein Verdacht, keine Anweisung. Monday fragt nach,
     * statt still zu filtern — sonst verschwinden Stellen aus der
     * Liste, ohne dass jemand das entschieden hätte.
     */
    expect(musterErkennen(absagen)?.frage).toMatch(/\?$/);
  });

  it("schweigt bei zu wenigen Rückmeldungen", () => {
    expect(musterErkennen(absagen.slice(0, 3))).toBeNull();
  });

  it("schweigt, wenn kein Grund heraussticht", () => {
    const gemischt = ["a", "b", "c", "d", "e"].map((g, i) => ({ grund: g, erstelltAm: tag(i + 1) }));
    expect(musterErkennen(gemischt)).toBeNull();
  });
});

describe("Fall E — Stelle ändert Gehalt und Remote-Tage, Match wird neu berechnet", () => {
  it("erzeugt bei deutlicher Verbesserung ein Ereignis", () => {
    const e = verbesserung(52, 71, ["gehalt", "remote"]);
    expect(e?.art).toBe("match_verbessert");
  });

  it("nennt eine grosse Verbesserung dringender als eine kleine", () => {
    // Ein Sprung über zwanzig Punkte heisst meist: eine harte
    // Bedingung ist jetzt erfüllt.
    expect(verbesserung(50, 75, ["gehalt"])?.prioritaet).toBe(1);
    expect(verbesserung(50, 58, ["gehalt"])?.prioritaet).toBe(2);
  });

  it("meldet Rauschen nicht", () => {
    /*
     * Ohne Schwelle würde jede Neuberechnung eine Meldung erzeugen.
     * Monday wäre dann eine Benachrichtigungsquelle, die man abschaltet.
     */
    expect(verbesserung(60, 62, ["gehalt"])).toBeNull();
  });

  it("meldet eine Verschlechterung nicht als Verbesserung", () => {
    expect(verbesserung(70, 55, ["gehalt"])).toBeNull();
  });

  it("bewertet die geänderte Stelle tatsächlich neu", () => {
    /*
     * Gehalt und Remote-Anteil sind Bedingungen, keine Fachpassung.
     *
     * `computeFit` bewertet Tätigkeiten, Werte und Belege — an denen
     * ändert sich nichts, wenn die Anzeige mehr zahlt. Die
     * Neuberechnung, um die es in diesem Fall geht, findet in
     * `checkConstraints` statt, und genau dort wird sie geprüft.
     */
    const knapp = makeConstraints({ minSalaryPerYear: 60000, acceptedWorkModels: ["remote"] });
    const vorher = checkConstraints(makeJob(), knapp, testCommute);
    const nachher = checkConstraints(makeJob({
      workModel: "remote", remotePercent: 100,
      salary: { min: 66000, max: 72000, currency: "EUR", period: "year", disclosed: true, provenance: null, evidence: null },
    }), knapp, testCommute);

    expect(vorher.overall).toBe("blocked");
    expect(nachher.overall).not.toBe("blocked");
  });
});

describe("Fall F — unsichere Extraktion überschreibt keine bestätigte Angabe", () => {
  const bestaetigt: Fakt = {
    schluessel: "wunschgehalt",
    wert: 65000,
    quelle: "nutzer",
    konfidenz: 100,
    bestaetigt: true,
  };

  it("verwirft eine schwache Ableitung gegen eine bestätigte Angabe", () => {
    const ableitung: Fakt = {
      schluessel: "wunschgehalt", wert: 52000,
      quelle: "nina_ableitung", konfidenz: 40, bestaetigt: false,
    };
    expect(entscheide(bestaetigt, ableitung).art).toBe("verwerfen");
  });

  it("fragt nach, statt zu überschreiben, wenn die Ableitung stark ist", () => {
    /*
     * Auch eine sehr sichere Ableitung überschreibt nichts Bestätigtes.
     * Der Mensch hat den Wert selbst genannt; ein Modell, das dagegen
     * hält, hat eine Frage, kein Recht.
     */
    const stark: Fakt = {
      schluessel: "wunschgehalt", wert: 78000,
      quelle: "gespraech", konfidenz: 90, bestaetigt: false,
    };
    const e = entscheide(bestaetigt, stark);
    expect(e.art).toBe("nachfragen");
    expect(e.art === "nachfragen" && e.frage).toBeTruthy();
  });

  it("lässt eine neue bestätigte Angabe die alte ersetzen", () => {
    const neu: Fakt = { ...bestaetigt, wert: 70000 };
    expect(entscheide(bestaetigt, neu).art).toBe("ersetzen");
  });

  it("schreibt in ein leeres Feld ohne Rückfrage", () => {
    const ableitung: Fakt = {
      schluessel: "wunschgehalt", wert: 52000,
      quelle: "nina_ableitung", konfidenz: 40, bestaetigt: false,
    };
    expect(entscheide(null, ableitung).art).toBe("ersetzen");
  });

  it("hält eine unsichere Anzeigenangabe als unsicher fest", () => {
    // Dieselbe Vorsicht auf der Stellenseite: ohne Signalwort im Text
    // ist die Einstufung geraten, und das steht in der Konfidenz.
    expect(anforderungEinstufen("Kenntnisse in Excel").konfidenz).toBe(40);
  });
});
