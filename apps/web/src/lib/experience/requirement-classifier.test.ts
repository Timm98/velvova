import { describe, expect, it } from "vitest";
import { classifyRequirement, extractYears, summariseRequirements } from "./requirement-classifier.ts";

/**
 * Die Beispiele stammen aus dem, was in deutschen Stellenanzeigen
 * tatsächlich steht.
 *
 * Der Fehler, den diese Datei verhindert, ist teuer und unsichtbar:
 * behandelt man „Teamgeist“ und „Führerschein Klasse C“ gleich, filtert
 * man Menschen aus, die die Stelle bekommen könnten — und lässt sie
 * glauben, sie seien nicht qualifiziert.
 */

describe("Jahresangaben", () => {
  it("liest Ziffern", () => {
    expect(extractYears("mindestens 3 Jahre Berufserfahrung").minimum).toBe(3);
    expect(extractYears("5+ Jahre Erfahrung").minimum).toBe(5);
  });

  it("liest ausgeschriebene Zahlen", () => {
    // In deutschen Anzeigen sehr häufig. Ein Muster nur für Ziffern
    // übersieht sie und meldet "keine Jahresangabe".
    expect(extractYears("drei Jahre einschlägige Erfahrung").minimum).toBe(3);
    expect(extractYears("zwei Jahre in vergleichbarer Position").minimum).toBe(2);
  });

  it("liest Spannen", () => {
    const j = extractYears("2-4 Jahre Erfahrung");
    expect(j.minimum).toBe(2);
    expect(j.preferred).toBe(4);
  });

  it("erfindet keine Jahre, wo keine stehen", () => {
    expect(extractYears("Erfahrung im Kundenkontakt").minimum).toBeNull();
  });
});

describe("Formale Sperren", () => {
  it("erkennt einen Führerschein als Sperre", () => {
    const r = classifyRequirement("Führerschein Klasse C ist zwingend erforderlich");
    expect(r.type).toBe("legal_or_license");
    expect(r.strength).toBe("mandatory");
    expect(r.equivalentExperienceAllowed).toBe(false);
  });

  it("sagt trotzdem, dass man sie erwerben kann", () => {
    // Der Unterschied zwischen "du bist raus" und "das lässt sich
    // beschaffen" entscheidet, ob jemand aufgibt.
    const r = classifyRequirement("Staplerschein erforderlich");
    expect(r.rationale).toMatch(/erwerben/);
  });

  it("stuft eine gewünschte Lizenz nicht als Pflicht ein", () => {
    const r = classifyRequirement("Führerschein Klasse B wünschenswert");
    expect(r.type).toBe("legal_or_license");
    expect(r.strength).toBe("preferred");
  });
});

describe("Werbetext", () => {
  it("erkennt Wortwolken als solche", () => {
    for (const t of ["Teamgeist und Hands-on-Mentalität", "Du bist dynamisch und belastbar", "Passion for excellence"]) {
      expect(classifyRequirement(t).type, t).toBe("cultural_marketing_language");
    }
  });

  it("nimmt der Person die Angst davor", () => {
    const r = classifyRequirement("Teamgeist und Hands-on-Mentalität");
    expect(r.rationale).toMatch(/scheitern/);
  });
});

describe("Ausbildung", () => {
  it("erkennt den Halbsatz, der alles ändert", () => {
    // "oder vergleichbare Qualifikation" wird überlesen — und genau
    // dieser Halbsatz entscheidet oft, ob sich jemand bewirbt.
    const r = classifyRequirement("Abgeschlossenes Studium der Informatik oder vergleichbare Qualifikation");
    expect(r.type).toBe("education");
    expect(r.degreeSubstitutionPossible).toBe(true);
    expect(r.rationale).toMatch(/gleichwertig/i);
  });

  it("sagt auch ohne diesen Halbsatz, dass Erfahrung oft zählt", () => {
    const r = classifyRequirement("Abgeschlossenes Studium der Betriebswirtschaft");
    expect(r.degreeSubstitutionPossible).toBe(false);
    expect(r.rationale).toMatch(/Berufserfahrung/);
  });
});

describe("Erfahrung", () => {
  it("stuft ein Jahr als im Onboarding aufholbar ein", () => {
    expect(classifyRequirement("1 Jahr Berufserfahrung").onboardingLearnable).toBe(true);
  });

  it("stuft fünf Jahre nicht als aufholbar ein", () => {
    expect(classifyRequirement("5 Jahre Berufserfahrung").onboardingLearnable).toBe(false);
  });

  it("betont die Tätigkeit statt der Dauer", () => {
    const r = classifyRequirement("mindestens 3 Jahre Berufserfahrung");
    expect(r.rationale).toMatch(/Tätigkeit, nicht die Dauer/);
  });

  it("behandelt gewünschte Erfahrung nicht als Muss", () => {
    // Der häufigste stille Fehler: "von Vorteil" wird wie "erforderlich"
    // behandelt, und die Liste der erreichbaren Stellen schrumpft.
    const r = classifyRequirement("Erfahrung mit SAP von Vorteil");
    expect(r.strength).toBe("preferred");
  });
});

describe("Zusammenfassung", () => {
  it("trennt echte Sperren von Verhandelbarem und Rauschen", () => {
    const reqs = [
      classifyRequirement("Führerschein Klasse C erforderlich"),
      classifyRequirement("3 Jahre Berufserfahrung"),
      classifyRequirement("Teamgeist"),
      classifyRequirement("Erfahrung mit SAP von Vorteil"),
    ];
    const s = summariseRequirements(reqs);

    expect(s.blocking).toHaveLength(1);
    expect(s.noise).toHaveLength(1);
    expect(s.negotiable).toHaveLength(2);
  });

  it("sagt deutlich, wenn es keine Sperre gibt", () => {
    const s = summariseRequirements([
      classifyRequirement("3 Jahre Berufserfahrung"),
      classifyRequirement("Teamgeist"),
    ]);
    expect(s.summary).toMatch(/Keine formale Sperre/);
  });
});
