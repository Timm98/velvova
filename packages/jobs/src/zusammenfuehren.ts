import type { Herkunft } from "@paycheck/domain";
import { besteHerkunft } from "@paycheck/domain";
import type { RawListing } from "./adapter.ts";

/**
 * Dieselbe Stelle, von mehreren Anbietern — einmal zeigen, alles behalten.
 *
 * ── Warum der Inhaltshash allein nicht reicht ──────────────────
 *
 * `deduplicate()` in `adapter.ts` vergleicht den Text. Das findet
 * Wiederveröffentlichungen derselben Anzeige. Über mehrere Anbieter
 * hinweg versagt es: TheirStack kürzt die Beschreibung anders als
 * JSearch, ein Portal hängt einen Werbesatz an, ein anderes entfernt
 * die Aufzählungszeichen. Ein Zeichen Unterschied, zwei Hashes, zwei
 * Zeilen in der Liste — und die Person hält zwei Anzeigen für zwei
 * Stellen.
 *
 * ── Woran eine Stelle wirklich erkennbar ist ───────────────────
 *
 * In dieser Reihenfolge, und die Reihenfolge ist die Verlässlichkeit:
 *
 *   1. **Bewerbungslink.** Zwei Anzeigen, die auf dieselbe Adresse
 *      führen, sind dieselbe Stelle. Härter geht es nicht.
 *   2. **Firmendomain + normalisierter Titel + Ort.** Die Domain ist
 *      eindeutiger als der Firmenname („Muster GmbH" / „Muster
 *      Deutschland GmbH" / „MUSTER").
 *   3. **Normalisierter Firmenname + Titel + Ort.** Wenn wir keine
 *      Domain haben.
 *
 * Ähnlichkeit von Fliesstext steht bewusst NICHT dabei. Zwei
 * Sachbearbeitungsstellen desselben Konzerns an zwei Standorten haben
 * beinahe denselben Text und sind zwei Stellen. Ein Schwellenwert, der
 * das trennt, existiert nicht — er verschmilzt entweder echte Stellen
 * oder er findet nichts.
 *
 * ── Alle Quellen bleiben erhalten ──────────────────────────────
 *
 * Zusammenführen heisst hier nicht wegwerfen. Jede zusammengeführte
 * Stelle trägt ihre Herkünfte mit, und die beste gewinnt: taucht
 * dieselbe Stelle bei einem Aggregator und auf der Karriereseite des
 * Arbeitgebers auf, verlinken wir den Arbeitgeber. Ausserdem lassen
 * sich die Angaben gegenseitig prüfen — nennt eine Quelle ein Gehalt
 * und die andere nicht, gilt die Angabe.
 */

export interface Quellenangabe {
  provider: string;
  externalId: string;
  herkunft: Herkunft;
  originalUrl: string | null;
}

export interface ZusammengefuehrteStelle {
  listing: RawListing;
  quellen: Quellenangabe[];
  /** Die beste bekannte Herkunft über alle Quellen. */
  herkunft: Herkunft;
  /** Woran die Zusammenführung hing. Ohne das ist sie nicht prüfbar. */
  erkanntUeber: "bewerbungslink" | "domain" | "name" | null;
}

export interface QuellListing {
  provider: string;
  herkunft: Herkunft;
  listing: RawListing;
  /** Firmendomain, wenn der Anbieter eine liefert. */
  domain?: string | null;
}

/** Schlüssel, unter denen eine Anzeige wiedererkannt wird — stärkster zuerst. */
function schluessel(q: QuellListing): { art: "bewerbungslink" | "domain" | "name"; wert: string }[] {
  const raus: { art: "bewerbungslink" | "domain" | "name"; wert: string }[] = [];
  const ziel = normUrl(q.listing.applyTarget ?? q.listing.originalUrl ?? null);
  if (ziel) raus.push({ art: "bewerbungslink", wert: ziel });

  const titel = normTitel(q.listing.title);
  const ort = normOrt(q.listing.location);
  const domain = (q.domain ?? domainAusUrl(q.listing.originalUrl))?.toLowerCase() ?? null;

  if (domain && titel) raus.push({ art: "domain", wert: `${domain}|${titel}|${ort}` });
  const firma = normFirma(q.listing.companyName);
  if (firma && titel) raus.push({ art: "name", wert: `${firma}|${titel}|${ort}` });
  return raus;
}

export function fuehreZusammen(eingang: QuellListing[]): ZusammengefuehrteStelle[] {
  const gruppen: ZusammengefuehrteStelle[] = [];
  const index = new Map<string, ZusammengefuehrteStelle>();

  for (const q of eingang) {
    const kandidaten = schluessel(q);
    let treffer: ZusammengefuehrteStelle | undefined;
    let ueber: "bewerbungslink" | "domain" | "name" | null = null;

    for (const k of kandidaten) {
      const g = index.get(`${k.art}:${k.wert}`);
      if (!g) continue;

      /*
       * Innerhalb eines Anbieters entscheidet der Text.
       *
       * ── Zwei echte Fälle, die gleich aussehen ──────────────
       *
       * Ein Callcenter mit fünf offenen Stellen „Kundenberater (m/w/d)"
       * in Karlsruhe: fünf Ausschreibungen. Sie zusammenzuführen liesse
       * vier echte Stellen verschwinden.
       *
       * Speechify stellt dieselbe Stelle zweimal bei Arbeitnow ein —
       * einmal als „Munich", einmal als „Munich, Bavaria, Germany",
       * mit zwei Kennungen und fast gleichem Text. Sie NICHT
       * zusammenzuführen zeigt der Person dieselbe Stelle doppelt.
       *
       * Titel, Firma und Ort sind in beiden Fällen gleich. Der
       * Unterschied steht im Beschreibungstext: die Wiederholung ist
       * inhaltlich dieselbe Anzeige, die fünf Ausschreibungen sind es
       * nicht.
       *
       * Eine frühere Fassung sperrte pauschal jede Zusammenführung
       * innerhalb eines Anbieters. Das löste den ersten Fall und
       * erzeugte den zweiten — gemessen an echten Daten 40 Gruppen,
       * die alle Wiederholungen waren.
       *
       * Über Anbietergrenzen hinweg genügt der schwache Schlüssel
       * weiterhin: dass zwei Portale dieselbe Firma, denselben Titel
       * und denselben Ort führen, ist für sich aussagekräftig.
       *
       * Der Bewerbungslink bleibt unberührt: dieselbe Adresse ist
       * dieselbe Stelle, immer.
       */
      if (k.art !== "bewerbungslink" && g.quellen.some((x) => x.provider === q.provider)) {
        if (!aehnlicherText(g.listing.description, q.listing.description)) continue;
      }

      treffer = g;
      ueber = k.art;
      break;
    }

    const angabe: Quellenangabe = {
      provider: q.provider,
      externalId: q.listing.externalId,
      herkunft: q.herkunft,
      originalUrl: q.listing.originalUrl ?? null,
    };

    if (treffer) {
      treffer.quellen.push(angabe);
      treffer.herkunft = besteHerkunft(treffer.quellen.map((x) => x.herkunft)) ?? treffer.herkunft;
      treffer.erkanntUeber = treffer.erkanntUeber ?? ueber;
      treffer.listing = ergaenze(treffer.listing, q.listing);
    } else {
      treffer = { listing: q.listing, quellen: [angabe], herkunft: q.herkunft, erkanntUeber: null };
      gruppen.push(treffer);
    }

    // Auch die schwächeren Schlüssel eintragen, damit eine spätere
    // Anzeige ohne Bewerbungslink dieselbe Gruppe noch findet.
    for (const k of kandidaten) index.set(`${k.art}:${k.wert}`, treffer);
  }

  /*
   * Zum Schluss die beste Anzeige je Gruppe nach vorn.
   *
   * „Beste" heisst hier: die vom Arbeitgeber, sonst die mit der
   * längeren Beschreibung. Nicht die zuerst gesehene — welcher
   * Anbieter zuerst antwortet, ist eine Frage der Netzlaufzeit und
   * keine Aussage über die Anzeige.
   */
  return gruppen;
}

/**
 * Fehlende Angaben aus einer zweiten Quelle ergänzen.
 *
 * Nur ergänzen, nie überschreiben. Zwei Quellen mit verschiedenen
 * Gehaltsangaben sind ein Widerspruch, und ihn stillschweigend zugunsten
 * der zuletzt eingetroffenen aufzulösen hiesse: das Ergebnis hängt an
 * der Netzlaufzeit. Was wir haben, behalten wir; was fehlt, nehmen wir
 * dazu.
 */
function ergaenze(bisher: RawListing, neu: RawListing): RawListing {
  const raus: RawListing = { ...bisher };
  if (raus.salaryMin == null && neu.salaryMin != null) {
    raus.salaryMin = neu.salaryMin;
    raus.salaryMax = neu.salaryMax ?? raus.salaryMax;
    raus.salaryCurrency = neu.salaryCurrency ?? raus.salaryCurrency;
    raus.salaryPeriod = neu.salaryPeriod ?? raus.salaryPeriod;
  }
  if (raus.publishedAt == null && neu.publishedAt) raus.publishedAt = neu.publishedAt;
  if (raus.expiresAt == null && neu.expiresAt) raus.expiresAt = neu.expiresAt;
  if (raus.contractType == null && neu.contractType) raus.contractType = neu.contractType;
  if (raus.weeklyHours == null && neu.weeklyHours != null) raus.weeklyHours = neu.weeklyHours;
  if (raus.industry == null && neu.industry) raus.industry = neu.industry;
  if ((raus.benefits ?? []).length === 0 && (neu.benefits ?? []).length > 0) raus.benefits = neu.benefits;
  // Die längere Beschreibung gewinnt: sie enthält in aller Regel die
  // kürzere, und die Einschätzung hängt am Text.
  if ((neu.description?.length ?? 0) > (raus.description?.length ?? 0)) raus.description = neu.description;
  return raus;
}

// --- Normalisierung ------------------------------------------------------

export function normUrl(u: string | null): string | null {
  if (!u) return null;
  try {
    const url = new URL(u);
    /*
     * Kampagnenparameter weg.
     *
     * Dieselbe Anzeige kommt bei zwei Anbietern mit verschiedenem
     * `utm_source` — und wäre damit zweimal in der Liste. Der Pfad
     * bleibt unangetastet: dort steht die Kennung der Stelle.
     */
    for (const p of [...url.searchParams.keys()]) {
      if (/^utm_|^gh_src$|^ref$|^source$|^campaign/i.test(p)) url.searchParams.delete(p);
    }
    url.hash = "";
    return `${url.hostname.toLowerCase().replace(/^www\./, "")}${url.pathname.replace(/\/+$/, "")}${url.search}`;
  } catch {
    return null;
  }
}

export function domainAusUrl(u: string | null | undefined): string | null {
  if (!u) return null;
  try {
    return new URL(u).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function normTitel(t: string): string {
  return t
    .toLowerCase()
    /*
     * Geschlechtszusätze raus.
     *
     * „(m/w/d)", „(all genders)", „w/m/x" stehen mal dabei und mal
     * nicht — je nach Anbieter, bei derselben Stelle. Sie tragen nichts
     * zur Unterscheidung bei und verhindern sonst jede Zusammenführung.
     */
    .replace(/\((?:[mwdfxa]\s*[\/|]\s*)+[mwdfxa]\)/gi, " ")
    .replace(/\(all\s+genders?\)/gi, " ")
    .replace(/\b(?:[mwdfxa]\s*[\/|]\s*)+[mwdfxa]\b/gi, " ")
    .replace(/[^a-z0-9äöüß]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normFirma(f: string): string {
  return f
    .toLowerCase()
    .replace(/\b(gmbh|ag|se|kg|ohg|mbh|ug|co|kgaa|e\.?\s?v|inc|ltd|llc|corp|holding|group|deutschland|germany)\b/g, " ")
    .replace(/[^a-z0-9äöüß]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normOrt(o: string): string {
  /*
   * Nur die erste Ortsangabe, ohne Postleitzahl.
   *
   * „76133 Karlsruhe, Baden-Württemberg, Deutschland" und „Karlsruhe"
   * sind derselbe Ort. Der Rest der Kette ist Ausschmückung, die je
   * Anbieter anders ausfällt.
   */
  return (o.split(",")[0] ?? o)
    .toLowerCase()
    .replace(/\b\d{4,5}\b/g, " ")
    .replace(/[^a-z0-9äöüß]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}


/**
 * Sind das zwei Fassungen desselben Textes?
 *
 * Wortmengen-Überschneidung (Jaccard) statt Zeichenvergleich: eine
 * Wiederholung unterscheidet sich fast immer in Kleinigkeiten — ein
 * ergänzter Absatz, eine andere Ortsschreibweise, ein Datum. Gemessen
 * an echten Daten: 5683 gegen 6670 Zeichen bei derselben Stelle.
 *
 * Die Schwelle ist bewusst hoch. Zwei verschiedene Ausschreibungen
 * desselben Arbeitgebers teilen den halben Text — Unternehmensvorstellung,
 * Leistungen, Bewerbungshinweise. Erst deutlich darüber wird es
 * dieselbe Anzeige.
 */
const AEHNLICHKEIT = 0.75;

export function aehnlicherText(a: string, b: string): boolean {
  const A = wortmenge(a);
  const B = wortmenge(b);
  /*
   * Zu kurz für ein Urteil.
   *
   * Bei einer Handvoll Wörter schwankt die Überschneidung so stark,
   * dass jede Schwelle Zufall wäre. Dann lieber nicht zusammenführen:
   * eine doppelte Zeile ist sichtbar, eine verschwundene Stelle nicht.
   */
  if (A.size < 20 || B.size < 20) return false;

  let gemeinsam = 0;
  for (const w of A) if (B.has(w)) gemeinsam++;
  const vereinigung = A.size + B.size - gemeinsam;
  return vereinigung > 0 && gemeinsam / vereinigung >= AEHNLICHKEIT;
}

function wortmenge(text: string): Set<string> {
  return new Set(
    (text ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9äöüß]+/g, " ")
      .split(" ")
      .filter((w) => w.length > 3),
  );
}
