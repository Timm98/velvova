import { describe, expect, it } from "vitest";
import { abdeckungssatz, type Quellenabdeckung } from "./coverage.ts";

/*
 * Die Zahlen aus der Meldung vom 8. September 2026, unverändert.
 *
 * Auf der Seite stand nebeneinander „558 der 596 neuesten passen" und
 * „3.454.589 Stellen geprüft". Wörtlich zurückgemeldet: „das macht
 * null sinn ich hab keine filter angegeben."
 */
const ABDECKUNG: Quellenabdeckung = {
  aktiveQuellen: 28,
  aktiveNamen: [],
  möglicheQuellen: 28,
  rohTreffer: 0,
  eindeutig: 0,
  aktiv: 3_454_589,
  zuletzt: null,
  jeQuelle: [],
};

describe("der Satz unter der Trefferzahl", () => {
  const satz = abdeckungssatz(ABDECKUNG, 558, 596);

  it("nennt den Bestand als Bestand, nicht als geprüft", () => {
    /*
     * Der Kern des Fehlers: „3.454.589 Stellen geprüft" war unwahr.
     * Geprüft wurden 596 — so viele lädt und bewertet die Seite je
     * Aufbau. Die grosse Zahl ist, was da IST.
     */
    expect(satz).toContain("3.454.589 Stellen im Bestand");
    expect(satz).not.toContain("3.454.589 Stellen geprüft");
  });

  it("sagt, wie viele davon wirklich angesehen wurden", () => {
    expect(satz).toContain("davon die 596 neuesten bewertet");
  });

  it("spricht vom Profil und nicht von Bedingungen", () => {
    /*
     * „erfüllen deine Bedingungen" liest sich wie Filter. Es sind
     * aber die Profilangaben — wer keinen Filter gesetzt hat, sucht
     * sonst nach etwas, das es nicht gibt.
     */
    expect(satz).toContain("558 passen zu deinem Profil");
    expect(satz).not.toContain("Bedingungen");
  });

  it("ergibt gelesen eine Rechnung", () => {
    expect(satz).toBe(
      "28 Quellen durchsucht · 3.454.589 Stellen im Bestand · " +
        "davon die 596 neuesten bewertet · 558 passen zu deinem Profil",
    );
  });

  it("bleibt bei einer einzigen Quelle im Singular", () => {
    const einer = abdeckungssatz({ ...ABDECKUNG, aktiveQuellen: 1 }, 3, 10);
    expect(einer).toContain("1 Quelle durchsucht");
  });
});
