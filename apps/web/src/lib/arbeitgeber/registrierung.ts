import "server-only";

import { and, eq, isNotNull } from "drizzle-orm";
import { getDb, schema } from "@paycheck/db";

/*
 * Felder, Zustände und Domainabgleich liegen nebenan, in
 * `registrierung-felder.ts` — sie werden auch im Browser gebraucht,
 * und diese Datei zieht den Datenbanktreiber mit. Hier stehen sie als
 * Re-Export, damit serverseitige Aufrufer aus einer Datei importieren.
 */
export {
  BRANCHEN,
  FUNKTIONEN,
  GROESSEN,
  PRUEFSTAND_TEXT,
  domainAus,
  standAus,
  type Pruefstand,
} from "./registrierung-felder";

/**
 * Was der Registrierung im Weg steht — oder auch nicht.
 *
 * Wird während der Eingabe aufgerufen, nicht erst beim Absenden. Wer
 * erst nach dem Ausfüllen erfährt, dass sein Unternehmen bereits
 * verwaltet wird, hat umsonst getippt.
 */
export type Befund =
  | { art: "frei" }
  | { art: "wird_verwaltet"; name: string }
  | { art: "domain_passt"; domain: string }
  | { art: "domain_weicht_ab"; domain: string; adressDomain: string };

export async function pruefeUnternehmen(opt: {
  domain: string | null;
  /** Die Adresse, mit der die Person angemeldet ist. */
  emailDomain: string | null;
}): Promise<Befund[]> {
  const befunde: Befund[] = [];
  const db = await getDb();

  if (opt.domain) {
    const [vorhanden] = await db
      .select({ name: schema.organizations.name })
      .from(schema.organizations)
      .where(
        and(
          eq(schema.organizations.domain, opt.domain),
          /* Nur bestätigte Organisationen blockieren. Ein fremder,
             ungeprüfter Entwurf darf niemanden daran hindern, sein
             eigenes Unternehmen anzulegen. */
          isNotNull(schema.organizations.verifiedAt),
        ),
      )
      .limit(1);

    if (vorhanden) {
      befunde.push({ art: "wird_verwaltet", name: vorhanden.name });
      return befunde;
    }

    if (opt.emailDomain) {
      befunde.push(
        opt.emailDomain === opt.domain
          ? { art: "domain_passt", domain: opt.domain }
          : { art: "domain_weicht_ab", domain: opt.domain, adressDomain: opt.emailDomain },
      );
    }
  }

  if (befunde.length === 0) befunde.push({ art: "frei" });
  return befunde;
}

