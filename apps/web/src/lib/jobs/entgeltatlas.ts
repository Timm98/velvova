import { sql } from "drizzle-orm";
import { getDb, withSystem } from "@paycheck/db";

/**
 * Amtliche Gehaltsdaten der Bundesagentur für Arbeit.
 *
 * ── Warum es diese Datei gibt ─────────────────────────────────
 *
 * Der Vergleichswert in `gehaltsvergleich.ts` stammt aus unserem
 * eigenen Bestand — aus den rund 190 Anzeigen, die eine Zahl nennen.
 * Das reicht für sieben Berufsgruppen und damit für 71 % der Stellen.
 * Für die übrigen 29 % gibt es keine tragfähige Basis, und eine Zahl
 * aus zwei Anzeigen wäre ein Zufallswert mit Nachkommastellen.
 *
 * Der Entgeltatlas schliesst diese Lücke: Er liefert Medianentgelte je
 * Berufsgattung, Region, Branche, Alter und Geschlecht aus der
 * Beschäftigungsstatistik — für alle Berufe, nicht nur für die, über
 * die wir zufällig Daten haben.
 *
 * ── Der Irrtum, der ihn wochenlang abgeschaltet hielt ─────────
 *
 * Hier stand: „Er antwortet auf jede Anfrage ohne eigene Zugangsdaten
 * mit 403. Beide Zugänge sind kostenlos, brauchen aber eine
 * Registrierung, die nur der Betreiber vornehmen kann."
 *
 * Das war falsch, und der Irrtum kostete eine Registrierung, die
 * niemand gebraucht hätte. Der Atlas verlangt keine Zugangsdaten. Er
 * verlangt dieselbe öffentliche Kennung wie die Jobsuche — nur unter
 * anderem Namen.
 *
 * Gefunden hat es nicht die Dokumentation, sondern eine Gegenprobe:
 * Der Token-Pfad `/oauth/gettoken_cc` antwortet mit 403 auch auf
 * **erfundene** Zugangsdaten, auf einen leeren Körper und auf GET. Ein
 * Dienst, der Zugangsdaten prüft, unterscheidet zwischen falschen und
 * fehlenden; dieser tat es nicht. Also lag es nicht an den Daten,
 * sondern am Pfad — es gibt dort kein OAuth.
 *
 * Die richtige Kennung stand offen in der Weboberfläche des Atlas
 * (`web.arbeitsagentur.de/entgeltatlas/`, im HTML als
 * `infosysbubLibConfig.clientId`). Damit antwortet der Dienst mit 200.
 *
 * ── Was der Dienst liefert, und was davon zu glauben ist ──────
 *
 * Eine Abfrage gibt bis zu mehreren hundert Sätze zurück — je
 * Kombination aus Region, Branche, Geschlecht und Altersgruppe einen.
 * Nur etwa **ein Drittel** trägt echte Zahlen. Der Rest ist mit
 * negativen Kennzahlen belegt: gemessen wurden -1, -2, -3, -42 und
 * -100 in `entgelt`, `entgeltQ25`, `entgeltQ75` und `besetzung`.
 *
 * Das ist die gefährlichste Eigenschaft dieser Quelle. Ein `-2`, das
 * als Betrag durchgeht, macht aus „nicht ausgewiesen" ein Gehalt von
 * minus zwei Euro — und der Vergleichswert einer Berufsgruppe wäre
 * still verdorben. Deshalb prüft `ausgewiesenerWert()` jeden Wert
 * einzeln, und zwar auf `> 0`, nicht auf `!= null`.
 */

export interface AmtlicherWert {
  /** Median-Bruttoentgelt je Jahr in Euro. */
  median: number;
  /** Unteres und oberes Quartil je Jahr — `null`, wenn nicht ausgewiesen. */
  q1: number | null;
  q3: number | null;
  /** Woher, für die Anzeige. */
  quelle: string;
  /** Das Jahr, auf das sich die Statistik bezieht. */
  stand: string;
  /**
   * Wie viele Beschäftigte hinter dem Median stehen.
   *
   * Steht in der Anzeige nicht, entscheidet aber, ob der Wert etwas
   * taugt: Ein Median über 40 Beschäftigte ist etwas anderes als einer
   * über 40.000.
   */
  besetzung: number | null;
  /**
   * true, wenn der Median an der Beitragsbemessungsgrenze liegt.
   *
   * Die Beschäftigungsstatistik erfasst Entgelte nur bis zu dieser
   * Grenze. Liegt der Median dort, ist er abgeschnitten und in
   * Wahrheit höher — als Vergleichswert taugt er dann nicht mehr, und
   * wer ihn anzeigt, muss es dazusagen.
   */
  abgeschnitten: boolean;
}

const BASIS = "https://rest.arbeitsagentur.de/infosysbub/entgeltatlas";
const DKZ = "https://rest.arbeitsagentur.de/infosysbub/dkz-rest";

/*
 * Die Kennung ist keine Zugangsbeschränkung, sondern eine Kennung.
 *
 * Sie steht im Klartext im HTML der Weboberfläche des Entgeltatlas und
 * ist damit genauso öffentlich wie `jobboerse-jobsuche` bei der
 * Jobsuche. Sie gehört deshalb in den Code und nicht in `.env.local`:
 * es gibt nichts geheimzuhalten, und ein Platzhalter, den jeder erst
 * nachschlagen müsste, hielte die Quelle ohne Not abgeschaltet.
 */
const KENNUNG = "infosysbub-ega";

/*
 * `Accept: *​/*`, nicht `application/json`.
 *
 * Der DKZ-Dienst antwortet auf `application/json` mit 406 — er liefert
 * HAL und nennt es anders. Eine halbe Stunde Fehlersuche hing an
 * diesem einen Kopffeld.
 */
const KOEPFE = { "X-API-Key": KENNUNG, Accept: "*/*", "User-Agent": "Velvova/1.0" };

/**
 * Ob der Atlas benutzbar ist.
 *
 * Immer true: Die Kennung steht im Code, es gibt keine Zugangsdaten,
 * die fehlen könnten. Die Funktion bleibt, weil die Aufrufer sie
 * kennen — und weil eine abgeschaltete Quelle in Zukunft wieder hier
 * ihren Platz hätte.
 */
export function entgeltatlasVerfuegbar(): boolean {
  return true;
}

/**
 * Ein Zahlenfeld des Atlas, oder `null`.
 *
 * Negative Werte sind Kennzahlen für „nicht ausgewiesen", keine
 * Beträge. Siehe den Dateikopf: gemessen wurden -1, -2, -3, -42, -100.
 */
export function ausgewiesenerWert(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
}

/*
 * Das Stichjahr der Statistik, einmal je Prozess geholt.
 *
 * `stand` stand vorher als leere Zeichenkette in jedem Wert — ein Feld,
 * das nach Herkunftsangabe aussieht und keine ist. Der Dienst nennt das
 * Jahr unter `/pc/v1/dataset`: derzeit 2025, importiert am 1.9.2026.
 *
 * Eine amtliche Zahl ohne Stichjahr ist keine Auskunft: Ein Median von
 * 2019 sagt 2026 etwas anderes als einer von 2025.
 */
let stichjahr: { wert: string; bis: number } | null = null;

async function jahrDerStatistik(): Promise<string> {
  if (stichjahr && stichjahr.bis > Date.now()) return stichjahr.wert;
  try {
    const antwort = await fetch(`${BASIS}/pc/v1/dataset`, {
      headers: KOEPFE,
      signal: AbortSignal.timeout(8000),
    });
    if (!antwort.ok) return "";
    const daten = (await antwort.json()) as { year?: number };
    const wert = daten.year ? String(daten.year) : "";
    /* Einen Tag halten — das Jahr wechselt nicht im Stundenrhythmus. */
    stichjahr = { wert, bis: Date.now() + 86_400_000 };
    return wert;
  } catch {
    return "";
  }
}

interface Entgeltsatz {
  entgelt?: number;
  entgeltQ25?: number;
  entgeltQ75?: number;
  besetzung?: number;
  kldb?: string;
  region?: { schluessel?: string; beitragsBemessungsGrenze?: number };
  branche?: { id?: number };
  gender?: { id?: number };
  ageCategory?: { id?: number };
}

/**
 * Die Berufsgattung zu einer Berufsbezeichnung.
 *
 * ── Warum das ein eigener Schritt ist ─────────────────────────
 *
 * Der Atlas fragt nach einer Kennung wie „43414", nicht nach
 * „Softwareentwickler/in". Die Jobsuche liefert Namen.
 *
 * Übersetzen kann der DKZ-Dienst (Dokumentationskennziffer), der zu
 * jedem seiner 51.094 Berufe die KldB-2010-Kennung mitführt. Sein
 * Suchparameter ist allerdings **wirkungslos**: `?suchwort=`, `?was=`
 * und `?bezeichnung=` geben alle dieselbe erste Seite zurück — die
 * Suche nach „Softwareentwickler" liefert Landwirte. Gemessen, nicht
 * vermutet.
 *
 * Nachschlagen im laufenden Betrieb geht deshalb nicht. Statt dessen
 * holt `scripts/berufsschluessel-ernten.mjs` die Seiten einmal
 * vollständig in `beruf_schluessel`, und hier wird nur noch gelesen.
 * Das ist auch das schnellere Verfahren: eine Abfrage gegen die eigene
 * Tabelle statt einer Netzrunde je Stelle.
 */
export async function berufsschluesselFuer(beruf: string): Promise<string | null> {
  // Eine Kennung ist schon eine Kennung.
  if (/^\d{3,6}$/.test(beruf.trim())) return beruf.trim();

  const db = await getDb();
  const gespeichert = await withSystem(db, (tx) =>
    tx.execute(sql`select schluessel from beruf_schluessel where beruf = ${beruf}`),
  ).catch(() => ({ rows: [] }) as never);
  const zeilen = (gespeichert as unknown as { rows: { schluessel: string | null }[] }).rows ?? [];
  return zeilen.length > 0 ? zeilen[0]!.schluessel : null;
}

/**
 * Das Medianentgelt für eine Berufsbezeichnung oder Berufsgattung.
 *
 * `null`, wenn sich kein Schlüssel finden lässt, der Dienst nicht
 * antwortet oder die Statistik für diesen Beruf nichts ausweist. In
 * allen drei Fällen fällt der Aufrufer auf die eigene Statistik
 * zurück — und wenn auch die nichts hat, steht nichts da.
 */
export async function amtlicherWert(beruf: string): Promise<AmtlicherWert | null> {
  const schluessel = await berufsschluesselFuer(beruf);
  if (!schluessel) return null;

  /*
   * Die Anforderungsniveaus einzeln, vom spezialisierten zum
   * einfachen.
   *
   * Für viele Berufsgattungen ist nur eines besetzt — welches, ist von
   * aussen nicht zu wissen, also werden sie der Reihe nach versucht
   * und das erste mit echten Zahlen genommen.
   */
  for (const niveau of [3, 4, 2, 1]) {
    const satz = await hole(schluessel, niveau);
    if (satz) return satz;
  }
  return null;
}

async function hole(schluessel: string, niveau: number): Promise<AmtlicherWert | null> {
  try {
    const antwort = await fetch(
      `${BASIS}/pc/v1/entgelte/${encodeURIComponent(schluessel)}?l=${niveau}`,
      { headers: KOEPFE, signal: AbortSignal.timeout(10000) },
    );
    if (!antwort.ok) return null;

    const saetze = (await antwort.json()) as Entgeltsatz[];
    if (!Array.isArray(saetze)) return null;

    /*
     * Der eine Satz, der uns interessiert: Deutschland gesamt, alle
     * Branchen, beide Geschlechter, alle Altersgruppen.
     *
     * Ohne diese Auswahl griffe man den ersten Satz der Liste — und
     * der ist irgendeine Kombination, etwa „Frauen unter 25 in
     * Mecklenburg-Vorpommern". Als Vergleichswert für eine
     * Stellenanzeige wäre das schlicht der falsche Wert.
     */
    const gesamt = saetze.find(
      (s) =>
        s.region?.schluessel === "D" &&
        s.branche?.id === 1 &&
        s.gender?.id === 1 &&
        s.ageCategory?.id === 1,
    );
    const median = ausgewiesenerWert(gesamt?.entgelt);
    if (!gesamt || median === null) return null;

    /* Monatsentgelt × 12. Keine Schätzung — dieselbe Zahl, andere Einheit. */
    const jahr = (n: number | null) => (n === null ? null : Math.round(n * 12));
    const grenze = ausgewiesenerWert(gesamt.region?.beitragsBemessungsGrenze);

    return {
      median: jahr(median)!,
      q1: jahr(ausgewiesenerWert(gesamt.entgeltQ25)),
      q3: jahr(ausgewiesenerWert(gesamt.entgeltQ75)),
      quelle: "Entgeltatlas der Bundesagentur für Arbeit",
      stand: await jahrDerStatistik(),
      besetzung: ausgewiesenerWert(gesamt.besetzung),
      abgeschnitten: grenze !== null && median >= grenze,
    };
  } catch (e) {
    console.error("[entgeltatlas] Abfrage fehlgeschlagen:", e);
    return null;
  }
}

/**
 * Eine Seite des DKZ-Berufsverzeichnisses.
 *
 * Nur für das Ernteskript — im Anfragepfad wird nie gesucht, sondern
 * ausschliesslich in `beruf_schluessel` gelesen.
 */
export async function dkzSeite(
  seite: number,
  groesse = 100,
): Promise<{ berufe: { name: string; kldb: string | null }[]; seiten: number }> {
  const antwort = await fetch(`${DKZ}/pc/v1/berufe?page=${seite}&size=${groesse}`, {
    headers: KOEPFE,
    signal: AbortSignal.timeout(30000),
  });
  if (!antwort.ok) throw new Error(`DKZ antwortet mit HTTP ${antwort.status}`);
  const daten = (await antwort.json()) as {
    _embedded?: {
      berufe?: { kurzBezeichnungNeutral?: string; bezeichnungNeutral?: string; kldb2010?: string }[];
    };
    page?: { totalPages?: number };
  };
  const berufe = (daten._embedded?.berufe ?? []).flatMap((b) => {
    const name = (b.kurzBezeichnungNeutral ?? b.bezeichnungNeutral ?? "").trim();
    if (!name) return [];
    /* „B 11193" → „11193". Der Buchstabe ist der Katalog, nicht Teil der Kennung. */
    const kldb = String(b.kldb2010 ?? "").replace(/\D/g, "");
    return [{ name, kldb: kldb.length >= 3 ? kldb : null }];
  });
  return { berufe, seiten: daten.page?.totalPages ?? 0 };
}
