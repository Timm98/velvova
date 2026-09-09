/**
 * ══════════════════════════════════════════════════════════════════
 * Den Karrierebereich finden, ohne ihn zu raten
 * ══════════════════════════════════════════════════════════════════
 *
 * Die naheliegende Lösung wäre eine Liste von Pfaden: `/karriere`,
 * `/jobs`, `/stellenangebote`. Sie ist ausdrücklich ausgeschlossen,
 * und aus gutem Grund.
 *
 * Ein Landratsamt führt seine Stellen unter `/buergerservice/
 * personalamt/ausschreibungen`. Eine Klinik unter `/ueber-uns/
 * arbeiten-bei-uns`. Eine Hochschule unter `/verwaltung/dezernat-4`.
 * Wer Pfade rät, findet die Firmen, die ihre Seite gebaut haben wie
 * alle anderen — und übersieht genau die, bei denen es sich lohnt.
 *
 * ── Was stattdessen entscheidet ─────────────────────────────────
 *
 * Der Text, den ein Mensch anklickt. Er ist geschrieben worden, damit
 * ein Besucher versteht, wohin er führt; das macht ihn zur besseren
 * Auskunft als jeder Pfad. Die Adresse zählt mit, aber schwächer —
 * sie ist ein Hinweis und kein Versprechen.
 *
 * ── Warum die Art des Ziels wichtiger ist als die Reihenfolge ───
 *
 * „Initiativbewerbung" und „Offene Stellen" sind nicht zwei Grade
 * desselben Fundes. Das eine beantwortet die Frage, ob wir überhaupt
 * fragen dürfen; das andere beantwortet die Frage, ob wir es müssen.
 * Deshalb trägt jeder Fund seine Art, und der Aufrufer entscheidet,
 * welche er zuerst besucht.
 *
 * ── Was hier NICHT passiert ─────────────────────────────────────
 *
 * Kein Abruf, kein Netz. Diese Datei bekommt HTML und gibt Adressen
 * zurück. Was davon tatsächlich geholt werden darf, entscheidet
 * `abrufregeln.ts` — und zwar danach, nicht hier.
 */

export type Karriereart =
  /** Initiativbewerbung, Talentpool, Vormerkung. Der wertvollste Fund. */
  | "initiativbewerbung"
  /** Eine Liste offener Stellen. Sie entscheidet, ob überhaupt gefragt wird. */
  | "stellenliste"
  /** Der Karrierebereich allgemein. */
  | "karriere"
  /** Ausbildung, Studium, Praktikum. Eigener Weg, eigene Zielgruppe. */
  | "ausbildung"
  /** Ein Kontaktweg, der zum Personalbereich gehört. */
  | "kontakt";

export interface Karrierefund {
  /** Vollständig aufgelöste Adresse. */
  url: string;
  art: Karriereart;
  /** Der Text, den ein Mensch anklicken würde. */
  text: string;
  /** 0–1. Rangsignal innerhalb einer Art, kein Qualitätsurteil. */
  punkte: number;
  /** Woran es erkannt wurde. Steht im Protokoll, nicht in der Oberfläche. */
  grund: string;
}

/*
 * Die Wörter.
 *
 * Deutsch und Englisch, weil DACH-Arbeitgeber ihre Karriereseite in
 * einem von beiden beschriften. Kleingeschrieben und ohne Umlaute
 * verglichen — „Stellenangebote", „STELLENANGEBOTE" und
 * „Stellenangebote/Ausschreibungen" sollen dasselbe treffen.
 *
 * Die Reihenfolge in der Liste ist bedeutungslos; die Art entscheidet.
 */
const WOERTER: { art: Karriereart; muster: readonly string[]; gewicht: number }[] = [
  {
    art: "initiativbewerbung",
    gewicht: 1,
    muster: [
      "initiativbewerbung", "initiativ", "talentpool", "talent pool", "talentepool",
      "vormerkung", "kurzbewerbung", "blindbewerbung",
      "spontaneous application", "unsolicited application", "speculative application",
      "talent community", "talent network", "join our talent",
    ],
  },
  {
    art: "stellenliste",
    gewicht: 0.95,
    muster: [
      "stellenangebot", "stellenanzeige", "stellenausschreibung", "stellenboerse",
      "offene stellen", "freie stellen", "aktuelle stellen", "unsere stellen",
      "stellenmarkt", "jobboerse", "jobangebote", "vakanzen",
      "job openings", "open positions", "current openings", "vacancies",
      "current vacancies", "browse jobs", "all jobs",
    ],
  },
  {
    art: "ausbildung",
    gewicht: 0.55,
    muster: [
      "ausbildung", "auszubildende", "azubi", "duales studium", "praktikum",
      "praktikant", "trainee", "berufseinstieg", "schuelerpraktikum",
      "apprenticeship", "internship", "graduate programme", "graduate program",
    ],
  },
  {
    art: "karriere",
    gewicht: 0.8,
    muster: [
      "karriere", "arbeiten bei uns", "arbeiten bei", "arbeiten fuer uns",
      "ihre karriere", "deine karriere", "wir als arbeitgeber", "als arbeitgeber",
      "personalamt", "hauptamt", "personalservice", "personalabteilung",
      "recruiting", "personalgewinnung", "mitarbeiter werden", "teil des teams",
      "unser team", "wir suchen",
      "careers", "career", "jobs", "join us", "work with us", "work for us",
      "working at", "employment", "life at",
    ],
  },
  {
    art: "kontakt",
    gewicht: 0.35,
    muster: [
      "ansprechpartner", "kontakt personal", "personalkontakt",
      "fragen zur bewerbung", "bewerbungsinformation", "bewerbungsprozess",
      "hr contact", "recruiting contact",
    ],
  },
];

/**
 * Wörter, die sicher NICHT in den Karrierebereich führen.
 *
 * Sie stehen hier, weil „Aktuelles" und „Presse" auf vielen
 * Behördenseiten neben „Stellenangebote" stehen und dieselben Wörter
 * enthalten können — „Wir suchen Zeugen" ist eine Pressemitteilung,
 * kein Stellenangebot.
 */
const AUSSCHLUSS = [
  "presse", "pressemitteilung", "aktuelles", "newsletter", "veranstaltung",
  "impressum", "datenschutz", "barrierefreiheit", "sitemap", "cookie",
  "press release", "privacy", "imprint", "accessibility",
];

/**
 * Fremde Ziele, die trotzdem zählen.
 *
 * Viele Arbeitgeber betreiben ihre Stellen nicht selbst, sondern über
 * ein Bewerbersystem. Der Link führt dann auf eine fremde Domain und
 * ist trotzdem die offizielle Stellenliste des Arbeitgebers — mit
 * demselben Rang wie seine eigene Seite.
 *
 * Diese Systeme kennt das Produkt bereits: `sources/ats/board.ts`
 * liest sie aus. Ein Fund hier ist deshalb kein Sonderfall, sondern
 * eine Übergabe.
 */
const BEWERBERSYSTEME = [
  "greenhouse.io", "lever.co", "ashbyhq.com", "recruitee.com",
  "smartrecruiters.com", "personio.de", "softgarden.io", "workday.com",
  "myworkdayjobs.com", "successfactors.com", "rexx-systems.com",
  "d-vinci.de", "concludis.de", "interamt.de",
];

/**
 * Unsichtbare Zeichen, die ein Wort in der Mitte zerteilen.
 *
 * Das weiche Trennzeichen (U+00AD) steht in deutscher Web-Typografie
 * überall: „Stellen\u00ADangebote" bricht sauber um und sieht aus wie
 * ein Wort. Für einen Vergleich ist es zwei.
 *
 * Ein Test hat genau das gefunden — eine Karriereseite mit sauberem
 * Umbruch wäre still übersehen worden, und niemand hätte gewusst,
 * warum ausgerechnet dieser Arbeitgeber nie auftaucht.
 */
const UNSICHTBAR = /[\u00AD\u200B\u200C\u200D\u2060\uFEFF]/g;

function grundform(text: string): string {
  return text
    .replace(UNSICHTBAR, "")
    .toLowerCase()
    .replaceAll("ä", "ae").replaceAll("ö", "oe").replaceAll("ü", "ue")
    .replaceAll("ß", "ss");
}

/** Kleinschreibung, Umlaute aufgelöst, Zeichen zu Leerraum. */
function vereinfachen(text: string): string {
  return grundform(text).replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Dasselbe, aber ohne jede Trennung.
 *
 * `/stellen-angebote` ist eine völlig übliche Adresse, und mit
 * Leerzeichen dazwischen trifft „stellenangebot" sie nicht. Beide
 * Formen zu prüfen kostet nichts und fängt Bindestrich,
 * Unterstrich und Schrägstrich in einem.
 */
function verdichten(text: string): string {
  return grundform(text).replace(/[^a-z0-9]+/g, "");
}

/** Alle `<a href>` mit ihrem sichtbaren Text. */
function verweise(html: string): { href: string; text: string }[] {
  const raus: { href: string; text: string }[] = [];
  const muster = /<a\b[^>]*?href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;

  for (const treffer of html.matchAll(muster)) {
    const href = treffer[2]?.trim();
    if (!href) continue;
    /*
     * Der Text kann Markierungen enthalten — ein Symbol im `<span>`,
     * eine versteckte Beschriftung. Sie werden entfernt, nicht
     * ausgewertet: Was ein Mensch liest, ist der Text dazwischen.
     */
    const text = (treffer[3] ?? "")
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    raus.push({ href, text });
  }
  return raus;
}

function gleicheSeite(a: URL, b: URL): boolean {
  /*
   * Verglichen wird auf den letzten beiden Namensteilen.
   *
   * `karriere.landkreis.de` und `www.landkreis.de` gehören zusammen;
   * eine Karriereseite auf einer eigenen Unterdomain ist der
   * Normalfall und kein fremdes Ziel.
   *
   * Das ist grob — `example.co.uk` hat drei Teile. Für den Zweck
   * genügt es: Der Fehler wäre, eine echte Karriereseite zu
   * verwerfen, und der tritt bei zwei Teilen seltener auf als bei
   * einem strengen Vollvergleich.
   */
  const kurz = (h: string) => h.toLowerCase().split(".").slice(-2).join(".");
  return kurz(a.hostname) === kurz(b.hostname);
}

function istBewerbersystem(host: string): boolean {
  const h = host.toLowerCase();
  return BEWERBERSYSTEME.some((b) => h === b || h.endsWith(`.${b}`));
}

/**
 * Die Karrierebereiche auf dieser Seite finden.
 *
 * `basis` ist die Adresse, unter der das HTML geholt wurde — sie löst
 * relative Verweise auf. Ohne sie wären `/karriere` und `../jobs`
 * nicht verwertbar, und genau so stehen sie in fast jeder Navigation.
 *
 * Gibt eine leere Liste zurück, wenn nichts gefunden wurde. Das ist
 * ein gültiges Ergebnis: Nicht jede Firmenseite hat einen
 * Karrierebereich, und eine geratene Adresse wäre schlechter als
 * keine.
 */
export function karrierelinks(html: string, basis: string): Karrierefund[] {
  let basisUrl: URL;
  try {
    basisUrl = new URL(basis);
  } catch {
    return [];
  }

  const gefunden = new Map<string, Karrierefund>();

  for (const { href, text } of verweise(html)) {
    let url: URL;
    try {
      url = new URL(href, basisUrl);
    } catch {
      continue;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") continue;

    const fremd = !gleicheSeite(url, basisUrl);
    if (fremd && !istBewerbersystem(url.hostname)) continue;

    const beschriftung = vereinfachen(text);
    const beschriftungDicht = verdichten(text);
    const rohPfad = (() => {
      try {
        return decodeURIComponent(url.pathname + url.search);
      } catch {
        /* Eine kaputt kodierte Adresse ist kein Grund, die Seite aufzugeben. */
        return url.pathname + url.search;
      }
    })();
    const pfad = vereinfachen(rohPfad);
    const pfadDicht = verdichten(rohPfad);

    if (AUSSCHLUSS.some((w) => beschriftung.includes(w))) continue;

    let bester: Karrierefund | null = null;

    for (const gruppe of WOERTER) {
      for (const wort of gruppe.muster) {
        /*
         * Der Linktext wiegt schwerer als der Pfad.
         *
         * Er ist für Menschen geschrieben. Ein Pfad kann `/k/12` heissen
         * und trotzdem zur Karriereseite führen — oder `/karriere-news`
         * heissen und zur Presse.
         */
        const wortDicht = verdichten(wort);
        const imText = beschriftung.includes(wort) || beschriftungDicht.includes(wortDicht);
        const imPfad = pfad.includes(wort) || pfadDicht.includes(wortDicht);
        if (!imText && !imPfad) continue;

        const punkte = gruppe.gewicht * (imText ? 1 : 0.6) * (fremd ? 0.9 : 1);
        if (bester && bester.punkte >= punkte) continue;

        bester = {
          url: url.toString(),
          art: gruppe.art,
          text: text.slice(0, 120),
          punkte: Math.round(punkte * 100) / 100,
          grund: [
            imText ? `Linktext enthält „${wort}"` : `Adresse enthält „${wort}"`,
            fremd ? `Bewerbersystem ${url.hostname}` : null,
          ].filter(Boolean).join("; "),
        };
      }
    }

    if (!bester) continue;
    /* Dieselbe Adresse kann mehrfach verlinkt sein — der beste Fund gilt. */
    const vorhanden = gefunden.get(bester.url);
    if (!vorhanden || vorhanden.punkte < bester.punkte) gefunden.set(bester.url, bester);
  }

  return [...gefunden.values()].sort(
    (a, b) => b.punkte - a.punkte || a.url.localeCompare(b.url),
  );
}

/** Der beste Fund einer bestimmten Art — oder keiner. */
export function fundDerArt(funde: readonly Karrierefund[], art: Karriereart): Karrierefund | null {
  return funde.find((f) => f.art === art) ?? null;
}
