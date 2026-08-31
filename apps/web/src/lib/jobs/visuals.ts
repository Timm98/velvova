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
export const BERUFSGRUPPEN = [
  { key: "customer_success", label: "Customer Success", muster: /kundenservice|customer|support|betreuung|success/i },
  { key: "software_data", label: "Software & Data", muster: /entwickl|developer|engineer|software|data|devops|frontend|backend/i },
  { key: "finance", label: "Finance", muster: /finanz|buchhalt|controlling|accounting|steuer/i },
  { key: "healthcare", label: "Healthcare", muster: /pflege|gesundheit|medizin|arzt|therapie|klinik/i },
  { key: "education", label: "Education", muster: /bildung|lehr|dozent|schule|trainer|erzieh/i },
  { key: "skilled_trades", label: "Skilled Trades", muster: /handwerk|elektr|mechan|installat|montage|techniker/i },
  { key: "operations", label: "Operations", muster: /logistik|produktion|operations|supply|lager|fertigung/i },
  { key: "sales", label: "Sales", muster: /vertrieb|sales|account manager|akquise/i },
  { key: "design", label: "Design", muster: /design|ux|ui|kreativ|grafik/i },
  { key: "administration", label: "Administration", muster: /verwaltung|assistenz|office|sachbearbeit|personal|hr/i },
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
export function berufsgruppe(titel: string, aufgaben: string[] = []): BerufsgruppeKey | null {
  const text = `${titel} ${aufgaben.join(" ")}`;
  for (const g of BERUFSGRUPPEN) {
    if (g.muster.test(text)) return g.key;
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
function zahlAus(text: string): number {
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
