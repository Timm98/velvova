import { describe, expect, it } from "vitest";
import {
  AKTIONEN,
  aktionPruefen,
  darfOhneRueckfrage,
  type Aktionsname,
} from "./aktionen";

const KENNUNG = "3f1a2b4c-5d6e-4f70-8a91-b2c3d4e5f607";
const ZWEITE = "9e8d7c6b-5a49-4382-9170-6f5e4d3c2b1a";

describe("aktionPruefen", () => {
  it("nimmt eine gültige Oberflächenaktion an", () => {
    const p = aktionPruefen("show_panel", { ansicht: "gehalt" });
    expect(p.ok).toBe(true);
  });

  it("lehnt eine unbekannte Aktion ab und sagt warum", () => {
    const p = aktionPruefen("delete_everything", {});
    expect(p.ok).toBe(false);
    expect(p.ok === false && p.grund).toContain("Unbekannte Aktion");
  });

  it("lehnt eine erfundene Ansicht ab", () => {
    // Bei Sprachbedienung leitet ein Modell die Argumente ab und kann
    // dabei etwas erfinden. Hier fällt es auf.
    expect(aktionPruefen("show_panel", { ansicht: "steuererklaerung" }).ok).toBe(false);
  });

  it("verlangt eine echte Kennung statt einer Beschreibung", () => {
    // „der erste" ist keine Kennung, auch wenn das Modell es einsetzt.
    expect(aktionPruefen("open_job", { jobId: "der erste" }).ok).toBe(false);
  });

  it("nennt bei einem Fehler genau einen Grund", () => {
    const p = aktionPruefen("compare_jobs", { jobA: "x", jobB: "y" });
    expect(p.ok).toBe(false);
    expect(p.ok === false && p.grund.split(":").length).toBeLessThanOrEqual(3);
  });

  it("nimmt fehlende Argumente als leeres Objekt", () => {
    // filter_jobs ohne Argumente heisst „Filter zurücksetzen".
    expect(aktionPruefen("filter_jobs", undefined).ok).toBe(true);
  });

  it("gibt die geprüften Argumente zurück, nicht die rohen", () => {
    const p = aktionPruefen("open_job", { jobId: KENNUNG, unfug: 1 });
    expect(p.ok && p.aktion.args).toEqual({ jobId: KENNUNG });
  });

  it("prüft beide Kennungen beim Vergleich", () => {
    expect(aktionPruefen("compare_jobs", { jobA: KENNUNG, jobB: ZWEITE }).ok).toBe(true);
    expect(aktionPruefen("compare_jobs", { jobA: KENNUNG }).ok).toBe(false);
  });
});

describe("darfOhneRueckfrage", () => {
  it("lässt Ansichten ohne Rückfrage zu", () => {
    expect(darfOhneRueckfrage("show_panel")).toBe(true);
    expect(darfOhneRueckfrage("highlight_section")).toBe(true);
  });

  it("verlangt für jede Datenänderung eine Rückfrage", () => {
    /*
     * Auch fürs Merken. Der Unterschied zwischen „ich zeige dir das
     * Gehalt" und „ich habe die Stelle gemerkt" ist der zwischen
     * Auskunft und Handeln — Handeln bleibt bei der Person.
     */
    expect(darfOhneRueckfrage("save_job")).toBe(false);
    expect(darfOhneRueckfrage("prepare_application")).toBe(false);
  });

  it("stuft jede Aktion ausdrücklich ein", () => {
    // Eine neue Aktion ohne Einstufung wäre stillschweigend erlaubt.
    for (const name of Object.keys(AKTIONEN) as Aktionsname[]) {
      expect(["oberflaeche", "server"], name).toContain(AKTIONEN[name].wirkung);
    }
  });

  it("hält keine Bewerbung für gefahrlos", () => {
    // Der Auftrag verbietet automatische Bewerbungen ausdrücklich.
    expect(AKTIONEN.prepare_application.wirkung).toBe("server");
  });
});
