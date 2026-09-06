import { describe, expect, it } from "vitest";
import { suchbegriffe, suchrichtungen, type Profilauszug } from "./suchrichtungen.ts";
import type { EvidenceItem } from "@paycheck/domain";
import { makeConstraints } from "./fixtures.ts";

/**
 * Der Prüfstein ist das Profil ohne Jobtitel.
 *
 * Jemand sagt, was er getan hat und was ihm liegt — nie, wie der Beruf
 * heisst, den er sucht. Genau da versagt eine Jobbörse: sie kann nur
 * finden, was jemand schon benennen kann.
 *
 * Zwei Fehlerrichtungen:
 *
 *   **Zu eng.** Aus „Touren geplant" wird nur „Lagerist". Der Weg aus
 *   der körperlichen Arbeit heraus wird nie sichtbar.
 *
 *   **Zu weit.** Aus einem halben Satz werden zwölf Richtungen, und
 *   die Trefferliste hat mit der Person nichts mehr zu tun. Das ist
 *   die schlimmere Richtung: sie sieht nach Ergebnis aus.
 */

function profil(over: Partial<Profilauszug> = {}): Profilauszug {
  return {
    evidence: [],
    energisingTasks: [],
    drainingTasks: [],
    statedInterests: [],
    constraints: makeConstraints({ baseLocation: null, hardNoGos: [] }),
    ...over,
  };
}

/*
 * Eine Aussage von Hand, nicht über `makeEvidence`.
 *
 * Die Vorlage dort bringt eigene Sätze mit („Zwei Jahre
 * Kundenbetreuung …"), und die würden hier mitzählen: jeder Test
 * bekäme Kundenbetreuung geschenkt, und der Test „erfindet nichts,
 * wenn nichts im Profil steht" wäre nicht mehr wahr.
 */
let zaehler = 0;
function aussage(text: string, bestaetigt = true): EvidenceItem {
  const jetzt = new Date("2026-01-01T00:00:00Z");
  return {
    id: `ev-${++zaehler}`,
    userId: "u1",
    type: "experience_episode",
    statement: text,
    sourceType: "user_stated",
    sourceRef: "turn-1",
    confidence: 0.9,
    userConfirmed: bestaetigt,
    userRejected: false,
    sensitivityLevel: "normal",
    retentionClass: "profile",
    createdAt: jetzt,
    updatedAt: jetzt,
    deletedAt: null,
  };
}

describe("Aus Tätigkeiten werden Rollen", () => {
  it("findet Disposition aus „Touren geplant“, ohne dass das Wort fällt", () => {
    const r = suchrichtungen(
      profil({ evidence: [aussage("Ich habe die Touren geplant und mit den Fahrern telefoniert.")] }),
    );
    expect(r.map((x) => x.begriff)).toContain("Disposition");
  });

  it("findet mehrere Richtungen aus einem Lebenslauf ohne Jobtitel", () => {
    /*
     * Das Profil aus der Aufgabenstellung: Lagererfahrung, gut mit
     * Menschen, Computerkenntnisse, keine körperliche Arbeit mehr.
     */
    const r = suchrichtungen(
      profil({
        evidence: [
          aussage("Ich habe im Lager Bestellungen erfasst und die Lieferungen nachverfolgt."),
          aussage("Ich kann gut mit Menschen, Kundenkontakt macht mir nichts aus."),
          aussage("Mit Excel und dem Warenwirtschaftssystem komme ich zurecht."),
        ],
        drainingTasks: ["Körperliche Arbeit, schweres Heben"],
      }),
    );
    const begriffe = r.map((x) => x.begriff);
    expect(begriffe.length).toBeGreaterThanOrEqual(3);
    expect(begriffe).toContain("Auftragsabwicklung");
    expect(begriffe).toContain("Kundenbetreuung");
  });

  it("nennt zu jeder Richtung die Sätze, aus denen sie stammt", () => {
    // Ohne Beleg ist eine Suchrichtung eine Behauptung über die Person.
    const r = suchrichtungen(profil({ evidence: [aussage("Ich habe Angebote erstellt und kalkuliert.")] }));
    for (const x of r) {
      expect(x.belege.length, x.begriff).toBeGreaterThan(0);
      expect(x.begruendung.length, x.begriff).toBeGreaterThan(0);
    }
  });
});

describe("Was ausgeschlossen wurde, bleibt ausgeschlossen", () => {
  it("meidet körperliche Rollen, wenn jemand genau davon weg will", () => {
    const r = suchrichtungen(
      profil({
        evidence: [aussage("Ich habe zehn Jahre im Lager gearbeitet.")],
        drainingTasks: ["Keine körperliche Arbeit mehr"],
      }),
    );
    for (const x of r) expect(x.begriff.toLowerCase(), x.begriff).not.toMatch(/lager|produktion|montage/);
  });

  it("wirft wegen „keine Kaltakquise“ nicht den ganzen Vertrieb weg", () => {
    /*
     * Die feine Unterscheidung. „Keine Kaltakquise" ist kein „kein
     * Vertrieb" — es gibt Vertriebsrollen ohne Kaltakquise, und für
     * viele sind genau die der interessante Weg. Eine harte Sperre
     * nähme ihn weg, ohne dass jemand es merkt.
     */
    const r = suchrichtungen(
      profil({
        evidence: [aussage("Ich habe Angebote erstellt und Bestandskunden betreut.")],
        constraints: makeConstraints({ baseLocation: null, hardNoGos: ["Kaltakquise"] }),
      }),
    );
    expect(r.length).toBeGreaterThan(0);
  });

  it("nimmt eine Rolle nicht auf, wenn der Beleg selbst die Gegenanzeige enthält", () => {
    const r = suchrichtungen(
      profil({ evidence: [aussage("Ich habe Kaltakquise gemacht und will das nie wieder.")] }),
    );
    expect(r.map((x) => x.begriff)).not.toContain("Inside Sales");
  });
});

describe("Zurückhaltung", () => {
  it("erfindet nichts, wenn nichts im Profil steht", () => {
    /*
     * Eine Standardliste wäre kein Vorschlag, sondern Raten — und sie
     * sähe für die Person genauso aus wie ein echtes Ergebnis.
     */
    expect(suchrichtungen(profil())).toEqual([]);
  });

  it("gewichtet Bestätigtes höher als Vermutetes", () => {
    const bestaetigt = suchrichtungen(
      profil({ evidence: [aussage("Ich habe die Disposition gemacht.", true)] }),
    );
    const vermutet = suchrichtungen(
      profil({ evidence: [aussage("Ich habe die Disposition gemacht.", false)] }),
    );
    expect(bestaetigt[0]!.staerke).toBeGreaterThan(vermutet[0]!.staerke);
  });

  it("liefert höchstens so viele Richtungen wie verlangt", () => {
    // Eine Suche über zwanzig Richtungen wäre teuer und für niemanden
    // lesbar.
    const viel = profil({
      evidence: [
        aussage("Ich habe Touren geplant, Aufträge erfasst, Kunden betreut."),
        aussage("Ich habe Angebote kalkuliert, Rechnungen geprüft und Stammdaten gepflegt."),
        aussage("Ich habe Projekte koordiniert und im Einkauf Preise verglichen."),
      ],
    });
    expect(suchrichtungen(viel, 4).length).toBeLessThanOrEqual(4);
  });
});

describe("Suchbegriffe", () => {
  it("hängt den Wohnort an, wenn einer bekannt ist", () => {
    const r = suchrichtungen(profil({ evidence: [aussage("Ich habe Touren geplant.")] }));
    const c = makeConstraints({ baseLocation: "Karlsruhe" });
    expect(suchbegriffe(r, c)[0]).toBe("Disposition Karlsruhe");
  });

  it("kommt ohne Wohnort aus", () => {
    // „Disposition undefined" wäre eine Suche, die nichts findet.
    const r = suchrichtungen(profil({ evidence: [aussage("Ich habe Touren geplant.")] }));
    const c = makeConstraints({ baseLocation: null });
    expect(suchbegriffe(r, c)[0]).toBe("Disposition");
  });
});
