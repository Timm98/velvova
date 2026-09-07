/**
 * Aus Ereignissen Hinweise machen — und nicht mehr als Hinweise.
 *
 * ══════════════════════════════════════════════════════════════
 * Der Fehler, den dieses Modul vermeidet
 * ══════════════════════════════════════════════════════════════
 *
 * Jemand sieht sich eine Anzeige vier Minuten lang an. Die naheliegende
 * Deutung: Er will diesen Job.
 *
 * Die anderen Deutungen sind genauso plausibel. Die Anzeige war
 * unverständlich geschrieben. Er hat etwas gesucht, das nicht dastand.
 * Das Gehalt war so seltsam formuliert, dass er es zweimal gelesen hat.
 * Er ist zwischendurch aufgestanden. Er hat sie jemandem gezeigt.
 *
 * Ein Verhaltenssignal sagt: „Das ist passiert." Es sagt nicht, warum.
 *
 * ══════════════════════════════════════════════════════════════
 * Was daraus folgt
 * ══════════════════════════════════════════════════════════════
 *
 * Jedes abgeleitete Verhaltenssignal trägt die Ereignisse mit sich, aus denen es
 * entstand. Damit kann Monday sagen „du hast diese Stelle dreimal
 * geöffnet" statt „ich weiss, dass du sie willst" — und die Person
 * kann widersprechen, ohne gegen eine Behauptung anzureden, die
 * niemand belegt hat.
 *
 * Ein Verhaltenssignal verfällt. Interesse von vor drei Wochen ist kein
 * Interesse von heute, und ein System, das das nicht vergisst, hält
 * Menschen an ihrer Vergangenheit fest.
 */

/**
 * Was im Produkt beobachtet wird.
 *
 * ── Was hier bewusst NICHT steht ──────────────────────────────
 *
 * Mausbewegungen, Tippgeschwindigkeit, Scrollmuster, Pausen zwischen
 * Tastenanschlägen. Daraus liessen sich Persönlichkeitsvermutungen
 * bauen, und niemand hat uns dafür ein Mandat gegeben. Ein Produkt,
 * das seinen Nutzern beim Denken zusieht, ist kein Assistent.
 */
export const EREIGNISARTEN = [
  "job_viewed",
  "job_view_duration",
  "job_reopened",
  "job_saved",
  "job_unsaved",
  "job_dismissed",
  "job_compared",
  "job_detail_section_opened",
  "salary_opened",
  "requirements_opened",
  "company_opened",
  "apply_started",
  "apply_abandoned",
  "search_changed",
  "filter_changed",
  "search_result_clicked",
  "nina_message_clicked",
  "match_explanation_opened",
] as const;

export type Ereignisart = (typeof EREIGNISARTEN)[number];

export function ereignisBekannt(art: string): art is Ereignisart {
  return (EREIGNISARTEN as readonly string[]).includes(art);
}

export type Urheber = "user" | "nina" | "system";

export interface Ereignis {
  id: string;
  art: Ereignisart;
  /**
   * Wer es ausgelöst hat.
   *
   * Nur `user` verstärkt ein Signal. Was Monday selbst getan hat,
   * bestätigt ihre eigene Vermutung nicht.
   */
  urheber: Urheber;
  jobId: string | null;
  auftragId: string | null;
  sitzungId: string | null;
  geschehenAm: Date;
  /** Nur Zahlen und kurze Kennungen — keine freien Texte der Person. */
  kontext: Record<string, string | number | boolean>;
}

export type Signalart =
  | "interesse_an_stelle"
  | "gehalt_wichtig"
  | "remote_interesse"
  | "richtungswechsel"
  | "vergleich_laeuft";

export type Signalstatus = "inferred" | "confirmed" | "rejected";

export interface Verhaltenssignal {
  art: Signalart;
  /** 0 bis 1. Eine Ordnung, keine Wahrscheinlichkeit. */
  staerke: number;
  jobId: string | null;
  /** Die Ereignisse, auf die sich das Verhaltenssignal beruft. */
  belege: string[];
  /** In der Sprache der Person, als Beobachtung formuliert. */
  beobachtung: string;
  gueltigBis: Date;
  status: Signalstatus;
}

/* ═══════════════════════════════════════════════════════════════
   Die Schwellen
   ═══════════════════════════════════════════════════════════════ */

/**
 * Ab wann ein Blick als längeres Ansehen zählt.
 *
 * Sechzig Sekunden ist eine Produktentscheidung, kein Messwert. Sie
 * ist nicht gegen Nutzerurteile validiert und gehört kalibriert,
 * sobald echte Verläufe vorliegen.
 */
export const LANGE_ANSICHT_SEKUNDEN = 60;

/**
 * Wie viele unabhängige Hinweise ein Verhaltenssignal braucht.
 *
 * ── Warum zwei und nicht einer ────────────────────────────────
 *
 * Ein einzelnes Ereignis ist zu leicht zufällig. Jemand klickt eine
 * Anzeige an und schliesst sie wieder; jemand lässt einen Tab offen
 * und geht Kaffee holen. Zwei verschiedene Handlungen sind schwerer
 * zufällig — nicht unmöglich, aber schwerer.
 */
export const HINWEISE_FUER_SIGNAL = 2;

/** Wie lange ein abgeleitetes Verhaltenssignal gilt, in Tagen. */
export const SIGNAL_GUELTIG_TAGE = 14;

/* ═══════════════════════════════════════════════════════════════
   Auswertung
   ═══════════════════════════════════════════════════════════════ */

function tageSpaeter(von: Date, tage: number): Date {
  return new Date(von.getTime() + tage * 24 * 60 * 60 * 1000);
}

/**
 * Die Hinweise auf Interesse an einer bestimmten Stelle.
 *
 * Jeder Eintrag ist eine eigenständige Handlung — sie zählen einzeln,
 * damit „dreimal dieselbe Anzeige geöffnet" nicht als drei
 * verschiedene Arten von Interesse durchgeht.
 */
interface Hinweis {
  name: string;
  belege: string[];
}

function hinweiseFuerStelle(ereignisse: readonly Ereignis[]): Hinweis[] {
  const hinweise: Hinweis[] = [];

  const geoeffnet = ereignisse.filter((e) => e.art === "job_viewed" || e.art === "job_reopened");
  if (geoeffnet.length >= 2)
    hinweise.push({ name: "mehrfach geöffnet", belege: geoeffnet.map((e) => e.id) });

  const lange = ereignisse.filter(
    (e) =>
      e.art === "job_view_duration" &&
      typeof e.kontext.sekunden === "number" &&
      e.kontext.sekunden >= LANGE_ANSICHT_SEKUNDEN,
  );
  if (lange.length > 0)
    hinweise.push({ name: "länger gelesen", belege: lange.map((e) => e.id) });

  const gehalt = ereignisse.filter((e) => e.art === "salary_opened");
  const anforderungen = ereignisse.filter((e) => e.art === "requirements_opened");
  if (gehalt.length > 0 && anforderungen.length > 0)
    hinweise.push({
      name: "Gehalt und Anforderungen aufgerufen",
      belege: [...gehalt, ...anforderungen].map((e) => e.id),
    });

  const verglichen = ereignisse.filter((e) => e.art === "job_compared");
  if (verglichen.length > 0)
    hinweise.push({ name: "mit anderen verglichen", belege: verglichen.map((e) => e.id) });

  const bewerbung = ereignisse.filter((e) => e.art === "apply_started");
  if (bewerbung.length > 0)
    hinweise.push({ name: "eine Bewerbung begonnen", belege: bewerbung.map((e) => e.id) });

  return hinweise;
}

/**
 * Ob die Person die Stelle ausdrücklich abgelehnt hat.
 *
 * ── Warum das alles andere schlägt ────────────────────────────
 *
 * „Nicht relevant" ist eine Aussage der Person über sich selbst.
 * Zehn beobachtete Klicks dagegenzuhalten hiesse, ihr zu erklären,
 * dass sie sich irrt.
 *
 * Der Fall ist real: Jemand sieht eine Anzeige dreimal an, WEIL er
 * nicht versteht, was die Stelle eigentlich ist, und lehnt sie dann
 * ab. Das lange Ansehen war Verwirrung, kein Interesse.
 */
function abgelehnt(ereignisse: readonly Ereignis[]): boolean {
  return ereignisse.some((e) => e.art === "job_dismissed" || e.art === "job_unsaved");
}

/**
 * Aus den Ereignissen zu einer Stelle ein Interessenssignal — oder keins.
 */
export function interesseAusEreignissen(
  jobId: string,
  ereignisse: readonly Ereignis[],
  jetzt: Date,
): Verhaltenssignal | null {
  /*
   * Nur echte Nutzerhandlungen.
   *
   * Hätte Monday selbst ein Ereignis ausgelöst — etwa beim Vormerken —,
   * bestätigte sie damit ihre eigene Vermutung. Der Filter steht hier
   * und nicht beim Laden, damit er auch dann greift, wenn jemand
   * später eine andere Quelle anschliesst.
   */
  const zurStelle = ereignisse.filter((e) => e.jobId === jobId && e.urheber === "user");
  if (zurStelle.length === 0) return null;
  if (abgelehnt(zurStelle)) return null;

  const hinweise = hinweiseFuerStelle(zurStelle);
  if (hinweise.length < HINWEISE_FUER_SIGNAL) return null;

  /*
   * Die Stärke wächst mit der Zahl der Hinweise und bleibt unter 1.
   *
   * Unter 1, weil Gewissheit hier nicht vorkommt. Ein Wert von 1 wäre
   * die Behauptung, es gäbe keine andere Erklärung mehr — und die gibt
   * es immer.
   */
  const staerke = Math.min(0.9, 0.3 + hinweise.length * 0.2);

  return {
    art: "interesse_an_stelle",
    staerke,
    jobId,
    belege: [...new Set(hinweise.flatMap((h) => h.belege))],
    /*
     * Höchstens zwei Hinweise im Satz.
     *
     * Ein echter Lauf ergab: „Du hast dir diese Stelle mehrfach
     * geöffnet und länger angesehen und Gehalt und Anforderungen
     * angesehen." Drei „und", zweimal dasselbe Verb — ein Satz, den
     * niemand geschrieben hätte.
     *
     * Die übrigen Hinweise gehen nicht verloren: Sie stehen in
     * `belege` und tragen die Stärke. Nur genannt werden die zwei
     * aussagekräftigsten.
     */
    beobachtung: `Du hast diese Stelle ${hinweise
      .slice(0, 2)
      .map((h) => h.name)
      .join(" und ")}.`,
    gueltigBis: tageSpaeter(jetzt, SIGNAL_GUELTIG_TAGE),
    status: "inferred",
  };
}

/**
 * Muster über mehrere Stellen hinweg.
 *
 * ── Warum das getrennt vom Einzelinteresse steht ──────────────
 *
 * Weil es eine andere Art von Aussage ist. „Du hast diese Stelle
 * mehrfach geöffnet" beschreibt eine Handlung. „Du schaust dir
 * häufiger Remote-Stellen an" beschreibt eine Tendenz — und Tendenzen
 * sind der Ort, an dem aus Beobachtung schnell Diagnose wird.
 *
 * Deshalb bleibt auch das Ergebnis eine Vermutung mit Status
 * `inferred`. Es ändert nie von selbst das bestätigte Suchprofil.
 */
export function musterAusEreignissen(
  alleEreignisse: readonly Ereignis[],
  merkmale: {
    /** Ob die Stelle vollständig remote ist. `null` heisst unbekannt. */
    remote: Map<string, boolean | null>;
  },
  jetzt: Date,
): Verhaltenssignal[] {
  const signale: Verhaltenssignal[] = [];

  /* Auch hier: nur, was die Person selbst getan hat. */
  const ereignisse = alleEreignisse.filter((e) => e.urheber === "user");

  /* ── Gehalt zuerst angesehen ──────────────────────────────── */
  const gehaltEreignisse = ereignisse.filter((e) => e.art === "salary_opened");
  const gehaltStellen = new Set(gehaltEreignisse.map((e) => e.jobId).filter(Boolean));
  if (gehaltStellen.size >= 3) {
    signale.push({
      art: "gehalt_wichtig",
      staerke: Math.min(0.8, 0.3 + gehaltStellen.size * 0.1),
      jobId: null,
      belege: gehaltEreignisse.map((e) => e.id),
      beobachtung: `Du hast bei ${gehaltStellen.size} Stellen zuerst das Gehalt geöffnet.`,
      gueltigBis: tageSpaeter(jetzt, SIGNAL_GUELTIG_TAGE),
      status: "inferred",
    });
  }

  /* ── Remote-Stellen länger angesehen ──────────────────────── */
  const remoteEreignisse = ereignisse.filter(
    (e) => e.jobId !== null && merkmale.remote.get(e.jobId) === true,
  );
  const remoteStellen = new Set(remoteEreignisse.map((e) => e.jobId));
  if (remoteStellen.size >= 3) {
    signale.push({
      art: "remote_interesse",
      staerke: Math.min(0.8, 0.3 + remoteStellen.size * 0.1),
      jobId: null,
      belege: remoteEreignisse.map((e) => e.id),
      /*
       * „Du hast dir angesehen" — nicht „Remote ist dir wichtig".
       * Das erste ist nachprüfbar, das zweite eine Unterstellung.
       */
      beobachtung: `Du hast dir zuletzt ${remoteStellen.size} vollständig ortsunabhängige Stellen angesehen.`,
      gueltigBis: tageSpaeter(jetzt, SIGNAL_GUELTIG_TAGE),
      status: "inferred",
    });
  }

  return signale;
}

/**
 * Dieselbe Handlung darf nicht zweimal zählen.
 *
 * ── Warum das nötig ist ───────────────────────────────────────
 *
 * Zwei offene Tabs auf derselben Anzeige senden dasselbe Ereignis
 * zweimal. Ohne diese Prüfung entstünde aus einem Blick ein
 * „mehrfach geöffnet", und Monday merkte eine Stelle vor, die niemand
 * zweimal angesehen hat.
 *
 * Der Schlüssel ist bewusst grob: Art, Stelle und angefangene Minute.
 * Feiner wäre genauer und würde denselben Klick über zwei Tabs
 * wieder durchlassen.
 */
export function entdoppeln(ereignisse: readonly Ereignis[]): Ereignis[] {
  const gesehen = new Set<string>();
  const raus: Ereignis[] = [];
  for (const e of ereignisse) {
    const minute = Math.floor(e.geschehenAm.getTime() / 60_000);
    /* Der Urheber gehört in den Schlüssel: Eine Handlung Mondays und
       eine der Person zur selben Minute sind zwei Ereignisse. */
    const schluessel = `${e.urheber}|${e.art}|${e.jobId ?? ""}|${minute}`;
    if (gesehen.has(schluessel)) continue;
    gesehen.add(schluessel);
    raus.push(e);
  }
  return raus;
}
