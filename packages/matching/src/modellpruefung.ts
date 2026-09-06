/**
 * Was ein Modell geliefert hat, gegen das prüfen, was es durfte.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum ein Schema nicht reicht
 * ══════════════════════════════════════════════════════════════
 *
 * Structured Outputs garantieren die Form, nicht den Inhalt. Ein
 * Modell kann formgerecht eine `job_id` liefern, die es nie bekommen
 * hat — eine, die es aus dem Gesprächsverlauf kennt, oder eine
 * erfundene. Beides fällt durch kein Schema.
 *
 * Der Schaden wäre nicht theoretisch: Eine fremde `job_id` in einer
 * Zusammenfassung heisst, dass eine Person eine Stelle empfohlen
 * bekommt, die nie mit ihrem Profil verglichen wurde — mit einer
 * Begründung, die nach einer Prüfung klingt.
 *
 * ══════════════════════════════════════════════════════════════
 * Was hier zurückgewiesen wird
 * ══════════════════════════════════════════════════════════════
 *
 *   Kennungen, die nicht in der Eingabe standen
 *   Belegreferenzen, die auf nichts zeigen
 *   Mehr Posten, als es Empfehlungen gibt
 *   Ein Grund, der zu keinem gelieferten Kandidaten gehört
 *
 * Zurückgewiesen heisst: weggelassen, nicht repariert. Ein
 * ausgedachter Beleg lässt sich nicht in einen echten verwandeln.
 */

export interface Pruefbefund<T> {
  /** Was übrig bleibt. */
  gueltig: T[];
  /** Was weggefallen ist, und warum. */
  verworfen: { kennung: string; grund: string }[];
}

/* ═══════════════════════════════════════════════════════════════
   Systemprompt 2 — Matchingbelege
   ═══════════════════════════════════════════════════════════════ */

/** Die Statuswerte, die das Modell liefert. */
export type Modellstatus =
  | "fulfilled"
  | "partially_fulfilled"
  | "not_fulfilled"
  | "unknown"
  | "conflicting";

export type Transferart =
  | "direct_skill_match"
  | "transferable_skill_match"
  | "unverified_possible_transfer";

export interface Modellkriterium {
  criterion_id: string;
  status: Modellstatus;
  profile_evidence_ids: string[];
  job_evidence_ids: string[];
  reason: string;
  missing_information: string | null;
}

export interface Modelltransfer {
  job_requirement: string;
  profile_basis: string;
  art: Transferart;
  profile_evidence_ids: string[];
  job_evidence_ids: string[];
  reason: string;
}

export interface Matchbelegeingabe {
  job_id: string;
  criteria: Modellkriterium[];
  transferable_skill_matches: Modelltransfer[];
  soft_hits: string[];
  soft_misses: string[];
  unknowns: string[];
  conflicts: string[];
  reason_candidates: string[];
  caveat: string | null;
}

export interface Matchbelegrahmen {
  /** Die Stellen, die dem Modell übergeben wurden. */
  erlaubteJobs: Set<string>;
  /** Die Kriterien der aktiven Profilfassung. */
  erlaubteKriterien: Set<string>;
  /** Belegkennungen der Anzeigen, die das Modell gesehen hat. */
  erlaubteJobbelege: Set<string>;
  /** Belegkennungen des Profils. */
  erlaubteProfilbelege: Set<string>;
}

/** Die Umrechnung zwischen der Sprache des Modells und der des Codes. */
export const STATUS_AUS_MODELL: Record<Modellstatus, string> = {
  fulfilled: "erfuellt",
  partially_fulfilled: "teilweise",
  not_fulfilled: "nicht_erfuellt",
  unknown: "unbekannt",
  conflicting: "widerspruechlich",
};

/**
 * Matchingbelege prüfen.
 *
 * ══════════════════════════════════════════════════════════════
 * Was hier zurückgewiesen wird
 * ══════════════════════════════════════════════════════════════
 *
 *   Eine Stelle, die nie geliefert wurde
 *   Ein Kriterium, das es im Profil nicht gibt
 *   Belegkennungen, die auf nichts zeigen
 *   Ein Urteil „erfüllt" ohne einen einzigen Jobbeleg
 *
 * Die letzte ist die wichtigste und die einzige, die etwas
 * verändert statt nur wegzulassen. Der Systemprompt verlangt: „Wenn
 * kein passender Jobbeleg existiert: status = unknown."
 *
 * Eine Bitte im Prompt ist keine Regel. Ein Modell, das ohne Beleg
 * „erfüllt" sagt, behauptet etwas über eine Anzeige, das niemand
 * nachlesen kann — und genau darauf stützt sich später der Satz in
 * der Mail. Deshalb wird es hier heruntergestuft, nicht verworfen:
 * Die Beobachtung bleibt, die Behauptung nicht.
 */
export function matchbelegePruefen(
  antworten: Matchbelegeingabe[],
  rahmen: Matchbelegrahmen,
): Pruefbefund<Matchbelegeingabe> {
  const gueltig: Matchbelegeingabe[] = [];
  const verworfen: { kennung: string; grund: string }[] = [];
  const gesehen = new Set<string>();

  for (const a of antworten) {
    if (!rahmen.erlaubteJobs.has(a.job_id)) {
      verworfen.push({ kennung: a.job_id, grund: "fremde_stelle" });
      continue;
    }
    if (gesehen.has(a.job_id)) {
      verworfen.push({ kennung: a.job_id, grund: "doppelt" });
      continue;
    }
    gesehen.add(a.job_id);

    const kriterien: Modellkriterium[] = [];
    for (const r of a.criteria ?? []) {
      if (!rahmen.erlaubteKriterien.has(r.criterion_id)) {
        verworfen.push({ kennung: `${a.job_id}/${r.criterion_id}`, grund: "fremdes_kriterium" });
        continue;
      }
      const jobbelege = (r.job_evidence_ids ?? []).filter((id) => rahmen.erlaubteJobbelege.has(id));
      const profilbelege = (r.profile_evidence_ids ?? []).filter((id) =>
        rahmen.erlaubteProfilbelege.has(id),
      );
      if ((r.job_evidence_ids ?? []).length !== jobbelege.length)
        verworfen.push({ kennung: `${a.job_id}/${r.criterion_id}`, grund: "erfundener_jobbeleg" });
      if ((r.profile_evidence_ids ?? []).length !== profilbelege.length)
        verworfen.push({ kennung: `${a.job_id}/${r.criterion_id}`, grund: "erfundener_profilbeleg" });

      /*
       * Ohne Jobbeleg keine Aussage über die Anzeige.
       *
       * `not_fulfilled` ist ausgenommen: Eine Verletzung lässt sich
       * auch aus dem Fehlen begründen — „die Anzeige nennt Zeitarbeit"
       * braucht einen Beleg, „sie nennt nirgends Vollzeit" nicht.
       * Heruntergestuft wird nur, was etwas Positives behauptet.
       */
      const behauptetErfuellung = r.status === "fulfilled" || r.status === "partially_fulfilled";
      const status: Modellstatus =
        behauptetErfuellung && jobbelege.length === 0 ? "unknown" : r.status;
      if (status !== r.status)
        verworfen.push({ kennung: `${a.job_id}/${r.criterion_id}`, grund: "erfuellt_ohne_beleg" });

      kriterien.push({
        ...r,
        status,
        job_evidence_ids: jobbelege,
        profile_evidence_ids: profilbelege,
        missing_information: status === "unknown" ? (r.missing_information ?? null) : null,
      });
    }

    /*
     * ── Übertragbare Fähigkeiten ─────────────────────────────
     *
     * Dieselbe Belegpflicht, nur strenger: Ein `direct_skill_match`
     * oder ein `transferable_skill_match` ohne Profilbeleg ist eine
     * Vermutung — und Vermutungen heissen hier
     * `unverified_possible_transfer`.
     *
     * Der Unterschied ist nicht sprachlich. Die ersten beiden dürfen
     * in einen Fit einfliessen, die dritte erzeugt eine Rückfrage.
     * Wer sie verwechselt, rechnet eine Vermutung in eine Zahl.
     */
    const transfers: Modelltransfer[] = [];
    for (const t of a.transferable_skill_matches ?? []) {
      const profilbelege = (t.profile_evidence_ids ?? []).filter((id) =>
        rahmen.erlaubteProfilbelege.has(id),
      );
      const jobbelege = (t.job_evidence_ids ?? []).filter((id) => rahmen.erlaubteJobbelege.has(id));
      const gestuetzt = profilbelege.length > 0;
      const art: Transferart =
        t.art !== "unverified_possible_transfer" && !gestuetzt
          ? "unverified_possible_transfer"
          : t.art;
      if (art !== t.art)
        verworfen.push({ kennung: `${a.job_id}/transfer`, grund: "transfer_ohne_profilbeleg" });
      transfers.push({ ...t, art, profile_evidence_ids: profilbelege, job_evidence_ids: jobbelege });
    }

    gueltig.push({
      ...a,
      criteria: kriterien,
      transferable_skill_matches: transfers,
      soft_hits: a.soft_hits ?? [],
      soft_misses: a.soft_misses ?? [],
      unknowns: a.unknowns ?? [],
      conflicts: a.conflicts ?? [],
      reason_candidates: a.reason_candidates ?? [],
      caveat: a.caveat ?? null,
    });
  }

  return { gueltig, verworfen };
}

/**
 * Welche Kriterien das Modell überhaupt beurteilen darf.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum nicht alle
 * ══════════════════════════════════════════════════════════════
 *
 * Ob 42.000 unter 45.000 liegt, ist keine Ermessensfrage. Ein
 * Modell, das sie beantwortet, kostet Geld und kann sich irren — und
 * wenn es sich irrt, steht in der Mail eine Zahl, die niemand
 * nachgerechnet hat.
 *
 * Sprache braucht es dort, wo Wörter verglichen werden müssen:
 * Tätigkeiten, Aufgaben, Ausschlüsse. Nur dort darf das Modell das
 * Urteil des Codes bewegen — und auch dort nur mit einem Beleg aus
 * der Anzeige.
 */
export const SPRACHKRITERIEN = new Set(["taetigkeit", "berufsfeld", "taetigkeit_ausschluss"]);

export interface Verschmelzung {
  /** Das Urteil je Kriterium, nach der Zusammenführung. */
  status: Map<string, string>;
  /** Die Begründung des Modells, wo sie zählt. */
  begruendung: Map<string, string>;
  /** Was das Modell verändert hat — für die Nachvollziehbarkeit. */
  geaendert: { kriterium: string; von: string; nach: string }[];
}

/**
 * Das Urteil des Codes und das des Modells zusammenführen.
 *
 * Bei allem, was rechenbar ist, gewinnt der Code — ohne Ausnahme.
 * Das Modell darf nur dort bewegen, wo es um Wörter geht, und auch
 * dort nur mit einem Beleg aus der Anzeige.
 *
 * Der umgekehrte Weg wäre bequemer und falsch: Ein Modell, das ein
 * berechnetes „nicht erfüllt" überstimmen darf, hebt die Bedingung
 * auf, die eine Person ausdrücklich gesetzt hat.
 */
export function belegeVerschmelzen(
  deterministisch: { kriteriumId: string; kriterium: string; status: string }[],
  modell: readonly Modellkriterium[],
): Verschmelzung {
  const status = new Map<string, string>();
  const begruendung = new Map<string, string>();
  const geaendert: { kriterium: string; von: string; nach: string }[] = [];

  const modellNach = new Map(modell.map((m) => [m.criterion_id, m]));

  for (const d of deterministisch) {
    const m = modellNach.get(d.kriterium);
    if (!m || !SPRACHKRITERIEN.has(d.kriterium)) {
      status.set(d.kriteriumId, d.status);
      continue;
    }
    const neu = STATUS_AUS_MODELL[m.status] ?? d.status;
    /*
     * Ohne Jobbeleg keine Bewegung. `matchbelegePruefen` hat
     * Behauptungen ohne Beleg schon auf `unknown` gesetzt; hier wird
     * zusätzlich verhindert, dass ein belegloses `unknown` ein
     * belegtes Urteil des Codes verdrängt.
     */
    if (neu === "unbekannt" && m.job_evidence_ids.length === 0) {
      status.set(d.kriteriumId, d.status);
      continue;
    }
    status.set(d.kriteriumId, neu);
    if (m.reason) begruendung.set(d.kriteriumId, m.reason);
    if (neu !== d.status) geaendert.push({ kriterium: d.kriterium, von: d.status, nach: neu });
  }

  return { status, begruendung, geaendert };
}

export interface Mailposten {
  job_id: string;
  reason: string;
  caveat: string | null;
}

export interface Mailtextrahmen {
  /** Genau die Stellen, die das Backend ausgewählt hat — in dieser Reihenfolge. */
  ausgewaehlt: string[];
  /** Die validierten Gründe je Stelle. */
  gruende: Map<string, string[]>;
  /** Die validierten Vorbehalte je Stelle. `null`, wenn es keinen gibt. */
  caveats: Map<string, string | null>;
}

export interface Mailtextbefund {
  posten: Mailposten[];
  /** Ob das Modell die Auswahl verändert hat. */
  auswahlVeraendert: boolean;
  hinweise: string[];
}

/**
 * Den Mailtext gegen die Auswahl prüfen.
 *
 * Das Modell darf formulieren, nicht auswählen. Wer hier durchrutscht,
 * ändert am Ende der Kette eine Entscheidung, die vier Schritte vorher
 * begründet getroffen wurde — und niemand sieht es, weil die Mail
 * plausibel aussieht.
 */
export function mailtextPruefen(
  posten: Mailposten[],
  rahmen: Mailtextrahmen,
): Mailtextbefund {
  const hinweise: string[] = [];
  const erlaubt = new Set(rahmen.ausgewaehlt);
  const nachId = new Map(posten.map((p) => [p.job_id, p]));

  const fremd = posten.filter((p) => !erlaubt.has(p.job_id));
  if (fremd.length > 0) hinweise.push(`fremde_stellen:${fremd.length}`);

  const fehlend = rahmen.ausgewaehlt.filter((id) => !nachId.has(id));
  if (fehlend.length > 0) hinweise.push(`fehlende_stellen:${fehlend.length}`);

  /*
   * Die Reihenfolge kommt aus der Auswahl, nicht aus der Antwort.
   *
   * Eine umsortierte Liste ist eine andere Empfehlung: Was oben steht,
   * wird gelesen. Das Modell darf das nicht verschieben, auch nicht
   * versehentlich.
   */
  const raus: Mailposten[] = [];
  for (const jobId of rahmen.ausgewaehlt) {
    const geliefert = nachId.get(jobId);
    const erlaubteGruende = rahmen.gruende.get(jobId) ?? [];
    const erlaubterCaveat = rahmen.caveats.get(jobId) ?? null;

    /*
     * Der Grund muss einer der validierten sein. Ein neu formulierter
     * Grund wäre eine neue Behauptung über eine Stelle — und die
     * kommt nicht aus der Anzeige, sondern aus dem Modell.
     */
    const grund =
      geliefert && erlaubteGruende.includes(geliefert.reason)
        ? geliefert.reason
        : (erlaubteGruende[0] ?? "");
    if (geliefert && !erlaubteGruende.includes(geliefert.reason)) hinweise.push(`grund_ersetzt:${jobId}`);

    const caveat =
      geliefert && geliefert.caveat !== null && geliefert.caveat === erlaubterCaveat
        ? geliefert.caveat
        : erlaubterCaveat;
    if (geliefert && geliefert.caveat !== null && geliefert.caveat !== erlaubterCaveat)
      hinweise.push(`caveat_ersetzt:${jobId}`);

    raus.push({ job_id: jobId, reason: grund, caveat });
  }

  return {
    posten: raus,
    auswahlVeraendert: fremd.length > 0 || fehlend.length > 0,
    hinweise,
  };
}

/**
 * Prüft, ob der Betreff die tatsächliche Zahl nennt.
 *
 * ── Warum das eine eigene Prüfung ist ─────────────────────────
 *
 * „5 neue Stellen für dich" bei drei Posten ist die Art Fehler, die
 * niemand meldet und die jeder bemerkt. Sie entsteht zuverlässig,
 * wenn ein Modell die Zahl aus dem Kontext schätzt statt zu zählen.
 */
export function betreffZahlStimmt(betreff: string, anzahl: number): boolean {
  const zahlen = betreff.match(/\d+/g);
  if (zahlen === null) return true;
  return zahlen.every((z) => Number(z) === anzahl);
}
