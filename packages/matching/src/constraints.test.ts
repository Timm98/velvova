import { describe, expect, it } from "vitest";
import { checkConstraints } from "./constraints.ts";
import { makeConstraints, makeJob } from "./fixtures.ts";

describe("Nur gesetzte Bedingungen werden geprüft", () => {
  /**
   * Die Regel, an der die Trennung „geprüft / offen / verletzt" hängt.
   *
   * `overall` wird „uncertain", sobald EINE Prüfung es ist. Solange
   * Reiseanteil, Vertragsart und Wochenstunden auch dann eine Zeile
   * erzeugten, wenn die Person dazu nichts gesagt hatte, war praktisch
   * jede Stelle „uncertain" — aus Gründen, die mit ihren Bedingungen
   * nichts zu tun hatten.
   *
   * Gemessen im Browser: 243 von 243 Stellen landeten im Abschnitt
   * „hier ist etwas offen". Ein Hinweis, der für alles gilt, ist keiner.
   */
  const leer = makeConstraints({
    minSalaryPerYear: null,
    maxCommuteMinutes: null,
    maxTravelPercent: null,
    acceptedContractTypes: [],
    weeklyHoursMin: null,
    weeklyHoursMax: null,
    acceptsShiftWork: true,
    hardNoGos: [],
    acceptedWorkModels: ["on_site", "hybrid", "remote"],
  });

  it("erzeugt keine Zeile für eine Bedingung, die nicht gesetzt ist", () => {
    const job = makeJob({ travelPercent: null, contractType: null, weeklyHours: null });
    const r = checkConstraints(job, leer);
    for (const key of ["travel", "contract", "hours", "salary"]) {
      expect(r.checks.find((c) => c.key === key), key).toBeUndefined();
    }
  });

  it("nennt eine Stelle ohne eigene Bedingungen nicht „unsicher“", () => {
    /*
     * Der Kern. Wer nichts festgelegt hat, hat nichts Offenes — und
     * seine Trefferliste darf nicht komplett in den Klärungsabschnitt
     * rutschen.
     */
    const job = makeJob({ travelPercent: null, contractType: null, weeklyHours: null, shiftWork: null });
    expect(checkConstraints(job, leer).overall).not.toBe("uncertain");
  });

  it("prüft weiterhin, sobald eine Bedingung gesetzt ist", () => {
    const mit = makeConstraints({ ...leer, maxTravelPercent: 20 });
    const r = checkConstraints(makeJob({ travelPercent: null }), mit);
    const zeile = r.checks.find((c) => c.key === "travel");
    expect(zeile?.verdict).toBe("uncertain");
    expect(zeile?.reason).toMatch(/nennt keinen Reiseanteil/);
  });

  it("meldet eine Verletzung unverändert", () => {
    const mit = makeConstraints({ ...leer, maxTravelPercent: 20 });
    const r = checkConstraints(makeJob({ travelPercent: 60 }), mit);
    expect(r.checks.find((c) => c.key === "travel")?.verdict).toBe("blocked");
    expect(r.overall).toBe("blocked");
  });

  it("gibt für ein fehlendes Gehalt keinen grünen Haken", () => {
    // „eligible — Du hast keine Untergrenze festgelegt" las sich neben
    // echten Prüfungen wie „Gehalt passt".
    const r = checkConstraints(makeJob({ salary: { min: null, max: null, currency: "EUR", period: "year", disclosed: false, provenance: null, evidence: null } }), leer);
    expect(r.checks.find((c) => c.key === "salary")).toBeUndefined();
  });
});

describe("Ein neu angemeldeter Mensch", () => {
  /**
   * Der Fall, den keine der bisherigen Prüfungen abdeckte.
   *
   * `makeConstraints` hinterlegt Sprachen und ein Land — ein echter
   * neuer Zugang hat weder das eine noch das andere. Und weil fast
   * keine Anzeige etwas zur Arbeitserlaubnis sagt, war für ihn JEDE
   * Stelle „uncertain". Im Browser gemessen: 10 von 10 Stellen im
   * Abschnitt „hier ist etwas offen", bei jemandem, der noch keine
   * einzige Bedingung genannt hatte.
   */
  const neu = makeConstraints({
    minSalaryPerYear: null,
    baseLocation: null,
    maxCommuteMinutes: null,
    maxTravelPercent: null,
    acceptedContractTypes: [],
    weeklyHoursMin: null,
    weeklyHoursMax: null,
    acceptsShiftWork: true,
    hardNoGos: [],
    acceptedWorkModels: ["on_site", "hybrid", "remote"],
    earliestStartDate: null,
    workPermitCountries: [],
    languages: {},
  });

  it("sieht eine gewöhnliche Anzeige als geeignet an", () => {
    const job = makeJob({
      workPermitRequired: null,
      languageRequirements: {},
      travelPercent: null,
      contractType: null,
      weeklyHours: null,
      shiftWork: null,
    });
    expect(checkConstraints(job, neu).overall).toBe("eligible");
  });

  it("erzeugt für ihn gar keine offenen Punkte", () => {
    const job = makeJob({ workPermitRequired: null, languageRequirements: {} });
    expect(checkConstraints(job, neu).uncertainAbout).toHaveLength(0);
  });

  it("prüft die Arbeitserlaubnis, sobald ein Land hinterlegt ist", () => {
    const mit = makeConstraints({ ...neu, workPermitCountries: ["DE"] });
    const r = checkConstraints(makeJob({ workPermitRequired: null }), mit);
    expect(r.checks.find((c) => c.key === "work_permit")?.verdict).toBe("uncertain");
  });

  it("sperrt weiterhin, wo eine Anzeige eine Sprache fordert, die nicht belegt ist", () => {
    const r = checkConstraints(makeJob({ languageRequirements: { fr: "C1" } }), neu);
    expect(r.checks.find((c) => c.key === "language")?.verdict).toBe("blocked");
  });
});

describe("Gehalt aus dem Anzeigentext", () => {
  /**
   * Eine gelesene Zahl darf informieren, nicht entscheiden.
   *
   * Sie steht in der Anzeige, aber nicht in einem Feld, das der
   * Arbeitgeber ausgefüllt hat — sie kann sich auf ein Projektbudget
   * oder einen Umsatz beziehen. Eine Stelle deswegen auszublenden wäre
   * der teurere Fehler: ausgeblendete Stellen fallen niemandem auf.
   */
  const mitGrenze = makeConstraints({ minSalaryPerYear: 50000 });

  const ausText = (min: number) =>
    makeJob({
      salary: {
        min,
        max: null,
        currency: "EUR",
        period: "year",
        disclosed: false,
        provenance: "text",
        evidence: "Das Jahresgehalt beträgt …",
      },
    });

  it("sperrt nicht, obwohl der gelesene Betrag unter der Grenze liegt", () => {
    const r = checkConstraints(ausText(38000), mitGrenze);
    expect(r.checks.find((c) => c.key === "salary")?.verdict).toBe("uncertain");
    expect(r.overall).not.toBe("blocked");
  });

  it("gibt auch bei einem Betrag ÜBER der Grenze kein „erfüllt“", () => {
    // Die andere Richtung, und genauso wichtig: eine gelesene Zahl
    // belegt nichts. Ein grüner Haken darauf wäre eine Behauptung.
    const r = checkConstraints(ausText(70000), mitGrenze);
    expect(r.checks.find((c) => c.key === "salary")?.verdict).toBe("uncertain");
  });

  it("sagt dazu, dass die Zahl aus dem Text stammt", () => {
    const zeile = checkConstraints(ausText(60000), mitGrenze).checks.find((c) => c.key === "salary");
    expect(zeile?.reason).toMatch(/aus dem Text gelesen/i);
    expect(zeile?.jobValue).toMatch(/aus dem Text/i);
  });

  it("sperrt weiterhin bei einer bestätigten Angabe unter der Grenze", () => {
    /*
     * Die Gegenprobe. Ohne sie wäre die Lockerung oben eine stille
     * Abschaffung der Gehaltsbedingung.
     */
    const bestaetigt = makeJob({
      salary: { min: 30000, max: 38000, currency: "EUR", period: "year", disclosed: true, provenance: "provider", evidence: null },
    });
    expect(checkConstraints(bestaetigt, mitGrenze).overall).toBe("blocked");
  });
});
