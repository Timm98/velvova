/*
 * Über den Unterpfad, nicht über den Paketeinstieg.
 *
 * `@paycheck/jobs` zieht die Anbieter-Adapter mit, und die hängen an
 * `pg`, `dns` und `net`. Diese Datei läuft aber AUCH im Browser — der
 * Editor prüft die Anzeige beim Tippen. Über den Einstieg importiert
 * bricht der Bau mit „Module not found: Can't resolve 'dns'", einer
 * Meldung, die mit der Ursache nichts zu tun hat.
 *
 * `leistungen.ts` selbst ist rein: keine Datenbank, kein Netz, keine
 * Konfiguration.
 */
import { leistungenAusText } from "@paycheck/jobs/leistungen";

/**
 * Was an einer Anzeige noch fehlt oder schiefliegt.
 *
 * ── Warum Muster und kein Modell ──────────────────────────────
 *
 * Ein Modell würde hier gelegentlich etwas beanstanden, das nicht
 * dasteht, und gelegentlich etwas übersehen, das dasteht. Beides ist bei
 * einer Rechtsfrage teuer: Wer eine Formulierung geändert bekommt, die
 * gar nicht im Text stand, verliert das Vertrauen in alle anderen
 * Hinweise — und danach liest er keinen mehr.
 *
 * Jeder Befund hier ist deshalb nachprüfbar: eine fehlende Angabe oder
 * eine Textstelle, die zitiert wird.
 *
 * ── Warum Hinweise und keine Sperren ──────────────────────────
 *
 * Bis auf Gehalt, Ort und Beschreibung — die drei blockieren das
 * Veröffentlichen — ist alles hier ein Hinweis. „Junges Team“ IST nicht
 * automatisch rechtswidrig; es ist eine Formulierung, über die
 * Arbeitsgerichte schon entschieden haben, und der Arbeitgeber soll sie
 * bewusst wählen oder ändern. Wer die Entscheidung wegnimmt, erzieht
 * niemanden — er wird umgangen.
 *
 * ── Was das mit Recruiting zu tun hat ─────────────────────────
 *
 * Das Gegenstück zur Kandidatenseite: Dort liest das Produkt Anzeigen
 * und sagt, was fehlt. Hier tut es dasselbe, bevor die Anzeige
 * hinausgeht. Dieselben Lücken, nur früher — und beim Autor, der sie
 * noch schliessen kann.
 */

export type Gewicht = "blockiert" | "wichtig" | "hinweis";

export interface Befund {
  key: string;
  gewicht: Gewicht;
  titel: string;
  text: string;
  /** Die beanstandete Textstelle, wenn es eine gibt. */
  beleg?: string;
}

export interface Anzeigenentwurf {
  title: string;
  location: string;
  description: string;
  workModel: string | null;
  contractType: string | null;
  weeklyHours: number | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryPeriod: string;
  /* Die Felder aus der erweiterten Anzeige. Optional, weil eine
     Anzeige in mehreren Anläufen entsteht — geprüft wird trotzdem. */
  aufgaben?: string | null;
  mussFaehigkeiten?: string[];
  kannFaehigkeiten?: string[];
  arbeitssprache?: string | null;
  antwortzeit?: string | null;
  interviewablauf?: string | null;
  berichtslinie?: string | null;
}

/*
 * Formulierungen, über die Arbeitsgerichte entschieden haben.
 *
 * Die Liste ist bewusst kurz und belegbar. „Junges, dynamisches Team“
 * ist der Klassiker aus der Rechtsprechung zum Alter; die
 * geschlechtsbezogene Ausschreibung ohne Zusatz ist der zweite
 * Dauerbrenner. Was hier NICHT steht, ist alles, was von der
 * Formulierung allein nicht zu entscheiden ist.
 */
const FORMULIERUNGEN: { key: string; muster: RegExp; titel: string; text: string }[] = [
  {
    key: "alter",
    /*
     * Das Komma gehört ins Muster.
     *
     * „junges, dynamisches Team" ist die verbreitetste Schreibweise —
     * und die erste Fassung mit `\s+` traf sie nicht. Ein Muster, das
     * genau die häufigste Form verfehlt, sieht im Test gut aus und
     * findet in der Wirklichkeit nichts.
     */
    muster:
      /\b(junges?\s*,?\s*(und\s+)?(dynamisches?\s*,?\s*)?team|jungem\s+team|digital\s+natives?|berufsanfänger\s+bevorzugt|höchstens\s+\d{2}\s+jahre)\b/i,
    titel: "Altersbezug",
    text:
      "Formulierungen wie „junges Team“ gelten vor Arbeitsgerichten als Indiz für eine " +
      "Benachteiligung wegen des Alters. Gemeint ist meist die Arbeitsweise — die lässt sich " +
      "auch beschreiben, ohne ein Alter zu nennen.",
  },
  {
    key: "geschlecht",
    muster: /\b(m[\/|]w|m\/w\/d|w\/m\/d|\(m\/w\/d\)|geschlechtsneutral)\b/i,
    titel: "",
    text: "",
  },
  {
    key: "muttersprache",
    muster: /\bmuttersprach(?:ler|lich)/i,
    titel: "„Muttersprache“",
    text:
      "„Muttersprachler“ beschreibt die Herkunft, nicht das Können — und gilt deshalb als Indiz " +
      "für eine Benachteiligung wegen der ethnischen Herkunft. Ein Sprachniveau (etwa C2) sagt " +
      "genauer, was gemeint ist.",
  },
  {
    key: "aussehen",
    muster: /\b(gepflegtes\s+äußeres|attraktives?\s+auftreten|sportliche?\s+erscheinung)\b/i,
    titel: "Aussehen als Anforderung",
    text:
      "Anforderungen an das Aussehen sind nur zulässig, wenn sie für die Tätigkeit wirklich " +
      "notwendig sind. Sonst benachteiligen sie — und sagen über die Eignung nichts.",
  },
  {
    key: "familienstand",
    muster: /\b(ungebunden|flexibel\s+ohne\s+familiäre|keine\s+kinder)\b/i,
    titel: "Familienstand",
    text:
      "Hinweise auf Familienstand oder Kinder benachteiligen — meist Frauen. Was gemeint ist, " +
      "sind oft Reisebereitschaft oder Arbeitszeiten; die lassen sich direkt benennen.",
  },
];

export function pruefeAnzeige(e: Anzeigenentwurf): Befund[] {
  const befunde: Befund[] = [];
  const text = e.description ?? "";

  // ── Was das Veröffentlichen blockiert ──────────────────────
  if (e.title.trim().length < 3) {
    befunde.push({
      key: "titel",
      gewicht: "blockiert",
      titel: "Kein Titel",
      text: "Ohne Titel findet die Stelle niemand.",
    });
  }
  if (e.location.trim().length === 0) {
    befunde.push({
      key: "ort",
      gewicht: "blockiert",
      titel: "Kein Ort",
      text:
        "Der Ort entscheidet über den Arbeitsweg, und der verschiebt die Rechnung oft stärker " +
        "als das Gehalt. Bei einer reinen Remote-Stelle gehört auch das hier hin.",
    });
  }
  if (text.trim().length < 120) {
    befunde.push({
      key: "beschreibung",
      gewicht: "blockiert",
      titel: "Beschreibung zu kurz",
      text: "Unter 120 Zeichen steht nichts, woran jemand erkennen könnte, ob die Stelle passt.",
    });
  }
  if (e.salaryMin === null && e.salaryMax === null) {
    befunde.push({
      key: "gehalt",
      gewicht: "blockiert",
      titel: "Keine Gehaltsangabe",
      text:
        "Hier ist sie Pflicht. Dieses Produkt dreht sich um die Frage, was von einem Gehalt " +
        "übrig bleibt — eine Anzeige ohne Zahl macht sie unbeantwortbar.",
    });
  }

  // ── Zahlen, die nicht zusammenpassen ───────────────────────
  if (e.salaryMin !== null && e.salaryMax !== null && e.salaryMin > e.salaryMax) {
    befunde.push({
      key: "spanne_verdreht",
      gewicht: "blockiert",
      titel: "Gehaltsspanne verdreht",
      text: `„Von“ (${e.salaryMin}) liegt über „bis“ (${e.salaryMax}).`,
    });
  }
  if (
    e.salaryMin !== null &&
    e.salaryMax !== null &&
    e.salaryMin > 0 &&
    e.salaryMax / e.salaryMin > 2
  ) {
    /*
     * Eine sehr weite Spanne ist keine Angabe mehr.
     *
     * „40.000 bis 90.000“ beantwortet die Frage nicht, sondern verschiebt
     * sie ins Gespräch — und wirkt dort wie ein Verhandlungstrick. Kein
     * Blocker: Bei manchen Rollen ist die Spanne echt.
     */
    befunde.push({
      key: "spanne_weit",
      gewicht: "hinweis",
      titel: "Sehr weite Gehaltsspanne",
      text:
        "Mehr als das Doppelte zwischen unten und oben liest sich wie „kommt darauf an“. Wenn " +
        "die Spanne echt ist, hilft ein Satz dazu, wovon sie abhängt.",
    });
  }

  // ── Angaben, die die Rechnung möglich machen ───────────────
  if (e.weeklyHours === null) {
    befunde.push({
      key: "stunden",
      gewicht: "wichtig",
      titel: "Keine Wochenstunden",
      text:
        "Ohne sie lässt sich nicht ausrechnen, was die Stelle je Stunde bringt — die einzige " +
        "Zahl, die zwei Angebote fair vergleicht. Bewerberinnen sehen dann eine Lücke, wo " +
        "andere Anzeigen eine Zahl haben.",
    });
  }
  if (!e.workModel) {
    befunde.push({
      key: "arbeitsmodell",
      gewicht: "wichtig",
      titel: "Kein Arbeitsmodell",
      text: "Vor Ort, hybrid oder remote entscheidet für viele, ob sie sich überhaupt bewerben.",
    });
  }
  if (!e.contractType) {
    befunde.push({
      key: "vertrag",
      gewicht: "hinweis",
      titel: "Keine Vertragsart",
      text: "Befristet oder unbefristet ist eine der ersten Fragen im Gespräch.",
    });
  }
  if (leistungenAusText(text).length === 0 && text.trim().length >= 120) {
    befunde.push({
      key: "leistungen",
      gewicht: "hinweis",
      titel: "Keine Leistungen genannt",
      text:
        "Urlaubstage, Homeoffice, Altersvorsorge, Jobticket: Was im Text steht, erscheint in der " +
        "Anzeige als eigener Abschnitt — mit dem Satz, in dem es steht.",
    });
  }

  // ── Formulierungen ─────────────────────────────────────────
  const saetze = text.split(/(?<=[.!?;:])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
  for (const f of FORMULIERUNGEN) {
    if (f.key === "geschlecht") continue;
    for (const satz of saetze) {
      if (!f.muster.test(satz)) continue;
      befunde.push({
        key: f.key,
        gewicht: "wichtig",
        titel: f.titel,
        text: f.text,
        beleg: satz.length > 160 ? `${satz.slice(0, 157)}…` : satz,
      });
      break;
    }
  }

  /*
   * Der Zusatz im Titel — geprüft am Titel, nicht am Text.
   *
   * „(m/w/d)“ gehört in die Stellenbezeichnung. Ihn irgendwo im
   * Fliesstext zu finden, würde eine Anzeige durchwinken, in deren
   * Überschrift „Sachbearbeiter“ ohne Zusatz steht — und genau der
   * Titel wird in Listen und Suchergebnissen gezeigt.
   */
  if (!/\((?:m\/w\/d|w\/m\/d|m\/w\/x|d\/m\/w|all\s*genders?)\)|\bm\/w\/d\b/i.test(e.title)) {
    befunde.push({
      key: "geschlecht",
      gewicht: "wichtig",
      titel: "Kein Zusatz im Titel",
      text:
        "Eine Stellenbezeichnung ohne „(m/w/d)“ gilt als Indiz für eine geschlechtsbezogene " +
        "Ausschreibung. Der Zusatz gehört in den Titel, nicht nur in den Fliesstext.",
      beleg: e.title,
    });
  }

  /*
   * Die Reihenfolge: erst was blockiert, dann was fehlt, dann Hinweise.
   *
   * Wer die Liste von oben liest, arbeitet sie in der Reihenfolge ab, in
   * der sie ihm nützt.
   */
  const rang: Record<Gewicht, number> = { blockiert: 0, wichtig: 1, hinweis: 2 };
  return befunde.sort((a, b) => rang[a.gewicht] - rang[b.gewicht]);
}

/** Ob die Anzeige veröffentlicht werden kann. */
/**
 * Die Regeln zu den erweiterten Feldern.
 *
 * ── Warum „Muss ohne Kann" ein Befund ist ─────────────────────
 *
 * Eine Anzeige, in der alles unverzichtbar ist, hat die Trennung nicht
 * vorgenommen — sie hat nur alles in die erste Spalte geschrieben.
 * Für die Bewertung heisst das: Jede fehlende Fähigkeit ist ein
 * Ausschluss, und niemand ist mehr entwickelbar. Genau daran scheitern
 * Menschen, die die Arbeit könnten.
 *
 * ── Warum die Anzahl der Muss-Kriterien zählt ─────────────────
 *
 * Ab etwa acht unverzichtbaren Anforderungen beschreibt eine Anzeige
 * niemanden mehr, den es gibt. Der Befund sagt das, ohne eine Zahl zu
 * erfinden: Er nennt die Anzahl und überlässt das Urteil dem Team.
 */
export function pruefeFelder(e: Anzeigenentwurf): Befund[] {
  const b: Befund[] = [];
  const muss = e.mussFaehigkeiten ?? [];
  const kann = e.kannFaehigkeiten ?? [];

  if (!e.aufgaben?.trim()) {
    b.push({
      key: "aufgaben",
      gewicht: "wichtig",
      titel: "Die Aufgaben stehen nicht getrennt da",
      text: "Im Fliesstext gehen sie zwischen Anforderungen und Selbstbeschreibung unter. Getrennt erfassen heisst, dass Nina sie mit dem vergleichen kann, was jemand tatsächlich getan hat.",
    });
  }

  if (muss.length === 0) {
    b.push({
      key: "muss_fehlt",
      gewicht: "wichtig",
      titel: "Keine Muss-Anforderungen erfasst",
      text: "Ohne sie kann Nina nicht unterscheiden, was wirklich unverzichtbar ist und was in der Einarbeitung erreichbar wäre.",
    });
  } else if (kann.length === 0) {
    b.push({
      key: "kann_fehlt",
      gewicht: "wichtig",
      titel: "Alles ist unverzichtbar",
      text: `${muss.length} Muss-Anforderungen, keine einzige als erlernbar markiert. Dann ist jede Lücke ein Ausschluss — auch bei Menschen, die die Aufgabe könnten.`,
    });
  }

  if (muss.length >= 8) {
    b.push({
      key: "muss_viele",
      gewicht: "hinweis",
      titel: `${muss.length} unverzichtbare Anforderungen`,
      text: "Je länger diese Liste, desto kleiner der Kreis. Prüft, welche davon wirklich am ersten Tag dasein müssen.",
    });
  }

  if (!e.antwortzeit?.trim()) {
    b.push({
      key: "antwortzeit",
      gewicht: "wichtig",
      titel: "Keine Antwortzeit zugesagt",
      text: "Ohne sie weiss niemand, ab wann er nachfragen darf — und ausbleibende Rückmeldung ist der meistgenannte Abbruchgrund.",
    });
  }

  if (!e.interviewablauf?.trim()) {
    b.push({
      key: "interviewablauf",
      gewicht: "hinweis",
      titel: "Der Ablauf ist nicht beschrieben",
      text: "Wie viele Gespräche, mit wem, wie lange. Wer das vorher weiss, springt seltener mittendrin ab.",
    });
  }

  return b;
}

export function veroeffentlichbar(befunde: Befund[]): boolean {
  return !befunde.some((b) => b.gewicht === "blockiert");
}
