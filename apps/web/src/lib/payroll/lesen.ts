import { and, eq } from "drizzle-orm";
import { schema, type Database } from "@paycheck/db";
import { STANDARD, type Gehaltsangaben } from "./angaben.ts";
import type { Bundesland, Steuerklasse } from "./core/types.ts";

/**
 * Die Steuerangaben lesen — in einer bereits offenen Transaktion.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum diese Datei neben `einstellungen.ts` existiert
 * ══════════════════════════════════════════════════════════════
 *
 * `einstellungen.ts` beginnt mit `"use server"`. Jede exportierte
 * Funktion darin ist damit eine Server Action: Sie bekommt einen
 * Endpunkt, ihre Argumente werden über das Netz übertragen und müssen
 * serialisierbar sein. Eine Datenbanktransaktion ist das nicht — man
 * kann sie einer solchen Funktion also nicht übergeben.
 *
 * Genau das brauchte die Stellenseite aber. Sie las die
 * Steuerangaben, die Lebenshaltung, die gemerkten Stellen, den
 * Wohnort, den Riegel und das Profil — jedes in einer eigenen
 * `withUser`-Transaktion. Eine solche Transaktion sind vier
 * Netzrunden gegen Supabase (BEGIN, Rolle setzen, Abfrage, COMMIT),
 * und die Runden addieren sich, weil die Verbindungen sich in die
 * Quere kommen.
 *
 * Das Lesen steht deshalb hier, ohne `"use server"`, und
 * `ladeGehaltsangaben` ruft es auf. Für alle bisherigen Aufrufer
 * ändert sich nichts.
 *
 * ══════════════════════════════════════════════════════════════
 * Was das für die Trennung der Daten bedeutet
 * ══════════════════════════════════════════════════════════════
 *
 * Nichts — und das ist Absicht. Die Funktion nimmt keine Verbindung,
 * sondern eine Transaktion, in der Rolle und Nutzerkennung bereits
 * gesetzt sind: `withUser` hat das getan, bevor sie aufgerufen wird.
 * Die Zeilensicherheit greift wie zuvor, weil sie an der Sitzung
 * hängt und nicht daran, wer die Abfrage schreibt.
 *
 * `userId` steht zusätzlich in der `where`-Bedingung. Doppelt: einmal
 * in der Datenbank, einmal in der Abfrage. Wer eine der beiden
 * Schichten für überflüssig hält, hat noch keine erlebt, die ausfiel.
 */
export async function gehaltsangabenAusTx(
  tx: Database,
  userId: string,
): Promise<Gehaltsangaben> {
  const [zeile] = await tx
    .select()
    .from(schema.salaryCalculationProfiles)
    .where(
      and(
        eq(schema.salaryCalculationProfiles.userId, userId),
        eq(schema.salaryCalculationProfiles.taxYear, STANDARD.steuerjahr),
      ),
    )
    .limit(1);

  if (!zeile || !zeile.savePreferences) return STANDARD;

  return {
    steuerjahr: zeile.taxYear,
    steuerklasse: (zeile.taxClass ?? 1) as Steuerklasse,
    bundesland: (zeile.federalState ?? "NW") as Bundesland,
    kirchensteuer: zeile.churchTax,
    krankenversicherung: zeile.healthInsuranceType === "privat" ? "privat" : "gesetzlich",
    krankenkasse: zeile.healthInsurerName,
    zusatzbeitrag: zeile.healthAdditionalRate ?? STANDARD.zusatzbeitrag,
    hatKinder: (zeile.childrenCount ?? 0) > 0,
    kinderzahl: zeile.childrenCount ?? 0,
    zahlungen: (zeile.paymentFrequency as 12 | 13 | 14) ?? 12,
    gespeichert: true,
  };
}
