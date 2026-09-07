"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb, schema, withUser } from "@paycheck/db";
import { requireUser } from "@/lib/auth";
import { istLandescode } from "@/lib/laender";
import {
  einrichtungSpeichern,
  hintergrundWiderrufen,
  standLaden,
  type Einrichtungsstand,
} from "@/lib/nina/einrichtung/speicher";
import { weiterZu } from "@/lib/nina/einrichtung/texte";

/**
 * Die Einrichtung abschliessen.
 *
 * ── Warum die Weiterleitung hier passiert ─────────────────────
 *
 * Wohin es danach geht, hängt am Kontotyp — und der wird
 * serverseitig aus den Mitgliedschaften abgeleitet. Ein Client, der
 * das Ziel bestimmt, bestimmt mit, ob jemand in den
 * Arbeitgeberbereich gelangt.
 */

export type AbschlussAntwort = {
  ok: boolean;
  fehler?: string;
  stand?: Einrichtungsstand;
};

export async function einrichtungAbschliessen(eingabe: {
  bedienart: unknown;
  sprachspeicherung: unknown;
  stufe: unknown;
  briefingAktiv: unknown;
  briefingRhythmus: unknown;
  briefingZeit: unknown;
  zeitzone: unknown;
  kanaele: unknown;
  sprache: unknown;
  land: unknown;
}): Promise<AbschlussAntwort> {
  const user = await requireUser();

  /*
   * Sprache und Land wandern in die Einstellungen, nicht in die
   * Einwilligung.
   *
   * Sie sind keine Erlaubnis, sondern eine Angabe — und gehören
   * deshalb in `user_settings`, wo sie der Rest der Anwendung sucht.
   * Sie hier mitzuspeichern würde eine zweite Wahrheit anlegen.
   */
  const sprache = eingabe.sprache === "en" ? "en" : "de";
  const land =
    typeof eingabe.land === "string" && istLandescode(eingabe.land)
      ? eingabe.land.toUpperCase()
      : null;

  const db = await getDb();
  await withUser(db, user.id, (tx) =>
    tx
      .insert(schema.userSettings)
      .values({ userId: user.id, locale: sprache, ...(land ? { country: land } : {}) })
      .onConflictDoUpdate({
        target: schema.userSettings.userId,
        set: { locale: sprache, ...(land ? { country: land } : {}), updatedAt: new Date() },
      }),
  );

  const ergebnis = await einrichtungSpeichern(user.id, eingabe);
  if (!ergebnis.ok) return { ok: false, fehler: ergebnis.fehler };

  revalidatePath("/app", "layout");
  revalidatePath("/", "layout");
  return { ok: true, stand: ergebnis.stand };
}

/**
 * „Ohne Hintergrundsuche fortfahren."
 *
 * Speichert Stufe 1 und lässt das Briefing aus. Ablehnen muss so
 * einfach sein wie Zustimmen — deshalb ein Knopf und kein Weg durch
 * drei Auswahlfelder.
 *
 * Die Bedienart wird trotzdem gebraucht: Ohne sie wüsste Monday im
 * nächsten Schritt nicht, ob sie sprechen oder schreiben soll. Steht
 * keine da, gilt Text — die Fassung, die niemandem ein Mikrofon
 * abverlangt.
 */
export async function ohneHintergrund(bedienart: unknown): Promise<AbschlussAntwort> {
  const user = await requireUser();
  const ergebnis = await einrichtungSpeichern(user.id, {
    bedienart: bedienart === "sprache" ? "sprache" : "text",
    sprachspeicherung: "nur_bestaetigte",
    stufe: "manual",
    briefingAktiv: false,
    briefingRhythmus: "werktags",
    briefingZeit: "08:00",
    zeitzone: "Europe/Berlin",
    kanaele: [],
  });
  if (!ergebnis.ok) return { ok: false, fehler: ergebnis.fehler };

  revalidatePath("/app", "layout");
  return { ok: true, stand: ergebnis.stand };
}

/** Weiter ins Gespräch — das Ziel bestimmt der Server. */
export async function weiterInsGespraech(): Promise<void> {
  const user = await requireUser();
  const stand = await standLaden(user.id);
  redirect(weiterZu(stand.kontotyp));
}

/* ── Privacy Center ───────────────────────────────────────────── */

export async function einstellungAendern(eingabe: {
  bedienart: unknown;
  sprachspeicherung: unknown;
  stufe: unknown;
  briefingAktiv: unknown;
  briefingRhythmus: unknown;
  briefingZeit: unknown;
  zeitzone: unknown;
  kanaele: unknown;
}): Promise<AbschlussAntwort> {
  const user = await requireUser();
  const ergebnis = await einrichtungSpeichern(user.id, eingabe);
  if (!ergebnis.ok) return { ok: false, fehler: ergebnis.fehler };
  revalidatePath("/app/settings/privacy");
  return { ok: true, stand: ergebnis.stand };
}

export async function hintergrundAbschalten(): Promise<AbschlussAntwort> {
  const user = await requireUser();
  const stand = await hintergrundWiderrufen(user.id);
  revalidatePath("/app/settings/privacy");
  revalidatePath("/app", "layout");
  return { ok: true, stand };
}
