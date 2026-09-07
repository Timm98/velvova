import { describe, expect, it } from "vitest";
import {
  ANFANG,
  kannZurueck,
  MAX_TIEFE,
  naechster,
  sichtbar,
  type Panelzustand,
} from "./panelzustand";
import type { Aktion } from "./aktionen";

const A = "3f1a2b4c-5d6e-4f70-8a91-b2c3d4e5f607";
const B = "9e8d7c6b-5a49-4382-9170-6f5e4d3c2b1a";

const tun = (z: Panelzustand, aktion: Aktion) => naechster(z, { art: "aktion", aktion });
const zeige = (z: Panelzustand, ansicht: string) =>
  tun(z, { name: "show_panel", args: { ansicht } } as Aktion);

describe("Panelzustand", () => {
  it("beginnt auf der Übersicht", () => {
    expect(sichtbar(ANFANG)).toBe("uebersicht");
    expect(kannZurueck(ANFANG)).toBe(false);
  });

  it("öffnet eine Ansicht und bietet Zurück an", () => {
    const z = zeige(ANFANG, "gehalt");
    expect(sichtbar(z)).toBe("gehalt");
    expect(kannZurueck(z)).toBe(true);
  });

  it("führt Zurück zur vorigen Ansicht, nicht zum Anfang", () => {
    /*
     * Der Punkt des Stapels: Von „warum passt" nach „gehalt" und
     * zurück landet man bei „warum passt" — nicht bei der Übersicht.
     */
    const z = zeige(zeige(ANFANG, "warum_passt"), "gehalt");
    expect(sichtbar(naechster(z, { art: "zurueck" }))).toBe("warum_passt");
  });

  it("stapelt dieselbe Ansicht nicht zweimal", () => {
    // Sonst bräuchte Zurück zwei Klicks für einen sichtbaren Wechsel.
    const z = zeige(zeige(ANFANG, "gehalt"), "gehalt");
    expect(z.stapel.filter((s) => s === "gehalt")).toHaveLength(1);
  });

  it("tut auf der Übersicht bei Zurück nichts", () => {
    expect(naechster(ANFANG, { art: "zurueck" })).toBe(ANFANG);
  });

  it("begrenzt die Tiefe des Stapels", () => {
    let z = ANFANG;
    for (const a of ["gehalt", "unternehmen", "warum_passt", "aehnliche", "bewerbung", "vergleich", "gehalt"]) {
      z = zeige(z, a);
    }
    expect(z.stapel.length).toBeLessThanOrEqual(MAX_TIEFE);
  });

  it("hebt einen Abschnitt hervor, ohne die Ansicht zu wechseln", () => {
    /*
     * Der Abschnitt liegt in der Mitte, das Panel rechts. Wer
     * hinspringt, soll Mondays Begründung weiterhin sehen.
     */
    const z = tun(zeige(ANFANG, "warum_passt"), {
      name: "highlight_section",
      args: { abschnitt: "arbeitszeiten" },
    } as Aktion);
    expect(z.hervorgehoben).toBe("arbeitszeiten");
    expect(sichtbar(z)).toBe("warum_passt");
  });

  it("löscht die Hervorhebung beim Zurückgehen", () => {
    let z = zeige(ANFANG, "gehalt");
    z = tun(z, { name: "highlight_section", args: { abschnitt: "gehalt" } } as Aktion);
    expect(naechster(z, { art: "zurueck" }).hervorgehoben).toBeNull();
  });

  it("setzt beim Stellenwechsel auf die Übersicht zurück", () => {
    // Die geöffnete Gehaltsansicht gehörte zur vorigen Stelle.
    const z = zeige({ ...ANFANG, jobId: A }, "gehalt");
    const neu = naechster(z, { art: "stelle_gewechselt", jobId: B });
    expect(sichtbar(neu)).toBe("uebersicht");
    expect(neu.jobId).toBe(B);
  });

  it("rührt sich nicht, wenn dieselbe Stelle noch einmal kommt", () => {
    const z = zeige({ ...ANFANG, jobId: A }, "gehalt");
    expect(naechster(z, { art: "stelle_gewechselt", jobId: A })).toBe(z);
  });

  it("verwirft den Vergleich beim Stellenwechsel", () => {
    // Er bezog sich auf ein Paar, von dem eine Hälfte nicht mehr gilt.
    const z = tun(ANFANG, { name: "compare_jobs", args: { jobA: A, jobB: B } } as Aktion);
    expect(naechster(z, { art: "stelle_gewechselt", jobId: B }).vergleichJobId).toBeNull();
  });

  it("merkt sich beide Stellen des Vergleichs", () => {
    const z = tun(ANFANG, { name: "compare_jobs", args: { jobA: A, jobB: B } } as Aktion);
    expect([z.jobId, z.vergleichJobId]).toEqual([A, B]);
    expect(sichtbar(z)).toBe("vergleich");
  });

  it("lässt das Panel bei einer Serveraktion unverändert", () => {
    /*
     * Wer nach dem Merken die Ansicht wechselte, nähme der Person die
     * Stelle weg, die sie gerade gemerkt hat.
     */
    const z = zeige(ANFANG, "gehalt");
    expect(tun(z, { name: "save_job", args: { jobId: A } } as Aktion)).toBe(z);
  });

  it("beginnt bei open_job von vorn", () => {
    const z = zeige({ ...ANFANG, jobId: A }, "unternehmen");
    const neu = tun(z, { name: "open_job", args: { jobId: B } } as Aktion);
    expect(sichtbar(neu)).toBe("uebersicht");
    expect(neu.jobId).toBe(B);
  });
});

describe("Vorherige Stelle", () => {
  it("merkt sich die vorige Stelle beim Wechsel", () => {
    /*
     * Damit „ist der besser als der davor?" beantwortbar ist, ohne
     * dass jemand zwei Titel nennen muss.
     */
    const z = naechster({ ...ANFANG, jobId: A }, { art: "stelle_gewechselt", jobId: B });
    expect(z.vorherigeJobId).toBe(A);
    expect(z.jobId).toBe(B);
  });

  it("hat beim ersten Öffnen keine vorherige", () => {
    const z = naechster(ANFANG, { art: "stelle_gewechselt", jobId: A });
    expect(z.vorherigeJobId).toBeNull();
  });

  it("überschreibt die vorherige nicht bei derselben Stelle", () => {
    // Zweimal dieselbe Stelle anzuklicken darf den Vorgänger nicht
    // auf sie selbst setzen — dann verglicht man sie mit sich.
    let z = naechster({ ...ANFANG, jobId: A }, { art: "stelle_gewechselt", jobId: B });
    z = naechster(z, { art: "stelle_gewechselt", jobId: B });
    expect(z.vorherigeJobId).toBe(A);
  });

  it("merkt sie sich auch, wenn Monday die Stelle öffnet", () => {
    const z = tun({ ...ANFANG, jobId: A }, { name: "open_job", args: { jobId: B } } as Aktion);
    expect(z.vorherigeJobId).toBe(A);
  });
});
