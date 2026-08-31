/**
 * Der Ablauf eines Live-Gesprächs.
 *
 * Bewusst eine reine Funktion über einem Zustand und keine Klasse mit
 * Timern, WebRTC-Verbindung und Audioelementen darin. Der Grund ist
 * prüfbarkeit: die schwierigen Stellen eines Sprachgesprächs sind
 * keine Netzwerkfragen, sondern Reihenfolgefragen —
 *
 *   Was passiert, wenn jemand zu reden anfängt, während Nina spricht?
 *   Was, wenn die Antwort auf einen abgebrochenen Satz eintrifft?
 *   Was, wenn der Ton startet, nachdem längst unterbrochen wurde?
 *
 * Das sind Fragen an eine Zustandsmaschine, und die kann man in
 * Millisekunden hundertmal durchspielen, statt jedes Mal ein Mikrofon
 * zu suchen.
 *
 * Die Zustände folgen V7 §14.5:
 *
 *   Mensch beginnt zu sprechen  → hört
 *   Redebeitrag beendet         → denkt
 *   erster Ton                  → spricht
 *   Ton zu Ende                 → hört
 */

export type LiveZustand =
  | "aus"
  | "verbindet"
  | "hört"
  | "denkt"
  | "spricht"
  | "fehler";

export interface LiveStand {
  zustand: LiveZustand;
  /** Was gerade erkannt wird, noch nicht abgeschlossen. */
  teiltranskript: string;
  /**
   * Die laufende Nummer des Redebeitrags.
   *
   * Sie ist das ganze Geheimnis des Unterbrechens. Jede Antwort und
   * jeder Ton tragen die Nummer, zu der sie gehören; steigt die Nummer,
   * ist alles Ältere ungültig. Ohne sie kommt die Antwort auf einen
   * abgebrochenen Satz Sekunden später doch noch aus dem Lautsprecher —
   * der Fehler, den man erst im Betrieb hört und dann nicht mehr
   * vergisst.
   */
  zug: number;
  fehler: string | null;
}

export const START: LiveStand = {
  zustand: "aus",
  teiltranskript: "",
  zug: 0,
  fehler: null,
};

export type LiveEreignis =
  | { art: "verbinden" }
  | { art: "verbunden" }
  | { art: "sprache_beginnt" }
  | { art: "teiltranskript"; text: string }
  | { art: "redebeitrag_fertig"; text: string }
  | { art: "antwort_fertig"; zug: number }
  | { art: "ton_beginnt"; zug: number }
  | { art: "ton_endet"; zug: number }
  | { art: "fehler"; text: string }
  | { art: "beenden" };

/** Was die Hülle nach einem Übergang tun soll. */
export interface Wirkung {
  /** Diesen Text an Nina schicken. */
  sende?: string;
  /** Laufende Tonausgabe und Anfragen abbrechen. */
  brichAb?: boolean;
  /** Verbindung und Mikrofon schliessen. */
  schliesse?: boolean;
}

export function weiter(
  stand: LiveStand,
  e: LiveEreignis,
): { stand: LiveStand; wirkung: Wirkung } {
  switch (e.art) {
    case "verbinden":
      return { stand: { ...START, zustand: "verbindet" }, wirkung: {} };

    case "verbunden":
      // Nach dem Verbinden wird zugehört, nicht gesprochen. Nina
      // begrüsst niemanden von sich aus — wer den Knopf drückt, will
      // reden, nicht angesprochen werden.
      return { stand: { ...stand, zustand: "hört", fehler: null }, wirkung: {} };

    case "sprache_beginnt": {
      if (stand.zustand === "aus" || stand.zustand === "fehler") {
        return { stand, wirkung: {} };
      }

      /*
       * Hier steht das Unterbrechen (§14.6).
       *
       * Fängt jemand an zu reden, während Nina spricht oder denkt,
       * gewinnt der Mensch. Sofort: Ton aus, Warteschlange leer,
       * laufende Erzeugung abgebrochen, Anfrage abgebrochen.
       *
       * Die Zugnummer steigt dabei — das ist der Teil, der auch das
       * verhindert, was danach noch eintrudelt.
       */
      const unterbricht = stand.zustand === "spricht" || stand.zustand === "denkt";

      return {
        stand: {
          ...stand,
          zustand: "hört",
          teiltranskript: "",
          zug: unterbricht ? stand.zug + 1 : stand.zug,
        },
        wirkung: unterbricht ? { brichAb: true } : {},
      };
    }

    case "teiltranskript":
      // Nur anzeigen, solange wirklich zugehört wird. Ein Teilsatz, der
      // nach dem Ende des Redebeitrags eintrifft, würde sonst unter
      // Ninas Antwort stehen bleiben.
      if (stand.zustand !== "hört") return { stand, wirkung: {} };
      return { stand: { ...stand, teiltranskript: e.text }, wirkung: {} };

    case "redebeitrag_fertig": {
      const text = e.text.trim();
      if (stand.zustand !== "hört") return { stand, wirkung: {} };

      // Leere Beiträge kommen vor: ein Husten, eine zugeschlagene Tür.
      // Sie erzeugen keine Anfrage — sonst antwortet Nina auf ein
      // Geräusch.
      if (text.length === 0) {
        return { stand: { ...stand, teiltranskript: "" }, wirkung: {} };
      }

      return {
        stand: { ...stand, zustand: "denkt", teiltranskript: "" },
        wirkung: { sende: text },
      };
    }

    case "antwort_fertig":
      // Veraltet? Dann ist sie das Ergebnis eines unterbrochenen Zuges
      // und wird verworfen, statt gesprochen zu werden.
      if (e.zug !== stand.zug || stand.zustand !== "denkt") {
        return { stand, wirkung: {} };
      }
      return { stand, wirkung: {} };

    case "ton_beginnt":
      if (e.zug !== stand.zug) return { stand, wirkung: {} };
      if (stand.zustand !== "denkt") return { stand, wirkung: {} };
      return { stand: { ...stand, zustand: "spricht" }, wirkung: {} };

    case "ton_endet":
      if (e.zug !== stand.zug) return { stand, wirkung: {} };
      if (stand.zustand !== "spricht") return { stand, wirkung: {} };
      // Zurück ins Zuhören, ohne dass jemand etwas drücken muss. Das
      // ist der Unterschied zwischen einem Gespräch und einem Diktat.
      return { stand: { ...stand, zustand: "hört" }, wirkung: {} };

    case "fehler":
      return {
        stand: { ...stand, zustand: "fehler", fehler: e.text, teiltranskript: "" },
        wirkung: { brichAb: true, schliesse: true },
      };

    case "beenden":
      return {
        stand: { ...START, zug: stand.zug + 1 },
        wirkung: { brichAb: true, schliesse: true },
      };
  }
}

/** Für die Statuszeile. Kurz, ohne Fachwort, ohne Prozentzahl. */
export const LIVE_TEXT: Record<LiveZustand, string> = {
  aus: "Live-Gespräch beendet",
  verbindet: "Verbindung wird aufgebaut …",
  hört: "Ich höre zu",
  denkt: "Ich denke nach …",
  spricht: "Ich spreche",
  fehler: "Das Live-Gespräch ist unterbrochen",
};
