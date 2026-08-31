import { RADAR_QUELLEN, type RadarQuelle } from "./radar-quellen.ts";

/**
 * Der Arbeitswelt-Radar.
 *
 * Holt Feeds, nimmt Metadaten, wirft alles andere weg.
 *
 * Zwei Entscheidungen, die den Rest erklären:
 *
 * **Kein XML-Parser als Abhängigkeit.** Ein RSS-Kanal ist eine flache
 * Liste aus `<item>` mit fünf interessanten Feldern. Dafür eine
 * Bibliothek mit eigener Angriffsfläche einzubinden, die auch DTDs und
 * externe Entitäten versteht, wäre mehr Risiko als Nutzen — gerade bei
 * Daten aus dem Netz. Hier werden genau die fünf Felder gelesen und
 * sonst nichts ausgewertet.
 *
 * **Nie ein Fehler nach aussen.** Ist ein Feed langsam, kaputt oder
 * weg, fällt diese eine Quelle aus, und die anderen erscheinen
 * trotzdem. Der Radar ist ein Zusatz auf der Startseite; er darf sie
 * nicht mitreissen.
 */

/**
 * Ein Vorschaubild für einen Beitrag.
 *
 * Bewusst kein Bild AUS dem Artikel: das gehört dem Herausgeber, und
 * ein Feed erlaubt die Nennung, nicht die Übernahme von Bildern. Auch
 * kein Stockfoto — es würde einen Inhalt behaupten, den wir nicht
 * kennen.
 *
 * Stattdessen eine Fläche aus der Quelle selbst: derselbe Herausgeber
 * bekommt immer dasselbe Motiv, verschiedene bekommen verschiedene. Das
 * macht die Liste ruhig und wiedererkennbar, ohne etwas zu erfinden.
 */
export function beitragsbild(quelleId: string, titel: string): string {
  let h = 2166136261;
  for (const zeichen of quelleId + titel) {
    h ^= zeichen.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  const n = Math.abs(h);
  // 210–280 Grad: Eisblau bis Violett, wie überall im Produkt.
  const ton = 210 + (n % 70);
  const winkel = 110 + (n % 70);
  const versatz = 25 + (n % 50);

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 220" width="400" height="220">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1" gradientTransform="rotate(${winkel} .5 .5)">` +
    `<stop offset="0" stop-color="oklch(0.95 0.03 ${ton})"/>` +
    `<stop offset="1" stop-color="oklch(0.89 0.07 ${ton + 20})"/></linearGradient></defs>` +
    `<rect width="400" height="220" fill="url(#g)"/>` +
    `<circle cx="${versatz + 60}" cy="${110 + (n % 40) - 20}" r="${44 + (n % 30)}" ` +
    `fill="oklch(0.7 0.12 ${ton})" opacity=".16"/>` +
    `<circle cx="${300 - (n % 60)}" cy="${70 + (n % 60)}" r="${30 + (n % 26)}" ` +
    `fill="oklch(0.65 0.14 ${ton + 30})" opacity=".13"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export interface RadarBeitrag {
  id: string;
  titel: string;
  /** Die Kurzbeschreibung, die der Feed selbst liefert — nicht unsere. */
  beschreibung: string;
  link: string;
  datum: Date | null;
  quelle: RadarQuelle;
  /** Vorschaufläche, aus Quelle und Titel gerechnet. Kein fremdes Bild. */
  bild: string;
}

/** Höchstens so alt darf ein Beitrag sein, um noch „aktuell" zu heissen. */
const MAX_ALTER_TAGE = 45;

/*
 * Wie lange die geholten Beiträge gelten.
 *
 * Eine Stunde. Amtliche Feeds ändern sich selten mehrmals täglich, und
 * die Startseite bei jedem Aufruf drei fremde Server fragen zu lassen
 * wäre langsam für uns und unhöflich gegenüber den Herausgebern.
 */
const CACHE_MS = 60 * 60 * 1000;

let zwischenspeicher: { bis: number; beiträge: RadarBeitrag[] } | null = null;

function entschlüssele(roh: string): string {
  return roh
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    // `&amp;` zuletzt: sonst würde aus `&amp;lt;` erst `&lt;` und dann
    // `<` — eine Runde zu viel.
    .replace(/&amp;/g, "&");
}

/**
 * Entfernt Auszeichnung und normalisiert Leerraum.
 *
 * Die Reihenfolge ist der ganze Punkt, und sie war zuerst falsch
 * herum: erst Tags entfernen, dann Entitäten auflösen. Bei einem Feed,
 * der seine Beschreibung doppelt kodiert — `&lt;p&gt;Text&lt;/p&gt;`,
 * und das ist bei RSS eher die Regel als die Ausnahme — stand danach
 * wörtlich `<p>Text</p>` auf der Seite. Kein Sicherheitsproblem, React
 * setzt nichts als HTML; aber sichtbarer Quelltext in einer
 * Kurzbeschreibung sieht kaputt aus, und zwar zu Recht.
 *
 * Jetzt: auflösen, entfernen, noch einmal auflösen. Der zweite Durchlauf
 * fängt, was der erste erst sichtbar gemacht hat.
 */
function alsText(roh: string): string {
  const ohneCdata = roh.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  const einmal = entschlüssele(ohneCdata).replace(/<[^>]+>/g, " ");
  return entschlüssele(einmal)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function feldAus(block: string, name: string): string {
  const treffer = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i").exec(block);
  return treffer ? alsText(treffer[1] ?? "") : "";
}

/** Ein Kanal, so weit wir ihn brauchen. */
export function leseFeed(xml: string, quelle: RadarQuelle): RadarBeitrag[] {
  // RSS nennt sie `item`, Atom `entry`. Beide kommen vor.
  const blöcke = xml.match(/<(item|entry)[\s\S]*?<\/\1>/gi) ?? [];

  return blöcke
    .map((block, i): RadarBeitrag | null => {
      const titel = feldAus(block, "title");
      if (!titel) return null;

      // Atom setzt den Link ins Attribut, RSS in den Inhalt.
      const link =
        feldAus(block, "link") ||
        /<link[^>]*href="([^"]+)"/i.exec(block)?.[1] ||
        "";
      if (!/^https?:\/\//.test(link)) return null;

      const rohDatum = feldAus(block, "pubDate") || feldAus(block, "updated") || feldAus(block, "published");
      const datum = rohDatum ? new Date(rohDatum) : null;

      const beschreibung = feldAus(block, "description") || feldAus(block, "summary");

      return {
        id: `${quelle.id}-${i}`,
        titel,
        /*
         * Bewusst gekürzt.
         *
         * Manche Feeds liefern den ganzen Artikel im
         * Beschreibungsfeld. Ihn vollständig anzuzeigen wäre die
         * Übernahme, die §23.2 ausschliesst — auch wenn der Feed sie
         * technisch anbietet. 280 Zeichen sind ein Anreisser, kein
         * Ersatz für den Artikel.
         */
        beschreibung: beschreibung.length > 280 ? `${beschreibung.slice(0, 279)}…` : beschreibung,
        link,
        datum: datum && !Number.isNaN(datum.getTime()) ? datum : null,
        quelle,
        bild: beitragsbild(quelle.id, titel),
      };
    })
    .filter((b): b is RadarBeitrag => b !== null);
}

async function holeQuelle(quelle: RadarQuelle): Promise<RadarBeitrag[]> {
  try {
    const antwort = await fetch(quelle.feed, {
      // Ein knappes Zeitlimit: die Startseite wartet nicht auf einen
      // fremden Server.
      signal: AbortSignal.timeout(6_000),
      headers: { accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" },
    });
    if (!antwort.ok) return [];
    return leseFeed(await antwort.text(), quelle);
  } catch {
    // Eine unerreichbare Quelle ist kein Fehler der Seite.
    return [];
  }
}

export async function radarBeiträge(jetzt = new Date()): Promise<RadarBeitrag[]> {
  if (zwischenspeicher && zwischenspeicher.bis > jetzt.getTime()) {
    return zwischenspeicher.beiträge;
  }

  const alle = (await Promise.all(RADAR_QUELLEN.map(holeQuelle))).flat();
  const grenze = jetzt.getTime() - MAX_ALTER_TAGE * 86_400_000;

  const beiträge = alle
    .filter((b) => !b.datum || b.datum.getTime() >= grenze)
    .sort((a, b) => (b.datum?.getTime() ?? 0) - (a.datum?.getTime() ?? 0))
    .slice(0, 6);

  /*
   * Auch ein leeres Ergebnis wird gemerkt.
   *
   * Sonst fragt jede Anfrage erneut drei nicht erreichbare Server an,
   * und die Startseite wird genau dann am langsamsten, wenn ohnehin
   * etwas kaputt ist.
   */
  zwischenspeicher = { bis: jetzt.getTime() + CACHE_MS, beiträge };
  return beiträge;
}
