import "server-only";

import { passungsgruende } from "@paycheck/domain";
import type { ScoredJob } from "@/lib/matching";
import { gehaltsanzeige } from "@/lib/jobs/gehaltsanzeige";
import type { Lage } from "./schnellaktionen";

/**
 * Was der Arbeitsbereich über eine Stelle weiss.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum hier nichts nachgeladen und nichts gedeutet wird
 * ══════════════════════════════════════════════════════════════
 *
 * Passung, Faktoren, Bedingungen und Gehaltsanzeige liegen beim
 * Seitenaufbau bereits vor — `scoreAllJobs` hat sie gerechnet. Sie
 * über eine zweite Schnittstelle noch einmal zu holen kostete einen
 * weiteren Umlauf und ergäbe zwei Stände derselben Zahl.
 *
 * Kein Modellaufruf. Jeder Satz hier entsteht aus Zahlen, die aus der
 * Bewertung kommen. Ein Modell schriebe flüssiger und behauptete dabei
 * gelegentlich etwas, das in keinem Faktor steht — und diese Sätze
 * stehen ungefragt da, also müssen sie ausnahmslos stimmen.
 *
 * Mondays Deutung im Gespräch bleibt davon unberührt.
 */

export type Befund = { key: string; label: string; satz: string };

export type WorkspaceDaten = {
  jobId: string;
  titel: string;
  unternehmen: string;
  assistentin: string;
  gemerkt: boolean;
  originalUrl: string | null;
  beschreibung: string | null;

  /** Ort, Arbeitsmodell, Vertragsart, Datum — in dieser Reihenfolge. */
  eckdaten: { feld: string; wert: string | null }[];

  /** 0 bis 100, oder null wenn die Grundlage zu dünn ist. */
  passung: number | null;
  einschaetzung: string;
  /** Die Kriterien mit ihrem Stand — für die Passungsansicht. */
  kriterien: { key: string; label: string; stand: "passt" | "offen"; satz: string }[];
  /**
   * Die Teilwerte mit Zahl — für die Herleitung der Passung.
   *
   * Getrennt von `kriterien`, weil beide verschiedene Fragen
   * beantworten: Dort geht es um „passt / offen" auf einen Blick,
   * hier um „woraus entsteht die Zahl". Dieselbe Liste für beides
   * hiesse, entweder die Zahlen in eine Häkchenliste zu drängen oder
   * die Herleitung ohne Zahlen zu lassen.
   */
  faktoren: { key: string; label: string; wert: number | null; satz: string }[];

  dafuer: Befund[];
  dagegen: Befund[];
  offen: Befund[];

  gehalt: {
    anzeige: string | null;
    wunsch: string | null;
    markt: string | null;
    hinweis: string | null;
  };
  anforderungen: { muss: string[]; wunsch: string[]; unklar: string[] };
  aufgaben: string[];
  unternehmensdaten: { feld: string; wert: string | null }[];
  lage: Lage;
};

export function workspaceDaten(
  scored: ScoredJob,
  opts: {
    assistentin: string;
    gemerkt: boolean;
    wunschgehalt: number | null;
    marktspanne: string | null;
    hatVergleichsstelle: boolean;
    hatWohnort: boolean;
  },
): WorkspaceDaten {
  const gruende = passungsgruende(scored.fit.factors);
  const anzeige = gehaltsanzeige(scored.job.salary);
  const job = scored.job;

  const anforderungen = anforderungenTeilen(scored.requirements);
  const aufgaben = job.coreTasks ?? [];

  const firma = scored.firma;
  const unternehmensdaten = [
    { feld: "Branche", wert: firma.branche },
    { feld: "Grösse", wert: firma.mitarbeiter },
    { feld: "Sitz", wert: firma.hauptsitz },
    { feld: "Arbeitsmodell", wert: arbeitsmodell(job.workModel) },
  ];

  return {
    jobId: scored.jobId,
    titel: job.title,
    unternehmen: job.companyName,
    assistentin: opts.assistentin,
    gemerkt: opts.gemerkt,
    originalUrl: job.originalUrl ?? null,
    beschreibung: job.description ?? null,

    eckdaten: [
      { feld: "Ort", wert: job.location || null },
      { feld: "Arbeitsmodell", wert: arbeitsmodell(job.workModel) },
      { feld: "Vertragsart", wert: vertragsart(job.contractType) },
      { feld: "Veröffentlicht", wert: datum(job.publishedAt) },
    ],

    passung: scored.fit.score,
    einschaetzung: einschaetzung(scored.fit.score, gruende),
    kriterien: kriterien(scored.fit.factors),
    faktoren: scored.fit.factors.map((f) => ({
      key: f.key,
      label: f.label,
      wert: f.raw,
      satz: f.explanation,
    })),

    dafuer: gruende.dafuer.map(kurz),
    dagegen: gruende.dagegen.map(kurz),
    offen: gruende.offen.map(kurz),

    gehalt: {
      anzeige: anzeige?.betrag ?? null,
      wunsch: opts.wunschgehalt !== null ? `ab ${opts.wunschgehalt.toLocaleString("de-DE")} €` : null,
      markt: opts.marktspanne,
      hinweis: gehaltshinweis(scored, opts.wunschgehalt),
    },
    anforderungen,
    aufgaben,
    unternehmensdaten,

    lage: {
      hatGehalt: anzeige !== null,
      hatUnternehmensdaten: unternehmensdaten.some((d) => d.wert !== null),
      hatVergleichsstelle: opts.hatVergleichsstelle,
      hatPassung: scored.fit.score !== null,
      hatAufgaben: aufgaben.length > 0,
      hatAnforderungen: scored.requirements.length > 0,
      hatWohnort: opts.hatWohnort,
      anzahlDafuer: gruende.dafuer.length,
      anzahlDagegen: gruende.dagegen.length,
      anzahlOffen: gruende.offen.length,
    },
  };
}

const kurz = (g: { key: string; label: string; satz: string }): Befund => ({
  key: g.key,
  label: g.label,
  satz: g.satz,
});

/**
 * Anforderungen in erforderlich, wünschenswert und unklar teilen.
 *
 * `kind` kommt aus dem Import und ist die Einstufung der Quelle. Wo
 * sie fehlt oder unbekannt ist, landet die Zeile unter „unklar" —
 * nicht unter „erforderlich". Eine unklare Anforderung als Pflicht
 * auszugeben schreckt Leute von Bewerbungen ab, die sie hätten
 * abschicken sollen.
 */
function anforderungenTeilen(
  reqs: readonly { kind: string; text: string }[],
): { muss: string[]; wunsch: string[]; unklar: string[] } {
  const muss: string[] = [];
  const wunsch: string[] = [];
  const unklar: string[] = [];
  for (const r of reqs) {
    if (r.kind === "must") muss.push(r.text);
    else if (r.kind === "nice") wunsch.push(r.text);
    else unklar.push(r.text);
  }
  return { muss, wunsch, unklar };
}

/**
 * Die Kriterien mit ihrem Stand.
 *
 * Nur zwei Zustände: „passt" und „offen". Ein dritter für „passt
 * nicht" wäre naheliegend und falsch — er gehört in die Liste
 * „darauf solltest du achten", wo er mit Begründung steht, statt hier
 * als Häkchenzeile ohne Kontext.
 */
function kriterien(
  factors: readonly { key: string; label: string; raw: number | null; explanation: string }[],
) {
  return factors.slice(0, 6).map((f) => ({
    key: f.key,
    label: f.label,
    stand: (f.raw !== null && f.raw >= 0.65 ? "passt" : "offen") as "passt" | "offen",
    satz: f.explanation,
  }));
}

function arbeitsmodell(w: string): string | null {
  return w === "remote" ? "Remote" : w === "hybrid" ? "Hybrid" : w === "on_site" ? "Vor Ort" : null;
}

const VERTRAG: Record<string, string> = {
  permanent: "Unbefristet",
  fixed_term: "Befristet",
  internship: "Praktikum",
  working_student: "Werkstudium",
  apprenticeship: "Ausbildung",
  freelance: "Freiberuflich",
  temp_agency: "Zeitarbeit",
};

function vertragsart(c: string | null): string | null {
  return c ? (VERTRAG[c] ?? null) : null;
}

function datum(d: Date | null): string | null {
  if (!d) return null;
  return new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "long" }).format(d);
}

/**
 * Mondays Satz zur Gesamtlage.
 *
 * Gestuft, weil ein einziger Satz mit eingesetzter Zahl bei 91 % und
 * bei 44 % gleich klingt. Was sich ändert, ist nicht der Wert im Text,
 * sondern was der Satz behauptet.
 */
function einschaetzung(
  score: number | null,
  g: { dafuer: unknown[]; dagegen: unknown[]; offen: unknown[] },
): string {
  if (score === null) {
    return "Einiges passt zu dem, was ich bisher über dich weiss. Für eine belastbare Gesamtbewertung fehlen mir aber noch Angaben zu deinen Fähigkeiten und deiner Arbeitsweise.";
  }
  const offen = g.offen.length;
  const dagegen = g.dagegen.length;

  if (score >= 80 && dagegen === 0) {
    return offen > 0
      ? `Das passt gut. ${offen === 1 ? "Ein Punkt ist" : `${offen} Punkte sind`} noch offen — dazu würde ich nachfragen.`
      : "Das passt gut, und mir fällt nichts auf, was dagegen spräche.";
  }
  if (score >= 60) {
    return dagegen > 0
      ? `Vieles passt, aber ${dagegen === 1 ? "ein Punkt spricht" : `${dagegen} Punkte sprechen`} dagegen. Ob das für dich zählt, weisst nur du.`
      : "Vieles passt. Ein paar Angaben fehlen noch, um sicherer zu sein.";
  }
  /*
   * Bei niedriger Passung keine Ermutigung.
   *
   * „Könnte trotzdem interessant sein" ist der Satz, mit dem
   * Jobbörsen Vermittlungen erzeugen. Wenn die Zahl niedrig ist, ist
   * die ehrliche Auskunft, woran es liegt.
   */
  return dagegen > 0
    ? `Das passt eher nicht: ${dagegen === 1 ? "ein Punkt spricht" : `${dagegen} Punkte sprechen`} dagegen. Sieh dir an, ob es Punkte sind, die dir wichtig sind.`
    : "Das passt eher nicht — mir fehlen aber auch Angaben über dich. Je mehr ich weiss, desto belastbarer wird die Einschätzung.";
}

/**
 * Die Gehaltseinschätzung — oder nichts.
 *
 * `null` heisst: keine Grundlage. Ein Satz wie „liegt im üblichen
 * Rahmen" ohne Vergleichszahlen wäre erfunden, und zwar in der
 * gefährlichsten Form: beiläufig, plausibel und für bare Münze
 * genommen.
 */
function gehaltshinweis(scored: ScoredJob, wunsch: number | null): string | null {
  const min = scored.job.salary.min;
  if (min === null) return null;
  if (wunsch === null) {
    return "Zu deinem Wunschgehalt liegt mir nichts vor — trag es ein, dann kann ich vergleichen.";
  }
  if (min >= wunsch) {
    return "Das liegt in deinem Zielbereich. Wo genau, hängt von deiner Erfahrung ab — danach fragen sie im Gespräch.";
  }
  const luecke = Math.round(((wunsch - min) / wunsch) * 100);
  return `Der genannte Einstieg liegt rund ${luecke} % unter deinem Wunsch. Ob das Verhandlungssache ist, sagt die Anzeige nicht.`;
}
