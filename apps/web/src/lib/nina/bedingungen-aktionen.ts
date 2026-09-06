"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema, withUser } from "@paycheck/db";
import { UserConstraintsSchema, type UserConstraints } from "@paycheck/domain";
import { requireUser } from "@/lib/auth";
import { anwenden, aufheben, type Bedingungsfeld, type Bedingungsvorschlag } from "./bedingungen.ts";
import {
  ladeSitzungsbedingungen,
  leereSitzungsbedingungen,
  setzeSitzungsbedingung,
  type Sitzungsbedingungen,
} from "./sitzungsbedingungen.ts";

/**
 * Harte Bedingungen setzen und aufheben.
 *
 * Das ist die Leitung, die gefehlt hat. `user_constraints` wurde bis
 * hierher nur vom Einrichtungsformular und vom Seed beschrieben — was
 * jemand Nina sagte, kam dort nie an. Die Jobseite schrieb deshalb „Du
 * hast keine Untergrenze festgelegt", nachdem im Gespräch eine genannt
 * worden war.
 *
 * Drei Dinge, die hier bewusst so sind:
 *
 *   **Nur auf Bestätigung.** Diese Funktionen laufen nicht nebenbei
 *   beim Verarbeiten einer Nachricht, sondern wenn ein Mensch einen
 *   Vorschlag annimmt. Eine harte Bedingung schliesst Stellen aus; das
 *   darf kein Muster allein entscheiden.
 *
 *   **Ein Schema am Ende.** Was gespeichert wird, geht durch
 *   `UserConstraintsSchema`. Eine kaputte Bedingung fällt hier auf und
 *   nicht Wochen später an einer Rangfolge, die niemand erklären kann.
 *
 *   **Aufheben ist genauso leicht.** Wer eine Bedingung setzen kann,
 *   muss sie an derselben Stelle wieder loswerden — sonst ist die
 *   Zustimmung eine Einbahnstrasse.
 */

/** Was gerade gilt. Leere Bedingungen, wenn nichts gespeichert ist. */
export async function ladeBedingungen(): Promise<UserConstraints> {
  const user = await requireUser();
  return lies(user.id);
}

async function lies(userId: string): Promise<UserConstraints> {
  const db = await getDb();
  const [zeile] = await withUser(db, userId, (tx) =>
    tx
      .select()
      .from(schema.userConstraints)
      .where(eq(schema.userConstraints.userId, userId))
      .limit(1),
  ).catch(() => []);

  const geparst = UserConstraintsSchema.safeParse(zeile?.data ?? {});
  return geparst.success
    ? geparst.data
    : UserConstraintsSchema.parse({
        minSalaryPerYear: null,
        baseLocation: null,
        maxCommuteMinutes: null,
        weeklyHoursMin: null,
        weeklyHoursMax: null,
        maxTravelPercent: null,
      });
}

async function schreibe(userId: string, c: UserConstraints): Promise<void> {
  const db = await getDb();
  const data = UserConstraintsSchema.parse(c) as unknown as Record<string, unknown>;

  await withUser(db, userId, async (tx) => {
    const [vorhanden] = await tx
      .select({ userId: schema.userConstraints.userId })
      .from(schema.userConstraints)
      .where(eq(schema.userConstraints.userId, userId))
      .limit(1);

    if (vorhanden) {
      await tx
        .update(schema.userConstraints)
        .set({ data: data as never, updatedAt: new Date() })
        .where(eq(schema.userConstraints.userId, userId));
    } else {
      await tx.insert(schema.userConstraints).values({ userId, data: data as never });
    }
  });

  /*
   * Die Jobseite muss neu rechnen.
   *
   * Eine harte Bedingung ändert die Menge der zulässigen Stellen, nicht
   * bloss ihre Reihenfolge. Ohne diese Zeilen stünde die alte Liste da,
   * und die Bedingung sähe wirkungslos aus — genau der Eindruck, der
   * repariert werden soll.
   */
  revalidatePath("/app/jobs");
  revalidatePath("/app");
  revalidatePath("/app/nina");
}

/** Einen Vorschlag annehmen. Ab jetzt schliesst er Stellen aus. */
export async function bedingungUebernehmen(v: Bedingungsvorschlag): Promise<{
  ok: boolean;
  text: string;
}> {
  const user = await requireUser();
  try {
    const neu = anwenden(await lies(user.id), v);
    await schreibe(user.id, neu);
    return {
      ok: true,
      text: `Übernommen: ${v.label} — ${v.anzeige}. Stellen, die das nicht erfüllen, zeige ich dir nicht mehr in den Haupttreffern.`,
    };
  } catch {
    return { ok: false, text: "Das konnte ich nicht speichern." };
  }
}

/** Eine gesetzte Bedingung wieder aufheben. */
export async function bedingungAufheben(
  feld: Bedingungsfeld,
  wert?: string,
): Promise<{ ok: boolean; text: string }> {
  const user = await requireUser();
  try {
    await schreibe(user.id, aufheben(await lies(user.id), feld, wert));
    return { ok: true, text: "Bedingung entfernt." };
  } catch {
    return { ok: false, text: "Das konnte ich nicht ändern." };
  }
}

/** Einen Wert von Hand setzen — für die Regelkarten. */
export async function bedingungSetzen(
  feld: Bedingungsfeld,
  wert: unknown,
  anzeige: string,
): Promise<{ ok: boolean; text: string }> {
  const user = await requireUser();
  try {
    const neu = anwenden(await lies(user.id), {
      feld,
      wert,
      label: feld,
      anzeige,
      beleg: "von dir eingetragen",
      sicherheit: 1,
      // Von Hand gesetzt heisst: ab jetzt, nicht nur für diese Suche.
      geltung: "dauerhaft",
    });
    await schreibe(user.id, neu);
    return { ok: true, text: "Gespeichert." };
  } catch {
    return { ok: false, text: "Das konnte ich nicht speichern." };
  }
}

/**
 * Nur für diese Suche übernehmen.
 *
 * Der dritte Weg neben „setzen" und „verwerfen". Er entstand aus einem
 * Satz, den beide anderen falsch beantworten:
 *
 *   „Zeig mir heute mal Stellen in Berlin."
 *
 * „Setzen" macht daraus einen dauerhaften Wunschort — und Wochen später
 * fehlen die Stellen vor der eigenen Haustür, ohne dass jemand den
 * Zusammenhang noch herstellen kann. „Verwerfen" ignoriert eine klare
 * Ansage. Beides ist falsch, und deshalb brauchte es einen dritten
 * Knopf statt einer besseren Vermutung.
 *
 * Was hier NICHT passiert: kein Schreiben in `user_constraints`. Das
 * Profil bleibt unberührt — nachlesbar in `sitzungsbedingungen.ts`.
 */
export async function bedingungFuerSitzung(v: Bedingungsvorschlag): Promise<{
  ok: boolean;
  text: string;
}> {
  await requireUser();
  const r = await setzeSitzungsbedingung(v.feld, v.wert);
  if (!r.ok) {
    return { ok: false, text: "Das lässt sich nicht nur für diese Suche setzen." };
  }
  /*
   * Dieselbe Neuberechnung wie beim dauerhaften Weg.
   *
   * Eine Bedingung, die erst beim nächsten harten Neuladen wirkt, sieht
   * aus wie eine Bedingung, die nicht wirkt.
   */
  revalidatePath("/app/jobs");
  revalidatePath("/app");
  return {
    ok: true,
    text: `Nur für diese Suche: ${v.label} — ${v.anzeige}. Dein Profil bleibt unverändert.`,
  };
}

/** Alles zurücknehmen, was nur für diese Sitzung galt. */
export async function sitzungZuruecksetzen(): Promise<{ ok: boolean; text: string }> {
  await requireUser();
  await leereSitzungsbedingungen();
  revalidatePath("/app/jobs");
  revalidatePath("/app");
  return { ok: true, text: "Die Suche gilt wieder nur nach deinem Profil." };
}

/**
 * Was gerade nur für diese Suche gilt — für die Anzeige.
 *
 * Ohne diese Auskunft wäre „Nur für diese Suche" ein Knopf, der etwas
 * Unsichtbares tut: Die Bedingung wirkte auf die Jobliste, stand aber
 * nirgends, und niemand konnte sie zurücknehmen. Genau die Sorte
 * stiller Zustand, die dieses Produkt sonst überall vermeidet.
 */
export async function ladeSitzung(): Promise<Sitzungsbedingungen> {
  await requireUser();
  return ladeSitzungsbedingungen();
}
