/**
 * Ob eine Stelle noch ausgeschrieben ist — und woher wir das wissen.
 *
 * ══════════════════════════════════════════════════════════════
 * Die zwei Verwechslungen, gegen die diese Datei gebaut ist
 * ══════════════════════════════════════════════════════════════
 *
 *   „Link kaputt"        ist nicht  „Stelle abgelaufen"
 *   „nicht mehr im Feed" ist nicht  „besetzt"
 *
 * Beide sehen sich zum Verwechseln ähnlich und bedeuten Verschiedenes.
 * Ein Bewerbungsserver, der drei Minuten lang 500 antwortet, hat nichts
 * über eine Ausschreibung gesagt. Ein Job, der aus einem Feed
 * verschwindet, kann geschlossen sein — oder der Feed hat seine
 * Paginierung geändert.
 *
 * Wer beides gleichsetzt, schliesst bei einem fünfminütigen Ausfall
 * eines ATS tausende Stellen auf einmal. Das ist kein hypothetisches
 * Risiko: Es ist der Normalfall bei jeder Störung.
 *
 * ══════════════════════════════════════════════════════════════
 * Vier Vertrauensstufen
 * ══════════════════════════════════════════════════════════════
 *
 *   1. Die Quelle sagt es ausdrücklich    stärkstes Signal
 *   2. Verschwunden nach VOLLSTÄNDIGEN Läufen
 *   3. Frist abgelaufen                   nicht „besetzt"
 *   4. Technische Prüfung                 nur Ergänzung
 *
 * Stufe 4 steht bewusst unten. Ein 404 auf einer zuvor erreichbaren
 * Bewerbungsseite ist ein Hinweis; ein 403 oder ein Zeitablauf ist
 * gar nichts — dahinter steht meistens ein Botschutz.
 */

export type Verfuegbarkeit =
  /** Die Quelle führt sie als aktive Ausschreibung. */
  | "active"
  /** Die Bewerbungsfrist ist verstrichen. NICHT „besetzt". */
  | "deadline_expired"
  /** Aus einem vollständig geladenen Feed verschwunden, bestätigt. */
  | "no_longer_published"
  /** Die Quelle nennt sie ausdrücklich beendet. */
  | "source_reported_closed"
  /** Die Bewerbungsseite antwortet dauerhaft mit 404 oder 410. */
  | "application_unavailable"
  /** Einmal vermisst, noch nicht bestätigt. */
  | "verification_pending"
  /** Nie etwas Belastbares gesehen. */
  | "unknown";

/**
 * Was ein Lauf über eine Stelle gesehen hat.
 *
 * `feedVollstaendig` ist das wichtigste Feld dieser Datei. Es sagt
 * nicht „der Abruf hat funktioniert", sondern „wir haben den ganzen
 * Bestand dieser Quelle gesehen". Nur dann bedeutet ein fehlender Job
 * etwas. Bei einem abgebrochenen Lauf, einem Zeitbudget, das griff,
 * oder einer Seite, die nie kam, ist er nicht vollständig — und dann
 * ist ein fehlender Job kein Signal, sondern eine Lücke.
 */
export interface Beobachtung {
  /** Stand die Stelle in diesem Lauf im Feed? */
  gesehen: boolean;
  /**
   * Hat der Lauf den GANZEN Bestand der Quelle geladen?
   *
   * `false` bei jedem Fehler, jedem Abbruch und jedem Lauf mit
   * Zeitbudget. Im Zweifel `false`: Ein zu vorsichtiges `false` kostet
   * einen Tag Verzögerung, ein falsches `true` schliesst den Bestand.
   */
  feedVollstaendig: boolean;
  /** Die Quelle nennt die Stelle ausdrücklich beendet. */
  quelleSagtBeendet?: boolean;
  /** Bewerbungsfrist laut Quelle. */
  fristBis?: Date | null;
  /**
   * Ergebnis einer Linkprüfung — nur als Ergänzung.
   *
   * `"weg"` nur bei 404 oder 410. Ein 403, 405, 429 oder Zeitablauf
   * ist `"unklar"`: Dahinter steht meistens ein Botschutz, und der
   * sagt über die Ausschreibung nichts.
   */
  linkpruefung?: "ok" | "weg" | "unklar";
  jetzt?: Date;
}

export interface Verfuegbarkeitsstand {
  zustand: Verfuegbarkeit;
  /** In Worten, für die Oberfläche und fürs Protokoll. */
  grund: string | null;
  /** Wie oft die Stelle bei VOLLSTÄNDIGEN Läufen gefehlt hat. */
  fehltSeitLaeufen: number;
  geprueftAm: Date | null;
  zuletztGesehenAm: Date | null;
}

export const LEERER_STAND: Verfuegbarkeitsstand = {
  zustand: "unknown",
  grund: null,
  fehltSeitLaeufen: 0,
  geprueftAm: null,
  zuletztGesehenAm: null,
};

/**
 * Wie oft eine Stelle fehlen muss, bevor sie als nicht mehr
 * veröffentlicht gilt.
 *
 * Zwei, nicht eins. Der erste vollständige Lauf ohne die Stelle kann
 * an vielem liegen — einer geänderten Seitengrösse, einem Filter, der
 * anders greift, einem Datensatz, der beim Umwandeln durchfiel. Der
 * zweite bestätigt.
 *
 * Zwei kostet einen halben Tag Verzögerung. Eins kostet bei jedem
 * Sonderfall der Quelle den halben Bestand.
 */
export const BESTAETIGUNGEN = 2;

/**
 * Den Stand fortschreiben.
 *
 * Reine Funktion: Sie bekommt den alten Stand und eine Beobachtung und
 * gibt den neuen zurück. Kein Datenbankzugriff, keine Uhr ausser der
 * übergebenen — damit ist jeder Übergang einzeln prüfbar.
 */
export function fortschreiben(
  vorher: Verfuegbarkeitsstand,
  b: Beobachtung,
): Verfuegbarkeitsstand {
  const jetzt = b.jetzt ?? new Date();

  /*
   * ── Stufe 1: Die Quelle sagt es ────────────────────────────
   *
   * Zuerst, weil nichts darüber steht. Ein ausdrückliches
   * `toUnpost`, `closed` oder `inactive` ist die Auskunft des
   * Arbeitgebers selbst — kein Rückschluss.
   */
  if (b.quelleSagtBeendet) {
    return {
      zustand: "source_reported_closed",
      grund: "Die Quelle führt die Stelle nicht mehr als aktive Ausschreibung.",
      fehltSeitLaeufen: vorher.fehltSeitLaeufen,
      geprueftAm: jetzt,
      zuletztGesehenAm: b.gesehen ? jetzt : vorher.zuletztGesehenAm,
    };
  }

  /*
   * ── Der Lauf war unvollständig: nichts ändern ──────────────
   *
   * Das ist die wichtigste Zeile der Datei. Ein Fehler, ein Zeitablauf,
   * ein 429, ein abgebrochener Lauf — nichts davon sagt etwas über
   * eine einzelne Stelle.
   *
   * `geprueftAm` wird bewusst NICHT gesetzt: Es gab keine Prüfung.
   * Ein Zeitstempel hier liesse den Stand frischer aussehen, als er
   * ist.
   */
  if (!b.feedVollstaendig) {
    if (!b.gesehen) return vorher;
    /* Gesehen zählt immer — auch aus einem Teilabruf. */
    return {
      ...vorher,
      zustand: vorher.zustand === "active" ? "active" : vorher.zustand,
      zuletztGesehenAm: jetzt,
    };
  }

  /* ── Vollständiger Lauf, Stelle vorhanden ──────────────────── */
  if (b.gesehen) {
    const frist = fristAbgelaufen(b.fristBis, jetzt);
    return {
      zustand: frist ? "deadline_expired" : "active",
      grund: frist
        ? `Die Bewerbungsfrist lief am ${b.fristBis!.toISOString().slice(0, 10)} ab. Ob die Stelle besetzt ist, sagt die Quelle nicht.`
        : null,
      /* Wieder da heisst wieder bei null. */
      fehltSeitLaeufen: 0,
      geprueftAm: jetzt,
      zuletztGesehenAm: jetzt,
    };
  }

  /*
   * ── Vollständiger Lauf, Stelle fehlt ───────────────────────
   *
   * Erst zählen, dann urteilen. Beim ersten Fehlen bleibt es bei
   * „wird geprüft"; erst die Bestätigung nimmt sie aus den aktiven
   * Empfehlungen.
   */
  const fehlt = vorher.fehltSeitLaeufen + 1;

  if (fehlt < BESTAETIGUNGEN) {
    return {
      zustand: "verification_pending",
      grund: "Beim letzten vollständigen Abruf nicht mehr im Feed. Wird beim nächsten Lauf geprüft.",
      fehltSeitLaeufen: fehlt,
      geprueftAm: jetzt,
      zuletztGesehenAm: vorher.zuletztGesehenAm,
    };
  }

  return {
    zustand: "no_longer_published",
    grund: "Von der Quelle nicht mehr veröffentlicht.",
    fehltSeitLaeufen: fehlt,
    geprueftAm: jetzt,
    zuletztGesehenAm: vorher.zuletztGesehenAm,
  };
}

/**
 * Eine Linkprüfung einarbeiten — als Ergänzung, nie als Urteil.
 *
 * Nur `"weg"` (404/410) ändert etwas, und auch das nur, wenn die
 * Quelle nichts Stärkeres gesagt hat. `"unklar"` — 403, 405, 429,
 * Zeitablauf — ändert nie etwas: Dahinter steht meistens ein
 * Botschutz, und ein Botschutz weiss nichts über Ausschreibungen.
 */
export function linkpruefungEinarbeiten(
  vorher: Verfuegbarkeitsstand,
  ergebnis: "ok" | "weg" | "unklar",
  jetzt = new Date(),
): Verfuegbarkeitsstand {
  if (ergebnis === "unklar") return vorher;

  /* Ein ausdrückliches Quellsignal steht über jeder Linkprüfung. */
  if (vorher.zustand === "source_reported_closed") return vorher;

  if (ergebnis === "weg") {
    return {
      ...vorher,
      zustand: "application_unavailable",
      grund: "Die Bewerbungsseite antwortet nicht mehr. Ob die Stelle besetzt ist, ist damit nicht gesagt.",
      geprueftAm: jetzt,
    };
  }

  /* Wieder erreichbar hebt nur die Linkaussage auf, nicht mehr. */
  if (vorher.zustand === "application_unavailable") {
    return { ...vorher, zustand: "active", grund: null, geprueftAm: jetzt };
  }
  return vorher;
}

/**
 * Zählt die Stelle noch als aktive Empfehlung?
 *
 * `deadline_expired` zählt bewusst NICHT als aktiv, aber die Stelle
 * verschwindet auch nicht: Sie wird nur nicht mehr empfohlen. Wer sie
 * gespeichert hat, sieht sie weiter — mit dem Grund daneben.
 */
export function giltAlsAktiv(zustand: Verfuegbarkeit): boolean {
  return zustand === "active" || zustand === "verification_pending" || zustand === "unknown";
}

/**
 * Der Satz für die Oberfläche.
 *
 * Nie „besetzt". Das wissen wir fast nie — und es zu behaupten macht
 * aus einer Beobachtung über einen Feed eine Aussage über einen
 * Arbeitsvertrag.
 */
export function verfuegbarkeitstext(stand: Verfuegbarkeitsstand): string {
  const gesehen = stand.zuletztGesehenAm
    ? ` Zuletzt aktiv gesehen: ${stand.zuletztGesehenAm.toLocaleDateString("de-DE", { day: "numeric", month: "long" })}.`
    : "";

  switch (stand.zustand) {
    case "active":
      return "Laut Quelle aktiv.";
    case "deadline_expired":
      return `Ausschreibungsfrist laut Quelle abgelaufen.${gesehen}`;
    case "no_longer_published":
      return `Von der Quelle nicht mehr veröffentlicht.${gesehen}`;
    case "source_reported_closed":
      return `Die Quelle führt die Stelle als beendet.${gesehen}`;
    case "application_unavailable":
      return `Die Bewerbungsseite ist nicht mehr erreichbar.${gesehen}`;
    case "verification_pending":
      return `Beim letzten Abruf nicht mehr im Feed — wird geprüft.${gesehen}`;
    case "unknown":
      return "Zum Stand dieser Ausschreibung liegt uns nichts vor.";
  }
}

/**
 * Der Stand einer Stelle aus ihren Fundstellen.
 *
 * ══════════════════════════════════════════════════════════════
 * Eine direkte Quelle schlägt einen Aggregator
 * ══════════════════════════════════════════════════════════════
 *
 * Dieselbe Stelle steht oft mehrfach da: einmal beim ATS des
 * Arbeitgebers, einmal bei einem Aggregator, der sie von dort hat.
 *
 * Verschwindet sie beim Aggregator, während das ATS sie weiter führt,
 * ist sie aktiv — der Aggregator hat womöglich nur seinen Feed
 * geändert. Verschwindet sie beim ATS, während der Aggregator eine
 * alte Kopie behält, ist sie NICHT mehr aktiv: Die Kopie ist alt.
 *
 * Deshalb entscheidet die näheste Quelle, und die anderen behalten
 * ihren eigenen Stand.
 */
export function standAusFundstellen(
  fundstellen: { naehe: number; stand: Verfuegbarkeitsstand }[],
): Verfuegbarkeitsstand {
  if (fundstellen.length === 0) return LEERER_STAND;

  /*
   * Kleinere `naehe` heisst näher an der Quelle: 0 für das ATS des
   * Arbeitgebers, höher für Aggregatoren. Das ist derselbe Gedanke
   * wie `rank` in `job_source_links`.
   */
  const naechste = Math.min(...fundstellen.map((f) => f.naehe));
  const vorne = fundstellen.filter((f) => f.naehe === naechste);

  /*
   * Sagen mehrere gleich nahe Quellen Verschiedenes, gewinnt die
   * aktivste. Eine Stelle stillzulegen, die eine gleichrangige Quelle
   * noch führt, wäre die teurere Verwechslung: Eine zu viel gezeigte
   * Stelle ärgert, eine zu wenig gezeigte fehlt.
   */
  const aktiv = vorne.find((f) => f.stand.zustand === "active");
  return aktiv ? aktiv.stand : vorne[0]!.stand;
}

function fristAbgelaufen(frist: Date | null | undefined, jetzt: Date): boolean {
  return frist instanceof Date && !Number.isNaN(frist.getTime()) && frist.getTime() < jetzt.getTime();
}
