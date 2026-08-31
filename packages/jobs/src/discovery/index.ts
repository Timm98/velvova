import { classifyCandidates, coverageStatement, ingestable, type DiscoveryCandidate } from "@paycheck/sources";

/**
 * Web-Discovery: erfahren, DASS es eine Stelle gibt.
 *
 * Diese Schicht ist bewusst dünn, und das ist ihre wichtigste
 * Eigenschaft. Die Frage „darf mit diesem Link mehr geschehen als das
 * Verlinken?" wird hier NICHT beantwortet — sie ist in
 * `@paycheck/sources` beantwortet, in der Policy Engine, gegen das
 * Quellenverzeichnis, aus dem auch das rechtliche Verzeichnis in
 * `docs/` erzeugt wird.
 *
 * Der erste Entwurf dieser Datei hatte eine eigene Sperrliste. Sie war
 * richtig — und trotzdem falsch: eine zweite Liste derselben Domains
 * hätte irgendwann anders ausgesehen als die erste, ohne dass es jemand
 * bemerkt. Eine Compliance-Regel, die an zwei Stellen steht, ist eine
 * Regel, die an einer Stelle veraltet.
 *
 * Was hier bleibt, ist das, was es vorher nicht gab: die Anbieter, die
 * überhaupt etwas finden, und das Zusammenführen doppelter Funde.
 */

export interface DiscoveryProvider {
  readonly key: string;
  readonly displayName: string;
  /** Warum dieser Anbieter benutzt werden darf. */
  readonly grundlage: string;
  /** Ist er eingeschaltet UND eingerichtet? */
  isEnabled(): boolean;
  /**
   * Rohe Funde: Titel und Adresse, mehr nicht.
   *
   * Ein Anbieter liefert absichtlich keine Entscheidung mit. Dürfte er
   * das, wäre jeder neue Anbieter eine neue Gelegenheit, an der Policy
   * vorbeizukommen.
   */
  suche(
    anfrage: string,
    options?: { limit?: number; signal?: AbortSignal },
  ): Promise<{ url: string; title?: string | null }[]>;
}

/**
 * Suchen, bewerten, zusammenführen.
 *
 * Die Reihenfolge ist nicht beliebig: erst bewerten, dann
 * zusammenführen. Andersherum könnte ein `link_only`-Fund einen
 * freigegebenen verdrängen, und die Stelle wäre nur noch verlinkt,
 * obwohl sie ladbar gewesen wäre.
 */
export async function entdecke(
  anbieter: DiscoveryProvider[],
  anfrage: string,
  options: { limit?: number; signal?: AbortSignal; now?: Date } = {},
): Promise<{ kandidaten: DiscoveryCandidate[]; ladbar: DiscoveryCandidate[]; abdeckung: string }> {
  const jetzt = options.now ?? new Date();

  const roh = await Promise.all(
    anbieter
      .filter((p) => p.isEnabled())
      .map(async (p) => {
        try {
          const funde = await p.suche(anfrage, options);
          return classifyCandidates(funde, p.key, jetzt);
        } catch {
          /*
           * Ein Anbieter, der ausfällt, nimmt die Suche nicht mit.
           * Die Abdeckungszeile sagt ohnehin, wie viel gefunden wurde —
           * sie wird dann kleiner, und das ist die ehrliche Auskunft.
           */
          return [];
        }
      }),
  );

  const kandidaten = führeZusammen(roh.flat());

  return {
    kandidaten,
    ladbar: ingestable(kandidaten),
    abdeckung: coverageStatement(kandidaten),
  };
}

/**
 * Dieselbe Stelle, mehrfach gefunden.
 *
 * Ein Treffer bei einem Portal und derselbe auf der Karriereseite des
 * Unternehmens sind eine Stelle, nicht zwei. Welche Fassung gewinnt,
 * ist keine Geschmacksfrage:
 *
 *   1. Was geladen werden darf, schlägt einen blossen Verweis. Eine
 *      Anzeige mit Inhalt ist mehr wert als ein Link darauf.
 *   2. Danach die kürzere Adresse. Sie ist fast immer die kanonische;
 *      lange Adressen tragen Tracking-Parameter und Sitzungskennungen,
 *      die in einem halben Jahr ins Leere zeigen.
 *
 * Ohne diese Zusammenführung stünde dieselbe Stelle mehrfach in der
 * Liste — und die Zahl darüber wäre falsch. Bei „975 Stellen geprüft"
 * fiele das niemandem auf und wäre trotzdem unwahr.
 */
export function führeZusammen(kandidaten: DiscoveryCandidate[]): DiscoveryCandidate[] {
  const nachSchlüssel = new Map<string, DiscoveryCandidate>();

  for (const k of kandidaten) {
    const schlüssel = zusammenführungsschlüssel(k);
    const vorhanden = nachSchlüssel.get(schlüssel);
    if (!vorhanden || istBesser(k, vorhanden)) nachSchlüssel.set(schlüssel, k);
  }

  return [...nachSchlüssel.values()];
}

function istBesser(a: DiscoveryCandidate, b: DiscoveryCandidate): boolean {
  const ladbar = (c: DiscoveryCandidate) => c.policyDecision === "approved";
  if (ladbar(a) !== ladbar(b)) return ladbar(a);
  return a.discoveredUrl.length < b.discoveredUrl.length;
}

/**
 * Woran erkennt man dieselbe Stelle?
 *
 * Am Titel, auf das Wesentliche reduziert — nicht an der Adresse:
 * dieselbe Anzeige hat auf drei Portalen drei Adressen, und genau das
 * ist der Grund für die Zusammenführung.
 *
 * Bewusst grob. Zwei verschiedene Stellen mit demselben Titel
 * zusammenzuwerfen ist der seltenere und harmlosere Fehler; dieselbe
 * Stelle dreimal anzuzeigen ist der häufige.
 */
function zusammenführungsschlüssel(k: DiscoveryCandidate): string {
  return (k.title ?? k.discoveredUrl)
    .toLowerCase()
    // Geschlechterzusätze und Rechtsformen unterscheiden nichts und
    // stehen mal da, mal nicht.
    .replace(/\((m\/w\/d|w\/m\/d|m\/f\/d|all genders)\)/g, "")
    .replace(/\b(gmbh|ag|se|kg|mbh|ltd|inc|bv|nv|co)\b/g, "")
    .replace(/[^a-z0-9äöüß]+/g, " ")
    .trim();
}

export type { DiscoveryCandidate };
