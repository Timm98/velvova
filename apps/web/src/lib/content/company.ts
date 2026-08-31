/**
 * Angaben zum Unternehmen — an genau einer Stelle.
 *
 * Rechtliche Pflichtangaben über zehn Komponenten zu verteilen heisst,
 * sie beim nächsten Umzug an neun davon zu vergessen. Hier stehen sie
 * einmal, und jede Seite liest von hier.
 *
 * Was noch fehlt, steht als `null` da — nicht als Platzhaltertext, der
 * versehentlich veröffentlicht wird. Eine Adresse wie
 * „tim.enseling@....com" in Produktion ist schlimmer als eine fehlende:
 * sie sieht aus, als wäre sie fertig.
 */

export interface ContactChannel {
  label: string;
  /** null heisst: noch nicht festgelegt. */
  email: string | null;
  purpose: string;
}

export interface TeamMember {
  name: string;
  /** Rolle. Muss vor Veröffentlichung rechtlich bestätigt werden. */
  role: string;
  focus: string;
  bio: string;
  email: string | null;
  /** Ist die Rollenbezeichnung geprüft? */
  roleConfirmed: boolean;
}

const env = (name: string): string | null => {
  const wert = process.env[name];
  return wert && wert.trim().length > 0 ? wert.trim() : null;
};

export const company = {
  /** Vollständiger Firmenname inklusive Rechtsform. */
  legalName: env("NEXT_PUBLIC_COMPANY_LEGAL_NAME"),
  tradeName: "Paycheck",
  address: {
    street: env("NEXT_PUBLIC_COMPANY_STREET"),
    postalCode: env("NEXT_PUBLIC_COMPANY_POSTAL_CODE"),
    city: env("NEXT_PUBLIC_COMPANY_CITY"),
    country: env("NEXT_PUBLIC_COMPANY_COUNTRY") ?? "Deutschland",
  },
  representedBy: env("NEXT_PUBLIC_COMPANY_REPRESENTED_BY"),
  register: {
    court: env("NEXT_PUBLIC_COMPANY_REGISTER_COURT"),
    number: env("NEXT_PUBLIC_COMPANY_REGISTER_NUMBER"),
  },
  vatId: env("NEXT_PUBLIC_COMPANY_VAT_ID"),
} as const;

export const contactChannels: ContactChannel[] = [
  {
    label: "Support",
    email: env("NEXT_PUBLIC_SUPPORT_EMAIL"),
    purpose: "Fragen zum Produkt, zum Konto oder zu einer Bewerbung.",
  },
  {
    label: "Datenschutz",
    email: env("NEXT_PUBLIC_PRIVACY_EMAIL"),
    purpose: "Auskunft, Löschung, Widerspruch und alles Weitere zu deinen Daten.",
  },
  {
    label: "Projektmanagement",
    email: env("NEXT_PUBLIC_PROJECT_CONTACT_EMAIL"),
    purpose: "Zusammenarbeit, Partnerschaften und Anfragen zum Projekt.",
  },
];

export const team: TeamMember[] = [
  {
    name: "Tim Enseling",
    role: "Gesellschafter und Geschäftsführer",
    focus: "Produkt & Technologie",
    bio: "Tim verantwortet die Produktentwicklung, technische Architektur und Umsetzung von Paycheck.",
    email: env("NEXT_PUBLIC_TIM_CONTACT_EMAIL"),
    // Bleibt false, bis die genaue rechtliche Bezeichnung bestätigt ist.
    // Eine falsche Rollenangabe im Impressum ist ein Rechtsfehler,
    // keine Ungenauigkeit.
    roleConfirmed: env("NEXT_PUBLIC_TEAM_ROLES_CONFIRMED") === "true",
  },
  {
    name: "Finn Feja",
    role: "Gesellschafter",
    focus: "Marketing & Growth",
    bio: "Finn verantwortet Positionierung, Kommunikation, Nutzergewinnung und Partnerschaften.",
    email: env("NEXT_PUBLIC_FINN_CONTACT_EMAIL"),
    roleConfirmed: env("NEXT_PUBLIC_TEAM_ROLES_CONFIRMED") === "true",
  },
];

/**
 * Fehlt etwas, das im Impressum stehen muss?
 *
 * Die Liste ist die Grundlage dafür, dass die Seite sich selbst nicht
 * als fertig ausgibt.
 */
export function missingImprintFields(): string[] {
  const fehlt: string[] = [];
  if (!company.legalName) fehlt.push("Vollständiger Firmenname mit Rechtsform");
  if (!company.address.street) fehlt.push("Ladungsfähige Anschrift");
  if (!company.address.city) fehlt.push("Ort");
  if (!company.representedBy) fehlt.push("Vertretungsberechtigte Person");
  if (!contactChannels.some((c) => c.email)) fehlt.push("Kontakt-E-Mail");
  if (!company.register.court) fehlt.push("Registergericht");
  if (!company.register.number) fehlt.push("Registernummer");
  return fehlt;
}

/** Darf eine Adresse öffentlich erscheinen? */
export function isPublishableEmail(email: string | null): boolean {
  if (!email) return false;
  // "tim.enseling@....com" sieht aus wie fertig und ist es nicht.
  if (email.includes("....")) return false;
  return /^[^@\s]+@[^@\s.]+\.[a-z]{2,}$/i.test(email);
}

/**
 * Ist der Kontaktweg in Produktion wirklich benutzbar? (V7 §25)
 *
 * Eine Adresse auf einer Seite ist ein Versprechen: hier antwortet
 * jemand. Steht dort `tim.enseling@paycheck.com`, während die Domain
 * niemandem gehört oder kein Postfach dahinter liegt, dann geht jede
 * Nachricht ins Leere — und der Absender wartet auf eine Antwort, die
 * nie kommt. Das ist schlimmer als gar keine Adresse.
 *
 * Deshalb bleibt die Anzeige stumm, bis jemand ausdrücklich bestätigt,
 * dass Domain und Zustellung geprüft sind. Nicht geraten, nicht aus dem
 * Format geschlossen — bestätigt.
 */
export function mailZustellungBestätigt(): boolean {
  return env("NEXT_PUBLIC_MAIL_DELIVERY_VERIFIED") === "true";
}

export interface Zustellwarnung {
  /** In Produktion sichtbar machen, nicht verschweigen. */
  schwere: "blockierend" | "hinweis";
  text: string;
  betroffene: string[];
}

/**
 * Was einer Veröffentlichung im Weg steht.
 *
 * Gibt `null` zurück, wenn alles bestätigt ist. Sonst eine Warnung, die
 * benennbar ist — nicht „irgendetwas stimmt nicht", sondern welche
 * Adressen betroffen sind und warum.
 */
export function zustellwarnung(inProduktion: boolean): Zustellwarnung | null {
  if (mailZustellungBestätigt()) return null;

  const adressen = [
    ...contactChannels.map((c) => c.email),
    ...team.map((t) => t.email),
  ].filter((e): e is string => isPublishableEmail(e));

  if (adressen.length === 0) return null;

  return {
    /*
     * In Produktion blockierend, in der Entwicklung nur ein Hinweis.
     *
     * Lokal will niemand für jeden Testlauf eine Domain verifizieren;
     * öffentlich darf keine Adresse stehen, die niemand liest.
     */
    schwere: inProduktion ? "blockierend" : "hinweis",
    text:
      "Domain und Mailzustellung sind nicht bestätigt. Diese Adressen werden deshalb " +
      "nicht als Kontaktweg angeboten — eine Adresse, die niemand liest, ist ein " +
      "gebrochenes Versprechen. Nach der Prüfung NEXT_PUBLIC_MAIL_DELIVERY_VERIFIED=true setzen.",
    betroffene: adressen,
  };
}

/**
 * Adressen, die wirklich angezeigt werden dürfen.
 *
 * Zwei Bedingungen, beide notwendig: die Adresse muss vollständig sein
 * UND die Zustellung bestätigt. Das Formular auf der Kontaktseite läuft
 * unabhängig davon — es braucht keine funktionierende Absenderdomain,
 * weil es serverseitig zugestellt wird.
 */
export function anzeigbareKontakte(): ContactChannel[] {
  if (!mailZustellungBestätigt()) return [];
  return contactChannels.filter((c) => isPublishableEmail(c.email));
}
