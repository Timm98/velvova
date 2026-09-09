import type { Anbieter } from "../registry/katalog.ts";
import type { Rolle, Teamplatz } from "./aufstellung.ts";

/**
 * ══════════════════════════════════════════════════════════════════
 * Der Teamlauf — drei Modelle, ein Ergebnis, keine Endlosschleife
 * ══════════════════════════════════════════════════════════════════
 *
 * Die Aufstellung sagt, wer arbeitet. Diese Datei lässt sie arbeiten.
 *
 * ── Warum die Ausführung von aussen kommt ───────────────────────
 *
 * `ausfuehren` ist eine Eigenschaft und kein Import. Der Orchestrator
 * weiss deshalb nichts über Anbieter, Schlüssel oder Prompts — er
 * weiss nur, dass etwas pro Platz laufen soll und dass es schiefgehen
 * kann.
 *
 * Das ist der Grund, warum die Fälle prüfbar sind, die im Betrieb
 * kaputt gehen: ein Modell, das nicht antwortet; zwei, die
 * gleichzeitig scheitern; eines, das nach der Frist noch etwas
 * zurückgibt. Mit einem fest verdrahteten Anbieter liesse sich das
 * nur mit echten Netzausfällen prüfen, also gar nicht.
 *
 * ── Parallel, weil sie nichts voneinander wissen sollen ─────────
 *
 * In Runde 1 arbeiten die Modelle unabhängig. Das ist keine
 * Optimierung, sondern der Zweck: Bekäme Modell B die Antwort von
 * Modell A zu sehen, würde es sie meist bestätigen. Drei Meinungen,
 * von denen zwei aus der ersten abgeleitet sind, sind eine Meinung
 * mit Zeugen.
 *
 * Dass es dadurch auch schneller ist, ist ein Nebeneffekt.
 *
 * ── Was ein Teilausfall bedeutet ────────────────────────────────
 *
 * Zwei von drei Ergebnissen sind ein brauchbarer Lauf. Eines von drei
 * ist kein Team, sondern ein einzelnes Modell — und darf auch nicht
 * so heissen. Der Lauf sagt dann `zuWenig`, und der Aufrufer muss
 * entscheiden, ob er mit einem Modell weitermacht. Er darf es nur
 * nicht Team nennen.
 */

/** Was ein Agent zurückgibt — §7, anbieterunabhängig. */
export interface Agentenergebnis {
  /** Worauf es hinausläuft, in einem Satz. */
  schluss: string;
  befunde: string[];
  risiken: string[];
  unsicherheiten: string[];
  empfehlungen: string[];
  /**
   * Woher die Aussagen stammen.
   *
   * Leer ist erlaubt und aussagekräftig: Eine Empfehlung ohne Beleg
   * ist eine Vermutung, und die Synthese muss sie als solche
   * behandeln können.
   */
  belege: string[];
  /**
   * Wie sicher sich das Modell ist, 0 bis 1.
   *
   * Ausdrücklich KEIN Qualitätsmass. Die selbstberichtete Sicherheit
   * eines Sprachmodells ist schlecht kalibriert; sie taugt als
   * schwaches Signal und nie als Entscheidungsgrundlage.
   */
  sicherheit: number;
}

export type Agentstatus = "erfolg" | "fehlschlag" | "frist";

export interface Agentenlauf {
  rolle: Rolle;
  modellId: string;
  anbieter: Anbieter;
  status: Agentstatus;
  ergebnis: Agentenergebnis | null;
  /** Ohne Schlüssel, ohne Kopfzeilen — das hier geht in Protokolle. */
  fehler: string | null;
  dauerMs: number;
}

export interface Laufgrenzen {
  /** Wie lange ein einzelner Agent höchstens braucht. */
  agentFristMs: number;
  /** Wie lange der ganze Lauf höchstens dauert. */
  gesamtFristMs: number;
  /** Unter dieser Zahl an Ergebnissen ist es kein Team. */
  minErgebnisse: number;
}

export const LAUFGRENZEN: Laufgrenzen = {
  agentFristMs: 45_000,
  gesamtFristMs: 90_000,
  minErgebnisse: 2,
};

export interface Teamlaufergebnis {
  laeufe: Agentenlauf[];
  /** Nur die, die etwas geliefert haben — in Rollenreihenfolge. */
  ergebnisse: Agentenlauf[];
  geplant: number;
  erfolgreich: number;
  gescheitert: number;
  /**
   * `true`, wenn zu wenige Agenten geliefert haben.
   *
   * Der Lauf ist dann nicht wertlos — die vorhandenen Ergebnisse
   * stehen da. Er darf nur nicht als Team dargestellt werden.
   */
  zuWenig: boolean;
  dauerMs: number;
}

export type AgentAusfuehren = (
  platz: Teamplatz,
  signal: AbortSignal,
) => Promise<Agentenergebnis>;

/**
 * Eine Frist, die auch dann greift, wenn der Aufrufer schon eine hat.
 *
 * `AbortSignal.any` verknüpft beide: Es bricht ab, sobald das erste
 * von beiden abbricht. Ohne diese Verknüpfung überlebt ein Agent den
 * Abbruch des ganzen Laufs und rechnet auf Kosten weiter, die niemand
 * mehr braucht.
 */
function mitFrist(ms: number, aussen?: AbortSignal): AbortSignal {
  const eigen = AbortSignal.timeout(ms);
  return aussen ? AbortSignal.any([aussen, eigen]) : eigen;
}

/**
 * Das Team laufen lassen.
 *
 * Wirft nicht. Ein Lauf, bei dem alle drei Modelle scheitern, ist ein
 * Ergebnis mit drei Fehlschlägen — kein Ausnahmefall. Der Aufrufer
 * bekommt in jedem Fall ein Protokoll, aus dem hervorgeht, was
 * versucht wurde und was daraus wurde.
 */
export async function teamLauf(
  aufstellung: readonly Teamplatz[],
  ausfuehren: AgentAusfuehren,
  grenzen: Laufgrenzen = LAUFGRENZEN,
  aussenSignal?: AbortSignal,
): Promise<Teamlaufergebnis> {
  const beginn = Date.now();

  if (aufstellung.length === 0) {
    return {
      laeufe: [], ergebnisse: [], geplant: 0, erfolgreich: 0, gescheitert: 0,
      zuWenig: true, dauerMs: 0,
    };
  }

  /*
   * Die Gesamtfrist gilt für alle gemeinsam.
   *
   * Sonst könnten drei Agenten mit je 45 Sekunden zusammen 45
   * Sekunden dauern — was stimmt, solange sie parallel laufen — aber
   * bei einem hängenden Anbieter wartet der ganze Lauf die volle
   * Einzelfrist ab, obwohl die anderen längst fertig sind. Die
   * gemeinsame Frist ist die Obergrenze für den Menschen, der wartet.
   */
  const gesamt = mitFrist(grenzen.gesamtFristMs, aussenSignal);

  const laeufe = await Promise.all(
    aufstellung.map(async (platz): Promise<Agentenlauf> => {
      const start = Date.now();
      const grundlage = {
        rolle: platz.rolle,
        modellId: platz.modell.internId,
        anbieter: platz.modell.anbieter,
      };
      try {
        const ergebnis = await ausfuehren(platz, mitFrist(grenzen.agentFristMs, gesamt));
        return { ...grundlage, status: "erfolg", ergebnis, fehler: null, dauerMs: Date.now() - start };
      } catch (fehler) {
        /*
         * Ein Abbruch ist etwas anderes als ein Fehler.
         *
         * „Das Modell hat nicht geantwortet" und „das Modell hat
         * einen Fehler geliefert" führen zu verschiedenen
         * Entscheidungen: Beim ersten lohnt ein Ersatz, beim zweiten
         * meist nicht. Beides als „fehlgeschlagen" zu führen kostet
         * genau diese Unterscheidung.
         */
        const abgebrochen =
          fehler instanceof Error &&
          (fehler.name === "TimeoutError" || fehler.name === "AbortError");
        return {
          ...grundlage,
          status: abgebrochen ? "frist" : "fehlschlag",
          ergebnis: null,
          fehler: fehler instanceof Error ? fehler.message : String(fehler),
          dauerMs: Date.now() - start,
        };
      }
    }),
  );

  const ergebnisse = laeufe.filter((l) => l.ergebnis !== null);

  return {
    laeufe,
    ergebnisse,
    geplant: aufstellung.length,
    erfolgreich: ergebnisse.length,
    gescheitert: laeufe.length - ergebnisse.length,
    zuWenig: ergebnisse.length < grenzen.minErgebnisse,
    dauerMs: Date.now() - beginn,
  };
}

/* ══════════════════════════════════════════════════════════════════
   Wo sich die Modelle uneinig sind
   ══════════════════════════════════════════════════════════════════ */

export interface Dissens {
  /** Was behauptet wurde. */
  aussage: string;
  /** Wer es sagte. */
  vertreten: { rolle: Rolle; modellId: string; belegt: boolean }[];
  /**
   * Ob es dafür überhaupt einen Beleg gibt.
   *
   * Das ist die entscheidende Spalte. §8: Belege schlagen Mehrheit.
   * Zwei Modelle können denselben Fehler machen — sie haben oft
   * ähnliche Daten gesehen. Drei unbelegte Stimmen für A und eine
   * belegte für B sind kein Ergebnis für A.
   */
  belegt: boolean;
}

/**
 * Die Aussagen sammeln und danach ordnen, ob sie belegt sind.
 *
 * ── Warum das hier steht und nicht im Prompt der Synthese ───────
 *
 * Weil ein Prompt eine Bitte ist. „Bevorzuge belegte Aussagen" ist
 * eine Bitte, die ein Modell an einem schlechten Tag überliest. Wenn
 * die Aussagen schon nach Belegen geordnet in den Prompt gehen, ist
 * die Rangfolge kein Wunsch mehr, sondern die Form der Eingabe.
 *
 * Die Zuordnung ist absichtlich grob: gleiche Zeichenkette in
 * Kleinschreibung ohne Satzzeichen. Sie erkennt „Der Standort passt"
 * und „der standort passt." als dasselbe und zwei umformulierte
 * Aussagen nicht. Das ist die richtige Richtung des Fehlers — zwei
 * echte Aussagen zu verschmelzen wäre schlimmer, als eine doppelt zu
 * führen.
 */
export function aussagenLage(ergebnisse: readonly Agentenlauf[]): Dissens[] {
  const schluessel = (s: string) =>
    s.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, "").replace(/\s+/g, " ").trim();

  const gesammelt = new Map<string, Dissens>();

  for (const lauf of ergebnisse) {
    const e = lauf.ergebnis;
    if (!e) continue;
    const hatBelege = e.belege.length > 0;

    for (const aussage of [...e.befunde, ...e.empfehlungen]) {
      const k = schluessel(aussage);
      if (!k) continue;
      const vorhanden = gesammelt.get(k);
      if (vorhanden) {
        vorhanden.vertreten.push({ rolle: lauf.rolle, modellId: lauf.modellId, belegt: hatBelege });
        vorhanden.belegt ||= hatBelege;
      } else {
        gesammelt.set(k, {
          aussage,
          vertreten: [{ rolle: lauf.rolle, modellId: lauf.modellId, belegt: hatBelege }],
          belegt: hatBelege,
        });
      }
    }
  }

  /*
   * Belegtes zuerst, danach das häufiger Vertretene.
   *
   * Die Reihenfolge ist Absicht: Eine belegte Einzelstimme steht über
   * einer unbelegten Mehrheit. Wäre es andersherum, wäre die
   * Sortierung genau das Mehrheitsprinzip, das §8 verbietet.
   */
  return [...gesammelt.values()].sort(
    (a, b) =>
      Number(b.belegt) - Number(a.belegt) ||
      b.vertreten.length - a.vertreten.length ||
      a.aussage.localeCompare(b.aussage),
  );
}
