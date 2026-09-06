import { describe, expect, it } from "vitest";
import { eineFrage, meldungBuendeln, type Handlungsbeleg } from "./meldung.ts";
import type { Freigabe } from "./engine.ts";

function beleg(handlung: string, ergebnis: Record<string, unknown> | null = null): Handlungsbeleg {
  return { handlung, jobId: "j1", ergebnis };
}

function freigabe(handlung: string, nachricht: string): Freigabe {
  return {
    handlung: handlung as Freigabe["handlung"],
    begruendung: "weil",
    jobId: null,
    belegEreignisse: [],
    brauchtZustimmung: true,
    nachricht,
    stellen: [],
    schluessel: null,
    policyFassung: "proaktiv-1",
  };
}

describe("F — vier Handlungen, eine Meldung", () => {
  it("fasst Vormerkung, Vergleich und offene Fragen zu einem Satz zusammen", () => {
    const satz = meldungBuendeln([
      beleg("job_vormerken"),
      beleg("job_vormerken"),
      beleg("vergleich_vorbereiten", {
        vergleich: { jobIds: ["a", "b"], unterschiede: ["Gehalt", "Entfernung"] },
      }),
      beleg("offene_fragen_sammeln", { fragen: [{ schluessel: "gehalt" }] }),
      beleg("offene_fragen_sammeln", { fragen: [{ schluessel: "schicht" }] }),
    ])!;

    /* Ein Satz, kein Protokoll. */
    expect(satz).toContain("gegenübergestellt");
    expect(satz).toContain("Gehalt");
    /* Deutsche Substantive gross — ein Satz, der das nicht tut,
       sieht aus wie von einer Maschine. */
    expect(satz).not.toMatch(/bei [a-zäöü]+ und/);
    /* Und nicht viermal „ich habe". */
    expect(satz.match(/Ich habe/g) ?? []).toHaveLength(1);
  });

  it("lässt den Vergleich führen und die Vormerkung darin aufgehen", () => {
    const satz = meldungBuendeln([
      beleg("job_vormerken"),
      beleg("vergleich_vorbereiten", { vergleich: { jobIds: ["a", "b"], unterschiede: [] } }),
    ])!;
    expect(satz).toContain("gegenübergestellt");
    expect(satz).not.toContain("vorgemerkt");
  });

  it("schweigt bei einer blossen Vormerkung", () => {
    /*
     * „Ich habe diese Stelle für dich vorgemerkt" — gesagt zu
     * jemandem, der gerade auf ebendieser Stelle steht und sie zum
     * dritten Mal liest. Das ist keine Auskunft, sondern ein Echo.
     */
    expect(meldungBuendeln([beleg("job_vormerken")])).toBeNull();
    expect(meldungBuendeln([beleg("job_vormerken"), beleg("job_vormerken")])).toBeNull();
  });

  it("schweigt auch, wenn nur offene Fragen dazukamen", () => {
    /* Dass die Anzeige kein Gehalt nennt, sieht man ihr an. */
    expect(
      meldungBuendeln([
        beleg("job_vormerken"),
        beleg("offene_fragen_sammeln", { fragen: [{ schluessel: "gehalt" }] }),
      ]),
    ).toBeNull();
  });

  it("nennt höchstens zwei Merkmale", () => {
    const satz = meldungBuendeln([
      beleg("vergleich_vorbereiten", {
        vergleich: {
          jobIds: ["a", "b"],
          unterschiede: ["Gehalt", "Entfernung", "Vertrag", "Wochenstunden"],
        },
      }),
    ])!;
    expect(satz).not.toContain("Wochenstunden");
  });

  it("erfindet keinen Unterschied, wo keiner belegt ist", () => {
    const satz = meldungBuendeln([
      beleg("vergleich_vorbereiten", { vergleich: { jobIds: ["a", "b"], unterschiede: [] } }),
    ])!;
    expect(satz).not.toMatch(/unterscheiden/);
  });

  it("nennt eine offene Frage nur, wenn sie ein Wort hat", () => {
    /*
     * „Bei einer ist noch etwas unklar" wäre ein Satz, der
     * beunruhigt, ohne zu helfen.
     */
    const satz = meldungBuendeln([
      beleg("vergleich_vorbereiten", { vergleich: { jobIds: ["a", "b"], unterschiede: ["Gehalt"] } }),
      beleg("offene_fragen_sammeln", { fragen: [{ schluessel: "voellig_unbekannt" }] }),
    ])!;
    expect(satz).not.toMatch(/[Oo]ffen ist|[Oo]ffen sind/);
  });

  it("Q — hat ohne Handlung nichts zu sagen", () => {
    expect(meldungBuendeln([])).toBeNull();
    /* Eine Handlung ohne Sprechform ergibt auch keinen Satz. */
    expect(meldungBuendeln([beleg("hypothese_merken")])).toBeNull();
  });
});

describe("Eine Frage zur Zeit", () => {
  it("stellt genau eine und legt die anderen zurück", () => {
    const { jetzt, wartend } = eineFrage([
      freigabe("mail_aktivieren", "Soll ich dir täglich schreiben?"),
      freigabe("umkreis_erweitern", "Soll ich weiter suchen?"),
      freigabe("gehalt_lockern", "Soll ich tiefer suchen?"),
    ]);
    expect(jetzt).not.toBeNull();
    expect(wartend).toHaveLength(2);
  });

  it("fragt zuerst nach dem, was die Suche am stärksten öffnet", () => {
    /*
     * Eine Suche, die nichts findet, ist das dringendste Problem —
     * dringender als die Frage nach der Mailhäufigkeit.
     */
    const { jetzt } = eineFrage([
      freigabe("mail_haeufiger", "Öfter?"),
      freigabe("umkreis_erweitern", "Weiter weg?"),
    ]);
    expect(jetzt!.handlung).toBe("umkreis_erweitern");
  });

  it("wählt bei gleichem Rang immer dieselbe", () => {
    /* Sonst entschiede die Reihenfolge, in der die Signale zufällig
       entstanden sind. */
    const a = eineFrage([freigabe("mail_aktivieren", "A"), freigabe("mail_haeufiger", "B")]);
    const b = eineFrage([freigabe("mail_haeufiger", "B"), freigabe("mail_aktivieren", "A")]);
    expect(a.jetzt!.handlung).toBe(b.jetzt!.handlung);
  });

  it("hat ohne Vorschläge nichts zu fragen", () => {
    expect(eineFrage([])).toEqual({ jetzt: null, wartend: [] });
  });
});
