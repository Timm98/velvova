"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema, withUser } from "@paycheck/db";
import { requireUser } from "@/lib/auth";
import { STANDARD, type Gehaltsangaben } from "./angaben.ts";
import type { Bundesland, Steuerklasse } from "./core/types.ts";

/**
 * Die eigenen Steuerangaben — speichern, lesen, löschen.
 *
 * Der Unterschied zu jeder anderen Einstellung im Produkt: hier ist
 * Nichtspeichern die Voreinstellung. Steuerklasse, Kinderzahl,
 * Krankenkasse und Bundesland ergeben zusammen ein Bild der
 * Lebensform, und niemand sollte es hinterlassen, weil er einmal
 * ausgerechnet hat, was von einem Gehalt übrig bleibt.
 *
 * Deshalb gibt es `nurFuerDieseBerechnung` als eigenen Weg und
 * `loeschen` als sichtbaren Knopf — nicht versteckt unter
 * „Datenschutz", sondern an derselben Stelle wie die Eingabe.
 */

export type { Gehaltsangaben };

export async function ladeGehaltsangaben(): Promise<Gehaltsangaben> {
  const user = await requireUser();
  const db = await getDb();

  const [zeile] = await withUser(db, user.id, (tx) =>
    tx
      .select()
      .from(schema.salaryCalculationProfiles)
      .where(
        and(
          eq(schema.salaryCalculationProfiles.userId, user.id),
          eq(schema.salaryCalculationProfiles.taxYear, STANDARD.steuerjahr),
        ),
      )
      .limit(1),
  ).catch(() => []);

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

export async function speichereGehaltsangaben(form: FormData): Promise<{ ok: boolean; text: string }> {
  const user = await requireUser();
  const db = await getDb();

  const zahl = (k: string, standard: number) => {
    const v = Number(form.get(k));
    return Number.isFinite(v) ? v : standard;
  };

  const speichern = form.get("speichern") === "on";
  const kinderzahl = Math.max(0, Math.min(12, zahl("kinderzahl", 0)));

  const werte = {
    userId: user.id,
    countryCode: "DE",
    taxYear: STANDARD.steuerjahr,
    taxClass: Math.max(1, Math.min(6, zahl("steuerklasse", 1))),
    federalState: String(form.get("bundesland") ?? "NW").slice(0, 2),
    churchTax: form.get("kirchensteuer") === "on",
    healthInsuranceType: form.get("krankenversicherung") === "privat" ? "privat" : "gesetzlich",
    healthInsurerName: (String(form.get("krankenkasse") ?? "").trim() || null)?.slice(0, 120) ?? null,
    healthAdditionalRate: Math.max(0, Math.min(0.05, zahl("zusatzbeitrag", 2.45) / 100)),
    childrenCount: kinderzahl,
    paymentFrequency: [12, 13, 14].includes(zahl("zahlungen", 12)) ? zahl("zahlungen", 12) : 12,
    savePreferences: speichern,
    updatedAt: new Date(),
  };

  await withUser(db, user.id, (tx) =>
    tx
      .insert(schema.salaryCalculationProfiles)
      .values(werte)
      .onConflictDoUpdate({
        target: [
          schema.salaryCalculationProfiles.userId,
          schema.salaryCalculationProfiles.countryCode,
          schema.salaryCalculationProfiles.taxYear,
        ],
        set: werte,
      }),
  );

  revalidatePath("/app/settings/gehalt");
  revalidatePath("/app/jobs");

  return {
    ok: true,
    text: speichern
      ? "Gespeichert. Deine Angaben gelten ab jetzt für alle Gehaltsschätzungen."
      : "Übernommen — aber nicht gespeichert. Beim nächsten Besuch stehen wieder die Standardannahmen.",
  };
}

/**
 * Alles löschen.
 *
 * An derselben Stelle wie die Eingabe, nicht versteckt unter
 * „Datenschutz". Wer etwas eingibt, soll es an Ort und Stelle wieder
 * loswerden können — sonst ist die Zustimmung eine Einbahnstrasse.
 */
export async function loescheGehaltsangaben(): Promise<{ ok: boolean; text: string }> {
  const user = await requireUser();
  const db = await getDb();
  await withUser(db, user.id, (tx) =>
    tx
      .delete(schema.salaryCalculationProfiles)
      .where(eq(schema.salaryCalculationProfiles.userId, user.id)),
  );
  await withUser(db, user.id, (tx) =>
    tx
      .delete(schema.salaryCalculationRuns)
      .where(eq(schema.salaryCalculationRuns.userId, user.id)),
  );
  revalidatePath("/app/settings/gehalt");
  return { ok: true, text: "Gelöscht. Es sind keine Steuerangaben mehr gespeichert." };
}
