/**
 * Die Felder und Zustände der Unternehmensregistrierung.
 *
 * ── Warum diese Datei kein `server-only` trägt ────────────────
 *
 * Das Formular im Browser braucht dieselben Auswahllisten, denselben
 * Domainabgleich und dieselben Zustandstexte wie der Server. Beides in
 * einer Datei mit den Datenbankabfragen hiesse, den Treiber ins
 * Browserbündel zu ziehen — der Build bricht dann ab, und zwar zu
 * Recht.
 *
 * Alles hier ist rein: Listen, eine Zeichenkettenzerlegung und eine
 * Fallunterscheidung. Die Abfrage liegt in `registrierung.ts` daneben.
 */

export type Pruefstand =
  | "domain_pruefung"
  | "bestaetigung_gesendet"
  | "manuelle_pruefung"
  | "bestaetigt"
  | "angaben_fehlen";

export const PRUEFSTAND_TEXT: Record<Pruefstand, { titel: string; text: string }> = {
  domain_pruefung: {
    titel: "Domain wird geprüft",
    text: "Wir gleichen eure Unternehmensdomain mit der Adresse ab, mit der ihr euch angemeldet habt.",
  },
  bestaetigung_gesendet: {
    titel: "Bestätigungs-E-Mail gesendet",
    text: "An eure geschäftliche Adresse ist ein Link unterwegs. Er gilt zwanzig Minuten.",
  },
  manuelle_pruefung: {
    titel: "Manuelle Prüfung läuft",
    text: "Ein Mensch sieht sich die Angaben an. Das dauert in der Regel einen Werktag.",
  },
  bestaetigt: {
    titel: "Unternehmen bestätigt",
    text: "Ihr könnt Stellen und die Unternehmensseite veröffentlichen.",
  },
  angaben_fehlen: {
    titel: "Weitere Angaben erforderlich",
    text: "Für die Prüfung fehlen noch Angaben — Domain, Rechtsform oder Hauptsitz.",
  },
};

/** Die Domain aus einer Adresse oder Website — ohne www und Pfad. */
export function domainAus(eingabe: string): string | null {
  const roh = eingabe.trim().toLowerCase();
  if (!roh) return null;
  const nachAt = roh.includes("@") ? roh.split("@").pop()! : roh;
  const ohneSchema = nachAt.replace(/^https?:\/\//, "");
  const host = ohneSchema.split("/")[0]!.replace(/^www\./, "");
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(host) ? host : null;
}

/**
 * Welcher Prüfstand sich aus den Angaben ergibt.
 *
 * ── Warum „domain_passt" nicht gleich „bestätigt" heisst ──────
 *
 * Weil eine übereinstimmende Domain nur belegt, dass jemand dort ein
 * Postfach hat. Ob er für das Unternehmen sprechen darf, ist eine
 * andere Frage — und die beantwortet kein Abgleich, sondern ein
 * Mensch. Die Domainprüfung verkürzt den Weg dorthin, sie ersetzt ihn
 * nicht.
 */
export function standAus(opt: {
  domain: string | null;
  rechtsname: string | null;
  hauptsitz: string | null;
  domainPasst: boolean;
}): Pruefstand {
  if (!opt.domain || !opt.rechtsname?.trim() || !opt.hauptsitz?.trim()) return "angaben_fehlen";
  return opt.domainPasst ? "domain_pruefung" : "manuelle_pruefung";
}

export const BRANCHEN = [
  "Industrie und Produktion",
  "Handel",
  "IT und Software",
  "Gesundheit und Pflege",
  "Bildung",
  "Finanzen und Versicherung",
  "Bau und Handwerk",
  "Logistik und Verkehr",
  "Öffentlicher Dienst",
  "Beratung und Dienstleistung",
  "Gastgewerbe",
  "Andere",
];

export const GROESSEN = [
  "1–9 Mitarbeitende",
  "10–49",
  "50–249",
  "250–999",
  "1.000–4.999",
  "ab 5.000",
];

export const FUNKTIONEN = [
  "Geschäftsführung",
  "Personalabteilung",
  "Recruiter",
  "Fachbereich",
  "Agentur",
  "Sonstige",
];
