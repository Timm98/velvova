import { describe, expect, it } from "vitest";
import { auswaehlen, leereLage, type Auswahlkandidat } from "./auswahl.ts";

function kandidat(teil: Partial<Auswahlkandidat> & { kanonischeJobId: string }): Auswahlkandidat {
  return {
    trefferId: `t-${teil.kanonischeJobId}`,
    jobId: teil.jobId ?? teil.kanonischeJobId,
    arbeitgeberId: teil.arbeitgeberId ?? `ag-${teil.kanonischeJobId}`,
    auftragId: teil.auftragId ?? "auftrag-1",
    fitScore: teil.fitScore ?? 80,
    materielleFassung: teil.materielleFassung ?? "v1",
    berechnetAm: teil.berechnetAm ?? new Date("2026-09-06T04:00:00Z"),
    grund: teil.grund ?? null,
    caveat: teil.caveat ?? null,
    ...teil,
  };
}

describe("Auswahl", () => {
  it("nimmt einen einzelnen guten Treffer, ohne aufzufüllen", () => {
    const e = auswaehlen([kandidat({ kanonischeJobId: "a" })], leereLage());
    expect(e.posten).toHaveLength(1);
  });

  it("hält die Obergrenze je Mail ein", () => {
    const viele = Array.from({ length: 9 }, (_, i) =>
      kandidat({ kanonischeJobId: `j${i}`, fitScore: 90 - i }),
    );
    const e = auswaehlen(viele, leereLage());
    expect(e.posten).toHaveLength(5);
    expect(e.verworfen.obergrenze_mail).toBe(4);
    /* Die besten zuerst — nicht die zuletzt eingefügten. */
    expect(e.posten[0]!.kanonischeJobId).toBe("j0");
  });

  it("nimmt höchstens zwei vom selben Arbeitgeber", () => {
    const gleiche = Array.from({ length: 4 }, (_, i) =>
      kandidat({ kanonischeJobId: `j${i}`, arbeitgeberId: "gross-ag", fitScore: 90 - i }),
    );
    const e = auswaehlen(gleiche, leereLage());
    expect(e.posten).toHaveLength(2);
    expect(e.verworfen.obergrenze_arbeitgeber).toBe(2);
  });

  it("entdoppelt dieselbe Stelle über zwei Portale", () => {
    const e = auswaehlen(
      [
        kandidat({ kanonischeJobId: "gleich", jobId: "portal-a", fitScore: 72 }),
        kandidat({ kanonischeJobId: "gleich", jobId: "portal-b", fitScore: 88 }),
      ],
      leereLage(),
    );
    expect(e.posten).toHaveLength(1);
    /* Die bessere Fassung überlebt, nicht die zuerst gefundene. */
    expect(e.posten[0]!.jobId).toBe("portal-b");
    expect(e.verworfen.dublette_portal).toBe(1);
  });

  it("meldet eine bereits gemeldete Stelle nicht erneut", () => {
    const lage = leereLage();
    lage.bereitsGemeldet.set("a", "v1");
    const e = auswaehlen([kandidat({ kanonischeJobId: "a", materielleFassung: "v1" })], lage);
    expect(e.posten).toHaveLength(0);
    expect(e.verworfen.bereits_gemeldet).toBe(1);
  });

  it("meldet eine materiell geänderte Stelle als Aktualisierung", () => {
    const lage = leereLage();
    lage.bereitsGemeldet.set("a", "v1");
    const e = auswaehlen([kandidat({ kanonischeJobId: "a", materielleFassung: "v2" })], lage);
    expect(e.posten).toHaveLength(1);
    expect(e.posten[0]!.art).toBe("aktualisierung");
  });

  it("verkauft eine gespeicherte Stelle nicht als Entdeckung", () => {
    const lage = leereLage();
    lage.gespeichert.add("a");
    const e = auswaehlen([kandidat({ kanonischeJobId: "a" })], lage);
    expect(e.posten).toHaveLength(0);
    expect(e.verworfen.bereits_bekannt).toBe(1);
  });

  it("lässt Abgelehntes, Beworbenes und Geschlossenes weg", () => {
    const lage = leereLage();
    lage.abgelehnt.add("a");
    lage.beworben.add("b");
    lage.geschlossen.add("c");
    const e = auswaehlen(
      [kandidat({ kanonischeJobId: "a" }), kandidat({ kanonischeJobId: "b" }), kandidat({ kanonischeJobId: "c" })],
      lage,
    );
    expect(e.posten).toHaveLength(0);
    expect(e.verworfen).toMatchObject({ abgelehnt: 1, bereits_beworben: 1, anzeige_geschlossen: 1 });
  });

  it("sortiert bei Gleichstand stabil", () => {
    const gleich = { fitScore: 80, berechnetAm: new Date("2026-09-06T04:00:00Z") };
    const a = auswaehlen(
      [kandidat({ kanonischeJobId: "zzz", ...gleich }), kandidat({ kanonischeJobId: "aaa", ...gleich })],
      leereLage(),
    );
    const b = auswaehlen(
      [kandidat({ kanonischeJobId: "aaa", ...gleich }), kandidat({ kanonischeJobId: "zzz", ...gleich })],
      leereLage(),
    );
    expect(a.posten.map((p) => p.kanonischeJobId)).toEqual(b.posten.map((p) => p.kanonischeJobId));
  });

  it("sortiert nicht nach Gehalt, sondern nach Fit", () => {
    const e = auswaehlen(
      [
        kandidat({ kanonischeJobId: "reich", fitScore: 62 }),
        kandidat({ kanonischeJobId: "passend", fitScore: 91 }),
      ],
      leereLage(),
    );
    expect(e.posten[0]!.kanonischeJobId).toBe("passend");
  });
});
