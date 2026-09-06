import type { Job } from "@paycheck/domain";
import { leistungenAusText } from "@paycheck/jobs";
import { stundenwert } from "./stundenwert.ts";

/**
 * Zwei oder drei Stellen nebeneinander — und die eigene daneben.
 *
 * ── Warum eine Tabelle und keine Punktzahl ────────────────────
 *
 * Es wäre naheliegend, aus allem eine Gesamtnote zu machen: „Stelle A:
 * 78, Stelle B: 71". Die Zahl entstünde aus Gewichten, die niemand
 * gewählt hat — wie viel ist eine Stunde Arbeitsweg gegen zweihundert
 * Euro? Das ist keine Rechenfrage, sondern eine Lebensfrage, und sie
 * gehört der Person.
 *
 * Diese Datei stellt deshalb nebeneinander, was vergleichbar ist, und
 * markiert, wo etwas fehlt. Die Gewichtung passiert im Kopf des
 * Menschen, der die Tabelle liest — dort, wo sie hingehört.
 *
 * ── Warum „unbekannt" eine eigene Kategorie ist ───────────────
 *
 * Der teuerste Fehler in einem Vergleich ist eine Lücke, die wie eine
 * Null aussieht. Eine Stelle ohne Gehaltsangabe ist nicht schlechter
 * bezahlt als eine mit 45.000 € — man weiss es nur nicht. Wer die
 * fehlende Angabe als Nachteil verbucht, bevorzugt systematisch
 * Anzeigen, die viel schreiben, und nicht solche, die viel bieten.
 *
 * Jede Zelle hat deshalb drei mögliche Zustände: einen Wert, ein
 * ausdrückliches „nicht angegeben", oder — für das Gehalt — eine
 * Spanne.
 */

export type Zelle =
  | { art: "zahl"; wert: number; anzeige: string }
  | { art: "spanne"; von: number; bis: number; anzeige: string }
  | { art: "text"; anzeige: string }
  | { art: "liste"; werte: string[] }
  | { art: "fehlt"; grund: string };

export interface Vergleichszeile {
  key: string;
  label: string;
  /**
   * Ob ein höherer Wert besser ist.
   *
   * `null` heisst: Es gibt kein Besser. Bei Leistungen etwa sagt die
   * Anzahl nichts über den Wert — vier Stichworte können weniger wert
   * sein als eines.
   */
  hoeherIstBesser: boolean | null;
  /** Ein Satz dazu, wenn die Zeile leicht falsch gelesen wird. */
  hinweis?: string;
  zellen: Zelle[];
}

export interface Spalte {
  id: string;
  titel: string;
  untertitel: string | null;
  /** Ob es die eigene aktuelle Stelle ist. */
  istEigene: boolean;
}

export interface Vergleichsdaten {
  spalten: Spalte[];
  zeilen: Vergleichszeile[];
}

export interface VergleichsStelle {
  id: string;
  titel: string;
  untertitel: string | null;
  istEigene: boolean;
  bruttoVon: number | null;
  bruttoBis: number | null;
  waehrung: string;
  nettoMonat: number | null;
  /** Warum es kein Netto gibt. */
  nettoGrund: string | null;
  wochenstunden: number | null;
  pendelMinuten: number | null;
  buerotage: number | null;
  arbeitsmodell: string | null;
  vertragsart: string | null;
  leistungen: string[];
  urlaubstage: number | null;
}

/**
 * Aus einer Stellenanzeige die Angaben für den Vergleich.
 *
 * Das Netto kommt von aussen: Es braucht die Steuerangaben der Person,
 * und die liegen in der Datenbank. Diese Funktion bleibt damit rein und
 * prüfbar — dieselbe Trennung wie in `rechnung.ts`.
 */
export function stelleAusJob(
  job: Job,
  netto: { nettoMonat: number | null; grund: string | null },
): VergleichsStelle {
  const leistungen = leistungenAusText(job.description);
  const urlaub = leistungen.find((l) => l.art === "urlaub")?.wert ?? null;

  /*
   * Nur Jahresgehälter werden übernommen.
   *
   * Ein Stundenlohn liesse sich nur mit den Wochenstunden hochrechnen,
   * und die fehlen in den meisten Anzeigen. Mit vierzig zu rechnen
   * verfehlt eine Teilzeitstelle um mehr als die Hälfte — und in einem
   * Vergleich stünde die Zahl direkt neben einer echten.
   */
  const jahr = job.salary.period === "year";

  return {
    id: job.id,
    titel: job.title,
    untertitel: job.companyName,
    istEigene: false,
    bruttoVon: jahr ? (job.salary.min ?? job.salary.max) : null,
    bruttoBis: jahr ? (job.salary.max ?? job.salary.min) : null,
    waehrung: job.salary.currency,
    nettoMonat: netto.nettoMonat,
    nettoGrund: netto.grund,
    wochenstunden: job.weeklyHours ?? null,
    /*
     * Der Arbeitsweg einer neuen Stelle ist unbekannt.
     *
     * Kein Routingdienst ist angebunden, und in der Anzeige steht keine
     * Fahrzeit. Aus der Entfernung eine Zeit zu schätzen wäre der
     * naheliegende Fehler: Zwischen zwei Punkten derselben Stadt liegt
     * je nach Verbindung eine Viertel- oder eine Dreiviertelstunde.
     */
    pendelMinuten: null,
    buerotage: null,
    arbeitsmodell: job.workModel ?? null,
    vertragsart: job.contractType ?? null,
    leistungen: leistungen.map((l) => l.label),
    urlaubstage: urlaub,
  };
}

const MODELL: Record<string, string> = {
  on_site: "Vor Ort",
  hybrid: "Hybrid",
  remote: "Remote",
};

const VERTRAG: Record<string, string> = {
  permanent: "Unbefristet",
  fixed_term: "Befristet",
  temporary: "Zeitarbeit",
  freelance: "Freiberuflich",
  internship: "Praktikum",
  apprenticeship: "Ausbildung",
};

export function vergleichsdaten(stellen: VergleichsStelle[]): Vergleichsdaten {
  const spalten: Spalte[] = stellen.map((s) => ({
    id: s.id,
    titel: s.titel,
    untertitel: s.untertitel,
    istEigene: s.istEigene,
  }));

  const zeilen: Vergleichszeile[] = [
    {
      key: "brutto",
      label: "Brutto im Jahr",
      hoeherIstBesser: true,
      zellen: stellen.map((s) => geldZelle(s.bruttoVon, s.bruttoBis, s.waehrung)),
    },
    {
      key: "netto",
      label: "Netto im Monat",
      hoeherIstBesser: true,
      hinweis: "Geschätzt nach deinen Steuerangaben — die tatsächliche Abrechnung kann abweichen.",
      zellen: stellen.map((s) =>
        s.nettoMonat === null
          ? { art: "fehlt", grund: s.nettoGrund ?? "nicht angegeben" }
          : { art: "zahl", wert: s.nettoMonat, anzeige: `${euro(s.nettoMonat)} €` },
      ),
    },
    {
      key: "stunden",
      label: "Wochenstunden",
      /*
       * Weniger ist NICHT automatisch besser.
       *
       * Wer Vollzeit sucht, für den sind 20 Stunden ein Ausschluss und
       * kein Vorteil. Ein Pfeil in die eine oder andere Richtung wäre
       * hier eine Behauptung über den Lebensentwurf der Person.
       */
      hoeherIstBesser: null,
      zellen: stellen.map((s) =>
        s.wochenstunden === null
          ? { art: "fehlt", grund: "nicht angegeben" }
          : { art: "zahl", wert: s.wochenstunden, anzeige: `${s.wochenstunden} Std.` },
      ),
    },
    {
      key: "jeStunde",
      label: "Netto je Arbeitsstunde",
      hoeherIstBesser: true,
      hinweis:
        "Die Zahl, die zwei Stellen fair vergleicht: Mehr Gehalt bei mehr Stunden kann je Stunde weniger sein.",
      zellen: stellen.map((s) => {
        const w = stundenwert(s.nettoMonat, s.wochenstunden).wert;
        return w === null
          ? { art: "fehlt", grund: "Gehalt oder Wochenstunden fehlen" }
          : {
              art: "zahl",
              wert: w.proArbeitsstunde,
              anzeige: `${w.proArbeitsstunde.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`,
            };
      }),
    },
    {
      key: "weg",
      label: "Arbeitsweg",
      /*
       * Kürzer ist besser — aber nur, wo überhaupt eine Zahl steht.
       *
       * Für neue Stellen steht keine, und das ist der Normalfall. Die
       * Zeile bleibt trotzdem drin: Dass der Arbeitsweg unbekannt ist,
       * ist selbst eine Auskunft — er verschiebt das Ergebnis oft
       * stärker als das Gehalt.
       */
      hoeherIstBesser: false,
      zellen: stellen.map((s) =>
        s.pendelMinuten === null
          ? { art: "fehlt", grund: "keine Fahrzeit bekannt" }
          : {
              art: "text",
              anzeige: `${s.pendelMinuten} Min.${s.buerotage ? ` · ${s.buerotage} Bürotage` : ""}`,
            },
      ),
    },
    {
      key: "modell",
      label: "Arbeitsmodell",
      hoeherIstBesser: null,
      zellen: stellen.map((s) =>
        s.arbeitsmodell === null
          ? { art: "fehlt", grund: "nicht angegeben" }
          : { art: "text", anzeige: MODELL[s.arbeitsmodell] ?? s.arbeitsmodell },
      ),
    },
    {
      key: "vertrag",
      label: "Vertrag",
      hoeherIstBesser: null,
      zellen: stellen.map((s) =>
        s.vertragsart === null
          ? { art: "fehlt", grund: "nicht angegeben" }
          : { art: "text", anzeige: VERTRAG[s.vertragsart] ?? s.vertragsart },
      ),
    },
    {
      key: "urlaub",
      label: "Urlaubstage",
      hoeherIstBesser: true,
      zellen: stellen.map((s) =>
        s.urlaubstage === null
          ? { art: "fehlt", grund: "nicht beziffert" }
          : { art: "zahl", wert: s.urlaubstage, anzeige: `${s.urlaubstage} Tage` },
      ),
    },
    {
      key: "leistungen",
      label: "Genannte Leistungen",
      /*
       * Keine Richtung.
       *
       * Vier Stichworte sind nicht besser als eines. Sie sagen etwas
       * darüber, wie ausführlich eine Anzeige geschrieben ist — und
       * eine Rangfolge daraus wäre eine Rangfolge der Textlänge.
       */
      hoeherIstBesser: null,
      hinweis: "Aus dem Anzeigentext gelesen. Wie viele genannt sind, sagt nichts über ihren Wert.",
      zellen: stellen.map((s) =>
        s.leistungen.length === 0
          ? { art: "fehlt", grund: "keine genannt" }
          : { art: "liste", werte: s.leistungen },
      ),
    },
  ];

  return { spalten, zeilen };
}

/**
 * Welche Spalte in einer Zeile vorn liegt.
 *
 * `null`, sobald weniger als zwei Zellen eine Zahl haben oder es kein
 * „besser" gibt. Eine Auszeichnung, die auf einer einzigen bekannten
 * Zahl beruht, wäre kein Vergleich, sondern eine Feststellung — sie
 * sähe aber genauso aus.
 */
export function beste(zeile: Vergleichszeile): number | null {
  if (zeile.hoeherIstBesser === null) return null;
  const werte = zeile.zellen.map((z) => (z.art === "zahl" ? z.wert : null));
  if (werte.filter((w) => w !== null).length < 2) return null;

  let index = -1;
  let bester: number | null = null;
  werte.forEach((w, i) => {
    if (w === null) return;
    if (bester === null || (zeile.hoeherIstBesser ? w > bester : w < bester)) {
      bester = w;
      index = i;
    }
  });

  /*
   * Bei Gleichstand gewinnt niemand.
   *
   * Zwei gleiche Zahlen und ein Häkchen an einer davon behaupten einen
   * Unterschied, den es nicht gibt.
   */
  if (werte.filter((w) => w === bester).length > 1) return null;
  return index === -1 ? null : index;
}

function geldZelle(von: number | null, bis: number | null, waehrung: string): Zelle {
  if (von === null && bis === null) return { art: "fehlt", grund: "nicht angegeben" };
  const a = von ?? bis!;
  const b = bis ?? von!;
  const z = waehrung === "EUR" ? "€" : waehrung;
  return a === b
    ? { art: "zahl", wert: a, anzeige: `${euro(a)} ${z}` }
    : { art: "spanne", von: a, bis: b, anzeige: `${euro(a)} – ${euro(b)} ${z}` };
}

function euro(n: number): string {
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(n);
}
