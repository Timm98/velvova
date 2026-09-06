import { loadRuntimeConfig, type RuntimeConfig } from "@paycheck/config";
import type { JobSourceAdapter } from "./adapter.ts";
import { UserTextImportAdapter } from "./sources/userImport.ts";
import { ArbeitnowAdapter } from "./sources/arbeitnow.ts";
import { ADZUNA_LAENDER, AdzunaAdapter } from "./sources/adzuna.ts";
import { ReedAdapter } from "./sources/reed.ts";
import { UsaJobsAdapter } from "./sources/usajobs.ts";
import { FindworkAdapter } from "./sources/findwork.ts";
import { JOOBLE_COUNTRIES, JoobleAdapter } from "./sources/jooble.ts";
import { AtsBoardAdapter, type BoardKind, type BoardRegistration } from "./sources/ats/board.ts";
import { PARTNER_ADAPTERS } from "./sources/partners.ts";
import { LightcastAdapter } from "./sources/lightcast.ts";
import { JSearchAdapter } from "./sources/jsearch.ts";
import { TheirStackAdapter } from "./sources/theirstack.ts";
import { BrightDataAdapter } from "./sources/brightdata.ts";
import { ApifyAdapter } from "./sources/apify.ts";
import { BundesagenturAdapter, STANDARDSUCHEN } from "./sources/bundesagentur.ts";

/**
 * Welche Quellen aktiv sind.
 *
 * Eine Quelle läuft nur, wenn sie ausgewählt, konfiguriert UND lizenziert
 * ist. Alle drei Prüfungen stehen hier und nicht im Aufrufer — sonst
 * schleicht sich früher oder später eine Stelle ein, an der eine davon
 * vergessen wird.
 */

export interface SourceStatus {
  key: string;
  displayName: string;
  active: boolean;
  reason: string;
  /** Liefert diese Quelle echte Stellen oder synthetische? */
  real: boolean;
}

/**
 * Registrierte Arbeitgeberboards, prozessweit gehalten.
 *
 * Der Adapter fragt sie synchron ab (`isConfigured()`), der
 * Datenbankzugriff ist asynchron. Deshalb wird die Liste vom Abrufpfad
 * gesetzt, statt sie im Adapter zu laden. Ist sie leer, fragt der
 * Adapter niemanden — und das ist die richtige Antwort, nicht ein
 * Versehen: wir kennen dann keinen Arbeitgeber, dessen Stellen wir
 * abrufen dürfen.
 */
const boardRegistrations = new Map<BoardKind, BoardRegistration[]>();

export function setBoardRegistrations(board: BoardKind, rows: BoardRegistration[]): void {
  boardRegistrations.set(board, rows);
}

export const ATS_BOARDS: BoardKind[] = ["greenhouse", "lever", "ashby", "smartrecruiters"];

/**
 * Suchbegriffe, die aus echten Profilen stammen.
 *
 * Ohne sie sucht die Bundesagentur mit fünf fest eingetragenen
 * Standardbegriffen — Sachbearbeitung, Kundenbetreuung, Disposition,
 * Büromanagement, Vertriebsinnendienst. Das ist eine vernünftige
 * Grundausstattung und war nie als Endzustand gedacht: Der Adapter nimmt
 * `abfragen` seit jeher im Konstruktor entgegen, und der Kommentar dort
 * nennt ausdrücklich „die Suchrichtungen aus ihrem Profil".
 *
 * Nur hat sie nie jemand übergeben. `allAdapters()` rief
 * `new BundesagenturAdapter()` ohne Argumente auf, und damit blieb es
 * bei den fünf.
 *
 * Die Folge war kein Fehler, sondern eine stille Verengung: Der Bestand
 * wuchs in genau fünf Richtungen, und wer in eine sechste wollte, fand
 * dort nichts — nicht weil es nichts gibt, sondern weil nie jemand
 * danach gefragt hat.
 */
export interface AdapterOptionen {
  /**
   * Begriffe für Anbieter, die eine Freitextsuche können.
   *
   * Wer sie nicht setzt, bekommt die Standardbegriffe. Das ist Absicht:
   * Ein Abruf ohne Profile im System darf nicht mit einer leeren Liste
   * enden und gar nichts holen.
   */
  abfragen?: string[];
  /**
   * Amtliche Berufsbezeichnungen als Suchwortschatz.
   *
   * Der eigentliche Hebel: Die Jobbörse verschlagwortet jede Anzeige
   * mit einer Bezeichnung aus der Klassifikation der Berufe. Danach zu
   * suchen findet sie zuverlässig — und die Liste steht ohnehin schon
   * in `beruf_zuordnung`.
   *
   * Ohne sie bleibt es bei fünf Standardbegriffen, und der Bestand
   * bleibt bei einem Bruchteil dessen, was die Quelle hergibt.
   */
  berufe?: string[];
}

/**
 * Grundausstattung plus das, was Profile hergeben.
 *
 * Ergänzen und nicht ersetzen — das ist hier die ganze Entscheidung,
 * und sie kommt aus einer Messung statt aus einer Vermutung: Über 63
 * Konten mit Belegen überschritten nur drei abgeleitete Richtungen die
 * Schwelle. Ein Austausch hätte den Bestand von fünf auf drei
 * Richtungen verengt und dabei Sachbearbeitung, Büromanagement und
 * Vertriebsinnendienst verloren.
 *
 * Die Grundausstattung steht deshalb vorn: Sie ist der Boden, unter den
 * es nicht geht, auch wenn noch niemand ein Profil ausgefüllt hat.
 */
function bundesagenturAbfragen(ausProfilen?: string[], berufe?: string[]): string[] {
  const zusammen = [...STANDARDSUCHEN];
  for (const b of [...(ausProfilen ?? []), ...(berufe ?? [])]) {
    if (!zusammen.some((x) => x.toLowerCase() === b.toLowerCase())) zusammen.push(b);
  }
  /*
   * Die Grenze lag bei zwölf — und das war richtig, solange der
   * Adapter nicht blätterte.
   *
   * Damals holte er je Begriff eine Seite und teilte sein Limit durch
   * die Anzahl der Begriffe. Mehr Begriffe hiessen weniger Treffer je
   * Begriff, und die hinteren verhungerten: Ein Testlauf mit Limit 20
   * und sechs Begriffen holte für den sechsten nichts.
   *
   * Seit der Adapter reihum blättert — erst Seite 1 für alle Begriffe,
   * dann Seite 2 für alle — verhungert keiner mehr. Jeder Begriff
   * kommt in jeder Runde dran, und ein Abbruch trifft alle gleich.
   * Damit fällt der Grund für die enge Grenze weg.
   *
   * Sie steht trotzdem noch da, nur weiter oben: 400 Begriffe sind
   * 400 Anfragen je Seite. Das ist eine Obergrenze gegen Unfälle, kein
   * fachliches Limit.
   */
  return zusammen.slice(0, 400);
}

function allAdapters(o: AdapterOptionen = {}): JobSourceAdapter[] {
  return [
    new ArbeitnowAdapter(),
    /*
     * Alle drei Länder, nicht nur Deutschland.
     *
     * Hier stand `new AdzunaAdapter()` ohne Argument — und damit lief
     * nur die Voreinstellung `de`, obwohl der Adapter das Land seit
     * jeher entgegennimmt. Österreich (33.078) und die Schweiz
     * (81.550) waren nie abgerufen worden.
     */
    ...ADZUNA_LAENDER.map((country) => new AdzunaAdapter({ country })),
    /*
     * Drei Quellen mit Schlüssel, alle kostenlos.
     *
     * Sie melden sich von selbst als nicht eingerichtet, solange kein
     * Schlüssel hinterlegt ist — der Abruf versucht es gar nicht erst.
     *
     * USAJOBS ist die einzige geprüfte Quelle mit lückenloser
     * Gehaltsangabe: Bei US-Bundesstellen ist die Spanne gesetzlich
     * vorgeschrieben.
     */
    /*
     * Ohne Suchbegriffe.
     *
     * `o.abfragen` sind die amtlichen deutschen Berufsbezeichnungen.
     * Sie hier zu übergeben hiesse, britische und amerikanische
     * Stellen nach „Zerspanungsmechaniker/in" zu durchsuchen — das
     * findet nichts, und der Lauf sähe aus, als lieferten die Quellen
     * nichts.
     *
     * Alle drei blättern ohne Begriff durch ihren Gesamtbestand. Ein
     * englischer Wortschatz wäre die Verbesserung; bis dahin ist kein
     * Begriff besser als der falsche.
     */
    new ReedAdapter(),
    new UsaJobsAdapter(),
    new FindworkAdapter(),
    ...JOOBLE_COUNTRIES.map((country) => new JoobleAdapter({ country })),
    new LightcastAdapter(),
    /*
     * Die Reihenfolge hier ist keine Rangfolge.
     *
     * Welcher Anbieter zuerst gefragt wird, entscheidet die
     * Abrufreihenfolge (`orchestrierung.ts`) nach Datenqualität und
     * Kosten — nicht diese Liste. Hier steht nur, welche es gibt.
     */
    new TheirStackAdapter(),
    new JSearchAdapter(),
    new BrightDataAdapter(),
    new ApifyAdapter(),
    /*
     * Die einzige Quelle ohne Zugangsdaten — und die einzige staatliche.
     * `isConfigured()` gibt hier immer `true` zurück, weil es nichts
     * einzurichten gibt.
     */
    /*
     * Die Begriffe werden durchgereicht, wenn welche da sind.
     *
     * `abfragen: undefined` fällt im Adapter auf die Standardliste
     * zurück — deshalb ist der leere Fall hier kein Sonderfall.
     */
    new BundesagenturAdapter({ abfragen: bundesagenturAbfragen(o.abfragen, o.berufe) }),
    ...ATS_BOARDS.map(
      (board) => new AtsBoardAdapter(board, () => boardRegistrations.get(board) ?? []),
    ),
    // Ohne Vertrag. Sie rufen nichts ab und werfen, wenn es jemand
    // versucht — aber sie machen die Lücke sichtbar. Fehlt der Adapter
    // ganz, sieht die Betriebsansicht aus, als gäbe es LinkedIn nicht,
    // und die nächste Person schreibt einen Scraper statt nach einem
    // Vertrag zu fragen.
    ...PARTNER_ADAPTERS.map((Adapter) => new Adapter()),
    new UserTextImportAdapter(),
  ];
}

export function adapterByKey(key: string): JobSourceAdapter | undefined {
  return allAdapters().find((a) => a.key === key);
}

/**
 * Wann eine Quelle läuft.
 *
 * ── Die Regel hat sich umgedreht ───────────────────────────────
 *
 * Vorher musste eine Quelle in `JOB_SOURCES` stehen, UND eingerichtet
 * sein, UND lizenziert. Das klang vorsichtig und war in der Praxis eine
 * Falle: `JOB_SOURCES=arbeitnow` stand seit Monaten in der
 * Konfiguration, und jeder neu eingerichtete Anbieter blieb still aus.
 * Wer einen Schlüssel einträgt und danach keine zusätzlichen Stellen
 * sieht, sucht den Fehler beim Anbieter — nicht in einer
 * Aufzählung, die er vor Monaten gesetzt hat.
 *
 * Jetzt gilt: **eingerichtet und lizenziert heisst aktiv.** Wer einen
 * Schlüssel hinterlegt, hat damit eine Entscheidung getroffen; sie
 * ein zweites Mal an anderer Stelle bestätigen zu müssen, schützt
 * niemanden.
 *
 * ── Zwei Ausnahmen, und beide sind Absicht ─────────────────────
 *
 * `JOB_SOURCES_EXCLUDE` schaltet eine Quelle ausdrücklich ab — für den
 * Fall, dass ein Schlüssel hinterlegt ist, aber gerade nicht abgefragt
 * werden soll (Kosten, Kontingent, Störung beim Anbieter).
 *
 * `seed` bleibt Aufzählungspflicht. Es liefert synthetische Stellen,
 * und die dürfen niemals dadurch in die Anwendung geraten, dass jemand
 * eine Regel gelockert hat. Sie brauchen eine ausdrückliche Nennung.
 */
function ausgeschlossen(): Set<string> {
  return new Set(
    (process.env.JOB_SOURCES_EXCLUDE ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

function laeuft(a: JobSourceAdapter, cfg: RuntimeConfig, aus: Set<string>): boolean {
  if (aus.has(a.key.toLowerCase())) return false;
  if (a.licenseStatus === "unclear") return false;
  if (!a.isConfigured()) return false;
  // Synthetische Quellen nur auf ausdrückliche Nennung.
  if (a.licenseStatus === "demo") return cfg.jobs.sources.includes(a.key);
  return true;
}

export function activeAdapters(
  cfg: RuntimeConfig = loadRuntimeConfig(),
  o: AdapterOptionen = {},
): JobSourceAdapter[] {
  const aus = ausgeschlossen();
  return allAdapters(o).filter((a) => laeuft(a, cfg, aus));
}

export function sourceStatuses(cfg: RuntimeConfig = loadRuntimeConfig()): SourceStatus[] {
  const aus = ausgeschlossen();
  const statuses: SourceStatus[] = allAdapters().map((a) => {
    const configured = a.isConfigured();
    const licensed = a.licenseStatus !== "unclear";
    return {
      key: a.key,
      displayName: a.displayName,
      active: laeuft(a, cfg, aus),
      real: true,
      /*
       * Der Grund muss die Handlung nennen, nicht den Zustand.
       *
       * „nicht eingerichtet" allein lässt offen, was zu tun ist.
       * „Zugangsdaten fehlen" sagt es — und genau danach sucht jemand,
       * der gerade einen Schlüssel eingetragen hat und sich fragt,
       * warum die Quelle immer noch aus ist.
       */
      reason: !licensed
        ? "gesperrt: Rechtslage nicht geklärt"
        : aus.has(a.key.toLowerCase())
          ? "abgeschaltet über JOB_SOURCES_EXCLUDE"
          : !configured
            ? "Zugangsdaten fehlen"
            : a.licenseStatus === "demo" && !cfg.jobs.sources.includes(a.key)
              ? "synthetische Quelle, nur auf ausdrückliche Nennung"
              : "aktiv",
    };
  });

  if (cfg.jobs.sources.includes("seed")) {
    statuses.unshift({
      key: "seed",
      displayName: "Demo-Datensatz",
      active: true,
      real: false,
      reason: "aktiv — ausschließlich synthetische Stellen",
    });
  }

  return statuses;
}
