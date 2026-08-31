import { berufsgruppe, verlaufFür, type BerufsgruppeKey } from "./visuals.ts";

/**
 * Ein Titelbild je Berufsgruppe — nicht je Stelle.
 *
 * Der Unterschied ist der ganze Punkt. Bei 994 Anzeigen wäre ein Bild
 * pro Stelle eine Rechnung pro Besucher und bei der nächsten
 * Einspielung wieder. Zehn Gruppen decken das Feld ab, und ein gutes
 * Bild je Gruppe ist bezahlbar und wiederverwendbar.
 *
 * Die Bilder sind eigene SVG-Kompositionen: abstrakte Motive in der
 * Markenfamilie, die eine Arbeitswelt andeuten, ohne einen Arbeitsplatz
 * zu behaupten. Ein Foto eines Grossraumbüros neben einer Anzeige liest
 * sich als „so sieht es dort aus" — und das wissen wir nicht.
 *
 * Ohne erkennbare Gruppe bleibt der gerechnete Verlauf. Lieber eine
 * ehrliche Fläche als ein Motiv, das die falsche Arbeit zeigt.
 */

export interface Berufsbild {
  /** Inline-SVG als data-URI. Kein Netzaufruf, kein Layoutsprung. */
  bild: string;
  /** Was zu sehen ist — für Vorlesegeräte und als Kennzeichnung. */
  altText: string;
  gruppe: BerufsgruppeKey | null;
}

/*
 * Je Gruppe zwei Töne und ein Motiv.
 *
 * Die Töne bleiben im Markenfenster (Eis bis Violett), damit die Liste
 * ruhig bleibt. Grün und Rot bedeuten im Produkt etwas — bestätigt,
 * Konflikt — und dürfen nicht dekorativ auftreten.
 */
const MOTIVE: Record<BerufsgruppeKey, { von: string; bis: string; form: string; alt: string }> = {
  customer_success: {
    von: "#EDF6FF", bis: "#E4ECFF",
    // Zwei Kreise, die sich überschneiden: ein Gespräch.
    form: '<circle cx="150" cy="110" r="58" fill="#655DFF" opacity=".16"/><circle cx="215" cy="130" r="46" fill="#8B84FF" opacity=".22"/>',
    alt: "Abstrakte Darstellung zweier sich überschneidender Kreise als Sinnbild für Kundenkontakt",
  },
  software_data: {
    von: "#F0EEFF", bis: "#E7E4FF",
    form: '<rect x="120" y="70" width="46" height="46" rx="12" fill="#655DFF" opacity=".18"/><rect x="176" y="96" width="46" height="46" rx="12" fill="#8B84FF" opacity=".24"/><rect x="232" y="70" width="46" height="46" rx="12" fill="#655DFF" opacity=".14"/>',
    alt: "Abstrakte Darstellung versetzter Blöcke als Sinnbild für Software und Daten",
  },
  finance: {
    von: "#EDF6FF", bis: "#E8EEFF",
    form: '<rect x="130" y="130" width="26" height="44" rx="9" fill="#655DFF" opacity=".18"/><rect x="166" y="100" width="26" height="74" rx="9" fill="#8B84FF" opacity=".24"/><rect x="202" y="76" width="26" height="98" rx="9" fill="#655DFF" opacity=".16"/>',
    alt: "Abstrakte Darstellung aufsteigender Balken als Sinnbild für Zahlen und Finanzen",
  },
  healthcare: {
    von: "#F0EEFF", bis: "#EAF2FF",
    form: '<path d="M200 160c-30-22-52-38-52-62a30 30 0 0 1 52-20 30 30 0 0 1 52 20c0 24-22 40-52 62z" fill="#8B84FF" opacity=".22"/>',
    alt: "Abstrakte weiche Form als Sinnbild für Pflege und Gesundheit",
  },
  education: {
    von: "#EDF6FF", bis: "#E9EDFF",
    form: '<path d="M140 120l60-30 60 30-60 30z" fill="#655DFF" opacity=".18"/><path d="M170 138v28c0 8 60 8 60 0v-28" stroke="#8B84FF" stroke-width="6" fill="none" opacity=".3"/>',
    alt: "Abstrakte Darstellung als Sinnbild für Bildung und Weitergabe von Wissen",
  },
  skilled_trades: {
    von: "#F1F3F8", bis: "#E9ECF7",
    form: '<rect x="132" y="104" width="120" height="16" rx="8" fill="#655DFF" opacity=".2" transform="rotate(-18 192 112)"/><circle cx="238" cy="142" r="22" fill="#8B84FF" opacity=".24"/>',
    alt: "Abstrakte Darstellung von Werkzeugformen als Sinnbild für handwerkliche Arbeit",
  },
  operations: {
    von: "#EDF6FF", bis: "#E6EDFB",
    form: '<rect x="128" y="96" width="52" height="52" rx="14" fill="#655DFF" opacity=".16"/><rect x="196" y="96" width="52" height="52" rx="14" fill="#8B84FF" opacity=".2"/><rect x="162" y="150" width="52" height="30" rx="12" fill="#655DFF" opacity=".12"/>',
    alt: "Abstrakte Darstellung geordneter Flächen als Sinnbild für Abläufe und Logistik",
  },
  sales: {
    von: "#F0EEFF", bis: "#E6E2FF",
    form: '<path d="M126 168l44-44 34 26 62-62" stroke="#655DFF" stroke-width="9" stroke-linecap="round" fill="none" opacity=".3"/><circle cx="266" cy="88" r="16" fill="#8B84FF" opacity=".3"/>',
    alt: "Abstrakte aufsteigende Linie als Sinnbild für Vertrieb und Wachstum",
  },
  design: {
    von: "#F0EEFF", bis: "#EDF6FF",
    form: '<circle cx="166" cy="120" r="44" fill="#655DFF" opacity=".16"/><rect x="196" y="96" width="72" height="72" rx="24" fill="#8B84FF" opacity=".22"/>',
    alt: "Abstrakte Überlagerung von Kreis und Fläche als Sinnbild für Gestaltung",
  },
  administration: {
    von: "#F1F3F8", bis: "#EAEEF9",
    form: '<rect x="140" y="82" width="104" height="20" rx="10" fill="#655DFF" opacity=".18"/><rect x="140" y="116" width="76" height="20" rx="10" fill="#8B84FF" opacity=".2"/><rect x="140" y="150" width="92" height="20" rx="10" fill="#655DFF" opacity=".12"/>',
    alt: "Abstrakte gestapelte Zeilen als Sinnbild für Verwaltung und Organisation",
  },
};

function alsDataUri(von: string, bis: string, form: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200" width="400" height="200">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${von}"/><stop offset="1" stop-color="${bis}"/>` +
    `</linearGradient></defs>` +
    `<rect width="400" height="200" fill="url(#g)"/>${form}</svg>`;
  /*
   * Als data-URI und nicht als Datei: das Bild ist unter einem
   * Kilobyte, kommt mit dem HTML mit und braucht keinen zweiten
   * Netzaufruf. Für zehn Motive lohnt sich kein Bilderdienst.
   */
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function berufsbild(job: {
  id: string;
  title: string;
  coreTasks?: string[];
}): Berufsbild {
  const gruppe = berufsgruppe(job.title, job.coreTasks ?? []);
  if (!gruppe) {
    return {
      bild: "",
      altText: "Farbfläche als Platzhalter",
      gruppe: null,
    };
  }
  const m = MOTIVE[gruppe];
  return { bild: alsDataUri(m.von, m.bis, m.form), altText: m.alt, gruppe };
}

/** Der Verlauf für Stellen ohne erkennbare Gruppe. */
export { verlaufFür };
