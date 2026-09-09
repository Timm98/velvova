import { describe, expect, it } from "vitest";
import {
  anfrageEntwerfen,
  unbelegteZahlen,
  type Anfrageeingaben,
} from "./anfragetext.ts";

const EINGABEN: Anfrageeingaben = {
  art: "stellenanfrage",
  arbeitgeberart: "oeffentlich",
  arbeitgebername: "das Landratsamt Reutlingen",
  absender: "Lea Hoffmann",
  fachgebiet: { aussage: "Projektmanagement", herkunft: "profil:rolle-1" },
  erfahrung: [
    { aussage: "fünf Jahre Projektleitung in der Verwaltungsdigitalisierung", herkunft: "dok:cv-v3#s2" },
  ],
  bezug: null,
  gesucht: { aussage: "eine Aufgabe in der Verwaltungsmodernisierung", herkunft: "profil:ziel-1" },
};

const entwurf = (teil: Partial<Anfrageeingaben> = {}) =>
  anfrageEntwerfen({ ...EINGABEN, ...teil });

describe("Ohne Belege kein Text", () => {
  it("sagt, was fehlt, statt etwas zu erfinden", () => {
    /*
     * Eine brauchbare Antwort: Sie sagt dem Menschen, was er ergänzen
     * müsste, statt ihm einen Text zu geben, den er nicht
     * verantworten kann.
     */
    const e = entwurf({ erfahrung: [], absender: "" });
    expect(e.moeglich).toBe(false);
    if (e.moeglich) return;
    expect(e.fehlt).toContain("dein Name");
    expect(e.fehlt).toContain("mindestens eine belegte Erfahrung");
  });

  it("verlangt mindestens eine belegte Erfahrung", () => {
    expect(entwurf({ erfahrung: [] }).moeglich).toBe(false);
  });

  it("lässt den Bezug weg, wenn keiner belegt ist", () => {
    /*
     * Ein erfundener Grund ist durchsichtig und richtet mehr Schaden
     * an als sein Fehlen: Wer "Ihre innovative Unternehmenskultur hat
     * mich überzeugt" schreibt, sagt damit, dass er nichts über den
     * Arbeitgeber weiss.
     */
    const e = entwurf({ bezug: null });
    if (!e.moeglich) throw new Error("sollte möglich sein");
    expect(e.entwurf.text).not.toMatch(/gekommen, weil/);
    expect(e.entwurf.text).not.toMatch(/innovativ|Kultur|beeindruck/i);
  });

  it("nimmt einen belegten Bezug auf", () => {
    const e = entwurf({
      bezug: { aussage: "Sie regelmässig Stellen in der Digitalisierung ausschreiben", herkunft: "job:abc" },
    });
    if (!e.moeglich) throw new Error("möglich");
    expect(e.entwurf.text).toMatch(/regelmässig Stellen in der Digitalisierung/);
  });
});

describe("Der öffentliche Dienst bekommt die Frage nach dem Verfahren", () => {
  it("fragt nach Ausschreibung, Veröffentlichungsort und Vormerkung", () => {
    /*
     * Dort werden Stellen ausgeschrieben. So zu tun, als ginge es
     * daran vorbei, hilft der Person nicht und stellt den Empfänger
     * vor eine Frage, die er nicht beantworten darf.
     */
    const e = entwurf({ arbeitgeberart: "oeffentlich" });
    if (!e.moeglich) throw new Error("möglich");
    expect(e.entwurf.text).toMatch(/Ausschreibung/);
    expect(e.entwurf.text).toMatch(/veröffentlicht/);
    expect(e.entwurf.text).toMatch(/Vormerkung/);
  });

  it("fragt bei privaten Arbeitgebern schlicht nach einer Möglichkeit", () => {
    const e = entwurf({ arbeitgeberart: "privat" });
    if (!e.moeglich) throw new Error("möglich");
    expect(e.entwurf.text).toMatch(/passende Möglichkeit/);
    expect(e.entwurf.text).not.toMatch(/Ausschreibung/);
  });
});

describe("Der Betreff sagt, was es ist", () => {
  it("nennt eine Anfrage eine Anfrage", () => {
    /*
     * Der Empfänger sortiert danach. Eine falsch beschriftete
     * Nachricht landet im falschen Stapel — oder wird als Bewerbung
     * abgelehnt, die keine war.
     */
    const e = entwurf({ art: "stellenanfrage" });
    if (!e.moeglich) throw new Error("möglich");
    expect(e.entwurf.betreff).toMatch(/^Anfrage:/);
    expect(e.entwurf.betreff).not.toMatch(/Bewerbung/);
  });

  it("nennt eine Initiativbewerbung eine Initiativbewerbung", () => {
    const e = entwurf({ art: "initiativbewerbung", arbeitgeberart: "privat" });
    if (!e.moeglich) throw new Error("möglich");
    expect(e.entwurf.betreff).toMatch(/^Initiativbewerbung/);
  });
});

describe("Kurz bleiben", () => {
  it("nimmt höchstens drei Erfahrungen auf", () => {
    /* Sie geht an jemanden, der nicht danach gefragt hat. */
    const e = entwurf({
      erfahrung: [1, 2, 3, 4, 5].map((n) => ({ aussage: `Erfahrung ${n}`, herkunft: `d:${n}` })),
    });
    if (!e.moeglich) throw new Error("möglich");
    expect(e.entwurf.text).toContain("Erfahrung 3");
    expect(e.entwurf.text).not.toContain("Erfahrung 4");
  });

  it("bleibt unter zweitausend Zeichen", () => {
    const e = entwurf({
      erfahrung: [1, 2, 3].map((n) => ({ aussage: `Erfahrung ${n}`, herkunft: `d:${n}` })),
      bezug: { aussage: "Sie dort ausschreiben", herkunft: "j:1" },
    });
    if (!e.moeglich) throw new Error("möglich");
    expect(e.entwurf.text.length).toBeLessThan(2000);
  });
});

describe("Jede Aussage trägt ihre Herkunft", () => {
  it("gibt zu jedem Satz im Text den Beleg mit", () => {
    /*
     * Der Mensch soll bei der Freigabe nicht nur lesen, WAS über ihn
     * gesagt wird, sondern WORAUF es sich stützt.
     */
    const e = entwurf({ bezug: { aussage: "Sie dort ausschreiben", herkunft: "job:abc" } });
    if (!e.moeglich) throw new Error("möglich");
    expect(e.entwurf.belege).toHaveLength(4);
    for (const b of e.entwurf.belege) expect(b.herkunft.length).toBeGreaterThan(0);
    expect(e.entwurf.belege.map((b) => b.herkunft)).toContain("dok:cv-v3#s2");
  });
});

describe("Die Prüfung nach dem Umformulieren", () => {
  const belege = [
    { aussage: "fünf Jahre Projektleitung", herkunft: "d:1" },
    { aussage: "Projektmanagement", herkunft: "d:2" },
  ];

  it("findet eine Jahreszahl, die vorher nirgends stand", () => {
    /*
     * "Über 8 Jahre Erfahrung" ist die häufigste erfundene Angabe in
     * einem generierten Anschreiben. Der Text wird aus Belegen gebaut
     * — aber ein Modell darf ihn umformulieren, und ein Mensch darf
     * ihn bearbeiten. Diese Prüfung läuft VOR der Freigabe noch
     * einmal darüber.
     */
    expect(unbelegteZahlen("Ich habe über 8 Jahre Erfahrung.", belege)).toContain("8");
  });

  it("lässt eine belegte Zahl durch", () => {
    expect(unbelegteZahlen("Seit 5 Jahren im Projektmanagement.", [
      { aussage: "5 Jahre Projektleitung", herkunft: "d:1" },
    ])).toEqual([]);
  });

  it("meldet nichts bei einem Text ohne Zahlen", () => {
    expect(unbelegteZahlen("Ich arbeite im Projektmanagement.", belege)).toEqual([]);
  });

  it("findet auch mehrere", () => {
    expect(unbelegteZahlen("12 Projekte in 3 Ländern.", belege).sort()).toEqual(["12", "3"]);
  });
});
