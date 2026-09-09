import type { Anbieter } from "../registry/katalog.ts";
import type { Rolle, Teamplatz } from "./aufstellung.ts";
import type { Agentenlauf } from "./lauf.ts";

/**
 * ══════════════════════════════════════════════════════════════════
 * Runde 2 — die Gegenprüfung
 * ══════════════════════════════════════════════════════════════════
 *
 * In Runde 1 arbeitet jedes Modell allein und sieht die anderen
 * nicht. Das ist Absicht: Sobald ein Modell die Antwort eines anderen
 * kennt, schliesst es sich ihr an. Drei Modelle, die einander gelesen
 * haben, sind ein Modell mit dreifachen Kosten.
 *
 * Runde 2 dreht das um. Jetzt bekommt jedes Modell die Aussagen der
 * anderen — nicht mit der Frage „stimmst du zu?", sondern mit der
 * Frage „welche davon hältst du für falsch, und warum?".
 *
 * ── Zwei Regeln, ohne die das keine Prüfung ist ─────────────────
 *
 * **Niemand prüft sich selbst.** Ein Modell, dem man die eigene
 * Aussage zur Prüfung vorlegt, bestätigt sie. Das ist kein Urteil,
 * sondern ein Echo, und im Lagebild wäre es später nicht mehr von
 * einer echten Bestätigung zu unterscheiden.
 *
 * **Niemand erfährt, von wem eine Aussage stammt.** Die Aussagen
 * gehen anonym in die Prüfung. Sonst prüft man nicht mehr die
 * Aussage, sondern den Absender: Wer weiss, dass eine Behauptung vom
 * teuersten Modell kommt, widerspricht ihr seltener. Genau diese
 * Höflichkeit macht die zweite Runde wertlos.
 *
 * ── Warum es Fälle gibt, in denen Runde 2 ausfällt ──────────────
 *
 * Weil sie Geld und Zeit kostet und nur dann etwas hergibt, wenn es
 * mindestens zwei Ergebnisse zu vergleichen gibt. Bei einem Ergebnis
 * gibt es nichts gegenzuprüfen — dann bleibt es bei Runde 1, und das
 * Ergebnis sagt das auch.
 */

/** Wie ein Prüfer über eine einzelne fremde Aussage urteilt. */
export interface Pruefurteil {
  /**
   * Die geprüfte Aussage, wörtlich wie vorgelegt.
   *
   * Wörtlich, weil das Lagebild sie später wieder zuordnen muss. Ein
   * Prüfer, der umformuliert, erzeugt eine neue Aussage statt eines
   * Urteils über eine vorhandene — deshalb prüft `pruefungOrdnen`
   * nach, ob die Aussage überhaupt vorgelegt wurde.
   */
  aussage: string;
  urteil: "gestuetzt" | "widersprochen" | "unklar";
  /** Warum. Ohne Begründung zählt ein Widerspruch nicht. */
  begruendung: string;
  /**
   * Der Beleg, falls es einen gibt.
   *
   * Entscheidend beim Widerspruch: Ein belegter Widerspruch wiegt im
   * Lagebild schwerer als ein unbelegter, weil sonst jedes „das
   * glaube ich nicht" eine belegte Aussage kippen könnte.
   */
  beleg: string | null;
}

export interface Pruefergebnis {
  urteile: Pruefurteil[];
}

export interface Prueflauf {
  rolle: Rolle;
  modellId: string;
  anbieter: Anbieter;
  status: "erfolg" | "fehlschlag" | "frist";
  ergebnis: Pruefergebnis | null;
  fehler: string | null;
  dauerMs: number;
}

/** Eine fremde Aussage, wie sie einem Prüfer vorgelegt wird. */
export interface Vorlage {
  /** `A`, `B`, `C` … — nie ein Modellname. Siehe oben. */
  kennung: string;
  aussage: string;
  /** Ob der Urheber dafür Belege angegeben hat. */
  belegt: boolean;
}

export type PruefAusfuehren = (
  platz: Teamplatz,
  vorlagen: readonly Vorlage[],
  signal: AbortSignal,
) => Promise<Pruefergebnis>;

export interface Pruefgrenzen {
  pruefFristMs: number;
  gesamtFristMs: number;
  /** Unter so vielen Ergebnissen aus Runde 1 gibt es nichts zu prüfen. */
  minErgebnisse: number;
  /**
   * Wie viele fremde Aussagen ein Prüfer höchstens sieht.
   *
   * Nicht aus Sparsamkeit: Eine Liste mit sechzig Punkten wird nicht
   * geprüft, sondern überflogen. Die Grenze zwingt zur Auswahl, und
   * die Auswahl trifft das Lagebild nach Belegen — nicht der Zufall
   * der Reihenfolge.
   */
  maxVorlagen: number;
}

export const PRUEFGRENZEN: Pruefgrenzen = {
  pruefFristMs: 30_000,
  gesamtFristMs: 60_000,
  minErgebnisse: 2,
  maxVorlagen: 12,
};

export interface Pruefrundenergebnis {
  laeufe: Prueflauf[];
  /** Nur die, die geurteilt haben. */
  ergebnisse: Prueflauf[];
  /**
   * `true`, wenn die Runde gar nicht stattgefunden hat.
   *
   * Kein Fehler — ein Ergebnis. Der Aufrufer darf dann nicht
   * behaupten, es sei gegengeprüft worden.
   */
  ausgefallen: boolean;
  grund: string | null;
  dauerMs: number;
}

/**
 * Die Aussagen eines Laufs für die Vorlage einsammeln.
 *
 * Befunde und Empfehlungen, nicht Risiken und Unsicherheiten: Ein
 * Risiko ist bereits als „könnte sein" formuliert, und ihm zu
 * widersprechen ergibt keinen Sinn. Geprüft wird, was behauptet wird.
 */
function aussagenVon(lauf: Agentenlauf): string[] {
  const e = lauf.ergebnis;
  if (!e) return [];
  return [...e.befunde, ...e.empfehlungen].map((s) => s.trim()).filter((s) => s.length > 0);
}

const KENNUNGEN = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Die Vorlage für einen bestimmten Prüfer bauen.
 *
 * Alles ausser seinen eigenen Aussagen, anonym, belegtes zuerst.
 * Belegtes zuerst, weil `maxVorlagen` sonst genau das abschneidet,
 * worüber ein Urteil am meisten wert wäre.
 */
export function vorlageFuer(
  pruefer: Rolle,
  ergebnisse: readonly Agentenlauf[],
  grenzen: Pruefgrenzen = PRUEFGRENZEN,
): Vorlage[] {
  const fremd: { aussage: string; belegt: boolean }[] = [];

  for (const lauf of ergebnisse) {
    if (lauf.rolle === pruefer) continue;
    const belegt = (lauf.ergebnis?.belege.length ?? 0) > 0;
    for (const aussage of aussagenVon(lauf)) fremd.push({ aussage, belegt });
  }

  /* Doppelte zusammenführen: Zwei Modelle mit demselben Satz sind
     eine Aussage, keine zwei. Belegt bleibt belegt. */
  const zusammen = new Map<string, { aussage: string; belegt: boolean }>();
  for (const eintrag of fremd) {
    const k = eintrag.aussage.toLowerCase();
    const da = zusammen.get(k);
    if (da) da.belegt ||= eintrag.belegt;
    else zusammen.set(k, { ...eintrag });
  }

  return [...zusammen.values()]
    .sort((a, b) => Number(b.belegt) - Number(a.belegt) || a.aussage.localeCompare(b.aussage))
    .slice(0, grenzen.maxVorlagen)
    .map((e, i) => ({
      /* Über 26 Aussagen hinaus doppelte Buchstaben statt Absturz. */
      kennung: KENNUNGEN[i % 26]!.repeat(Math.floor(i / 26) + 1),
      aussage: e.aussage,
      belegt: e.belegt,
    }));
}

/**
 * Urteile eines Prüfers auf das zurückschneiden, was zulässig ist.
 *
 * Ein Modell kann alles zurückgeben: Urteile über Aussagen, die nie
 * vorgelegt wurden, oder einen Widerspruch ohne ein Wort Begründung.
 * Beides landet ungeprüft im Lagebild und verschiebt dort echte
 * Ergebnisse — deshalb wird hier aussortiert und nicht später.
 *
 * Ein Widerspruch ohne Begründung wird zu `unklar` herabgestuft
 * statt verworfen: Dass ein Modell an einer Aussage zweifelt, ist
 * eine Information. Sie reicht nur nicht, um sie zu kippen.
 */
export function pruefungOrdnen(
  ergebnis: Pruefergebnis,
  vorlagen: readonly Vorlage[],
): Pruefurteil[] {
  const erlaubt = new Map(vorlagen.map((v) => [v.aussage.toLowerCase().trim(), v.aussage]));
  const gesehen = new Set<string>();
  const raus: Pruefurteil[] = [];

  for (const u of ergebnis.urteile) {
    const k = u.aussage?.toLowerCase().trim() ?? "";
    const wortlaut = erlaubt.get(k);
    if (!wortlaut) continue;
    /* Nur ein Urteil je Aussage — das erste zählt. */
    if (gesehen.has(k)) continue;
    gesehen.add(k);

    const begruendet = u.begruendung?.trim().length > 0;
    raus.push({
      aussage: wortlaut,
      urteil: u.urteil === "widersprochen" && !begruendet ? "unklar" : u.urteil,
      begruendung: u.begruendung?.trim() ?? "",
      beleg: u.beleg?.trim() ? u.beleg.trim() : null,
    });
  }

  return raus;
}

function mitFrist(ms: number, aussen?: AbortSignal): AbortSignal {
  const eigen = AbortSignal.timeout(ms);
  return aussen ? AbortSignal.any([aussen, eigen]) : eigen;
}

/**
 * Die Gegenprüfung durchführen.
 *
 * Wirft nicht. Eine Runde, in der jeder Prüfer scheitert, ist ein
 * Ergebnis ohne Urteile — das Lagebild kommt damit zurecht und sagt
 * dann eben, dass nichts gegengeprüft wurde.
 */
export async function pruefrunde(
  team: readonly Teamplatz[],
  runde1: readonly Agentenlauf[],
  ausfuehren: PruefAusfuehren,
  grenzen: Pruefgrenzen = PRUEFGRENZEN,
  aussen?: AbortSignal,
): Promise<Pruefrundenergebnis> {
  const beginn = Date.now();
  const geliefert = runde1.filter((l) => l.status === "erfolg" && l.ergebnis !== null);

  if (geliefert.length < grenzen.minErgebnisse) {
    return {
      laeufe: [],
      ergebnisse: [],
      ausgefallen: true,
      grund: `Nur ${geliefert.length} Ergebnis(se) aus Runde 1 — nichts gegenzuprüfen.`,
      dauerMs: Date.now() - beginn,
    };
  }

  const gesamt = mitFrist(grenzen.gesamtFristMs, aussen);

  /*
   * Prüfen darf nur, wer in Runde 1 geliefert hat.
   *
   * Ein Modell, das gerade ausgefallen oder in die Frist gelaufen
   * ist, urteilt sonst über Arbeit, an der es sich nicht beteiligt
   * hat — und sein Widerspruch wöge im Lagebild genauso viel wie
   * einer von jemandem, der die Aufgabe tatsächlich bearbeitet hat.
   */
  const zugelassen = team.filter((p) => geliefert.some((l) => l.rolle === p.rolle));

  const laeufe = await Promise.all(
    zugelassen.map(async (platz): Promise<Prueflauf> => {
      const start = Date.now();
      const vorlagen = vorlageFuer(platz.rolle, geliefert, grenzen);
      const grund: Omit<Prueflauf, "status" | "ergebnis" | "fehler" | "dauerMs"> = {
        rolle: platz.rolle,
        modellId: platz.modell.internId,
        anbieter: platz.modell.anbieter,
      };

      if (vorlagen.length === 0) {
        return { ...grund, status: "fehlschlag", ergebnis: null,
          fehler: "Keine fremden Aussagen zum Prüfen.", dauerMs: Date.now() - start };
      }

      try {
        const roh = await ausfuehren(platz, vorlagen, mitFrist(grenzen.pruefFristMs, gesamt));
        return {
          ...grund,
          status: "erfolg",
          ergebnis: { urteile: pruefungOrdnen(roh, vorlagen) },
          fehler: null,
          dauerMs: Date.now() - start,
        };
      } catch (fehler) {
        const text = fehler instanceof Error ? fehler.message : String(fehler);
        const frist = /abort|timeout|frist/i.test(text);
        return {
          ...grund,
          status: frist ? "frist" : "fehlschlag",
          ergebnis: null,
          fehler: text.slice(0, 300),
          dauerMs: Date.now() - start,
        };
      }
    }),
  );

  const ergebnisse = laeufe.filter((l) => l.status === "erfolg" && l.ergebnis !== null);

  return {
    laeufe,
    ergebnisse,
    ausgefallen: false,
    grund: null,
    dauerMs: Date.now() - beginn,
  };
}
