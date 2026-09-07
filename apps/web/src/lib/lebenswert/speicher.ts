"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema, withUser } from "@paycheck/db";
import { requireUser } from "@/lib/auth";
import type { Fixkosten } from "./rechnung.ts";

/**
 * Lesen und Schreiben der privaten Lebenshaltungsangaben.
 *
 * ── Was diese Datei bewusst NICHT tut ─────────────────────────
 *
 * Sie erzeugt keine Karriere-Belege. Was hier gespeichert wird, geht
 * nicht in `evidence_items`, nicht in Mondays Begründungen, nicht in
 * Suchrichtungen und nicht in Bewerbungsunterlagen.
 *
 * Das ist keine Vorsichtsmassnahme, sondern die Bedingung, unter der
 * jemand seine Miete überhaupt einträgt. Eine Zahl, die versehentlich
 * in einem Anschreiben landet, ist ein Schaden, den keine Korrektur
 * zurückholt — und beim zweiten Mal trägt niemand mehr etwas ein.
 *
 * Die Trennung steht deshalb an drei Stellen: eigene Tabellen, eigene
 * Zeilensicherheit, eigene Zugriffsfunktionen. Eine Regel, an die sich
 * jemand erinnern müsste, wäre die schwächste der drei.
 */

export interface Lebenshaltung extends Fixkosten {}

export interface AktuelleStelle {
  jobTitle: string | null;
  companyName: string | null;
  grossAmount: number | null;
  currency: string;
  salaryPeriod: "year" | "month" | "hour";
  workModel: "on_site" | "hybrid" | "remote" | null;
  /** Ohne sie gibt es keinen Stundenwert — und keinen fairen Vergleich. */
  weeklyHours: number | null;
  officeDaysPerWeek: number | null;
  commuteMinutes: number | null;
  commuteCostMonth: number | null;
}

const LEER: Lebenshaltung = {};

/** Was gespeichert ist. Leer, wenn nichts eingetragen wurde. */
export async function ladeLebenshaltung(): Promise<Lebenshaltung> {
  const user = await requireUser();
  const db = await getDb();
  const [zeile] = await withUser(db, user.id, (tx) =>
    tx.select().from(schema.livingCosts).where(eq(schema.livingCosts.userId, user.id)).limit(1),
  ).catch((e) => {
    /*
     * Ein Lesefehler darf nicht als „nichts eingetragen" durchgehen.
     *
     * Das stille `.catch(() => [])` sah nach Robustheit aus und war
     * eine Falle: Die Seite meldete daraufhin „für eine Nettorechnung
     * fehlt das Bruttogehalt" — obwohl der Betrag in der Datenbank
     * stand. Ein verschluckter Fehler wird zu einer falschen Auskunft,
     * und die ist schlimmer als eine Fehlermeldung.
     */
    console.error("[lebenshaltung] Kosten nicht lesbar:", e);
    return [];
  });

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

export async function speichereLebenshaltung(
  werte: Lebenshaltung,
): Promise<{ ok: boolean; text: string }> {
  const user = await requireUser();
  const db = await getDb();

  const sauber = bereinige(werte);

  try {
    await withUser(db, user.id, async (tx) => {
      const [vorhanden] = await tx
        .select({ userId: schema.livingCosts.userId })
        .from(schema.livingCosts)
        .where(eq(schema.livingCosts.userId, user.id))
        .limit(1);

      if (vorhanden) {
        await tx
          .update(schema.livingCosts)
          .set({ ...sauber, updatedAt: new Date() })
          .where(eq(schema.livingCosts.userId, user.id));
      } else {
        await tx.insert(schema.livingCosts).values({ userId: user.id, ...sauber });
      }
    });
    revalidatePath("/app/settings/lebenshaltung");
    return { ok: true, text: "Gespeichert." };
  } catch {
    return { ok: false, text: "Das konnte ich nicht speichern." };
  }
}

/** Alles löschen. Ohne Rückfrage an anderer Stelle — hier ist die Stelle. */
export async function loescheLebenshaltung(): Promise<{ ok: boolean; text: string }> {
  const user = await requireUser();
  const db = await getDb();
  try {
    await withUser(db, user.id, (tx) =>
      tx.delete(schema.livingCosts).where(eq(schema.livingCosts.userId, user.id)),
    );
    revalidatePath("/app/settings/lebenshaltung");
    return { ok: true, text: "Alle Angaben zur Lebenshaltung sind gelöscht." };
  } catch {
    return { ok: false, text: "Das konnte ich nicht löschen." };
  }
}

/** Die aktuelle Stelle — die Seite, gegen die verglichen wird. */
export async function ladeAktuelleStelle(): Promise<AktuelleStelle | null> {
  const user = await requireUser();
  const db = await getDb();
  const [z] = await withUser(db, user.id, (tx) =>
    tx
      .select()
      .from(schema.currentEmployment)
      .where(eq(schema.currentEmployment.userId, user.id))
      .limit(1),
  ).catch((e) => {
    console.error("[lebenshaltung] Aktuelle Stelle nicht lesbar:", e);
    return [];
  });
  if (!z) return null;
  return {
    jobTitle: z.jobTitle,
    companyName: z.companyName,
    grossAmount: z.grossAmount,
    currency: z.currency,
    salaryPeriod: z.salaryPeriod,
    workModel: z.workModel,
    weeklyHours: z.weeklyHours,
    officeDaysPerWeek: z.officeDaysPerWeek,
    commuteMinutes: z.commuteMinutes,
    commuteCostMonth: z.commuteCostMonth,
  };
}

export async function speichereAktuelleStelle(
  werte: Partial<AktuelleStelle>,
): Promise<{ ok: boolean; text: string }> {
  const user = await requireUser();
  const db = await getDb();
  try {
    await withUser(db, user.id, async (tx) => {
      const [vorhanden] = await tx
        .select({ userId: schema.currentEmployment.userId })
        .from(schema.currentEmployment)
        .where(eq(schema.currentEmployment.userId, user.id))
        .limit(1);
      if (vorhanden) {
        await tx
          .update(schema.currentEmployment)
          .set({ ...werte, updatedAt: new Date() })
          .where(eq(schema.currentEmployment.userId, user.id));
      } else {
        await tx.insert(schema.currentEmployment).values({ userId: user.id, ...werte });
      }
    });
    revalidatePath("/app/settings/lebenshaltung");
    revalidatePath("/app/jobs");
    return { ok: true, text: "Gespeichert." };
  } catch {
    return { ok: false, text: "Das konnte ich nicht speichern." };
  }
}

/*
 * Aus dem Formular kommen Zeichenketten.
 *
 * Ein leeres Feld heisst „nicht angegeben" und wird `null` — nicht `0`.
 * Eine ausdrückliche `0` bleibt `0`. Der Unterschied ist der Grund,
 * warum die Rechnung sagen kann, wie vollständig sie ist.
 */
function bereinige(w: Lebenshaltung): Lebenshaltung {
  const raus: Record<string, number | null> = {};
  for (const [k, v] of Object.entries(w)) {
    if (v === null || v === undefined || (typeof v === "string" && v === "")) {
      raus[k] = null;
      continue;
    }
    const n = Number(v);
    raus[k] = Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
  }
  return raus as Lebenshaltung;
}
