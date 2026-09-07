import { describe, expect, it } from "vitest";
import {
  adresse,
  ersatztexte,
  text,
  zusammenfassungRendern,
  type Vorlagendaten,
  type Vorlagenposten,
} from "./vorlage.ts";

function posten(teil: Partial<Vorlagenposten> = {}): Vorlagenposten {
  return {
    jobId: "job-a",
    titel: "Fachkraft für Lagerlogistik (m/w/d)",
    arbeitgeber: "Muster GmbH",
    ort: "Karlsruhe",
    gehalt: "36.000 – 42.000 EUR im Jahr",
    fitScore: 78,
    grund: "Der Titel nennt lagerlogistik.",
    caveat: null,
    art: "neu",
    url: "https://velvova.example/app/jobs?job=job-a",
    ...teil,
  };
}

function daten(teil: Partial<Vorlagendaten> = {}): Vorlagendaten {
  return {
    anrede: "Tim",
    betreff: "1 passende Stelle",
    einleitung: "Für deinen Suchauftrag ist eine Stelle dazugekommen.",
    abschluss: "Du kannst deinen Suchauftrag jederzeit ändern oder pausieren.",
    basisLabel: "Bestätigter Suchauftrag vom 4. September 2026",
    posten: [posten()],
    einstellungenUrl: "https://velvova.example/app/suchauftraege",
    abmeldeUrl: "https://velvova.example/abmelden?t=abc",
    absenderName: "Monday von Velvova",
    ...teil,
  };
}

describe("Fluchtzeichen", () => {
  it("entschärft Markup aus einer Anzeige", () => {
    const m = zusammenfassungRendern(
      daten({ posten: [posten({ arbeitgeber: `<script>alert(1)</script> & Co` })] }),
    );
    expect(m.html).not.toContain("<script>");
    expect(m.html).toContain("&lt;script&gt;");
    expect(m.html).toContain("&amp; Co");
  });

  it("lässt nur https und mailto als Ziel zu", () => {
    expect(adresse("https://velvova.example/x")).toBe("https://velvova.example/x");
    expect(adresse("mailto:nina@velvova.example")).toBe("mailto:nina@velvova.example");
    expect(adresse("javascript:alert(1)")).toBe("#");
    expect(adresse("http://unsicher.example")).toBe("#");
  });

  it("flieht die fünf Zeichen, die im Body zählen", () => {
    expect(text(`<a href="x">&'`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
  });
});

describe("Aufbau", () => {
  it("nennt jede Stelle mit Titel, Arbeitgeber und Ort", () => {
    const m = zusammenfassungRendern(daten());
    expect(m.html).toContain("Fachkraft für Lagerlogistik");
    expect(m.html).toContain("Muster GmbH");
    expect(m.html).toContain("Karlsruhe");
  });

  it("erfindet keinen Vorbehalt, wo keiner belegt ist", () => {
    const m = zusammenfassungRendern(daten());
    expect(m.html).not.toContain("Offen:");
    expect(m.text).not.toContain("Offen:");
  });

  it("zeigt einen belegten Vorbehalt", () => {
    const m = zusammenfassungRendern(daten({ posten: [posten({ caveat: "Zum Gehalt sagt die Anzeige nichts." })] }));
    expect(m.html).toContain("Zum Gehalt sagt die Anzeige nichts.");
  });

  it("kennzeichnet eine Aktualisierung als solche", () => {
    const m = zusammenfassungRendern(daten({ posten: [posten({ art: "aktualisierung" })] }));
    expect(m.text).toContain("kennst du schon");
  });

  it("trägt immer eine Nur-Text-Fassung", () => {
    const m = zusammenfassungRendern(daten());
    expect(m.text.length).toBeGreaterThan(50);
    expect(m.text).not.toContain("<");
  });

  it("trägt Abmeldung und Änderungsweg", () => {
    const m = zusammenfassungRendern(daten());
    expect(m.html).toContain("https://velvova.example/abmelden?t=abc");
    expect(m.text).toContain("Keine Mails mehr:");
    expect(m.html).toContain("Suchauftrag ändern");
  });

  it("kommt ohne Vornamen aus", () => {
    const m = zusammenfassungRendern(daten({ anrede: null }));
    expect(m.text.startsWith("Hallo,")).toBe(true);
  });
});

describe("Ersatztexte", () => {
  it("behaupten im Betreff keine Passung zur Person", () => {
    /*
     * Der Betreff steht allein im Postfach. „Passende Stelle" liest
     * sich dort als Aussage über den Menschen — und die können wir
     * ohne Mondays Gespräch nicht treffen. Die Einleitung sagt es
     * genau: „die zu deinen Angaben passt".
     */
    const t = ersatztexte(1, "Lager");
    expect(t.betreff).not.toMatch(/passend/i);
    expect(t.einleitung).toMatch(/zu deinen Angaben/);
  });

  it("nennen die tatsächliche Zahl", () => {
    expect(ersatztexte(1, "Lager").betreff).toBe("1 Stelle für deinen Suchauftrag");
    expect(ersatztexte(3, "Lager").betreff).toBe("3 Stellen für deinen Suchauftrag");
  });

  it("bleiben unter der Betrefflänge", () => {
    expect(ersatztexte(5, "Ein sehr langer Auftragsname").betreff.length).toBeLessThanOrEqual(50);
  });
});
