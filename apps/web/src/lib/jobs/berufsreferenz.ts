import { inArray, sql } from "drizzle-orm";
import { getDb, schema, withSystem } from "@paycheck/db";
import { KEIN_VOLLZEITVERGLEICH } from "./beschaeftigungsform.ts";
import {
  abfragestufen,
  haeufigsterBeruf,
  titelNormalisieren,
  MIN_ANGABEN,
  type BerufsStelle,
  type Entgeltreferenz,
} from "@paycheck/jobs/berufsregeln";

/**
 * Die amtliche Berufsbezeichnung — und was in diesem Beruf gezahlt wird.
 *
 * ── Das Problem, das hier gelöst wird ─────────────────────────
 *
 * Für rund ein Drittel der Stellen konnte das Produkt keine
 * Gehaltsgrössenordnung nennen. Die eigene Datenbasis trug in diesen
 * Berufsgruppen zu wenige Angaben, und die amtliche Statistik — der
 * Entgeltatlas der Bundesagentur — verlangt eine Registrierung, die
 * nur der Betreiber vornehmen kann.
 *
 * Die offene Jobsuche-Schnittstelle derselben Behörde beantwortet
 * beides ohne Zugangsdaten. Gemessen, nicht vermutet:
 *
 *   • Jede Anzeige trägt `hauptberuf` — die amtliche Bezeichnung aus
 *     der Klassifikation der Berufe. Unter 250 Treffern zu fünf
 *     Suchwörtern lagen 14 verschiedene Bezeichnungen. Das ist ein
 *     brauchbarer Vergleichsschlüssel; ein freier Anzeigentitel ist es
 *     nicht — bei 2.506 Stellen gibt es 2.092 verschiedene.
 *
 *   • 233 von 800 Anzeigen (29 %) tragen ein echtes, vom Arbeitgeber
 *     angegebenes Gehalt.
 *
 * ── Warum die Auflösung über die Schnittstelle läuft ──────────
 *
 * „Vertriebsinnendienst (m/w/d)" nach „Kaufmann/-frau -
 * Büromanagement" zu übersetzen ist genau die Aufgabe, die die
 * Suchmaschine der Jobbörse gut löst und eine Wortliste schlecht. Also
 * fragen wir sie — einmal je Titel, danach steht die Antwort in
 * `beruf_zuordnung`.
 *
 * ── Was hier NICHT passiert ───────────────────────────────────
 *
 * Kein Auslesen von Webseiten, kein Umgehen von Grenzen: die
 * dokumentierte Schnittstelle mit ihrer öffentlichen Kennung, dieselbe,
 * über die dieses Produkt ohnehin Stellen bezieht, mit Pause zwischen
 * den Aufrufen. Gespeichert wird keine fremde Anzeige, sondern deren
 * Auswertung.
 */

// Weitergereicht, damit Aufrufer und Tests nur ein Modul kennen müssen.
export { abfragestufen, haeufigsterBeruf, titelNormalisieren, MIN_ANGABEN };
export type { Entgeltreferenz };

const BASIS = "https://rest.arbeitsagentur.de/jobboerse/jobsuche-service";
const KENNUNG = "jobboerse-jobsuche";


async function suche(was: string, signal?: AbortSignal): Promise<BerufsStelle[]> {
  const url = new URL(`${BASIS}/pc/v6/jobs`);
  url.searchParams.set("was", was);
  url.searchParams.set("size", "100");
  url.searchParams.set("page", "1");
  const antwort = await fetch(url, {
    headers: { "X-API-Key": KENNUNG, "User-Agent": "Velvova/1.0" },
    signal: signal ?? AbortSignal.timeout(20_000),
  });
  if (!antwort.ok) {
    // Nur der Statuscode. Eine fremde Fehlerseite gehört nicht ins Protokoll.
    console.warn(`[berufsreferenz] Jobsuche antwortete ${antwort.status}`);
    return [];
  }
  const daten = (await antwort.json()) as { ergebnisliste?: BerufsStelle[] };
  return daten.ergebnisliste ?? [];
}

/**
 * Die amtliche Bezeichnung zu einem Titel. `null`, wenn unklar.
 *
 * Fragt zuerst den Zwischenspeicher. Ein Misserfolg wird dort ebenso
 * vermerkt wie ein Treffer — sonst würde derselbe unauflösbare Titel
 * bei jedem Aufruf erneut eine fremde Anfrage auslösen.
 */
export async function berufAufloesen(
  titel: string,
  optionen: { frisch?: boolean; signal?: AbortSignal } = {},
): Promise<string | null> {
  /*
   * Werkstudium, Praktikum, Ausbildung: gar nicht erst auflösen.
   *
   * Die Auflösung selbst gelingt — gemessen wurde „werkstudent im
   * verkauf mode und bekleidung" → „Fachverkäufer/in - Textilien" und
   * „werkstudent sales operations" → „Sales-Manager/in". Genau das ist
   * das Problem: die Stelle bekäme die Vollzeitspanne des Berufs, und
   * die läge um ein Vielfaches daneben.
   *
   * Hier zu prüfen spart nebenbei rund jede zehnte fremde Anfrage.
   */
  if (KEIN_VOLLZEITVERGLEICH.test(titel)) return null;
  const schluessel = titelNormalisieren(titel);
  if (schluessel.length < 3) return null;

  const db = await getDb();
  if (!optionen.frisch) {
    const treffer = await withSystem(db, (tx) =>
      tx.execute(sql`select beruf from beruf_zuordnung where titel = ${schluessel}`),
    ).catch(() => ({ rows: [] }) as never);
    const zeilen = (treffer as unknown as { rows: { beruf: string | null }[] }).rows ?? [];
    if (zeilen.length > 0) return zeilen[0]!.beruf;
  }

  /*
   * Von genau nach allgemein, bis eine Stufe genug hergibt.
   *
   * Abgebrochen wird beim ersten Treffer — nicht beim ersten
   * Ergebnis. Eine Stufe, die zwei Anzeigen findet, hat nichts
   * beantwortet, und die nächste Stufe darf es versuchen.
   */
  let beruf: string | null = null;
  let treffer = 0;
  let gesamt = 0;
  for (const stufe of abfragestufen(titel)) {
    const stellen = await suche(stufe, optionen.signal).catch(() => []);
    const r = haeufigsterBeruf(stellen);
    gesamt = Math.max(gesamt, r.gesamt);
    if (r.beruf) {
      beruf = r.beruf;
      treffer = r.treffer;
      gesamt = r.gesamt;
      break;
    }
  }

  await withSystem(db, (tx) =>
    tx.execute(sql`
      insert into beruf_zuordnung (titel, beruf, treffer, gesamt, gefragt_am)
      values (${schluessel}, ${beruf}, ${treffer}, ${gesamt}, now())
      on conflict (titel) do update
        set beruf = excluded.beruf, treffer = excluded.treffer,
            gesamt = excluded.gesamt, gefragt_am = now()
    `),
  ).catch((e) => {
    console.error("[berufsreferenz] Zuordnung nicht speicherbar:", e);
  });

  return beruf;
}

/**
 * Die amtliche Bezeichnung zu einem Titel — nur aus dem Speicher.
 *
 * Der Unterschied zu `berufAufloesen`: hier wird nichts nachgefragt.
 * Ein Seitenaufruf, der auf einen fremden Dienst wartet, ist ein
 * Seitenaufruf, der irgendwann hängt. Was nicht dasteht, ist für die
 * Anzeige unbekannt — und der Sammellauf trägt es beim nächsten Mal
 * nach.
 */
export async function berufFuerTitel(titel: string): Promise<string | null> {
  if (KEIN_VOLLZEITVERGLEICH.test(titel)) return null;
  const schluessel = titelNormalisieren(titel);
  if (schluessel.length < 3) return null;
  const db = await getDb();
  const treffer = await withSystem(db, (tx) =>
    tx.execute(sql`select beruf from beruf_zuordnung where titel = ${schluessel}`),
  ).catch(() => ({ rows: [] }) as never);
  const zeilen = (treffer as unknown as { rows: { beruf: string | null }[] }).rows ?? [];
  return zeilen[0]?.beruf ?? null;
}

/**
 * Die Entgelt-Referenz zu einer amtlichen Bezeichnung.
 *
 * Nur lesend — geschrieben wird von `scripts/entgelt-sammeln.mjs`. Der
 * Abruf einer Jobseite soll keine Statistik neu berechnen.
 */
export async function entgeltFuerBeruf(beruf: string): Promise<Entgeltreferenz | null> {
  const db = await getDb();
  const treffer = await withSystem(db, (tx) =>
    tx.execute(sql`
      select beruf, q1, median, q3, anzahl, quelle, stand
      from beruf_entgelt where beruf = ${beruf}
    `),
  ).catch(() => ({ rows: [] }) as never);
  const zeilen = (treffer as unknown as { rows: Record<string, unknown>[] }).rows ?? [];
  const z = zeilen[0];
  if (!z) return null;
  const anzahl = Number(z.anzahl);
  if (anzahl < MIN_ANGABEN) return null;
  return {
    beruf: String(z.beruf),
    q1: Number(z.q1),
    median: Number(z.median),
    q3: Number(z.q3),
    anzahl,
    quelle: String(z.quelle) === "entgeltatlas" ? "entgeltatlas" : "bundesagentur",
    stand: new Date(String(z.stand)),
  };
}

/**
 * Der ganze Weg: Titel → Beruf → Referenz.
 *
 * Löst NICHT von sich aus über die Schnittstelle auf. Beim Abruf einer
 * Jobseite wird nur gelesen, was schon dasteht; das Auflösen ist Sache
 * des Sammellaufs. Ein Seitenaufruf, der auf einen fremden Dienst
 * wartet, ist ein Seitenaufruf, der irgendwann hängt.
 */
export async function referenzFuerTitel(titel: string): Promise<Entgeltreferenz | null> {
  // Dieselbe Sperre wie beim Auflösen — doppelt, weil eine Zuordnung
  // auch aus einem früheren Lauf stammen kann.
  if (KEIN_VOLLZEITVERGLEICH.test(titel)) return null;
  const schluessel = titelNormalisieren(titel);
  if (schluessel.length < 3) return null;
  const db = await getDb();
  const treffer = await withSystem(db, (tx) =>
    tx.execute(sql`
      select e.beruf, e.q1, e.median, e.q3, e.anzahl, e.quelle, e.stand
      from beruf_zuordnung z
      join beruf_entgelt e on e.beruf = z.beruf
      where z.titel = ${schluessel}
    `),
  ).catch(() => ({ rows: [] }) as never);
  const zeilen = (treffer as unknown as { rows: Record<string, unknown>[] }).rows ?? [];
  const z = zeilen[0];
  if (!z) return null;
  const anzahl = Number(z.anzahl);
  if (anzahl < MIN_ANGABEN) return null;
  return {
    beruf: String(z.beruf),
    q1: Number(z.q1),
    median: Number(z.median),
    q3: Number(z.q3),
    anzahl,
    quelle: String(z.quelle) === "entgeltatlas" ? "entgeltatlas" : "bundesagentur",
    stand: new Date(String(z.stand)),
  };
}

/**
 * Referenzen für viele Titel auf einmal.
 *
 * ── Warum es diese Sammelabfrage gibt ─────────────────────────
 *
 * Die Stellenliste zeigt bis zu fünfzig Zeilen. Für jede einzeln zu
 * fragen wären fünfzig Abfragen je Seitenaufruf — die klassische
 * N+1-Falle, und sie fällt erst unter Last auf, wenn niemand mehr
 * weiss, woher die Sekunden kommen.
 *
 * Eine Abfrage, ein Join, eine Map. Titel, die keine Zuordnung oder
 * keine tragfähige Referenz haben, fehlen im Ergebnis — das ist der
 * ehrliche Normalfall und kein Fehler.
 */
export async function referenzenFuerTitel(
  titel: string[],
): Promise<Map<string, Entgeltreferenz>> {
  const raus = new Map<string, Entgeltreferenz>();

  // Normalisierter Schlüssel → alle Originaltitel, die darauf zeigen.
  const nachSchluessel = new Map<string, string[]>();
  for (const t of titel) {
    if (KEIN_VOLLZEITVERGLEICH.test(t)) continue;
    const k = titelNormalisieren(t);
    if (k.length < 3) continue;
    const liste = nachSchluessel.get(k) ?? [];
    liste.push(t);
    nachSchluessel.set(k, liste);
  }
  if (nachSchluessel.size === 0) return raus;

  const schluessel = [...nachSchluessel.keys()];
  const db = await getDb();
  const treffer = await withSystem(db, (tx) =>
    tx.execute(sql`
      select z.titel, e.beruf, e.q1, e.median, e.q3, e.anzahl, e.quelle, e.stand
      from beruf_zuordnung z
      join beruf_entgelt e on e.beruf = z.beruf
      where z.titel in (${sql.join(
        schluessel.map((k) => sql`${k}`),
        sql`, `,
      )}) and e.anzahl >= ${MIN_ANGABEN}
    `),
  ).catch((e) => {
    console.error("[berufsreferenz] Sammelabfrage fehlgeschlagen:", e);
    return { rows: [] } as never;
  });

  for (const z of (treffer as unknown as { rows: Record<string, unknown>[] }).rows ?? []) {
    const referenz: Entgeltreferenz = {
      beruf: String(z.beruf),
      q1: Number(z.q1),
      median: Number(z.median),
      q3: Number(z.q3),
      anzahl: Number(z.anzahl),
      quelle: String(z.quelle) === "entgeltatlas" ? "entgeltatlas" : "bundesagentur",
      stand: new Date(String(z.stand)),
    };
    for (const original of nachSchluessel.get(String(z.titel)) ?? []) {
      raus.set(original, referenz);
    }
  }
  return raus;
}

/**
 * Entgeltreferenzen zu Berufskennungen — eine Sammelabfrage.
 *
 * ── Warum neben der Titelsuche ────────────────────────────────
 *
 * `referenzenFuerTitel` normalisiert Stellentitel und sucht damit.
 * Das trägt für Stellen ohne amtliche Kennung, ist aber bei deutschen
 * Berufsnamen unzuverlässig — Komposita gehen verloren, und zufällige
 * Wortgleichheit erzeugt falsche Treffer.
 *
 * Wo eine Kennung an der Stelle steht, ist es ein Nachschlag in einer
 * Tabelle mit 752 Zeilen: kein Schwellenwert, keine Ähnlichkeit.
 * Gemessen decken diese 752 Codes 99,1 Prozent aller Stellen mit
 * Kennung ab.
 *
 * `q1` und `q3` dürfen in `entgelt_kldb` fehlen, hier aber nicht —
 * die Zeile zeigt eine Spanne. Wo ein Quartil fehlt, tritt der Median
 * an seine Stelle; die Spanne wird dadurch enger und nicht falsch.
 */
export async function referenzenFuerKldb(
  codes: readonly (string | null | undefined)[],
): Promise<Map<string, Entgeltreferenz>> {
  const raus = new Map<string, Entgeltreferenz>();
  const sauber = [
    ...new Set(
      codes
        .map((c) => (c ?? "").replace(/\D/g, "").slice(0, 5))
        .filter((c) => c.length === 5),
    ),
  ];
  if (sauber.length === 0) return raus;

  const db = await getDb();
  const zeilen = await withSystem(db, (tx) =>
    tx.select().from(schema.entgeltKldb).where(inArray(schema.entgeltKldb.kldb, sauber)),
  ).catch(() => []);

  for (const z of zeilen) {
    raus.set(z.kldb, {
      beruf: z.beruf,
      q1: z.q1 ?? z.median,
      median: z.median,
      q3: z.q3 ?? z.median,
      anzahl: z.besetzung ?? 0,
      quelle: "entgeltatlas",
      stand: z.stand,
    });
  }
  return raus;
}
