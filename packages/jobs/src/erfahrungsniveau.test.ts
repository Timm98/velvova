import { describe, expect, it } from "vitest";
import { erfahrungsniveauAusText } from "./erfahrungsniveau.ts";

describe("erfahrungsniveauAusText", () => {
  it("liest das Niveau aus dem Titel", () => {
    expect(erfahrungsniveauAusText("Senior Softwareentwickler (m/w/d)", null)).toBe("senior");
    expect(erfahrungsniveauAusText("Junior Controller", null)).toBe("junior");
  });

  it("lässt den Titel den Fliesstext schlagen", () => {
    /*
     * Im Text kann „Senior" das Team beschreiben, in das man kommt.
     * Der Titel ist die Bezeichnung, auf die sich der Arbeitgeber
     * festgelegt hat.
     */
    expect(
      erfahrungsniveauAusText("Junior Entwickler", "Du arbeitest mit erfahrenen Senior-Kollegen."),
    ).toBe("junior");
  });

  it("stuft eine Leitungsrolle über Senior ein", () => {
    // „Senior Teamleiter" enthält beides, und Leitung ist die
    // stärkere Aussage.
    expect(erfahrungsniveauAusText("Senior Teamleiter Logistik", null)).toBe("lead");
  });

  it("erkennt den Einstieg", () => {
    expect(erfahrungsniveauAusText("Mitarbeiter Lager", "Auch für Quereinsteiger geeignet.")).toBe(
      "entry",
    );
    expect(erfahrungsniveauAusText("Sachbearbeiter", "Berufseinsteiger willkommen.")).toBe("entry");
  });

  it("lässt geforderte Jahre die Schlagworte schlagen", () => {
    /*
     * „Junior" ist eine Rollenbezeichnung und heisst je nach Haus
     * etwas anderes; „mindestens 5 Jahre Berufserfahrung" ist eine
     * Bedingung.
     */
    expect(
      erfahrungsniveauAusText("Entwickler", "Du hast mindestens 5 Jahre Berufserfahrung."),
    ).toBe("senior");
    expect(erfahrungsniveauAusText("Entwickler", "Ab 3 Jahren Berufserfahrung.")).toBe("mid");
    expect(erfahrungsniveauAusText("Entwickler", "1 Jahr Erfahrung genügt.")).toBe("junior");
  });

  it("rät nicht, wenn nichts dasteht", () => {
    /*
     * Ein geratenes „mid" wäre schlimmer als gar nichts: Es sähe aus
     * wie eine Angabe des Arbeitgebers und wäre eine Vermutung.
     */
    expect(erfahrungsniveauAusText("Facharbeiter Sägerei (m/w/d)", "Wir suchen Verstärkung.")).toBeNull();
    expect(erfahrungsniveauAusText("Koch", null)).toBeNull();
  });

  it("verwechselt Leiter nicht mit Leiterplatte", () => {
    // `\b...\b` um „leiter": Sonst wird jede Elektronikstelle zur
    // Führungsposition.
    expect(erfahrungsniveauAusText("Bestücker Leiterplatten", null)).toBeNull();
  });
});
