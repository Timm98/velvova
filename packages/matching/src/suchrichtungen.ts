import type { EvidenceItem, UserConstraints } from "@paycheck/domain";

/**
 * Aus einem Profil werden Suchrichtungen — nicht aus einem Jobtitel.
 *
 * ── Der Unterschied zu einer Jobbörse ─────────────────────────
 *
 * Eine Jobbörse nimmt entgegen, was jemand ins Suchfeld tippt. Wer
 * „Bürokaufmann" eingibt, bekommt Bürokaufmann — und sieht nie, dass
 * dieselben Fähigkeiten auch in der Disposition, im Auftragsmanagement
 * oder in der Kundenbetreuung gebraucht werden. Für jemanden mit einem
 * klaren Berufsziel ist das in Ordnung. Für jemanden, der wechseln
 * will, ist es die eigentliche Sackgasse: er kann nur finden, was er
 * schon benennen kann.
 *
 * Hier entstehen die Suchbegriffe aus dem, was jemand über seine Arbeit
 * gesagt hat. Aus „ich habe die Touren geplant und mit Fahrern
 * telefoniert" wird nicht „Lagerist", sondern Disposition,
 * Auftragsabwicklung, Servicekoordination.
 *
 * ── Suchrichtung ist keine Empfehlung ─────────────────────────
 *
 * Das ist die wichtigste Grenze dieser Datei. Was hier entsteht, sind
 * Wörter, mit denen wir Anbieter fragen — nicht Aussagen darüber, dass
 * ein Beruf zu jemandem passt. Die echten Stellen kommen zurück und
 * werden danach gegen das Profil geprüft: harte Bedingungen, Passung,
 * Belegqualität. Eine Suchrichtung, die nichts Passendes liefert, hat
 * nichts kaputtgemacht.
 *
 * Deshalb steht hier auch kein Sprachmodell. Ein Modell, das aus einem
 * Lebenslauf Berufsbezeichnungen erfindet, erzeugt plausible Wörter,
 * für die es keine Rechenschaft gibt — und die Person sähe eine
 * Trefferliste, deren Zustandekommen niemand erklären kann. Der
 * Katalog unten ist überprüfbar: jede Richtung nennt die Tätigkeiten,
 * die zu ihr geführt haben.
 *
 * ── Warum ein Katalog und keine Ähnlichkeitsrechnung ──────────
 *
 * Weil er falsifizierbar ist. Wenn „Disposition" bei jemandem
 * auftaucht, der nie etwas geplant hat, lässt sich genau zeigen,
 * welches Muster gegriffen hat, und die Zeile korrigieren. Bei einem
 * Einbettungsvektor lässt sich das nicht.
 */

export interface Suchrichtung {
  /** Der Begriff, mit dem gesucht wird. */
  begriff: string;
  /** Warum — in der Sprache der Person, nicht in Modellsprache. */
  begruendung: string;
  /** Welche Aussagen dazu geführt haben. Ohne sie ist es nicht prüfbar. */
  belege: string[];
  /** 0..1. Wie deutlich die Muster getroffen haben. */
  staerke: number;
}

interface Rolle {
  begriff: string;
  /** Worum es in dieser Rolle geht — für die Begründung. */
  kern: string;
  /** Tätigkeitsmuster, die auf sie hinweisen. */
  muster: RegExp[];
  /** Muster, die dagegen sprechen. Eine Gegenanzeige wiegt schwer. */
  gegen?: RegExp[];
}

/**
 * Der Katalog.
 *
 * Bewusst auf Rollen beschränkt, die es im deutschsprachigen Raum
 * breit gibt und die von aussen erreichbar sind — also keine, die eine
 * bestimmte Ausbildung zwingend voraussetzen. Eine Suchrichtung, für
 * die niemand ohne Approbation in Frage kommt, ist für einen
 * Quereinstieg keine Richtung, sondern eine Enttäuschung mit Anlauf.
 */
const ROLLEN: Rolle[] = [
  {
    begriff: "Disposition",
    kern: "Termine, Touren und Kapazitäten planen und mit Menschen abstimmen",
    muster: [/\b(dispo|disposition|tour|touren|einsatzplan|schichtplan|routen)/i,
             /\b(geplant|koordiniert|eingeteilt)\b.{0,40}\b(fahrer|monteur|team|einsätze|termine)/i,
             /\b(lager|logistik|spedition|fuhrpark)\b/i],
  },
  {
    begriff: "Auftragsabwicklung",
    kern: "Aufträge von der Bestellung bis zur Lieferung begleiten",
    muster: [/\b(auftrag|aufträge|bestellung|bestellungen|lieferung|abwicklung)/i,
             /\b(erfasst|bearbeitet|nachverfolgt)\b.{0,30}\b(auftr|bestell)/i,
             /\b(erp|sap|warenwirtschaft|navision|dynamics)\b/i],
  },
  {
    begriff: "Kundenbetreuung",
    kern: "Menschen bei Fragen und Problemen begleiten",
    muster: [/\b(kunden|kundinnen)\b.{0,30}\b(betreut|beraten|geholfen|kontakt|anliegen)/i,
             /\b(kundenservice|kundenbetreuung|servicecenter|hotline|reklamation)/i,
             /\b(gut mit menschen|gerne mit menschen|kundenkontakt)/i],
    gegen: [/\b(kaltakquise|kalt.?akquise|neukundenakquise|türgeschäft)/i],
  },
  {
    begriff: "Customer Success",
    kern: "Bestandskunden begleiten, damit sie mit dem Produkt zurechtkommen",
    muster: [/\b(bestandskunden|betreuung|onboarding|schulung|einweisung)/i,
             /\b(kunden)\b.{0,40}\b(langfristig|beziehung|zufrieden)/i,
             /\b(software|system|anwendung|produkt)\b.{0,30}\b(erklärt|gezeigt|beigebracht)/i],
    gegen: [/\b(kaltakquise|kalt.?akquise)/i],
  },
  {
    begriff: "Inside Sales",
    kern: "Verkauf vom Schreibtisch aus, überwiegend mit Bestandskunden",
    muster: [/\b(angebote|angebot)\b.{0,25}\b(erstellt|kalkuliert|geschrieben)/i,
             /\b(vertriebsinnendienst|innendienst)/i,
             /\b(verkauf|vertrieb)\b/i],
    gegen: [/\b(kaltakquise|kalt.?akquise|keine? (kunden|verkauf|vertrieb))/i],
  },
  {
    begriff: "Sachbearbeitung",
    kern: "Vorgänge sorgfältig und nach Regeln bearbeiten",
    muster: [/\b(sachbearbeitung|sachbearbeiter|vorgänge|anträge|akten)/i,
             /\b(geprüft|erfasst|dokumentiert|verwaltet)\b/i,
             /\b(sorgfältig|genau|strukturiert|ordentlich)/i],
  },
  {
    begriff: "Büromanagement",
    kern: "Ein Büro am Laufen halten: Organisation, Termine, Unterlagen",
    muster: [/\b(büro|sekretariat|office|empfang|assistenz)/i,
             /\b(organisiert|koordiniert)\b.{0,30}\b(termine|besprechungen|reisen|unterlagen)/i],
  },
  {
    begriff: "Projektkoordination",
    kern: "Zwischen Beteiligten vermitteln, damit ein Vorhaben vorankommt",
    muster: [/\b(projekt|projekte)\b.{0,30}\b(begleitet|koordiniert|geleitet|betreut)/i,
             /\b(schnittstelle|abstimmung|zwischen)\b.{0,30}\b(abteilung|team|gewerke|beteiligt)/i],
  },
  {
    begriff: "Technischer Kundendienst",
    kern: "Technische Fragen von Kundinnen und Kunden lösen",
    muster: [/\b(technisch|technik)\b.{0,40}\b(kunden|support|hilfe|problem|störung)/i,
             /\b(fehler|störungen|probleme)\b.{0,25}\b(gelöst|behoben|eingegrenzt)/i,
             /\b(1st.?level|second.?level|helpdesk|it.?support)/i],
  },
  {
    begriff: "Einkauf",
    kern: "Beschaffen, vergleichen, mit Lieferanten verhandeln",
    muster: [/\b(einkauf|beschaffung|lieferanten|bestellwesen)/i,
             /\b(preise|konditionen|angebote)\b.{0,25}\b(verglichen|verhandelt|geprüft)/i],
  },
  {
    begriff: "Qualitätssicherung",
    kern: "Prüfen, ob etwas den Anforderungen entspricht, und Abweichungen verfolgen",
    muster: [/\b(qualität|qualitätssicherung|prüfung|kontrolle|audit)/i,
             /\b(reklamationen|abweichungen|mängel)\b.{0,25}\b(bearbeitet|verfolgt|dokumentiert)/i],
  },
  {
    begriff: "Personalsachbearbeitung",
    kern: "Verträge, Zeiten und Unterlagen von Beschäftigten verwalten",
    muster: [/\b(personal|hr|lohn|gehaltsabrechnung|arbeitsverträge|zeiterfassung)/i,
             /\b(bewerbungen|bewerber)\b.{0,25}\b(bearbeitet|verwaltet|koordiniert)/i],
  },
  {
    begriff: "Buchhaltung",
    kern: "Belege, Rechnungen und Zahlen ordnen",
    muster: [/\b(buchhaltung|buchführung|rechnungen|belege|debitoren|kreditoren|datev)/i,
             /\b(zahlen|abrechnung)\b.{0,25}\b(geprüft|erstellt|kontrolliert)/i],
  },
  {
    begriff: "Datenpflege",
    kern: "Bestände sauber halten, Daten prüfen und ergänzen",
    muster: [/\b(stammdaten|datenpflege|datenbank|excel|tabellen)/i,
             /\b(daten)\b.{0,25}\b(gepflegt|erfasst|bereinigt|aufbereitet)/i],
  },
];

/**
 * Muster, die eine Richtung ausschliessen — unabhängig vom Katalog.
 *
 * Wer sagt „keine körperliche Arbeit mehr", meint es. Solche Sätze als
 * blosse Präferenz zu behandeln und trotzdem Lagerstellen zu suchen,
 * wäre die Sorte Missachtung, die niemand ein zweites Mal verzeiht.
 */
const KOERPERLICH = /\b(körperlich|schwer heben|heben|schichtdienst|nachtschicht|lager|produktion|montage|baustelle)/i;
const KEIN_KOERPERLICH = /\b(kein|keine|nicht mehr|weg von|nie wieder)\b.{0,25}\b(körperlich|heben|lager|produktion|schicht)/i;

export interface Profilauszug {
  evidence: EvidenceItem[];
  energisingTasks: string[];
  drainingTasks: string[];
  statedInterests: string[];
  constraints: UserConstraints;
}

/**
 * Suchrichtungen aus dem Profil.
 *
 * Nur bestätigte Aussagen zählen mit vollem Gewicht. Eine Vermutung
 * darf eine Richtung anstossen, aber nicht allein tragen — sonst
 * entstünde eine Trefferliste aus etwas, das nie jemand bestätigt hat.
 */
export function suchrichtungen(p: Profilauszug, hoechstens = 8): Suchrichtung[] {
  const saetze: { text: string; gewicht: number }[] = [];

  for (const e of p.evidence) {
    if (e.userRejected || e.deletedAt) continue;
    saetze.push({ text: e.statement, gewicht: e.userConfirmed ? 1 : 0.5 * e.confidence });
  }
  // Was Energie gibt, wiegt schwerer als eine blosse Tätigkeitsangabe:
  // es sagt etwas über die Richtung, nicht nur über die Vergangenheit.
  for (const t of p.energisingTasks) saetze.push({ text: t, gewicht: 1.2 });
  for (const t of p.statedInterests) saetze.push({ text: t, gewicht: 1 });
  // Was auslaugt, zählt als Gegenanzeige.
  const gegenText = [...p.drainingTasks, ...p.constraints.hardNoGos].join(" \n ");

  const meidetKoerperlich =
    KEIN_KOERPERLICH.test(gegenText) ||
    saetze.some((s) => KEIN_KOERPERLICH.test(s.text)) ||
    p.drainingTasks.some((t) => KOERPERLICH.test(t));

  const raus: Suchrichtung[] = [];

  for (const r of ROLLEN) {
    let punkte = 0;
    const belege: string[] = [];

    for (const s of saetze) {
      const treffer = r.muster.filter((m) => m.test(s.text)).length;
      if (treffer === 0) continue;
      if (r.gegen?.some((g) => g.test(s.text))) continue;
      punkte += treffer * s.gewicht;
      if (belege.length < 3) belege.push(s.text);
    }

    if (punkte === 0) continue;

    /*
     * Gegenanzeigen ziehen ab, statt auszuschliessen.
     *
     * „Keine Kaltakquise" heisst nicht „kein Vertrieb" — es gibt
     * Vertriebsrollen ohne Kaltakquise, und genau die sind für viele
     * der interessante Weg. Eine harte Sperre nähme ihn weg.
     * Ausgeschlossen wird erst weiter unten, wenn ein Ausschluss den
     * Kern der Rolle trifft.
     */
    if (r.gegen?.some((g) => g.test(gegenText))) punkte *= 0.4;
    if (meidetKoerperlich && /\b(lager|produktion|montage)/i.test(r.kern)) continue;

    raus.push({
      begriff: r.begriff,
      begruendung: `${r.kern} — das kommt in dem vor, was du erzählt hast.`,
      belege,
      staerke: Math.min(1, punkte / 4),
    });
  }

  /*
   * Nichts erfinden, wenn nichts da ist.
   *
   * Ein leeres Profil ergibt keine Suchrichtungen. Eine Standardliste
   * wäre kein Vorschlag, sondern Raten — und sie sähe für die Person
   * genauso aus wie ein echtes Ergebnis.
   */
  return raus.sort((a, b) => b.staerke - a.staerke).slice(0, hoechstens);
}

/**
 * Die Suchbegriffe für die Anbieter.
 *
 * Ort kommt aus den Bedingungen, nicht aus der Richtung: „Disposition"
 * ist überall dasselbe, der Ort ist die Bedingung der Person.
 */
export function suchbegriffe(richtungen: Suchrichtung[], c: UserConstraints): string[] {
  const ort = c.baseLocation?.trim();
  return richtungen.map((r) => (ort ? `${r.begriff} ${ort}` : r.begriff));
}
