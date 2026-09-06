import { herkunftAusArt, type Herkunft } from "@paycheck/domain";
import type { FetchOptions, JobSourceAdapter, RawListing } from "./adapter.ts";
import { activeAdapters } from "./registry.ts";
import { fuehreZusammen, type QuellListing, type ZusammengefuehrteStelle } from "./zusammenfuehren.ts";

/**
 * Alle Anbieter auf einmal fragen — und den Ausfall eines einzelnen aushalten.
 *
 * ── Die eine Regel ────────────────────────────────────────────
 *
 * Kein Anbieter darf die Suche zum Stehen bringen. Nicht durch einen
 * Fehler, nicht durch Langsamkeit, nicht durch ein erschöpftes
 * Kontingent. Wenn vier von fünf antworten, sieht die Person die
 * Stellen der vier — und erfährt, dass einer fehlte.
 *
 * Das ist der Grund für `Promise.allSettled` statt `Promise.all`: bei
 * `all` reisst der erste Fehlschlag alles mit, auch die Ergebnisse, die
 * schon da sind.
 *
 * ── Reihen statt Rangfolge ────────────────────────────────────
 *
 * Reihe 1 läuft immer: TheirStack und JSearch antworten in ein bis drei
 * Sekunden und liefern strukturierte Felder.
 *
 * Reihe 2 läuft nur, wenn Reihe 1 zu wenig gebracht hat. Bright Data
 * und Apify sind langsamer und teurer — ein Apify-Actor läuft
 * Sekunden bis Minuten. Sie bei jeder Suche mitlaufen zu lassen, wäre
 * eine Rechnung pro Seitenaufruf für Ergebnisse, die meistens niemand
 * braucht.
 *
 * ── Die Zeitgrenze gilt für den Durchlauf ─────────────────────
 *
 * Nicht je Anbieter. Sonst summierten sich fünf Zeitgrenzen zu einer
 * Wartezeit, die niemand aushält. Wer nach der Frist nicht geantwortet
 * hat, ist für diese Suche nicht dabei.
 */

export interface Abrufbericht {
  provider: string;
  ok: boolean;
  stellen: number;
  dauerMs: number;
  fehler: string | null;
}

export interface AbrufErgebnis {
  stellen: ZusammengefuehrteStelle[];
  berichte: Abrufbericht[];
  /** Sätze vor der Zusammenführung — der Unterschied ist die Dublettenzahl. */
  roh: number;
}

export interface AbrufOptionen extends FetchOptions {
  /** Ab wie vielen Treffern Reihe 2 nicht mehr nötig ist. */
  genugAb?: number;
  /** Frist für den gesamten Durchlauf. */
  fristMs?: number;
  /** Für Tests: statt der eingerichteten Anbieter diese nehmen. */
  adapter?: JobSourceAdapter[];
}

/** Anbieter, die schnell und strukturiert liefern. */
const REIHE_1 = new Set(["theirstack", "jsearch", "adzuna", "arbeitnow"]);

export async function rufeAlleAb(o: AbrufOptionen = {}): Promise<AbrufErgebnis> {
  const alle = o.adapter ?? activeAdapters();
  const reihe1 = alle.filter((a) => REIHE_1.has(a.key) || a.key.startsWith("jooble"));
  const reihe2 = alle.filter((a) => !reihe1.includes(a));

  const frist = o.fristMs ?? 25_000;
  const abbruch = new AbortController();
  const uhr = setTimeout(() => abbruch.abort(), frist);
  o.signal?.addEventListener("abort", () => abbruch.abort(), { once: true });

  const berichte: Abrufbericht[] = [];
  const eingang: QuellListing[] = [];

  try {
    await sammle(reihe1, { ...o, signal: abbruch.signal }, berichte, eingang);

    const genug = o.genugAb ?? 40;
    if (eingang.length < genug && reihe2.length > 0 && !abbruch.signal.aborted) {
      await sammle(reihe2, { ...o, signal: abbruch.signal }, berichte, eingang);
    }
  } finally {
    clearTimeout(uhr);
  }

  return { stellen: fuehreZusammen(eingang), berichte, roh: eingang.length };
}

async function sammle(
  adapter: JobSourceAdapter[],
  o: AbrufOptionen,
  berichte: Abrufbericht[],
  eingang: QuellListing[],
): Promise<void> {
  const ergebnisse = await Promise.allSettled(
    adapter.map(async (a) => {
      const start = Date.now();
      try {
        const listings = await a.fetchListings({
          since: o.since,
          limit: o.limit,
          signal: o.signal,
        });
        return { adapter: a, listings, dauer: Date.now() - start, fehler: null as string | null };
      } catch (e) {
        /*
         * Der Fehler wird hier gefangen und NICHT weitergeworfen.
         *
         * `allSettled` fängt ihn ohnehin; ihn schon hier zu einem
         * Bericht zu machen, hält die Dauer und den Anbieternamen
         * beisammen. Aus einem `rejected` allein liesse sich nicht
         * mehr sagen, wer gescheitert ist.
         */
        return {
          adapter: a,
          listings: [] as RawListing[],
          dauer: Date.now() - start,
          fehler: e instanceof Error ? e.message.slice(0, 300) : String(e),
        };
      }
    }),
  );

  for (const r of ergebnisse) {
    if (r.status === "rejected") continue;
    const { adapter: a, listings, dauer, fehler } = r.value;
    berichte.push({
      provider: a.displayName,
      ok: fehler === null,
      stellen: listings.length,
      dauerMs: dauer,
      fehler,
    });
    const h: Herkunft = a.herkunft ?? herkunftAusArt(a.kind);
    for (const l of listings) {
      eingang.push({
        provider: a.key,
        herkunft: h,
        listing: l,
        domain: typeof l.raw?.companyDomain === "string" ? l.raw.companyDomain : null,
      });
    }
  }
}

/**
 * Ein Satz über den Durchlauf, für die Oberfläche.
 *
 * Ausdrücklich mit den Ausfällen: „127 Stellen" allein verschweigt,
 * dass zwei Anbieter nicht geantwortet haben — und die Person hält die
 * Liste für vollständig.
 */
export function abrufSatz(e: AbrufErgebnis): string {
  const ok = e.berichte.filter((b) => b.ok);
  const aus = e.berichte.filter((b) => !b.ok);
  const dubletten = e.roh - e.stellen.length;

  const teile = [
    `${e.stellen.length} Stellen aus ${ok.length} ${ok.length === 1 ? "Quelle" : "Quellen"}`,
  ];
  if (dubletten > 0) {
    teile.push(`${dubletten} ${dubletten === 1 ? "Dublette" : "Dubletten"} zusammengeführt`);
  }
  if (aus.length > 0) {
    teile.push(
      `${aus.map((b) => b.provider).join(", ")} ${aus.length === 1 ? "hat" : "haben"} nicht geantwortet`,
    );
  }
  return `${teile.join(" · ")}.`;
}
