import { eq } from "drizzle-orm";
import { schema, type Database } from "@paycheck/db";
import type { Fixkosten } from "./rechnung.ts";

export interface Lebenshaltung extends Fixkosten {}

/** Nichts eingetragen. Nicht dasselbe wie „alles null". */
export const LEER: Lebenshaltung = {};

/**
 * Die Lebenshaltungsangaben lesen — in einer bereits offenen
 * Transaktion.
 *
 * Warum das nicht in `speicher.ts` steht: Die Datei beginnt mit
 * `"use server"`, jede exportierte Funktion darin ist eine Server
 * Action, und einer Server Action kann man keine Transaktion
 * übergeben — ihre Argumente gehen über das Netz. Die ausführliche
 * Begründung steht in `payroll/lesen.ts`.
 *
 * Die Trennung der privaten Zahlen bleibt unberührt: Diese Funktion
 * liest `living_costs` und sonst nichts, in einer Transaktion, in der
 * `withUser` die Rolle und die Nutzerkennung bereits gesetzt hat.
 */
export async function lebenshaltungAusTx(tx: Database, userId: string): Promise<Lebenshaltung> {
  const [zeile] = await tx
    .select()
    .from(schema.livingCosts)
    .where(eq(schema.livingCosts.userId, userId))
    .limit(1);

  if (!zeile) return LEER;

  /*
   * `null` bleibt `null`.
   *
   * Es heisst „nicht angegeben" und ist etwas anderes als die Null.
   * Wer beides zu `0` zusammenzieht, kann anschliessend nicht mehr
   * sagen, wie vollständig die Rechnung ist — und genau das ist die
   * Auskunft, die sie ehrlich hält.
   */
  return {
    wohnen: zeile.wohnen,
    energie: zeile.energie,
    versicherungen: zeile.versicherungen,
    mobilitaet: zeile.mobilitaet,
    lebensmittel: zeile.lebensmittel,
    kredite: zeile.kredite,
    abos: zeile.abos,
    kinder: zeile.kinder,
    freizeit: zeile.freizeit,
    sparen: zeile.sparen,
    sonstiges: zeile.sonstiges,
  };
}
