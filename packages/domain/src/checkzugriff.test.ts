import { describe, expect, it } from "vitest";
import {
  type Checkbesitz,
  spaeteAntwortAnnehmen,
  uebernehmen,
  zugriff,
} from "./checkzugriff.ts";

const meiner: Checkbesitz = {
  checkId: "check-1",
  eigentuemer: { art: "person", id: "person-a" },
  erstelltAm: new Date("2026-09-07T10:00:00Z"),
  geloeschtAm: null,
};
const gastcheck: Checkbesitz = {
  checkId: "check-2",
  eigentuemer: { art: "gast", sitzung: "sitzung-1" },
  erstelltAm: new Date("2026-09-07T10:00:00Z"),
  geloeschtAm: null,
};

describe("Zugriff auf einen Check", () => {
  it("lässt den Eigentümer durch", () => {
    expect(zugriff(meiner, { art: "person", id: "person-a" }).erlaubt).toBe(true);
  });

  it("hält eine fremde Person heraus", () => {
    /*
     * „Eine schwer erratbare ID ersetzt keine Zugriffsprüfung." Die ID
     * steht im Verlauf, in der Zwischenablage und in jedem
     * weitergeleiteten Link — sie ist ein Name, kein Schloss.
     */
    const u = zugriff(meiner, { art: "person", id: "person-b" });
    expect(u.erlaubt).toBe(false);
    expect(u.grund).toBe("fremder_check");
  });

  it("verrät bei einem fremden Check nicht, dass es ihn gibt", () => {
    const fremd = zugriff(meiner, { art: "person", id: "person-b" });
    const geloescht = zugriff(
      { ...meiner, geloeschtAm: new Date() },
      { art: "person", id: "person-b" },
    );
    /* Beide Antworten müssen gleich aussehen. Wer erfährt, dass es
       diesen Check gibt, weiss schon etwas über eine fremde Person. */
    expect(geloescht.satz).toBe(fremd.satz);
    expect(geloescht.grund).toBe("fremder_check");
  });

  it("behandelt einen Gast-Check als jemandes Check", () => {
    /* „Niemand angemeldet" heisst nicht „für alle". */
    expect(zugriff(gastcheck, { art: "gast", sitzung: "sitzung-1" }).erlaubt).toBe(true);
    expect(zugriff(gastcheck, { art: "gast", sitzung: "sitzung-2" }).erlaubt).toBe(false);
  });

  it("verwechselt Person und Gastsitzung nicht", () => {
    expect(zugriff(gastcheck, { art: "person", id: "sitzung-1" }).erlaubt).toBe(false);
  });
});

describe("Späte Antworten nach dem Löschen", () => {
  const geloescht: Checkbesitz = { ...meiner, geloeschtAm: new Date("2026-09-07T10:00:30Z") };

  it("schreibt nicht in einen Check, der währenddessen gelöscht wurde", () => {
    /*
     * Zwischen Auftrag und Antwort liegen Sekunden bis Minuten. Ohne
     * diese Prüfung ist „gelöscht" eine Aussage über die Vergangenheit
     * statt über den Bestand.
     */
    const r = spaeteAntwortAnnehmen(geloescht, new Date("2026-09-07T10:00:10Z"));
    expect(r.annehmen).toBe(false);
    expect(r.grund).toContain("während diese Antwort berechnet wurde");
  });

  it("schreibt auch nicht, wenn schon vor dem Start gelöscht war", () => {
    const r = spaeteAntwortAnnehmen(geloescht, new Date("2026-09-07T10:01:00Z"));
    expect(r.annehmen).toBe(false);
    expect(r.grund).toContain("bereits gelöscht");
  });

  it("nimmt eine Antwort für einen bestehenden Check an", () => {
    expect(spaeteAntwortAnnehmen(meiner, new Date("2026-09-07T10:00:10Z")).annehmen).toBe(true);
  });
});

describe("Gast-Check übernehmen", () => {
  it("übernimmt nur die eigene Sitzung", () => {
    const gut = uebernehmen(gastcheck, "sitzung-1", "person-a");
    expect(gut.uebernommen).toBe(true);
    expect(gut.besitz.eigentuemer).toEqual({ art: "person", id: "person-a" });

    const fremd = uebernehmen(gastcheck, "sitzung-2", "person-a");
    expect(fremd.uebernommen).toBe(false);
  });

  it("holt einen gelöschten Check nicht zurück", () => {
    /* Sonst käme er über den Umweg der Anmeldung wieder. */
    const r = uebernehmen({ ...gastcheck, geloeschtAm: new Date() }, "sitzung-1", "person-a");
    expect(r.uebernommen).toBe(false);
  });

  it("sammelt bei der Anmeldung keine Konto-Checks ein", () => {
    expect(uebernehmen(meiner, "sitzung-1", "person-b").uebernommen).toBe(false);
  });
});
