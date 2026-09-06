import { describe, expect, it } from "vitest";
import { erkenntnisart, traegtEntscheidung, wirksameKonfidenz } from "./erkenntnis.ts";
import { naechsteFrage, wissenslage, type Belegtext } from "./naechstefrage.ts";
import {
  ansprechen,
  aussageSchlaegtVermutung,
  widersprueche,
  type Widerspruchsbeleg,
} from "./widersprueche.ts";

let n = 0;
function b(
  text: string,
  quelle: Widerspruchsbeleg["quelle"] = "user_stated",
  konfidenz = 0.9,
): Widerspruchsbeleg {
  return { id: `e${++n}`, text, quelle, konfidenz };
}

/* ═══════════════════════════════════════════════════════════════
   §F — die nächste Frage
   ═══════════════════════════════════════════════════════════════ */

describe("Die nächste Frage", () => {
  it("fragt zuerst nach dem, was die Suche unbrauchbar macht", () => {
    /* Ohne Ort ist jede Trefferliste Zufall. */
    const f = naechsteFrage([b("Ich habe drei Jahre im Lager gearbeitet")]);
    expect(f!.schluessel).toBe("arbeitsort");
  });

  it("überspringt, was schon belegt ist", () => {
    const f = naechsteFrage([
      b("Ich wohne in Karlsruhe und würde bis 30 km pendeln"),
      b("Drei Jahre Erfahrung im Lager"),
    ]);
    expect(f!.schluessel).toBe("gehalt");
  });

  it("zählt eine blosse Vermutung nicht als Antwort", () => {
    /*
     * „Vermutlich möchte sie in die Nähe" ist keine Antwort auf die
     * Frage nach dem Arbeitsort. Wer sie als Antwort zählt, fragt nie
     * nach und rechnet dauerhaft mit einer Vermutung.
     */
    const f = naechsteFrage([b("möchte wahrscheinlich in der Nähe pendeln", "ai_hypothesis", 0.9)]);
    expect(f!.schluessel).toBe("arbeitsort");
    expect(f!.grund).toMatch(/Vermutung/);
  });

  it("fragt nicht zweimal dasselbe", () => {
    const f = naechsteFrage([b("Drei Jahre im Lager")], ["arbeitsort"]);
    expect(f!.schluessel).not.toBe("arbeitsort");
  });

  it("schweigt, wenn genug bekannt ist", () => {
    /* Eine Assistentin, die immer noch eine Frage hat, ist ein
       Formular mit Gesprächsanstrich. */
    const belege = [
      b("Ich wohne in Karlsruhe, pendeln bis 30 km"),
      b("Mindestens 36.000 Euro brutto"),
      b("Ich möchte im Lager oder in der Logistik arbeiten"),
      b("Drei Jahre Erfahrung als Kommissionierer"),
      b("Vollzeit, feste Arbeitszeit, keine Nachtschicht"),
      b("Keine Führungsverantwortung"),
      b("Wenig Stress ist mir wichtig"),
      b("In fünf Jahren würde ich gern Weiterbildung machen"),
    ];
    expect(naechsteFrage(belege)).toBeNull();
  });

  it("nennt die Lage je Feld", () => {
    const lage = wissenslage([b("Mindestens 40.000 brutto")]);
    expect(lage.find((l) => l.schluessel === "gehalt")!.belegt).toBe(true);
    expect(lage.find((l) => l.schluessel === "arbeitsort")!.belegt).toBe(false);
  });
});

/* ═══════════════════════════════════════════════════════════════
   §I — Widersprüche
   ═══════════════════════════════════════════════════════════════ */

describe("4 — ein einzelner Klick ist kein Widerspruch", () => {
  it("macht aus einem verworfenen Remote-Job keine Abneigung", () => {
    const w = widersprueche([
      b("Ich möchte remote arbeiten"),
      b("Stelle vor Ort verworfen", "external_source", 0.5),
    ]);
    expect(w).toHaveLength(0);
  });
});

describe("5 — wiederholtes Verhalten ergibt eine Vermutung", () => {
  it("erkennt den Widerspruch erst ab drei Gegenbelegen", () => {
    const w = widersprueche([
      b("Ich möchte remote arbeiten"),
      b("Stelle vor Ort angesehen", "external_source", 0.5),
      b("Präsenzstelle im Büro gemerkt", "external_source", 0.5),
      b("Weitere Stelle vor Ort gemerkt", "external_source", 0.5),
    ]);
    expect(w).toHaveLength(1);
    expect(w[0]!.entgegen).toHaveLength(3);
  });
});

describe("3 — acht Vertriebsstellen nach „kein Vertrieb“", () => {
  const w = widersprueche([
    b("Ich möchte keinen Vertrieb machen"),
    ...Array.from({ length: 8 }, () => b("Sales Manager gemerkt", "external_source", 0.5)),
  ]);

  it("erkennt ihn", () => {
    expect(w).toHaveLength(1);
    expect(ansprechen(w[0]!)).toBe(true);
  });

  it("ändert die Präferenz NICHT von selbst", () => {
    /*
     * Wer „kein Vertrieb" durch Verhaltensdaten überschreibt, hat aus
     * einer Beobachtung eine Entscheidung gemacht — über den Kopf der
     * Person hinweg.
     */
    expect(w[0]!.gilt).toBe("gesagt");
  });

  it("stellt eine Frage, statt etwas festzustellen", () => {
    expect(w[0]!.frage).toMatch(/\?$/);
    expect(w[0]!.frage).not.toMatch(/du liebst|eigentlich willst du|in Wahrheit/i);
  });

  it("lässt den Widerspruch die Aussage nicht überholen", () => {
    /* Ein Widerspruch kann eine Aussage in Frage stellen; er kann sie
       nicht widerlegen. */
    expect(w[0]!.staerke).toBeLessThan(wirksameKonfidenz(w[0]!.gesagt));
  });
});

describe("Was als „gesagt“ zählt", () => {
  it("nimmt keine Vermutung als Seite eines Widerspruchs", () => {
    /* Eine Vermutung gegen eine Beobachtung ist kein Widerspruch,
       sondern zwei schwache Signale. */
    const w = widersprueche([
      b("möchte vermutlich wenig Stress", "ai_hypothesis", 0.7),
      ...Array.from({ length: 5 }, () => b("Sales Director gemerkt", "external_source", 0.5)),
    ]);
    expect(w).toHaveLength(0);
  });
});

describe("G — eine Aussage überstimmt eine Vermutung", () => {
  it("lässt die Aussage gelten und stuft die Vermutung herab", () => {
    const vermutung = b("möchte wahrscheinlich remote arbeiten", "ai_hypothesis", 0.95);
    const aussage = b("Ich möchte eigentlich jeden Tag ins Büro", "user_stated", 0.7);
    const e = aussageSchlaegtVermutung(aussage, vermutung);
    expect(e.gilt).toBe(aussage);
    /* Nicht gelöscht — herabgestuft. */
    expect(e.herabgestuft).toBe(vermutung);
  });
});

/* ═══════════════════════════════════════════════════════════════
   1, 6, 7 — belegt gegen vermutet
   ═══════════════════════════════════════════════════════════════ */

describe("6 — der Lebenslauf belegt Python", () => {
  it("ist ein Fakt, kein Vorschlag", () => {
    const beleg = b("Python in drei Projekten eingesetzt", "document_extract", 0.85);
    expect(erkenntnisart(beleg)).toBe("fact");
    expect(traegtEntscheidung(beleg)).toBe(true);
  });
});

describe("7 — Nina vermutet Führungsinteresse", () => {
  it("bleibt eine Vermutung und trägt keine Entscheidung", () => {
    const beleg = b("könnte an Führung interessiert sein", "ai_hypothesis", 0.9);
    expect(erkenntnisart(beleg)).toBe("inference");
    expect(traegtEntscheidung(beleg)).toBe(false);
  });
});

describe("1 — „Ich habe keine Fähigkeiten“", () => {
  it("lässt aus Erfahrung belegte Fähigkeiten stehen", () => {
    /*
     * Nina widerspricht nicht mit „doch, hast du". Sie hat Belege,
     * und die sind Fakten — unabhängig davon, wie jemand über sich
     * spricht.
     */
    const belege: Belegtext[] = [
      b("Ich habe keine besonderen Fähigkeiten"),
      b("Kommissionierung, zwei Jahre täglich", "document_extract", 0.85),
      b("Staplerschein, gültig", "document_extract", 0.9),
    ];
    const fakten = belege.filter((x) => erkenntnisart(x) === "fact");
    expect(fakten).toHaveLength(2);
    expect(fakten.every(traegtEntscheidung)).toBe(true);
  });
});
