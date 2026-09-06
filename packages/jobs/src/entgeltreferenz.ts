import { sql } from "drizzle-orm";
import { getDb, withSystem } from "@paycheck/db";
import {
  abfragestufen,
  haeufigsterBeruf,
  titelNormalisieren,
  MIN_ANGABEN,
  type BerufsStelle,
} from "./berufsregeln.ts";

/**
 * Die Entgelt-Referenz sammeln und frisch halten.
 *
 * ── Warum das laufen muss und nicht einmal reicht ─────────────
 *
 * Der erste Sammellauf ordnet die vorhandenen Stellentitel zu und
 * bildet Quartile. Danach kommen jeden Tag neue Anzeigen mit neuen
 * Titeln — und für die stünde wieder „zu wenige Gehaltsangaben", weil
 * niemand sie je nachgeschlagen hat.
 *
 * Deshalb ein kleines Budget je Durchlauf statt eines grossen Laufs:
 * Der Worker arbeitet alle fünfzehn Minuten ein paar offene Titel ab
 * und frischt die ältesten Referenzen auf. Neue Stellen sind innerhalb
 * weniger Stunden abgedeckt, ohne dass jemand etwas anstösst.
 *
 * ── Wie mit dem fremden Dienst umgegangen wird ────────────────
 *
 * Die dokumentierte, offene Schnittstelle der Bundesagentur mit ihrer
 * öffentlichen Kennung — dieselbe, über die dieses Produkt ohnehin
 * Stellen bezieht. Pause zwischen den Aufrufen, kein Nachfassen,
 * sofortiger Abbruch bei 429 oder 5xx. Ein abgebrochener Durchlauf
 * kostet nichts: was schon dasteht, wird beim nächsten Mal
 * übersprungen.
 *
 * Gespeichert wird keine fremde Anzeige, sondern deren Auswertung.
 */

const BASIS = "https://rest.arbeitsagentur.de/jobboerse/jobsuche-service";
const KOPF = { "X-API-Key": "jobboerse-jobsuche", "User-Agent": "Velvova/1.0" };
const PAUSE_MS = 320;
/** Höchstens so viele Detailabrufe je Beruf. Für Quartile reicht das weit. */
const PROBEN_JE_BERUF = 28;
/** Höchstens so viele Werte je Arbeitgeber — sonst prägt ein Grossversender den Median. */
const JE_ARBEITGEBER = 2;
/**
 * Plausibilitätsgrenzen je Zeitraum.
 *
 * Echt vorgefunden: eine Anzeige mit „Jahresgehalt, Festbetrag 15".
 * Fünfzehn Euro im Jahr ist ein Tippfehler in der Anzeige, und ohne
 * diese Grenzen zöge er den Median einer ganzen Berufsgruppe nach unten.
 */
const GRENZEN: Record<string, [number, number]> = {
  year: [12_000, 400_000],
  month: [800, 40_000],
  hour: [10, 200],
};

const warte = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface SammelErgebnis {
  zugeordnet: number;
  titelGefragt: number;
  referenzen: number;
  berufeGefragt: number;
  abgebrochen: boolean;
}

interface Detail {
  verguetungsangabe?: string;
  gehaltsspanneVon?: number;
  gehaltsspanneBis?: number;
  festgehalt?: number;
}

class Abbruch extends Error {}

async function hol<T>(url: string): Promise<T | null> {
  const a = await fetch(url, { headers: KOPF, signal: AbortSignal.timeout(25_000) }).catch(
    () => null,
  );
  await warte(PAUSE_MS);
  if (!a) return null;
  if (a.status === 429 || a.status >= 500) {
    // Kein Nachfassen. Wer bei Überlastung schneller fragt, ist das Problem.
    throw new Abbruch(String(a.status));
  }
  if (!a.ok) return null;
  return (await a.json().catch(() => null)) as T | null;
}

/** Monats- und Stundenangaben aufs Jahr. 47 Arbeitswochen, kein Urlaub. */
function aufsJahr(betrag: number, art: string): number | null {
  if (art === "JAHRESGEHALT") return betrag;
  if (art === "MONATSGEHALT") return betrag * 12;
  if (art === "STUNDENLOHN") return betrag * 40 * 47;
  return null;
}

function zeitraum(art: string | undefined): keyof typeof GRENZEN | null {
  return art === "JAHRESGEHALT"
    ? "year"
    : art === "MONATSGEHALT"
      ? "month"
      : art === "STUNDENLOHN"
        ? "hour"
        : null;
}

/**
 * Aus einem Detail den Jahresbetrag — oder `null`.
 *
 * Exportiert, weil hier drei Fehler möglich sind, die man einer Zahl
 * später nicht mehr ansieht: der Festbetrag wird übersehen, der
 * Zeitraum wird verwechselt, oder ein Tippfehler in der Anzeige wird
 * übernommen.
 */
export function jahresbetrag(det: Detail): number | null {
  const z = zeitraum(det.verguetungsangabe);
  if (!z) return null;
  const hatSpanne = det.gehaltsspanneVon != null || det.gehaltsspanneBis != null;
  const von = hatSpanne ? (det.gehaltsspanneVon ?? null) : (det.festgehalt ?? null);
  const bis = hatSpanne ? (det.gehaltsspanneBis ?? null) : (det.festgehalt ?? null);
  const mitte = von != null && bis != null ? (von + bis) / 2 : (bis ?? von);
  if (mitte == null || !Number.isFinite(mitte)) return null;
  const [u, o] = GRENZEN[z]!;
  if (mitte < u || mitte > o) return null;
  const jahr = aufsJahr(mitte, det.verguetungsangabe!);
  if (jahr === null || jahr < 15_000 || jahr > 250_000) return null;
  return Math.round(jahr);
}

/** Quartile aus einer Liste von Jahresbeträgen. */
export function quartile(werte: number[]): { q1: number; median: number; q3: number } | null {
  if (werte.length < MIN_ANGABEN) return null;
  const s = [...werte].sort((a, b) => a - b);
  const bei = (q: number) => s[Math.min(s.length - 1, Math.floor(s.length * q))]!;
  return { q1: bei(0.25), median: bei(0.5), q3: bei(0.75) };
}

/**
 * Offene Stellentitel einer amtlichen Bezeichnung zuordnen.
 *
 * `keinVollzeitvergleich` wird hereingereicht statt importiert: die
 * Sperre gehört zur Anzeigelogik der Weboberfläche, und dieses Paket
 * soll nicht in die andere Richtung greifen müssen.
 */
export async function zuordnungNachtragen(
  budget: number,
  keinVollzeitvergleich: RegExp,
): Promise<{ zugeordnet: number; gefragt: number; abgebrochen: boolean }> {
  /*
   * Feste Reihenfolge, sonst ist der Fortschritt Zufall.
   *
   * Ohne `order by` bestimmt der Ausführungsplan, welche Titel ein
   * Durchlauf sieht — und zwei Durchläufe können dieselben nehmen,
   * während andere nie an die Reihe kommen. Der Vorfilter auf den
   * rohen Titel ist entfallen: gespeichert wird der normalisierte, und
   * ein Vergleich auf `lower(btrim(...))` traf deshalb fast nie.
   */
  const db = await getDb();
  const zeilen = await withSystem(db, (tx) =>
    tx.execute(sql`
      select distinct j.title from jobs j order by j.title
    `),
  ).catch(() => ({ rows: [] }) as never);

  /*
   * Erst wissen, was schon dasteht — dann kürzen.
   *
   * Die erste Fassung kürzte die Liste auf ein Vielfaches des Budgets
   * und verglich erst danach mit dem Bestand. Sind die ersten Titel
   * alle schon zugeordnet — und das sind sie ab dem zweiten Durchlauf
   * —, bleibt nichts übrig, und der Worker steht still, ohne dass
   * etwas fehlschlägt. Die unangenehmste Sorte: alles grün, nichts
   * passiert.
   */
  const bekannt = new Set(
    (
      (await withSystem(db, (tx) =>
        tx.execute(sql`select titel from beruf_zuordnung`),
      ).catch(() => ({ rows: [] }) as never)) as unknown as { rows: { titel: string }[] }
    ).rows?.map((r) => r.titel) ?? [],
  );

  const offen: string[] = [];
  const gesehen = new Set<string>();
  for (const r of (zeilen as unknown as { rows: { title: string }[] }).rows ?? []) {
    const roh = String(r.title ?? "");
    if (keinVollzeitvergleich.test(roh)) continue;
    const n = titelNormalisieren(roh);
    if (n.length < 3 || gesehen.has(n) || bekannt.has(n)) continue;
    gesehen.add(n);
    offen.push(n);
    if (offen.length >= budget) break;
  }

  let zugeordnet = 0;
  let gefragt = 0;
  let abgebrochen = false;

  try {
    for (const titel of offen) {
      gefragt++;
      let beruf: string | null = null;
      let treffer = 0;
      let gesamt = 0;
      for (const stufe of abfragestufen(titel)) {
        const d = await hol<{ ergebnisliste?: BerufsStelle[] }>(
          `${BASIS}/pc/v6/jobs?was=${encodeURIComponent(stufe)}&size=100&page=1`,
        );
        const r = haeufigsterBeruf(d?.ergebnisliste ?? []);
        gesamt = Math.max(gesamt, r.gesamt);
        if (r.beruf) {
          beruf = r.beruf;
          treffer = r.treffer;
          gesamt = r.gesamt;
          break;
        }
      }
      if (beruf) zugeordnet++;
      await withSystem(db, (tx) =>
        tx.execute(sql`
          insert into beruf_zuordnung (titel, beruf, treffer, gesamt, gefragt_am)
          values (${titel}, ${beruf}, ${treffer}, ${gesamt}, now())
          on conflict (titel) do update set beruf = excluded.beruf,
            treffer = excluded.treffer, gesamt = excluded.gesamt, gefragt_am = now()
        `),
      );
    }
  } catch (e) {
    if (!(e instanceof Abbruch)) throw e;
    abgebrochen = true;
    console.warn(`[entgeltreferenz] Jobsuche antwortete ${e.message} — Durchlauf beendet.`);
  }

  return { zugeordnet, gefragt, abgebrochen };
}

/**
 * Für Berufe ohne Referenz eine Stichprobe sammeln.
 *
 * Zuerst die Berufe, auf die die meisten eigenen Stellen zeigen — dort
 * bringt jede Referenz am meisten Abdeckung je Aufruf.
 */
export async function referenzenNachtragen(
  budget: number,
): Promise<{ geschrieben: number; gefragt: number; abgebrochen: boolean }> {
  const db = await getDb();
  const berufe = (
    (await withSystem(db, (tx) =>
      tx.execute(sql`
        select z.beruf, count(*)::int n from beruf_zuordnung z
        where z.beruf is not null
          and not exists (select 1 from beruf_entgelt e where e.beruf = z.beruf)
        group by 1 order by 2 desc limit ${budget}
      `),
    ).catch(() => ({ rows: [] }) as never)) as unknown as { rows: { beruf: string }[] }
  ).rows ?? [];

  let geschrieben = 0;
  let gefragt = 0;
  let abgebrochen = false;

  try {
    for (const { beruf } of berufe) {
      gefragt++;
      const d = await hol<{ ergebnisliste?: (BerufsStelle & Record<string, unknown>)[] }>(
        `${BASIS}/pc/v6/jobs?was=${encodeURIComponent(beruf)}&size=100&page=1`,
      );
      const liste = (d?.ergebnisliste ?? []).filter(
        (s) =>
          s.hauptberuf === beruf &&
          typeof s.verguetungsangabe === "string" &&
          s.verguetungsangabe !== "KEINE_ANGABEN",
      );

      const werte: number[] = [];
      const firmen = new Map<string, number>();
      for (const s of liste.slice(0, PROBEN_JE_BERUF)) {
        const firma = String(s.firma ?? "?").toLowerCase().trim();
        if ((firmen.get(firma) ?? 0) >= JE_ARBEITGEBER) continue;
        const kodiert = Buffer.from(String(s.referenznummer), "utf8").toString("base64");
        const det = await hol<Detail>(`${BASIS}/pc/v4/jobdetails/${kodiert}`);
        if (!det) continue;
        const jahr = jahresbetrag(det);
        if (jahr === null) continue;
        werte.push(jahr);
        firmen.set(firma, (firmen.get(firma) ?? 0) + 1);
      }

      const q = quartile(werte);
      if (!q) continue;
      await withSystem(db, (tx) =>
        tx.execute(sql`
          insert into beruf_entgelt (beruf, q1, median, q3, anzahl, quelle, stand)
          values (${beruf}, ${q.q1}, ${q.median}, ${q.q3}, ${werte.length}, 'bundesagentur', now())
          on conflict (beruf) do update set q1 = excluded.q1, median = excluded.median,
            q3 = excluded.q3, anzahl = excluded.anzahl, quelle = excluded.quelle, stand = now()
        `),
      );
      geschrieben++;
    }
  } catch (e) {
    if (!(e instanceof Abbruch)) throw e;
    abgebrochen = true;
    console.warn(`[entgeltreferenz] Jobsuche antwortete ${e.message} — Durchlauf beendet.`);
  }

  return { geschrieben, gefragt, abgebrochen };
}
