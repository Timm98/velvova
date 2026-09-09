import type { Anbieter } from "./katalog.ts";

/**
 * ══════════════════════════════════════════════════════════════════
 * Der Schutzschalter für KI-Anbieter — Anforderung 17
 * ══════════════════════════════════════════════════════════════════
 *
 * Fällt ein Anbieter aus, schickt der Router weiter Anfragen an ihn.
 * Jede läuft in dieselbe Wand, jede kostet Zeit, und der Mensch davor
 * wartet dreimal so lange auf dieselbe Fehlermeldung.
 *
 * Der Schalter merkt sich das und nimmt den Anbieter für eine Weile
 * aus der automatischen Auswahl. Die Registry hat andere Modelle;
 * genau dafür ist sie da.
 *
 * ── Warum Fehler nicht gleich Fehler ist ────────────────────────
 *
 * Der naheliegende Bau — „drei Fehler, dann zu" — nimmt einen
 * gesunden Anbieter aus dem Betrieb, sobald wir dreimal etwas
 * Fehlerhaftes hinschicken. Ein abgelehntes Dokument ist kein
 * Ausfall. Deshalb wird die Art unterschieden:
 *
 *   `eingabe`    Unsere Schuld oder die der Daten. Zählt nicht.
 *   `konto`      Schlüssel, Rechte, Kontingent. Schliesst sofort —
 *                ein Schlüssel repariert sich nicht in dreissig
 *                Sekunden, und bis dahin ist jede Anfrage vergeudet.
 *   `ueberlast`  429, 5xx, Zeitüberschreitung. Schliesst nach
 *                mehreren, denn das geht oft von selbst vorbei.
 *
 * ── Warum eine ausdrückliche Modellwahl trotzdem durchgeht ──────
 *
 * Weil sie eine Handlung eines Menschen ist und keine Schleife. Wer
 * ein Modell auswählt, bekommt entweder seine Antwort oder einen
 * echten Fehler — und dieser eine Versuch ist zugleich die Probe, die
 * den Schalter wieder öffnet. Ihn hier zu blockieren hiesse, jemandem
 * ein Modell zu verweigern, das vielleicht längst wieder läuft.
 *
 * ── Was dieser Schalter nicht kann ──────────────────────────────
 *
 * Er lebt im Arbeitsspeicher eines Prozesses. Auf Vercel bedeutet
 * das: Jede Instanz hat ihren eigenen, und eine frisch gestartete
 * weiss nichts. Der Schalter macht aus hunderten vergeblichen
 * Anfragen also nicht null, sondern wenige je Instanz. Das ist der
 * grösste Teil des Nutzens zum kleinsten Teil des Aufwands — ein
 * gemeinsamer Zustand bräuchte eine Ablage, die selbst ausfallen
 * kann, und dann fällt die Entscheidung darüber, ob wir fragen
 * dürfen, mit ihr aus.
 */

export type Fehlerart = "eingabe" | "konto" | "ueberlast";

/**
 * Die Fehlerart aus dem Fehlertext bestimmen.
 *
 * Reihenfolge mit Absicht: `eingabe` zuerst. Eine Meldung wie
 * „invalid_request_error: unsupported file type" enthält auch das
 * Wort `request` — würde zuerst auf Überlast geprüft, zählte ein
 * abgelehntes PDF als Ausfall des Anbieters.
 */
export function fehlerart(text: string): Fehlerart {
  const t = text.toLowerCase();

  if (/invalid[_ ]request|unsupported|content[_ ]filter|too many tokens|context[_ ]length|400\b/.test(t))
    return "eingabe";

  if (/\b401\b|\b403\b|unauthorized|not authorized|forbidden|invalid[_ ]?api[_ ]?key|authentication|permission|quota|billing|credit/.test(t))
    return "konto";

  return "ueberlast";
}

export interface Schalterlage {
  zustand: "zu" | "offen" | "probe";
  /** Aufeinanderfolgende zählende Fehler. */
  fehler: number;
  /** Wann er zuletzt geöffnet wurde. */
  seit: number | null;
  /** Wie lange er beim aktuellen Stand offen bleibt. */
  ruheMs: number;
  grund: string | null;
}

export interface Schaltergrenzen {
  /** So viele Überlastfehler hintereinander, dann zu. */
  schwelle: number;
  /** Erste Ruhezeit nach dem Öffnen. */
  ruheMs: number;
  /** Obergrenze, wenn sich die Ruhezeit verdoppelt. */
  maxRuheMs: number;
  /** Ruhezeit bei Kontofehlern — die brauchen einen Menschen. */
  kontoRuheMs: number;
}

export const SCHALTERGRENZEN: Schaltergrenzen = {
  schwelle: 3,
  ruheMs: 30_000,
  maxRuheMs: 10 * 60_000,
  kontoRuheMs: 5 * 60_000,
};

interface Eintrag {
  fehler: number;
  offenSeit: number | null;
  ruheMs: number;
  grund: string | null;
  /** Eine Probe läuft — kein zweiter darf gleichzeitig durch. */
  probeLaeuft: boolean;
}

const zustaende = new Map<Anbieter, Eintrag>();

function eintrag(anbieter: Anbieter): Eintrag {
  let e = zustaende.get(anbieter);
  if (!e) {
    e = { fehler: 0, offenSeit: null, ruheMs: 0, grund: null, probeLaeuft: false };
    zustaende.set(anbieter, e);
  }
  return e;
}

/**
 * Einen Ausgang melden.
 *
 * `ok: true` schliesst den Schalter und setzt alles zurück — auch
 * einen halb offenen. Ein Anbieter, der antwortet, ist gesund, egal
 * was vorher war.
 */
export function anbieterMelden(
  anbieter: Anbieter,
  ok: boolean,
  fehlertext = "",
  grenzen: Schaltergrenzen = SCHALTERGRENZEN,
  jetzt = Date.now(),
): void {
  const e = eintrag(anbieter);

  if (ok) {
    e.fehler = 0;
    e.offenSeit = null;
    e.ruheMs = 0;
    e.grund = null;
    e.probeLaeuft = false;
    return;
  }

  const art = fehlerart(fehlertext);
  e.probeLaeuft = false;

  /* Unsere Schuld — der Anbieter ist gesund. Nichts zählen. */
  if (art === "eingabe") return;

  if (art === "konto") {
    e.fehler += 1;
    e.offenSeit = jetzt;
    e.ruheMs = grenzen.kontoRuheMs;
    e.grund = "Konto, Schlüssel oder Kontingent — das braucht einen Menschen.";
    return;
  }

  e.fehler += 1;
  if (e.fehler >= grenzen.schwelle) {
    /*
     * Beim Wiederöffnen verdoppeln.
     *
     * Ein Anbieter, der nach dreissig Sekunden immer noch nicht kann,
     * kann es meist auch nach den nächsten dreissig nicht. Ohne die
     * Verdopplung probiert der Schalter bei einem längeren Ausfall
     * alle halbe Minute erneut — und genau dieses Rauschen soll er
     * verhindern.
     */
    e.ruheMs = e.offenSeit === null
      ? grenzen.ruheMs
      : Math.min(grenzen.maxRuheMs, e.ruheMs * 2);
    e.offenSeit = jetzt;
    e.grund = `${e.fehler} Fehler hintereinander (Überlast oder Netz).`;
  }
}

/** Die Lage eines Anbieters — ohne sie zu verändern. */
export function schalterlage(
  anbieter: Anbieter,
  jetzt = Date.now(),
): Schalterlage {
  const e = zustaende.get(anbieter);
  if (!e || e.offenSeit === null) {
    return { zustand: "zu", fehler: e?.fehler ?? 0, seit: null, ruheMs: 0, grund: null };
  }
  const abgelaufen = jetzt - e.offenSeit >= e.ruheMs;
  return {
    zustand: abgelaufen ? "probe" : "offen",
    fehler: e.fehler,
    seit: e.offenSeit,
    ruheMs: e.ruheMs,
    grund: e.grund,
  };
}

/**
 * Darf der Router diesen Anbieter gerade nicht nehmen?
 *
 * Das ist die Frage, die `rangfolge` stellt. Nach Ablauf der Ruhezeit
 * lässt sie GENAU EINEN durch: Wären es alle, träfe die volle Last
 * einen Anbieter, von dem wir nur vermuten, dass er wieder kann —
 * und der Schalter hätte den Zusammenbruch nur verschoben.
 */
export function anbieterGestoert(anbieter: Anbieter, jetzt = Date.now()): boolean {
  const e = zustaende.get(anbieter);
  if (!e || e.offenSeit === null) return false;

  if (jetzt - e.offenSeit < e.ruheMs) return true;

  if (e.probeLaeuft) return true;
  e.probeLaeuft = true;
  return false;
}

/** Alle Lagen — für das Betreiber-Dashboard (Anforderung 18). */
export function alleSchalterlagen(jetzt = Date.now()): { anbieter: Anbieter; lage: Schalterlage }[] {
  return [...zustaende.keys()].map((anbieter) => ({ anbieter, lage: schalterlage(anbieter, jetzt) }));
}

/** Nur für Tests und den Betreiberknopf „jetzt neu versuchen". */
export function schalterZuruecksetzen(anbieter?: Anbieter): void {
  if (anbieter) zustaende.delete(anbieter);
  else zustaende.clear();
}
