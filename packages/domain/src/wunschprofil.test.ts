import { describe, expect, it } from "vitest";
import {
  MAX_RUECKFRAGEN,
  PFLICHTFELDER,
  RUECKFRAGE,
  anforderungenPruefen,
  lagePruefen,
  unterMarkt,
  verbindlichkeitshinweis,
  type Entwurf,
} from "./wunschprofil.ts";

const E = (teil: Partial<Entwurf> = {}): Entwurf => ({
  rolle: "Elektriker",
  anforderungen: [],
  gehaltVon: 4000,
  gehaltBis: 4600,
  arbeitszeit: "vollzeit",
  ort: "Musterstadt",
  befristung: "unbefristet",
  gueltigTage: 60,
  ...teil,
});

describe("anforderungenPruefen", () => {
  it("streicht den Satz, der in jedem echten Gespräch fällt", () => {
    /*
     * „…aber bitte keinen, der ständig krank ist, und nicht über
     * fünfzig." Ehrlich gemeint, und nach § 1 AGG unzulässig.
     */
    const { bleiben, gestrichen } = anforderungenPruefen([
      "Erfahrung mit Wärmepumpen",
      "nicht über 50 Jahre",
      "niemand der ständig krank ist",
    ]);
    expect(bleiben).toEqual(["Erfahrung mit Wärmepumpen"]);
    expect(gestrichen).toHaveLength(2);
  });

  it("nennt bei jeder Streichung das Merkmal und das Gesetz", () => {
    const { gestrichen } = anforderungenPruefen(["möglichst jung"]);
    expect(gestrichen[0]!.grund).toContain("Alter");
    expect(gestrichen[0]!.grund).toContain("Gleichbehandlungsgesetz");
  });

  it("greift auch bei gebeugten Formen", () => {
    /*
     * Der Fehler, der beim Lesen unsichtbar ist: `\bmännlich\b`
     * trifft „männlich" und nicht „männliche". Genau in der gebeugten
     * Form kommt so ein Wunsch aber vor.
     */
    for (const wunsch of [
      "nur männliche Bewerber",
      "möglichst junge Leute",
      "keine kranken Mitarbeiter",
      "gesunde Bewerber bevorzugt",
    ]) {
      expect(anforderungenPruefen([wunsch]).gestrichen, wunsch).toHaveLength(1);
    }
  });

  it("erkennt die Merkmale des § 1 AGG", () => {
    const faelle = [
      ["nur männliche Bewerber", "Geschlecht"],
      ["keine Mütter", "Familienstand"],
      ["deutscher Muttersprachler", "Herkunft"],
      ["kein Kopftuch", "Religion"],
      ["muss gesund sein", "Gesundheit"],
      ["gepflegtes Äußeres", "Aussehen"],
    ] as const;
    for (const [wunsch, merkmal] of faelle) {
      const { bleiben, gestrichen } = anforderungenPruefen([wunsch]);
      expect(bleiben, wunsch).toHaveLength(0);
      expect(gestrichen[0]!.grund, wunsch).toContain(merkmal);
    }
  });

  it("lässt fachliche Anforderungen stehen", () => {
    const fachlich = [
      "abgeschlossene Ausbildung als Elektroniker",
      "Führerschein Klasse B",
      "Bereitschaft zu Schichtarbeit",
      "gute Deutschkenntnisse für den Kundenkontakt",
      "Erfahrung mit SAP",
    ];
    const { bleiben, gestrichen } = anforderungenPruefen(fachlich);
    expect(bleiben).toEqual(fachlich);
    expect(gestrichen).toEqual([]);
  });

  it("wirft das Gestrichene nicht weg", () => {
    /*
     * Es ist der Nachweis, dass es entfernt wurde — und die einzige
     * Gelegenheit, dass der Betrieb erfährt, warum. Wer es
     * stillschweigend löscht, bekommt denselben Satz wieder.
     */
    const { gestrichen } = anforderungenPruefen(["nicht über 50 Jahre"]);
    expect(gestrichen[0]!.wunsch).toBe("nicht über 50 Jahre");
  });
});

describe("lagePruefen", () => {
  it("erkennt ein vollständiges Angebot", () => {
    expect(lagePruefen(E()).art).toBe("vollstaendig");
  });

  it("fragt nach dem, was fehlt — und nach dem Wichtigsten zuerst", () => {
    const lage = lagePruefen(E({ rolle: null, gehaltVon: null, befristung: null }));
    expect(lage.art).toBe("unvollstaendig");
    if (lage.art !== "unvollstaendig") return;
    expect(lage.fehlend[0]).toBe("rolle");
    expect(lage.fehlend[1]).toBe("gehalt");
    expect(lage.fragen[0]).toBe(RUECKFRAGE.rolle);
  });

  it("stellt nie mehr als drei Fragen auf einmal", () => {
    /* Bei vier bricht jemand ab, der gerade 90 Sekunden gesprochen hat. */
    const lage = lagePruefen({
      rolle: null,
      anforderungen: ["Erfahrung mit Wärmepumpen"],
      gehaltVon: null,
      gehaltBis: null,
      arbeitszeit: null,
      ort: null,
      befristung: null,
      gueltigTage: null,
    });
    expect(lage.art).toBe("unvollstaendig");
    if (lage.art !== "unvollstaendig") return;
    expect(lage.fehlend).toHaveLength(6);
    expect(lage.fragen).toHaveLength(MAX_RUECKFRAGEN);
  });

  it("stellt bei einem leeren Transkript kein Formular", () => {
    const lage = lagePruefen({
      rolle: null,
      anforderungen: [],
      gehaltVon: null,
      gehaltBis: null,
      arbeitszeit: null,
      ort: null,
      befristung: null,
      gueltigTage: null,
    });
    expect(lage.art).toBe("leer");
  });

  it("gibt die Streichungen auch bei unvollständigem Entwurf zurück", () => {
    const lage = lagePruefen(E({ gehaltVon: null, anforderungen: ["nicht über 50 Jahre"] }));
    expect(lage.art).toBe("unvollstaendig");
    if (lage.art !== "unvollstaendig") return;
    expect(lage.gestrichen).toHaveLength(1);
  });

  it("hat für jedes Pflichtfeld eine Rückfrage", () => {
    for (const f of PFLICHTFELDER) {
      expect(RUECKFRAGE[f].length).toBeGreaterThan(10);
      expect(RUECKFRAGE[f]).toMatch(/\?$/);
    }
  });
});

describe("unterMarkt", () => {
  it("meldet ein Angebot deutlich unter dem Markt", () => {
    expect(unterMarkt(3000, 4000)).toBe(true);
  });

  it("meldet ein knapp darunter liegendes nicht", () => {
    expect(unterMarkt(3500, 4000)).toBe(false);
  });

  it("behauptet ohne Vergleichswert nichts", () => {
    /* Kein Kurs, keine Aussage — auch keine beruhigende. */
    expect(unterMarkt(3000, null)).toBeNull();
    expect(unterMarkt(null, 4000)).toBeNull();
    expect(unterMarkt(3000, 0)).toBeNull();
  });
});

describe("verbindlichkeitshinweis", () => {
  it("sagt, was Bestätigen heisst — mit der Zahl der Tage", () => {
    const text = verbindlichkeitshinweis(60);
    expect(text).toContain("60 Tage");
    expect(text).toContain("nicht ein Ausgangspunkt");
  });
});
