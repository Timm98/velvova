import { describe, expect, it } from "vitest";
import { de } from "./messages/de.ts";
import { en } from "./messages/en.ts";
import { es } from "./messages/es.ts";
import { fr } from "./messages/fr.ts";
import { it as itMessages } from "./messages/it.ts";
import { nl } from "./messages/nl.ts";
import { pl } from "./messages/pl.ts";

/**
 * ══════════════════════════════════════════════════════════════════
 * Was an Übersetzungen maschinell prüfbar ist — und was nicht
 * ══════════════════════════════════════════════════════════════════
 *
 * Ob ein französischer Satz gut klingt, kann hier niemand feststellen.
 * Das bleibt Arbeit für einen Menschen, der die Sprache spricht.
 *
 * Prüfbar ist die Klasse von Fehlern, die beim Übersetzen tatsächlich
 * entsteht und die man beim Lesen übersieht:
 *
 *   - ein Platzhalter fällt weg          → „Hallo " statt „Hallo Tim"
 *   - ein Platzhalter wird übersetzt     → {assistant} wird {assistent}
 *   - ein Eintrag bleibt unübersetzt     → deutscher Satz in der
 *                                          polnischen Oberfläche
 *   - ein Eintrag ist leer               → leere Fläche im Bild
 *
 * Der erste ist der teuerste: Er fällt beim Korrekturlesen nicht auf,
 * weil der Satz vollständig aussieht. Er fällt erst auf, wenn eine
 * Anrede ins Leere läuft.
 *
 * Die Vollständigkeit der Schlüssel prüft bereits der Typ `Messages` —
 * ein fehlender Schlüssel ist ein Baufehler und kommt hier gar nicht
 * erst an.
 */

const KATALOGE = { en, fr, es, it: itMessages, nl, pl } as const;

/** Alle Texte eines Katalogs, flach, mit ihrem Pfad. */
function flach(o: unknown, pfad = ""): [string, string][] {
  if (typeof o === "string") return [[pfad, o]];
  if (!o || typeof o !== "object") return [];
  return Object.entries(o as Record<string, unknown>).flatMap(([k, v]) =>
    flach(v, pfad ? `${pfad}.${k}` : k),
  );
}

/** Die Platzhalter eines Textes, sortiert — `{assistant}` und so weiter. */
function platzhalter(text: string): string[] {
  return [...text.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((m) => m[1]!).sort();
}

const deutsch = new Map(flach(de));

/**
 * Bekannte Abweichungen — und warum sie stehen bleiben dürfen.
 *
 * `landing.coreLine2` ist der einzige Eintrag, an dem die deutsche und
 * die englische Fassung nicht dasselbe sagen:
 *
 *   de   „Jobbörsen beginnen mit einem Suchbegriff.
 *         {assistant} beginnt mit dir."
 *   en   „We do not show you more jobs.
 *         We show you the right ones."
 *
 * Beides sind gute Sätze, aber es sind zwei verschiedene Aussagen —
 * die deutsche über den Ansatz, die englische über das Ergebnis. Der
 * Unterschied ist älter als die fünf neuen Kataloge; die haben sich
 * an die englische Fassung gehalten, weil sie aus ihr übersetzt sind.
 *
 * Welche der beiden gelten soll, ist eine redaktionelle Entscheidung
 * und keine, die ein Test treffen kann. Sie steht hier, damit sie
 * sichtbar bleibt, statt jeden anderen Platzhalterfehler zu
 * überdecken — ein dauerhaft roter Test wird nach zwei Tagen nicht
 * mehr gelesen.
 */
const BEKANNTE_ABWEICHUNGEN = new Set(["landing.coreLine2"]);

describe.each(Object.entries(KATALOGE))("Katalog %s", (sprache, katalog) => {
  const eintraege = flach(katalog);

  it("hat in jedem Text dieselben Platzhalter wie das Original", () => {
    /*
     * Der wichtigste Test dieser Datei.
     *
     * `interpolate` ersetzt {assistant} durch den Namen. Fehlt der
     * Platzhalter in der Übersetzung, bleibt der Satz grammatisch heil
     * und verliert genau die Angabe, um die es ging. Wird er
     * mitübersetzt — {assistant} → {assistente} —, erscheint die
     * geschweifte Klammer im Bild.
     */
    const abweichungen: string[] = [];
    for (const [pfad, text] of eintraege) {
      if (BEKANNTE_ABWEICHUNGEN.has(pfad)) continue;
      const soll = platzhalter(deutsch.get(pfad) ?? "");
      const ist = platzhalter(text);
      if (soll.join("|") !== ist.join("|")) {
        abweichungen.push(`${pfad}: erwartet {${soll.join("},{")}}, gefunden {${ist.join("},{")}}`);
      }
    }
    expect(abweichungen, `${sprache}: Platzhalter weichen ab`).toEqual([]);
  });

  it("hat keinen leeren Text", () => {
    const leer = eintraege.filter(([, t]) => t.trim() === "").map(([p]) => p);
    expect(leer, `${sprache}: leere Einträge`).toEqual([]);
  });

  it("hat keinen Eintrag, der wörtlich deutsch geblieben ist", () => {
    /*
     * ── Warum das nicht einfach „gleich = Fehler" heisst ──────────
     *
     * Manche Texte sind in mehreren Sprachen zu Recht identisch:
     * Eigennamen, reine Platzhalter, Wörter, die man nicht übersetzt.
     * „Home" heisst auf Niederländisch nicht „Thuis", wenn die
     * Oberfläche es nicht so nennt.
     *
     * Der Test schlägt deshalb nur an, wenn ein Text mehr als drei
     * Wörter hat — bei ganzen Sätzen ist Gleichheit mit dem Deutschen
     * kein Zufall, sondern eine vergessene Zeile.
     */
    const unuebersetzt = eintraege
      .filter(([pfad, text]) => {
        const original = deutsch.get(pfad);
        if (!original || original !== text) return false;
        return original.trim().split(/\s+/).length > 3;
      })
      .map(([p]) => p);
    expect(unuebersetzt, `${sprache}: offenbar unübersetzt geblieben`).toEqual([]);
  });
});

describe("Der Prüfstand der Übersetzungen", () => {
  it("kennt für jede ausgelieferte Sprache einen Stand", async () => {
    /*
     * Damit niemand einen Rechtstext für geprüft hält, der es nicht
     * ist. Das Register steht in `pruefstand.ts` und muss jede
     * Sprache kennen, die es im Katalog gibt — kommt eine dazu, ohne
     * dass jemand ihren Stand einträgt, schlägt dieser Test an.
     */
    const { UEBERSETZUNGSSTAND } = await import("./pruefstand.ts");
    const imKatalog = ["de", "en", ...Object.keys(KATALOGE)].filter((s) => s !== "en").concat("en");
    for (const sprache of new Set(imKatalog)) {
      expect(
        UEBERSETZUNGSSTAND[sprache],
        `Für ${sprache} fehlt der Eintrag im Prüfstand`,
      ).toBeDefined();
    }
  });
});
