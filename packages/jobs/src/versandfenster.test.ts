import { describe, expect, it } from "vitest";
import {
  fensterschluessel,
  lokalesDatum,
  naechstesFenster,
  ortszeitNachUtc,
  zonenversatzMinuten,
} from "./versandfenster.ts";

describe("Zonenversatz", () => {
  it("kennt Winter- und Sommerzeit in Berlin", () => {
    expect(zonenversatzMinuten(new Date("2026-01-15T12:00:00Z"), "Europe/Berlin")).toBe(60);
    expect(zonenversatzMinuten(new Date("2026-07-15T12:00:00Z"), "Europe/Berlin")).toBe(120);
  });

  it("rechnet auch westlich von Greenwich", () => {
    expect(zonenversatzMinuten(new Date("2026-01-15T12:00:00Z"), "America/Vancouver")).toBe(-480);
  });
});

describe("Nächstes Versandfenster", () => {
  it("trifft acht Uhr Ortszeit in Berlin", () => {
    const jetzt = new Date("2026-07-15T04:00:00Z");
    const f = naechstesFenster(jetzt, "Europe/Berlin", "08:00");
    expect(f.faelligAm.toISOString()).toBe("2026-07-15T06:00:00.000Z");
    expect(f.schluessel).toBe("2026-07-15:taeglich");
  });

  it("springt auf den nächsten Tag, wenn die Zeit vorbei ist", () => {
    const jetzt = new Date("2026-07-15T09:00:00Z");
    const f = naechstesFenster(jetzt, "Europe/Berlin", "08:00");
    expect(lokalesDatum(f.faelligAm, "Europe/Berlin")).toBe("2026-07-16");
  });

  it("nimmt für eine andere Zone eine andere UTC-Stunde", () => {
    const jetzt = new Date("2026-07-15T00:00:00Z");
    const berlin = naechstesFenster(jetzt, "Europe/Berlin", "08:00").faelligAm;
    const vancouver = naechstesFenster(jetzt, "America/Vancouver", "08:00").faelligAm;
    expect(berlin.toISOString()).not.toBe(vancouver.toISOString());
    /* Beide sind acht Uhr — vor Ort. */
    expect(
      new Intl.DateTimeFormat("en-GB", { timeZone: "America/Vancouver", hour: "2-digit", hour12: false }).format(
        vancouver,
      ),
    ).toBe("08");
  });

  it("hält den wöchentlichen Rhythmus auf dem Wochentag", () => {
    const jetzt = new Date("2026-07-15T09:00:00Z"); // Mittwoch
    const f = naechstesFenster(jetzt, "Europe/Berlin", "08:00", "woechentlich", 1);
    expect(new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Berlin", weekday: "short" }).format(f.faelligAm)).toBe(
      "Mon",
    );
  });
});

describe("Sommerzeitübergänge", () => {
  it("liefert für eine übersprungene Ortszeit genau einen Zeitpunkt", () => {
    /*
     * 29. März 2026: Die Uhr springt in Berlin von 02:00 auf 03:00.
     * 02:30 gibt es an diesem Tag nicht.
     */
    const treffer = ortszeitNachUtc(2026, 3, 29, 2, 30, "Europe/Berlin");
    expect(Number.isFinite(treffer.getTime())).toBe(true);
    const ortszeit = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Berlin",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(treffer);
    /* Der erste Zeitpunkt danach — nicht zwei, nicht keiner. */
    expect(ortszeit).toBe("03:30");
  });

  it("wählt bei doppelter Ortszeit die erste Gelegenheit", () => {
    /* 25. Oktober 2026: 02:30 gibt es zweimal. */
    const treffer = ortszeitNachUtc(2026, 10, 25, 2, 30, "Europe/Berlin");
    /* Die erste ist noch in der Sommerzeit: UTC+2, also 00:30 UTC. */
    expect(treffer.toISOString()).toBe("2026-10-25T00:30:00.000Z");
  });

  it("erzeugt an einem Umstellungstag nur ein Fenster", () => {
    const vorher = new Date("2026-03-29T00:00:00Z");
    const a = naechstesFenster(vorher, "Europe/Berlin", "08:00");
    const b = naechstesFenster(new Date(a.faelligAm.getTime() - 60_000), "Europe/Berlin", "08:00");
    expect(a.schluessel).toBe(b.schluessel);
    expect(a.faelligAm.toISOString()).toBe(b.faelligAm.toISOString());
  });
});

describe("Fensterschlüssel", () => {
  it("ist für denselben lokalen Tag stabil", () => {
    const morgens = new Date("2026-07-15T06:00:00Z");
    const abends = new Date("2026-07-15T20:00:00Z");
    expect(fensterschluessel(morgens, "Europe/Berlin", "taeglich")).toBe(
      fensterschluessel(abends, "Europe/Berlin", "taeglich"),
    );
  });

  it("trennt täglich von wöchentlich", () => {
    const t = new Date("2026-07-15T06:00:00Z");
    expect(fensterschluessel(t, "Europe/Berlin", "taeglich")).not.toBe(
      fensterschluessel(t, "Europe/Berlin", "woechentlich"),
    );
  });
});
