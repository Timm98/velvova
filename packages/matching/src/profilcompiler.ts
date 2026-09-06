import type { Operator, Staerke } from "./suchkriterien.ts";

/**
 * Aus einem bestehenden Profilstand und neuen Signalen die nächste
 * Fassung bilden.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das Modell hier nichts entscheidet
 * ══════════════════════════════════════════════════════════════
 *
 * Das Modell darf lesen und vorschlagen. Was davon gilt, entscheidet
 * dieser Code — und zwar aus einem sehr praktischen Grund: Die Regeln
 * unten sind Sätze über Rechte, nicht über Sprache.
 *
 *   Darf ein beobachteter Klick eine Muss-Bedingung erzeugen?
 *   Darf eine Aussage über den Bruder zur eigenen Präferenz werden?
 *   Darf ein verspätetes Ergebnis einen neueren Stand überschreiben?
 *
 * Auf keine dieser Fragen ist „meistens nein" eine brauchbare Antwort.
 * Ein Modell antwortet aber meistens — und genau die Ausnahme ist der
 * Fall, in dem jemand Stellen bekommt, die er nie wollte, ohne dass
 * sich zeigen liesse, woher das kam.
 *
 * ══════════════════════════════════════════════════════════════
 * Die Rangfolge, wenn zwei Angaben sich widersprechen
 * ══════════════════════════════════════════════════════════════
 *
 * Nicht „das Neueste gewinnt". Massgeblich sind der ausdrückliche
 * Auftrag, sein Geltungsbereich und die Bestätigung:
 *
 *   Ein ausdrücklicher Änderungsauftrag ersetzt den alten Stand.
 *   Ein befristeter Zusatz gilt befristet und ändert nichts dauerhaft.
 *   Alles andere im Widerspruch wird zur Rückfrage.
 *
 * Bis eine Rückfrage beantwortet ist, gilt der letzte bestätigte
 * Stand. Gibt es keinen, bleibt der Punkt offen — nicht geraten.
 */

/** Startregel: Unbestätigte Verhaltenssignale verfallen nach 21 Tagen. */
export const VERHALTEN_VERFALL_TAGE = 21;

export type Herkunft =
  | "nutzer_aussage"
  | "uebernommener_filter"
  | "nutzerfakt"
  | "verhalten"
  | "nina_ableitung";

export type Geltungsbereich = "auftrag" | "profil" | "befristet";

/** Ein Signal, wie es in `profil_signale` steht. */
export interface Signal {
  id: string;
  /** Ob die Person es gesagt hat — oder ob es beobachtet wurde. */
  ausdruecklich: boolean;
  quelle: string;
  art: string;
  beobachtetAm: Date;
  /** Ob das Signal jemanden anderen betrifft. */
  fremdbezug?: boolean;
}

/** Ein Kriterium, wie es in einer bestehenden Fassung steht. */
export interface Bestandskriterium {
  kriterium: string;
  wert: unknown;
  einheit: string | null;
  operator: Operator;
  staerke: Staerke;
  gruppe: string | null;
  geltungsbereich: Geltungsbereich;
  herkunft: Herkunft;
  bestaetigungsstatus: "bestaetigt" | "offen" | "abgelehnt";
  bestaetigtAm: Date | null;
  gueltigBis: Date | null;
  signalIds: string[];
}

/** Was das Modell vorschlägt. */
export interface Aenderungsvorschlag {
  kriterium: string;
  wert: unknown;
  einheit?: string | null;
  operator?: Operator;
  staerke: Staerke;
  gruppe?: string | null;
  geltungsbereich?: Geltungsbereich;
  herkunft: Herkunft;
  signalIds: string[];
  /** Ob das Modell selbst eine Bestätigung für nötig hält. */
  bestaetigungNoetig?: boolean;
  /** Nur bei `befristet` — vom Backend geprüft, nicht übernommen. */
  gueltigBisIso?: string | null;
  /** Ob es ein ausdrücklicher Änderungsauftrag ist. */
  aenderungsauftrag?: boolean;
}

export interface Rueckfrage {
  kriterium: string;
  grund: "widerspruch" | "verhalten_gegen_muss" | "unbelegt";
  bisher: unknown;
  vorgeschlagen: unknown;
}

export interface Verworfen {
  kriterium: string;
  grund:
    | "beleg_fehlt"
    | "fremdbezug"
    | "verhalten_kein_muss"
    | "frist_fehlt"
    | "unbekanntes_signal";
}

export interface Verdichtung {
  /** Die Kriterien der neuen Fassung. */
  kriterien: Bestandskriterium[];
  rueckfragen: Rueckfrage[];
  verworfen: Verworfen[];
  /** Ob sich gegenüber dem Bestand überhaupt etwas geändert hat. */
  geaendert: boolean;
}

function schluessel(k: { kriterium: string; gruppe: string | null }): string {
  return `${k.kriterium}::${k.gruppe ?? ""}`;
}

/**
 * Ob ein Kriterium noch gilt.
 *
 * Zwei Fristen, und sie meinen Verschiedenes: `gueltigBis` ist die
 * ausdrückliche Befristung („nur diese Woche"), der Verhaltensverfall
 * ist die stille. Ein bestätigtes Kriterium hat keine stille Frist —
 * was jemand bestätigt hat, wird nicht nach drei Wochen leise anders.
 */
export function giltNoch(k: Bestandskriterium, jetzt: Date): boolean {
  if (k.gueltigBis !== null && k.gueltigBis.getTime() <= jetzt.getTime()) return false;
  if (k.bestaetigungsstatus === "abgelehnt") return false;
  if (k.bestaetigungsstatus === "bestaetigt") return true;
  if (k.herkunft === "verhalten" || k.herkunft === "nina_ableitung") {
    const alter = jetzt.getTime() - (k.bestaetigtAm ?? new Date(0)).getTime();
    const grenze = VERHALTEN_VERFALL_TAGE * 86_400_000;
    /* Ohne Zeitpunkt kein Alter — dann bleibt es, bis es bestätigt
       oder ersetzt wird. Ein Verfall auf Verdacht wäre schlimmer. */
    if (k.bestaetigtAm !== null && alter > grenze) return false;
  }
  return true;
}

export function verdichten(
  bestand: Bestandskriterium[],
  vorschlaege: Aenderungsvorschlag[],
  signale: Signal[],
  jetzt: Date,
): Verdichtung {
  const bekannt = new Map(signale.map((s) => [s.id, s]));
  const aktuell = new Map<string, Bestandskriterium>();
  for (const k of bestand) {
    if (giltNoch(k, jetzt)) aktuell.set(schluessel(k), k);
  }
  const vorher = new Map(aktuell);

  const rueckfragen: Rueckfrage[] = [];
  const verworfen: Verworfen[] = [];

  for (const v of vorschlaege) {
    const gruppe = v.gruppe ?? null;
    const key = schluessel({ kriterium: v.kriterium, gruppe });

    /*
     * ── Jede Änderung braucht einen Beleg ──────────────────
     *
     * Ohne Signal-ID gibt es später keine Antwort auf „woher weisst du
     * das". Und ein Modell, dessen frühere Vorschläge als Grundlage
     * durchgehen, schreibt sich selbst fort.
     */
    const belege = v.signalIds.map((id) => bekannt.get(id)).filter((s): s is Signal => s !== undefined);
    if (belege.length === 0) {
      verworfen.push({ kriterium: v.kriterium, grund: v.signalIds.length === 0 ? "beleg_fehlt" : "unbekanntes_signal" });
      continue;
    }

    /*
     * ── Angaben über andere Personen ───────────────────────
     *
     * „Ich suche für meinen Bruder" ist kein Wunsch der Person. Der
     * Auftrag kann das abbilden — sein Geltungsbereich sagt, für wen
     * gesucht wird. Das Profil bleibt davon unberührt.
     */
    if (belege.some((s) => s.fremdbezug === true)) {
      verworfen.push({ kriterium: v.kriterium, grund: "fremdbezug" });
      continue;
    }

    const ausdruecklich = belege.some((s) => s.ausdruecklich);
    const ausVerhalten = v.herkunft === "verhalten" || v.herkunft === "nina_ableitung" || !ausdruecklich;

    /*
     * ── Beobachtetes erzeugt kein Muss ─────────────────────
     *
     * Sieben Ablehnungen wegen Kundenkontakt sind ein Muster, kein
     * Filter. Wer daraus ein Muss macht, erklärt einen Menschen für
     * festgelegt — und niemand kann es widerrufen, weil niemand es
     * gesagt hat.
     */
    if (v.staerke === "muss" && ausVerhalten) {
      verworfen.push({ kriterium: v.kriterium, grund: "verhalten_kein_muss" });
      continue;
    }

    const bereich: Geltungsbereich = v.geltungsbereich ?? "auftrag";
    let gueltigBis: Date | null = null;
    if (bereich === "befristet") {
      /*
       * Eine Befristung ohne Frist ist keine. „Nur heute auch Hamburg"
       * ohne Enddatum wäre eine dauerhafte Änderung mit einem Etikett,
       * das das Gegenteil behauptet.
       */
      const roh = v.gueltigBisIso ? new Date(v.gueltigBisIso) : null;
      if (roh === null || Number.isNaN(roh.getTime()) || roh.getTime() <= jetzt.getTime()) {
        verworfen.push({ kriterium: v.kriterium, grund: "frist_fehlt" });
        continue;
      }
      gueltigBis = roh;
    }

    const bisher = aktuell.get(key);

    /*
     * ── Widerspruch zu Bestätigtem ─────────────────────────
     *
     * Eine bestätigte Angabe wird nur durch einen ausdrücklichen
     * Änderungsauftrag ersetzt. Alles andere wird zur Rückfrage, und
     * bis zur Antwort gilt der bestätigte Stand.
     */
    if (
      bisher !== undefined &&
      bisher.bestaetigungsstatus === "bestaetigt" &&
      JSON.stringify(bisher.wert) !== JSON.stringify(v.wert) &&
      bereich !== "befristet"
    ) {
      if (!(ausdruecklich && v.aenderungsauftrag === true)) {
        rueckfragen.push({
          kriterium: v.kriterium,
          grund: ausVerhalten ? "verhalten_gegen_muss" : "widerspruch",
          bisher: bisher.wert,
          vorgeschlagen: v.wert,
        });
        continue;
      }
    }

    /*
     * Ein bestätigter Stand bleibt bestätigt, wenn ein ausdrücklicher
     * Auftrag ihn ändert — die Person hat ihn ja gerade gesagt. Alles
     * andere kommt als `offen` herein und wartet auf Bestätigung.
     */
    const bestaetigt =
      ausdruecklich && v.aenderungsauftrag === true && v.bestaetigungNoetig !== true;

    aktuell.set(key, {
      kriterium: v.kriterium,
      wert: v.wert,
      einheit: v.einheit ?? null,
      operator: v.operator ?? "gleich",
      staerke: v.staerke,
      gruppe,
      geltungsbereich: bereich,
      herkunft: v.herkunft,
      bestaetigungsstatus: bestaetigt ? "bestaetigt" : "offen",
      bestaetigtAm: bestaetigt ? jetzt : (bisher?.bestaetigtAm ?? jetzt),
      gueltigBis,
      signalIds: belege.map((s) => s.id),
    });
  }

  const kriterien = [...aktuell.values()];
  const geaendert =
    kriterien.length !== vorher.size ||
    kriterien.some((k) => {
      const alt = vorher.get(schluessel(k));
      return alt === undefined || JSON.stringify(alt.wert) !== JSON.stringify(k.wert) || alt.staerke !== k.staerke;
    });

  return { kriterien, rueckfragen, verworfen, geaendert };
}

/* ═══════════════════════════════════════════════════════════════
   Ort und Arbeitsmodell auseinanderhalten
   ═══════════════════════════════════════════════════════════════ */

/** Wörter, die kein Ort sind, sondern ein Arbeitsmodell. */
const MODELLWORTE: Record<string, string> = {
  remote: "remote",
  homeoffice: "remote",
  "home office": "remote",
  "komplett remote": "remote",
  "vollstaendig remote": "remote",
  "vollständig remote": "remote",
  hybrid: "hybrid",
  "vor ort": "on_site",
  praesenz: "on_site",
  präsenz: "on_site",
  onsite: "on_site",
  on_site: "on_site",
};

/**
 * „Karlsruhe oder komplett remote" in zwei Kriterien trennen.
 *
 * ══════════════════════════════════════════════════════════════
 * Der Fehler, den das verhindert
 * ══════════════════════════════════════════════════════════════
 *
 * Ein Modellaufruf lieferte für genau diesen Satz:
 *
 *     arbeitsort · ["Karlsruhe", "remote"] · einer_von
 *
 * Das sieht richtig aus und ist es nicht. „remote" ist kein Ort, und
 * die Ortsprüfung vergleicht mit `jobs.location` — dort steht nie
 * „remote". Die Alternative wäre stillschweigend nie erfüllt gewesen:
 * Die Person liest ihren Auftrag, sieht „Karlsruhe oder remote", und
 * bekommt ausschliesslich Karlsruhe.
 *
 * Der Prompt darauf hinzuweisen wäre die schwächere Antwort. Das hier
 * ist entscheidbar, also entscheidet es der Code.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum beide in dieselbe Gruppe kommen
 * ══════════════════════════════════════════════════════════════
 *
 * Weil „oder" gemeint war. Zwei Kriterien ohne gemeinsame Gruppe
 * wären zwei gleichzeitig zwingende Standortbedingungen — dann fände
 * die Suche gar nichts, was der genau umgekehrte Fehler ist.
 */
export function ortUndModellTrennen(
  vorschlaege: readonly Aenderungsvorschlag[],
): Aenderungsvorschlag[] {
  const raus: Aenderungsvorschlag[] = [];

  for (const v of vorschlaege) {
    if (v.kriterium !== "arbeitsort" || !Array.isArray(v.wert)) {
      raus.push(v);
      continue;
    }

    const orte: string[] = [];
    const modelle: string[] = [];
    for (const roh of v.wert as unknown[]) {
      const wort = String(roh).toLowerCase().trim();
      const modell = MODELLWORTE[wort];
      if (modell) modelle.push(modell);
      else orte.push(wort);
    }

    if (modelle.length === 0) {
      raus.push(v);
      continue;
    }

    /*
     * Eine gemeinsame Gruppe, auch wenn keine mitgeliefert wurde.
     * Sie ist der Träger des „oder".
     */
    const gruppe = v.gruppe ?? "ort";

    if (orte.length > 0) raus.push({ ...v, wert: orte, gruppe });
    raus.push({
      ...v,
      kriterium: "arbeitsmodell",
      wert: [...new Set(modelle)],
      operator: "einer_von",
      einheit: null,
      gruppe,
    });
  }

  /*
   * ── Und der umgekehrte Fall ───────────────────────────────
   *
   * Beim zweiten echten Lauf kamen Ort und Arbeitsmodell nicht
   * verschmolzen, sondern als zwei Kriterien — beide ohne Gruppe.
   * Zwei Muss-Kriterien ohne gemeinsame Gruppe sind ein UND:
   * „in Karlsruhe UND vollständig remote". Das findet fast nichts,
   * und niemand sieht warum.
   *
   * Zusammengefasst wird nur `remote`. Bei `hybrid` und `on_site` ist
   * das UND die richtige Lesart — wer hybrid in Karlsruhe sucht, meint
   * beides. Nur „vollständig remote" ist ortsunabhängig und damit
   * die Alternative zum Ort.
   *
   * Die Person liest das Ergebnis im Bestätigungssatz als „oder" und
   * kann widersprechen. Es wird zusammengefasst, nicht entschieden.
   */
  /* `?? null`, weil `gruppe` optional ist: Ein fehlendes Feld und ein
     ausdrückliches `null` meinen dasselbe. */
  const ort = raus.find((k) => k.kriterium === "arbeitsort" && (k.gruppe ?? null) === null);
  const remote = raus.find(
    (k) =>
      k.kriterium === "arbeitsmodell" &&
      (k.gruppe ?? null) === null &&
      Array.isArray(k.wert) &&
      (k.wert as unknown[]).length === 1 &&
      String((k.wert as unknown[])[0]).toLowerCase() === "remote",
  );
  if (ort && remote) {
    return raus.map((k) => (k === ort || k === remote ? { ...k, gruppe: "ort" } : k));
  }

  return raus;
}
