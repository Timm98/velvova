import type { UserConstraints } from "@paycheck/domain";
import { deuteSuchintention } from "@/lib/jobs/suchintention";
import { geltungAusSatz, type Geltung } from "./geltung.ts";

/**
 * Aus einem Satz wird ein VORSCHLAG für eine harte Bedingung.
 *
 * Der Fehler, den das behebt, war der grösste im Produkt und zugleich
 * unsichtbar: Jemand sagt Nina „mindestens 45.000 Euro, das ist eine
 * harte Grenze". Der Satz wurde gespeichert — als Gesprächsverlauf und
 * als Evidenz. In die Tabelle `user_constraints`, die das Matching
 * tatsächlich liest, kam er nie. Sie wurde nur vom Einrichtungsformular
 * beschrieben.
 *
 * Die Folge stand danach schwarz auf weiss auf der Jobseite:
 *
 *   „Gehalt: Du hast keine Untergrenze festgelegt."
 *
 * Und Stellen in Hamburg erschienen für jemanden, der Karlsruhe gesagt
 * hatte. Das Produkt behauptete, Bedingungen zu berücksichtigen, und
 * hatte keine.
 *
 * ── Warum Vorschlag und nicht Übernahme ───────────────────────
 *
 * Eine harte Bedingung schliesst Stellen aus. Sie aus einem Satz
 * abzuleiten und stillschweigend zu setzen wäre der zweite Fehler nach
 * dem ersten: „ab 45.000 wäre schön" ist keine Grenze, „mindestens
 * 45.000, sonst lohnt es nicht" schon — und den Unterschied kann kein
 * Muster sicher erkennen.
 *
 * Deshalb entsteht hier ein Vorschlag mit Begründung, den der Mensch
 * bestätigt. Bestätigt heisst dann wirklich hart: die Stelle fällt
 * heraus, nicht bloss im Wert nach unten.
 *
 * ── Warum derselbe Parser wie die Suche ───────────────────────
 *
 * `deuteSuchintention` liest bereits Gehalt, Ort, Arbeitsmodell und
 * Vertragsart aus natürlicher Sprache. Ein zweiter Parser daneben würde
 * bei „45k" und „45.000 €" irgendwann Verschiedenes verstehen, und
 * niemand fände heraus, welcher recht hat.
 */

export type Bedingungsfeld =
  | "minSalaryPerYear"
  | "baseLocation"
  | "maxCommuteMinutes"
  | "acceptedWorkModels"
  | "acceptedContractTypes"
  | "maxTravelPercent"
  | "acceptsShiftWork"
  | "hardNoGos"
  /*
   * Keine Bedingung, sondern die Regel für ihre Auslegung.
   *
   * Sie steht trotzdem hier, weil sie denselben Weg nimmt: dieselbe
   * Tabelle, dasselbe Schema, dieselbe Neuberechnung der Jobliste. Ein
   * zweiter Speicherpfad für ein einziges Feld hiesse zwei Stellen, an
   * denen `revalidatePath` vergessen werden kann — und das Vergessen
   * fällt nicht auf, es sieht nur so aus, als wirke die Einstellung
   * nicht.
   *
   * Aus dem Gespräch entsteht sie nie: `bedingungenAusSatz` schlägt sie
   * nicht vor, sie wird ausschliesslich in den Einstellungen gesetzt.
   */
  | "unklaresBehandeln";

export interface Bedingungsvorschlag {
  feld: Bedingungsfeld;
  /** Der Wert, wie er in `UserConstraints` stehen würde. */
  wert: unknown;
  /** Wie es der Person angezeigt wird. */
  label: string;
  anzeige: string;
  /** Die Stelle im Satz, aus der es stammt — damit sie es nachlesen kann. */
  beleg: string;
  /**
   * Wie deutlich der Satz auf eine GRENZE hindeutet, nicht auf einen
   * Wunsch. Unter der Schwelle wird gar nicht vorgeschlagen.
   */
  sicherheit: number;
  /**
   * Ab wann und wie lange das gelten soll.
   *
   * Nicht dasselbe wie `sicherheit`. Die sagt, wie deutlich der Satz
   * eine GRENZE meint statt eines Wunsches; diese hier sagt, ob die
   * Grenze für immer gelten soll oder nur für diese eine Suche.
   *
   * „Zeig mir heute mal Stellen in Berlin" und „Ich will zukünftig nur
   * noch in Berlin arbeiten" sind beide deutlich — und meinen etwas
   * völlig Verschiedenes. Ohne dieses Feld wurden sie gleich behandelt,
   * und aus einem beiläufigen Blick nach Berlin wurde ein dauerhafter
   * Wunschort.
   */
  geltung: Geltung;
}

/*
 * Wörter, die eine Grenze von einem Wunsch unterscheiden.
 *
 * „mindestens", „auf keinen Fall", „muss" sind Grenzen. „gern",
 * „idealerweise", „am liebsten" sind Wünsche. Der Unterschied
 * entscheidet, ob eine Stelle ausgeschlossen wird oder nur schlechter
 * bewertet — und er ist im Deutschen erfreulich eindeutig markiert.
 */
const HART = /\b(mindestens|mindest|nicht unter|auf keinen fall|keinesfalls|muss|müssen|zwingend|unbedingt|Bedingung|Grenze|maximal|höchstens|nur|ausschliesslich|ausschließlich|kein|keine|keinen)\b/i;
const WEICH = /\b(gern|gerne|idealerweise|am liebsten|bevorzugt|wäre schön|wünschenswert|vielleicht|eventuell|tendenziell)\b/i;

/** Wie sicher der Satz eine Grenze meint, 0..1. */
function haerte(satz: string): number {
  const hart = HART.test(satz);
  const weich = WEICH.test(satz);
  if (hart && !weich) return 0.9;
  if (hart && weich) return 0.55;
  if (weich) return 0.2;
  return 0.45;
}

/** Unterhalb davon wird nichts vorgeschlagen. */
const SCHWELLE = 0.5;

const MODELL_TEXT: Record<string, string> = {
  remote: "Remote",
  hybrid: "Hybrid",
  on_site: "Vor Ort",
};

const VERTRAG_TEXT: Record<string, string> = {
  permanent: "Unbefristet",
  fixed_term: "Befristet",
  temp_agency: "Zeitarbeit",
  freelance: "Freiberuflich",
  internship: "Praktikum",
  apprenticeship: "Ausbildung",
  working_student: "Werkstudium",
};

/** Vom Wortschatz des Suchparsers in den der Bedingungen. */
const VERTRAG_ABBILDUNG: Record<string, UserConstraints["acceptedContractTypes"]> = {
  permanent: ["permanent"],
  temporary: ["fixed_term", "temp_agency"],
  freelance: ["freelance"],
  internship: ["internship"],
};

/**
 * Was in diesem Satz nach einer harten Bedingung aussieht.
 *
 * Leeres Ergebnis ist der Normalfall — die meisten Sätze in einem
 * Karrieregespräch enthalten keine Grenze, und jeden davon mit einer
 * Rückfrage zu unterbrechen wäre schlimmer als gar keine Erkennung.
 */
export function bedingungenAusSatz(satz: string): Bedingungsvorschlag[] {
  const sicherheit = haerte(satz);
  if (sicherheit < SCHWELLE) return [];

  const { filter } = deuteSuchintention(satz);
  /*
   * Ohne `geltung`, bis sie am Ende einmal für alle bestimmt wird.
   *
   * Sie hängt am Satz und nicht am einzelnen Fund — jeden Zweig
   * einzeln damit zu versorgen hiesse, dieselbe Ableitung ein Dutzend
   * Mal zu wiederholen und beim nächsten neuen Zweig zu vergessen.
   */
  const vorschlaege: Omit<Bedingungsvorschlag, "geltung">[] = [];

  /*
   * Wendungen, die es nur im Gespräch gibt.
   *
   * `deuteSuchintention` ist für Suchanfragen gebaut: „ab 45.000",
   * „ohne Vertrieb". Im Gespräch sagt niemand so. Dort heisst es „nicht
   * unter 45.000" und „auf keinen Fall Kaltakquise".
   *
   * Diese Formen kommen hier dazu und nicht in den Suchparser: der
   * beantwortet eine andere Frage — was filtere ich JETZT —, hat eigene
   * Prüfungen und würde von Gesprächswendungen nur unschärfer.
   */
  const gehaltGespraech = /\b(?:nicht unter|nicht weniger als|unter\s+.{0,12}\s*(?:geht|lohnt)\s*(?:es\s*)?nicht)\D{0,12}(\d[\d.\s]*(?:k)?)/i.exec(satz)
    ?? /\bmindestens\D{0,12}(\d[\d.\s]*(?:k)?)/i.exec(satz);
  const gehaltAus = gehaltGespraech ? betragAusText(gehaltGespraech[1] ?? "") : null;

  if (typeof filter.gehaltAb !== "number" && gehaltAus !== null) {
    vorschlaege.push({
      feld: "minSalaryPerYear",
      wert: gehaltAus,
      label: "Mindestgehalt",
      anzeige: `${gehaltAus.toLocaleString("de-DE")} € brutto im Jahr`,
      beleg: gehaltGespraech![0],
      sicherheit,
    });
  }

  if (typeof filter.gehaltAb === "number") {
    vorschlaege.push({
      feld: "minSalaryPerYear",
      wert: filter.gehaltAb,
      label: "Mindestgehalt",
      anzeige: `${filter.gehaltAb.toLocaleString("de-DE")} € brutto im Jahr`,
      beleg: satz,
      sicherheit,
    });
  }

  if (filter.ort) {
    vorschlaege.push({
      feld: "baseLocation",
      wert: filter.ort,
      label: "Wohnort",
      anzeige: filter.ort,
      beleg: satz,
      sicherheit,
    });
  }

  if (filter.remote) {
    /*
     * Aus einem genannten Modell wird eine Liste der ERLAUBTEN.
     *
     * „Homeoffice ist wichtig" heisst nicht „nur Remote" — Hybrid
     * erfüllt es meistens auch. Vor Ort erfüllt es nicht.
     */
    const erlaubt =
      filter.remote === "remote"
        ? ["remote", "hybrid"]
        : filter.remote === "hybrid"
          ? ["hybrid", "remote"]
          : ["on_site", "hybrid"];
    vorschlaege.push({
      feld: "acceptedWorkModels",
      wert: erlaubt,
      label: "Arbeitsmodell",
      anzeige: erlaubt.map((m) => MODELL_TEXT[m] ?? m).join(" oder "),
      beleg: satz,
      sicherheit,
    });
  }

  if (filter.contract) {
    /*
     * Der Suchparser und die Domäne sprechen nicht dieselbe Sprache.
     *
     * Der Parser kennt `temporary`, die Bedingungen kennen
     * `fixed_term` und `temp_agency`. Ohne diese Abbildung landete ein
     * Wert in der Datenbank, den das Schema nicht kennt — und das
     * Speichern scheiterte erst beim Bestätigen, weit weg von der
     * Ursache. Der Typprüfer hat es vorher gefunden.
     *
     * „befristet" wird bewusst zu BEIDEN: wer keine befristete Stelle
     * will, meint Zeitarbeit selten anders.
     */
    const arten = VERTRAG_ABBILDUNG[filter.contract];
    if (arten) {
      vorschlaege.push({
        feld: "acceptedContractTypes",
        wert: arten,
        label: "Vertragsart",
        anzeige: arten.map((a) => VERTRAG_TEXT[a] ?? a).join(" oder "),
        beleg: satz,
        sicherheit,
      });
    }
  }

  /*
   * Pendelzeit und Bürotage — die zwei, die der Suchparser nicht kennt,
   * weil sie keine Filter in der Jobliste sind.
   */
  const pendel = /\b(?:maximal|höchstens|bis zu|nicht mehr als)\s*(\d{1,3})\s*(?:min|minuten)\b/i.exec(satz);
  if (pendel) {
    const minuten = Number(pendel[1]);
    if (minuten > 0 && minuten <= 240) {
      vorschlaege.push({
        feld: "maxCommuteMinutes",
        wert: minuten,
        label: "Arbeitsweg",
        anzeige: `höchstens ${minuten} Minuten`,
        beleg: pendel[0],
        sicherheit,
      });
    }
  }

  const reise = /\b(?:maximal|höchstens|nicht mehr als)\s*(\d{1,3})\s*(?:%|prozent)\s*(?:reise|dienstreise)/i.exec(satz);
  if (reise) {
    vorschlaege.push({
      feld: "maxTravelPercent",
      wert: Number(reise[1]),
      label: "Reiseanteil",
      anzeige: `höchstens ${reise[1]} %`,
      beleg: reise[0],
      sicherheit,
    });
  }

  if (/\bkeine?\s+(?:schicht|schichtarbeit|nachtschicht|wechselschicht)/i.test(satz)) {
    vorschlaege.push({
      feld: "acceptsShiftWork",
      wert: false,
      label: "Schichtarbeit",
      anzeige: "keine Schichtarbeit",
      beleg: satz,
      sicherheit,
    });
  }

  /*
   * Freie Ausschlüsse: „kein aktiver Vertrieb", „keine Kaltakquise".
   *
   * Sie kommen aus dem `nicht`-Teil des Suchparsers — derselbe Weg, den
   * die Jobsuche schon nimmt.
   */
  const ausschluesse = new Set<string>();
  if (filter.nicht) {
    for (const w of filter.nicht.split(/[\s,]+/).filter((w) => w.length > 3)) ausschluesse.add(w);
  }
  for (const treffer of satz.matchAll(AUSSCHLUSS_MUSTER)) {
    const roh = (treffer[1] ?? "").trim().replace(/[.,;!?]+$/, "");
    // Ein Wort, höchstens drei — „Kaltakquise", „aktiven Vertrieb",
    // „Arbeit am Wochenende". Alles darüber ist ein Halbsatz und als
    // Ausschluss unbrauchbar.
    const worte = roh.split(/\s+/).filter(Boolean);
    if (worte.length === 0 || worte.length > 3) continue;
    if (roh.length > 3) ausschluesse.add(roh);
  }

  for (const wort of ausschluesse) {
    vorschlaege.push({
      feld: "hardNoGos",
      wert: wort,
      label: "Ausschluss",
      anzeige: `kein ${wort}`,
      beleg: satz,
      sicherheit,
    });
  }

  /*
   * Die Geltung hängt am Satz, nicht am einzelnen Vorschlag.
   *
   * Wer sagt „heute mal Berlin und maximal 40 Minuten Weg", meint
   * beides für heute. Die Geltung je Vorschlag getrennt zu bestimmen
   * hiesse, aus einem Satz zwei verschiedene Zeithorizonte zu lesen —
   * das tut niemand beim Sprechen.
   */
  const { geltung } = geltungAusSatz(satz);
  return vorschlaege.map((v) => ({ ...v, geltung }));
}

/*
 * Wie im Gespräch ausgeschlossen wird.
 *
 * „auf keinen Fall X", „kein X", „nichts mit X", „X kommt nicht in
 * Frage". Bewusst eng gefasst: ein zu weites Muster macht aus jedem
 * verneinten Nebensatz einen dauerhaften Ausschluss, und die Person
 * sieht danach Stellen nicht mehr, ohne zu wissen warum.
 */
const AUSSCHLUSS_MUSTER =
  /(?:auf keinen fall|keinesfalls|nichts mit|bloss kein|bloß kein|kein[e]?[nrms]?)\s+([A-Za-zÄÖÜäöüß][\wÄÖÜäöüß-]*(?:\s+[A-Za-zÄÖÜäöüß][\wÄÖÜäöüß-]*){0,2})/gi;

/** „45.000", „45k", „45 000" → 45000. Dieselbe Regel wie im Suchfeld. */
function betragAusText(roh: string): number | null {
  const sauber = roh.replace(/[.\s ]/g, "");
  const k = /^(\d+)k$/i.exec(sauber);
  if (k) return Number(k[1]) * 1000;
  const zahl = Number(sauber);
  if (!Number.isFinite(zahl) || zahl <= 0) return null;
  return zahl < 1000 ? Math.round(zahl * 1000) : Math.round(zahl);
}

/**
 * Einen bestätigten Vorschlag in die Bedingungen einarbeiten.
 *
 * Reine Funktion, damit sich das Zusammenführen prüfen lässt, ohne eine
 * Datenbank anzufassen. Listen werden ERSETZT und nicht ergänzt: wer
 * „nur unbefristet" sagt, meint nicht „unbefristet zusätzlich zu allem
 * bisherigen". Einzige Ausnahme sind die Ausschlüsse — die sammeln sich.
 */
export function anwenden(
  bisher: UserConstraints,
  v: Bedingungsvorschlag,
): UserConstraints {
  switch (v.feld) {
    case "minSalaryPerYear":
      return { ...bisher, minSalaryPerYear: v.wert as number };
    case "baseLocation":
      return { ...bisher, baseLocation: v.wert as string };
    case "maxCommuteMinutes":
      return { ...bisher, maxCommuteMinutes: v.wert as number };
    case "maxTravelPercent":
      return { ...bisher, maxTravelPercent: v.wert as number };
    case "acceptsShiftWork":
      return { ...bisher, acceptsShiftWork: v.wert as boolean };
    case "acceptedWorkModels":
      return { ...bisher, acceptedWorkModels: v.wert as UserConstraints["acceptedWorkModels"] };
    case "acceptedContractTypes":
      return {
        ...bisher,
        acceptedContractTypes: v.wert as UserConstraints["acceptedContractTypes"],
      };
    case "unklaresBehandeln":
      return {
        ...bisher,
        unklaresBehandeln: v.wert as UserConstraints["unklaresBehandeln"],
      };
    case "hardNoGos": {
      const neu = String(v.wert);
      return bisher.hardNoGos.includes(neu)
        ? bisher
        : { ...bisher, hardNoGos: [...bisher.hardNoGos, neu] };
    }
  }
}

/** Eine gesetzte Bedingung wieder aufheben. */
export function aufheben(bisher: UserConstraints, feld: Bedingungsfeld, wert?: string): UserConstraints {
  switch (feld) {
    case "minSalaryPerYear":
      return { ...bisher, minSalaryPerYear: null };
    case "baseLocation":
      return { ...bisher, baseLocation: null };
    case "maxCommuteMinutes":
      return { ...bisher, maxCommuteMinutes: null };
    case "maxTravelPercent":
      return { ...bisher, maxTravelPercent: null };
    case "acceptsShiftWork":
      return { ...bisher, acceptsShiftWork: true };
    case "acceptedWorkModels":
      // Zurück auf „alles erlaubt" — nicht auf eine leere Liste, die
      // jede Stelle ausschliessen würde.
      return { ...bisher, acceptedWorkModels: ["on_site", "hybrid", "remote"] };
    case "acceptedContractTypes":
      return { ...bisher, acceptedContractTypes: [] };
    case "hardNoGos":
      return { ...bisher, hardNoGos: bisher.hardNoGos.filter((n) => n !== wert) };
    case "unklaresBehandeln":
      /*
       * Zurück auf die Voreinstellung, nicht auf „mitzeigen".
       *
       * „Aufheben" darf hier nicht heissen: offene Bedingungen wieder
       * unter die geprüften mischen. Der Weg zurück führt auf den
       * sichtbaren, aber getrennten Abschnitt.
       */
      return { ...bisher, unklaresBehandeln: "getrennt" };
  }
}

/** Was gerade gilt — für die Regelkarten in der Oberfläche. */
export function gesetzteBedingungen(
  c: UserConstraints,
): { feld: Bedingungsfeld; label: string; anzeige: string; wert?: string }[] {
  const raus: { feld: Bedingungsfeld; label: string; anzeige: string; wert?: string }[] = [];

  if (c.minSalaryPerYear !== null) {
    raus.push({
      feld: "minSalaryPerYear",
      label: "Mindestgehalt",
      anzeige: `${c.minSalaryPerYear.toLocaleString("de-DE")} € brutto im Jahr`,
    });
  }
  if (c.baseLocation) {
    raus.push({ feld: "baseLocation", label: "Wohnort", anzeige: c.baseLocation });
  }
  if (c.maxCommuteMinutes !== null) {
    raus.push({
      feld: "maxCommuteMinutes",
      label: "Arbeitsweg",
      anzeige: `höchstens ${c.maxCommuteMinutes} Minuten`,
    });
  }
  if (c.acceptedWorkModels.length > 0 && c.acceptedWorkModels.length < 3) {
    raus.push({
      feld: "acceptedWorkModels",
      label: "Arbeitsmodell",
      anzeige: c.acceptedWorkModels.map((m) => MODELL_TEXT[m] ?? m).join(" oder "),
    });
  }
  if (c.acceptedContractTypes.length > 0) {
    raus.push({
      feld: "acceptedContractTypes",
      label: "Vertragsart",
      anzeige: c.acceptedContractTypes.map((v) => VERTRAG_TEXT[v] ?? v).join(", "),
    });
  }
  if (c.maxTravelPercent !== null) {
    raus.push({
      feld: "maxTravelPercent",
      label: "Reiseanteil",
      anzeige: `höchstens ${c.maxTravelPercent} %`,
    });
  }
  if (!c.acceptsShiftWork) {
    raus.push({ feld: "acceptsShiftWork", label: "Schichtarbeit", anzeige: "keine Schichtarbeit" });
  }
  for (const n of c.hardNoGos) {
    raus.push({ feld: "hardNoGos", label: "Ausschluss", anzeige: `kein ${n}`, wert: n });
  }

  return raus;
}
