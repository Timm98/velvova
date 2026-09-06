/**
 * Wie eine Stelle zu ihrem Bild kommt (V7 §21).
 *
 * Die Reihenfolge aus §21.1, von echt nach abstrakt:
 *
 *   1. offiziell erlaubtes Firmenlogo
 *   2. erlaubtes Arbeitgeber-Cover
 *   3. Illustration der Berufsgruppe
 *   4. erzeugter Verlauf
 *
 * Je weiter unten, desto weniger sagt das Bild über den Arbeitgeber
 * aus — und genau das muss sichtbar bleiben. Ein hübsches Bild neben
 * einer Stelle wirkt wie eine Aussage über den Arbeitsplatz. Ist es
 * eine Illustration, wird sie als solche gekennzeichnet (§21.2); ist
 * es ein Verlauf, behauptet er nichts.
 *
 * Stufe 4 kostet nichts und braucht keine Datenbank: der Verlauf wird
 * aus der Stellen-Kennung gerechnet. Das ist der Grund, warum die
 * Liste auch dann Charakter hat, wenn die Bibliothek noch leer ist —
 * und warum niemals bei einem Seitenaufruf ein Bild erzeugt wird
 * (§21.5).
 */

export type VisualGrund = "company_logo" | "employer_cover" | "role_family" | "gradient";

export interface JobVisual {
  grund: VisualGrund;
  /** Nur bei echten Bildern gesetzt. */
  url?: string;
  altText: string;
  /** Sichtbare Kennzeichnung, wenn eine Maschine das Bild gemacht hat. */
  kennzeichnung?: "Illustration";
  /** Für den gerechneten Verlauf. */
  gradient?: string;
}

/**
 * Die Berufsgruppen aus §21.3.
 *
 * Endlich viele und bewusst grob: zehn Gruppen decken die allermeisten
 * Stellen ab, und je Gruppe ein gutes Bild ist bezahlbar. Je Stelle ein
 * eigenes Bild wären bei 975 Stellen 975 Bilder — und bei der nächsten
 * Einspielung wieder.
 */
/*
 * Die Muster sind gewachsen, und zwar gemessen.
 *
 * Beim ersten Durchgang blieben 526 von 1.447 Stellen ohne Gruppe —
 * gut ein Drittel bekam nur einen Farbverlauf. Die Lücken waren nicht
 * zufällig, sondern benennbar:
 *
 *   ~29× „Kaufleute für Büromanagement"  → Verwaltung
 *    18× „Projektleiter / Teamleiter"     → Operations
 *     4× „Account Executive"              → Vertrieb
 *        „IT Administrator", „Netzwerk…"  → Software
 *
 * Alle vier waren im Muster schlicht nicht vorgesehen: `office` fängt
 * kein „Büromanagement", `account manager` kein „Account Executive".
 *
 * Erweitert wurde nur, was eindeutig ist. Eine zu weite Regel ist hier
 * schlechter als gar keine: Ein falsches Berufsbild behauptet etwas
 * über die Arbeit, ein Verlauf behauptet nichts.
 */
export const BERUFSGRUPPEN = [
  { key: "customer_success", label: "Customer Success", muster: /kundenservice|customer|support|betreuung|success/i },
  { key: "software_data", label: "Software", muster: /entwickl|developer|engineer|software|devops|frontend|backend|programmier|administrator|systemadmin|sysadmin|it-?support|helpdesk|servicedesk|netzwerk|cloud|it-?spezialist|informatik|fachinformatik|anwendungsentwickl|systemintegration|\bit\b/i },
  { key: "data_bi", label: "Data & BI", muster: /\bdata\b|daten|analyst|analytics|business intelligence|\bbi\b|report/i },
  { key: "finance", label: "Finance", muster: /finanz|buchhalt|controlling|controller|accounting|accountant|steuer|bank|versicherung|lohn- und gehalt/i },
  { key: "healthcare", label: "Healthcare", muster: /pflege|gesundheit|medizin|arzt|[äa]rztin|therap|klinik|sanit[äa]ter|diabetes|optiker|orthop[äa]die|zahn|logop[äa]d|ergotherap|di[äa]tassisten|hebamme|altenhilfe|sozialarbeit|sozialp[äa]dagog|heilerziehung|betreuungskraft|rettungs/i },
  { key: "education", label: "Education", muster: /lehrer|lehrkraft|lehrbeauftragt|dozent|schule|schulisch|trainer|erzieh|p[äa]dagog|nachhilfe|bildungstr[äa]ger|kita|hort|kinderbetreuung/i },
  { key: "skilled_trades", label: "Skilled Trades", muster: /handwerk|elektr|mechan|installat|montage|montier|monteur|techniker|mechatronik|h[öo]rakustik|maintenance|dreher|schleifer|fr[äa]ser|schwei(?:ss|ß)|schlosser|tischler|schreiner|maler|lackier|dachdecker|maurer|zimmerer|zimmerin|klempner|sanit[äa]r|heizung|anlagenbau|metallbau|feinwerk|industriemechanik|werkzeugmechanik|zerspanung|cnc|bergbau|technolog|rohrleitung|isolier|geb[äa]udetechnik|w[äa]rmepumpe|photovoltaik|solarteur|karosserie|bäcker|b[äa]cker|konditor|fleischer|metzger|friseur|kosmetik|goldschmied|schneider|polsterer|glaser|steinmetz/i },
  { key: "operations", label: "Operations", muster: /produktion|operations|prozess|fertigung|qualit[äa]t|inbetriebnahme|inbetriebnehm|projektleit|teamleit|projektmanage|product (?:manager|owner)|bauleit|anlagenf[üu]hr|maschinenf[üu]hr|maschinenbedien|bediener|warenverr[äa]um|warenverr[äa]umung|aushilfe|haushaltshilfe|\bcook\b|maschinen- und anlagen|koch\b|k[öo]chin|gastronom|hauswirtschaft|reinigung|reinigungskraft|geb[äa]udereinig|garten|landschaftsbau|landwirt|g[äa]rtner|forst|sicherheitsmitarbeit|werkschutz|objektschutz|k[üu]che|servicekraft|hotel|restaurant|barista|bar\b|catering|produktionshelfer|helfer\b|facharbeiter|anlagensicherheit/i },
  { key: "logistics", label: "Logistik", muster: /logistik|supply|lager|spedition|disposition|versand|kommission|gabelstapler|stapler|berufskraftfahr|kraftfahrer|lkw|fahrer\b|zusteller|kurier|paket|post|triebfahrzeug|lokf[üu]hr|zugbegleit|pilot|flugbegleit|schiff|nautik/i },
  { key: "sales", label: "Sales", muster: /vertrieb|sales|account (?:manager|executive)|akquise|au(?:ss|ß)endienst|business development|verk[äa]uf|filialleit|verkaufsstellenleit|einzelhandel|kassier|einkauf|eink[äa]ufer|marktleiter|handelsfachwirt|filiale/i },
  { key: "design", label: "Design", muster: /design|\bux\b|\bui\b|kreativ|grafik/i },
  { key: "administration", label: "Administration", muster: /verwaltung|assistenz|assistent|\boffice\b|sachbearbeit|b[üu]roangestellt|empfang|b[üu]romanagement|b[üu]roorganisation|kauffrau|kaufmann|kaufleute|kaufm[äa]nnisch|sekret[äa]r|rechtsanwalt|notar|jurist|dolmetsch|[üu]bersetz/i },
  { key: "hr", label: "HR", muster: /personal|human resources|\bhr\b|recruit|talent acquisition/i },
  { key: "marketing", label: "Marketing", muster: /marketing|kommunikation|content|social media|brand|\bpr\b|öffentlichkeitsarbeit/i },
  { key: "research", label: "Research", muster: /forschung|research|wissenschaft|labor|studie|entwicklungsingenieur|chemi|biolog|physik|geolog|apothek|pharma|ingenieur/i },
] as const;

export type BerufsgruppeKey = (typeof BERUFSGRUPPEN)[number]["key"];

/**
 * Welche Gruppe passt?
 *
 * Über den Titel und die genannten Aufgaben, nicht über die Branche:
 * eine Entwicklerin in einer Klinik entwickelt, sie pflegt nicht.
 *
 * Ohne Treffer gibt es keine Gruppe — und dann keine Illustration,
 * sondern einen Verlauf. Eine falsche Berufsillustration ist schlechter
 * als gar keine: sie behauptet etwas über die Arbeit.
 */
/**
 * Die Einleitung vor dem eigentlichen Beruf abschneiden.
 *
 * ── Der Fehler, um den es geht ────────────────────────────────
 *
 * Das Muster der Gruppe „Bildung" enthielt `bildung` — und traf damit
 * jedes „**Ausbildung** zum Augenoptiker". Solange kaum Ausbildungs-
 * stellen im Bestand standen, fiel das nicht auf. Nach dem Import von
 * 170.000 Ausbildungsplätzen landete jede fünfte Stelle in „Bildung",
 * darunter Bäcker, Optiker und Bergbautechnologen.
 *
 * Zwei Dinge waren daran falsch. Das Muster hat `bildung` verloren und
 * nennt jetzt Lehrberufe beim Namen. Und der Titel wird vorher
 * beschnitten: „Ausbildung zum Augenoptiker" wird zu „Augenoptiker",
 * denn der Beruf steht hinter der Einleitung, nicht darin.
 *
 * Das gilt für Praktika und Werkstudien genauso — auch dort ist die
 * Tätigkeit das, was zählt.
 */
export function ohneEinleitung(titel: string): string {
  /*
   * Zweimal durchlaufen, weil Zierrat und Einleitung sich abwechseln.
   *
   * Echte Titel sehen so aus: „*2026* Ausbildung - Fachinformatiker",
   * „*** Ausbildungsstelle für 2026 in 47475 Kamp-Lintfort - ...".
   * Ein einzelner Durchgang lässt entweder die Sterne oder das Wort
   * „Ausbildung" stehen.
   */
  const EINLEITUNG =
    /^(?:ausbildung(?:splatz|sstelle)?|azubi|auszubildende[rn]?|praktikum|praktikant(?:in)?|werkstudent(?:in)?|trainee|duales? studium|umschulung)\b[\s:,.\-–—]*(?:zum|zur|als|f[üu]r|im|in)?[\s:,.\-–—]*/i;
  const ZIERRAT = /^[\s*·•·:,.\-–—/|()\[\]]*(?:\d{4}[\s*:,.\-–—/]*)?/;

  let rest = titel;
  for (let i = 0; i < 3; i++) {
    const vorher = rest;
    rest = rest.replace(ZIERRAT, "").replace(EINLEITUNG, "");
    if (rest === vorher) break;
  }
  return rest.trim();
}

export function berufsgruppe(titel: string, aufgaben: string[] = []): BerufsgruppeKey | null {
  /*
   * Erst der Titel allein, dann erst die Aufgaben.
   *
   * Vorher wurden beide zu einer Zeichenkette verbunden und in einem
   * Durchgang geprüft. Damit konnte ein beliebiges Wort aus der
   * Aufgabenliste einen eindeutigen Titel überstimmen — und generische
   * Aufgabenwörter tun das ständig:
   *
   *   „Werkstudent Vertrieb Grünstrom" + „Kundenbetreuung"
   *     → betreuung trifft customer_success, obwohl der Titel Vertrieb sagt
   *
   *   „Werkstudent Vertrieb" + „Geschäftsentwicklung"
   *     → entwickl trifft software_data, obwohl niemand Software schreibt
   *
   * Auf der Startseite standen deshalb zwei von drei Karten mit
   * demselben Codefenster, darunter eine Vertriebsstelle.
   *
   * Die ursprüngliche Absicht bleibt erhalten: „eine Entwicklerin in
   * einer Klinik entwickelt, sie pflegt nicht" — das steht im Titel und
   * wird zuerst gelesen. Die Aufgaben helfen weiterhin dort, wo der
   * Titel nichts hergibt („Werkstudent (m/w/d)").
   */
  const gelesen = ohneEinleitung(titel);
  for (const g of BERUFSGRUPPEN) {
    if (g.muster.test(gelesen)) return g.key;
  }

  if (aufgaben.length === 0) return null;
  const ausAufgaben = aufgaben.join(" ");
  for (const g of BERUFSGRUPPEN) {
    if (g.muster.test(ausAufgaben)) return g.key;
  }

  return null;
}

/*
 * Eine stabile Zahl aus einer Zeichenkette.
 *
 * Dieselbe Stelle bekommt immer denselben Verlauf — beim Neuladen, auf
 * einem anderen Gerät, nach einem Neustart. Ein zufälliger Verlauf
 * würde bei jedem Rendern flackern und die Liste unruhig machen.
 */
export function zahlAus(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * Der Verlauf als letzte Stufe.
 *
 * Bewusst in der Markenfamilie und bewusst gedämpft: er soll eine
 * Fläche sein, kein Bild. Zwei Töne im Indigo-Bereich, leicht gedreht;
 * der Farbton kommt aus der Kennung, die Sättigung ist fest, damit
 * nichts grell wird.
 */
export function verlaufFür(jobId: string): string {
  const n = zahlAus(jobId);
  // 210–280 Grad: von Eisblau bis Violett. Ausserhalb dieses Fensters
  // wären es Farben, die im Produkt etwas bedeuten (Grün: bestätigt,
  // Rot: Konflikt) — die dürfen nicht dekorativ auftreten.
  const ton = 210 + (n % 70);
  const zweiterTon = ton + 24;
  const winkel = 120 + (n % 60);
  return (
    `linear-gradient(${winkel}deg, ` +
    `oklch(0.93 0.045 ${ton}) 0%, ` +
    `oklch(0.88 0.075 ${zweiterTon}) 100%)`
  );
}

/**
 * Das Bild für eine Stelle.
 *
 * `zuweisung` kommt aus der Bibliothek, falls es eine gibt. Fehlt sie,
 * endet die Reihenfolge beim Verlauf — ohne Netzaufruf, ohne
 * Bilderzeugung, ohne Wartezeit.
 */
export function jobVisual(
  job: { id: string; title: string; companyName: string; coreTasks?: string[] },
  zuweisung?: {
    grund: VisualGrund;
    url: string;
    altText: string;
    aiGenerated: boolean;
  } | null,
): JobVisual {
  if (zuweisung) {
    return {
      grund: zuweisung.grund,
      url: zuweisung.url,
      altText: zuweisung.altText,
      /*
       * Die Kennzeichnung hängt daran, ob eine Maschine das Bild
       * gemacht hat — nicht daran, welche Stufe gegriffen hat. Ein
       * erzeugtes Arbeitgeber-Cover wäre besonders irreführend und
       * muss besonders deutlich gekennzeichnet sein (§21.2).
       */
      kennzeichnung: zuweisung.aiGenerated ? "Illustration" : undefined,
    };
  }

  /*
   * Stufe 3: die Illustration der Berufsgruppe.
   *
   * Sie braucht keine Datenbank und keine Zuweisung. Die Bibliothek
   * liegt als fünfzehn SVG-Dateien im Auslieferungsverzeichnis, und
   * welche davon passt, ergibt sich allein aus Titel und Aufgaben —
   * einer reinen Funktion, die schon oben steht.
   *
   * Diese Stufe war bis hierher tot. Sie erwartete eine Zuweisung aus
   * einer Bibliothek, die niemand befüllt hatte, und deshalb fiel JEDE
   * Stelle auf Stufe 4 durch. Das Ergebnis war eine Anwendung ohne ein
   * einziges Bild — bei einer Architektur, die vier Bildstufen
   * vorsieht.
   *
   * Die Kennzeichnung ist Pflicht (§21.2): Das Bild zeigt eine
   * Berufsgruppe, nicht diesen Arbeitgeber. Ohne das Wort
   * „Illustration" läse es sich als Aufnahme aus dem Betrieb.
   */
  const gruppe = berufsgruppe(job.title, job.coreTasks ?? []);
  if (gruppe) {
    const label = BERUFSGRUPPEN.find((g) => g.key === gruppe)!.label;
    return {
      grund: "role_family",
      url: `/berufsbilder/${gruppe}.svg`,
      altText: `Illustration zur Berufsgruppe ${label}`,
      kennzeichnung: "Illustration",
    };
  }

  return {
    grund: "gradient",
    gradient: verlaufFür(job.id),
    /*
     * Der Alternativtext sagt, was das Bild IST, nicht was es zeigt.
     * „Farbfläche" ist ehrlich; „Büro" wäre erfunden.
     */
    altText: `Farbfläche als Platzhalter für ${job.title} bei ${job.companyName}`,
  };
}

/**
 * Darf überhaupt ein Bild erzeugt werden? (§21.5)
 *
 * Diese Frage stellt sich NIE bei einem Seitenaufruf. `jobVisual()`
 * ruft sie nicht auf und kann es nicht — die Funktion ist rein und
 * kennt keine Konfiguration. Der Schalter gilt für den Admin-Durchlauf,
 * der die Bibliothek füllt.
 *
 * Er steht hier, damit es genau eine Stelle gibt, an der die Frage
 * beantwortet wird. Ein Generator, der selbst in die Umgebung schaut,
 * wäre eine zweite Wahrheit — und die eine, die man beim Aufräumen
 * übersieht.
 */
export function bilderzeugungErlaubt(cfg: { jobs: { imageGeneration: boolean } }): boolean {
  return cfg.jobs.imageGeneration;
}
