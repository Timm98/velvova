"use server";

import { getDb, schema, withSystem, withUser } from "@paycheck/db";
import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { angabeErfassen } from "@/lib/arbeitsprofil";
import { besteProbe, type Arbeitsdimension } from "@paycheck/domain";

/**
 * Arbeitsproben: ausprobieren statt behaupten.
 *
 * ── Die zwei Fragen, die getrennt bleiben müssen ──────────────
 *
 * Kann jemand die Aufgabe? Und gibt sie ihm Energie?
 *
 * Das sind verschiedene Fragen und sie gehen oft auseinander. Der Fall,
 * um den es geht, ist der Mensch, der eine Arbeit beherrscht und daran
 * zugrunde geht — den findet man nur, wenn man beides einzeln fragt.
 * Eine gemeinsame Punktzahl hätte ihn versteckt.
 *
 * ── Was eine Probe NICHT ist ──────────────────────────────────
 *
 * Eine Prüfung. Nach jedem Versuch steht die Erklärung da, auch wenn
 * die Antwort stimmte. Und eine falsche Antwort schliesst nichts aus:
 * Sie erzeugt keinen Eintrag im Profil, der jemanden abwertet, sondern
 * nur die Energieangabe — die er selbst gegeben hat.
 */

export interface Probe {
  id: string;
  titel: string;
  aufgabe: string;
  art: string;
  optionen: string[];
  dauerSekunden: number;
  erklaerung: string;
}

/**
 * Die nächste Probe für jemanden.
 *
 * Bevorzugt zur eigenen Berufsrichtung, sonst allgemein — und nie eine,
 * die schon gemacht wurde. Eine Aufgabe zum zweiten Mal zu stellen
 * misst Erinnerung, nicht Eignung.
 */
export async function naechsteProbe(kldbHauptgruppe?: string | null): Promise<Probe | null> {
  const user = await requireUser();
  const db = await getDb();

  const gemacht = await withUser(db, user.id, (tx) =>
    tx
      .select({ id: schema.probendurchlaeufe.probeId })
      .from(schema.probendurchlaeufe)
      .where(eq(schema.probendurchlaeufe.userId, user.id)),
  ).catch(() => []);
  const gemachteIds = new Set(gemacht.map((g) => g.id));

  const alle = await withSystem(db, (tx) =>
    tx
      .select()
      .from(schema.aufgabenproben)
      .where(
        and(
          eq(schema.aufgabenproben.aktiv, true),
          kldbHauptgruppe
            ? or(
                eq(schema.aufgabenproben.kldbHauptgruppe, kldbHauptgruppe),
                isNull(schema.aufgabenproben.kldbHauptgruppe),
              )
            : sql`true`,
        ),
      ),
  ).catch(() => []);

  const offen = alle.filter((p) => !gemachteIds.has(p.id));
  if (offen.length === 0) return null;

  /*
   * Die Auswahlregel steht in `@paycheck/domain`.
   *
   * Sie ist geprüfbar ohne Datenbank und ohne Anmeldung — und sie
   * verhindert den Fehler, den die Vorgabe wörtlich nennt: Bei einer
   * Lieferfahrer-Stelle darf keine Warmwasser-Aufgabe erscheinen.
   *
   * Vorher stand hier eine Sortierung, die passende Aufgaben nach
   * vorn zog und die nächstbeste nahm, wenn keine passte. Sortieren
   * ist keine Bedingung.
   */
  const passend = besteProbe(offen, kldbHauptgruppe ?? null);
  if (!passend) return null;

  return {
    id: passend.id,
    titel: passend.titel,
    aufgabe: passend.aufgabe,
    art: passend.art,
    optionen: passend.optionen,
    dauerSekunden: passend.dauerSekunden,
    erklaerung: passend.erklaerung,
  };
}

export interface Probenergebnis {
  richtig: boolean | null;
  erklaerung: string;
  /** Die richtige Reihenfolge oder Auswahl — auch wenn es stimmte. */
  loesung: number[];
}

/**
 * Einen Versuch speichern und auswerten.
 *
 * Die Energieangabe fliesst als Angabe der Herkunft `probe` in den
 * Career Twin: schwerer als eine Selbstauskunft, leichter als eine
 * Beobachtung aus einem echten Arbeitsverhältnis.
 */
export async function probeAbgeben(
  probeId: string,
  antwort: number[],
  energie: number,
  dauerSekunden: number,
): Promise<Probenergebnis> {
  const user = await requireUser();
  const db = await getDb();

  const [probe] = await withSystem(db, (tx) =>
    tx.select().from(schema.aufgabenproben).where(eq(schema.aufgabenproben.id, probeId)).limit(1),
  );
  if (!probe) throw new Error("Diese Aufgabe gibt es nicht.");

  /*
   * Bei Textaufgaben wird nichts bewertet.
   *
   * `null` und nicht `false`: „nicht bewertet" ist etwas anderes als
   * „falsch", und der Unterschied entscheidet über jede spätere
   * Auswertung.
   */
  const richtig =
    probe.art === "text"
      ? null
      : probe.loesung.length === antwort.length &&
        probe.loesung.every((v, i) => v === antwort[i]);

  const wert = Math.min(5, Math.max(1, Math.round(energie)));

  await withUser(db, user.id, (tx) =>
    tx.insert(schema.probendurchlaeufe).values({
      userId: user.id,
      probeId,
      antwort,
      richtig,
      energie: wert,
      dauerSekunden: Math.max(0, Math.round(dauerSekunden)),
    }),
  );

  await energieInsProfil(user.id, probe.kldbHauptgruppe, probe.titel, wert);
  await belegAusProbe(user.id, probe.titel, richtig, wert, dauerSekunden);
  revalidatePath("/app/proben");

  return { richtig, erklaerung: probe.erklaerung, loesung: probe.loesung };
}

/**
 * Was die Energieangabe über den Menschen sagt.
 *
 * ── Warum nur die Ränder zählen ───────────────────────────────
 *
 * „teils" (3 von 5) sagt nichts. Nur deutliche Zustimmung oder
 * Ablehnung trägt einen Schluss.
 *
 * ── Warum nur `lernen` und `wiederholung` ─────────────────────
 *
 * Aus „diese Aufgabe hat mir Spass gemacht" folgt nicht, wie viel
 * Autonomie jemand braucht. Es folgt, dass ihn diese Art von Denken
 * trägt — und das ist eine Aussage über Neugier und über die Frage,
 * ob Abwechslung ihn eher anzieht oder anstrengt.
 *
 * Mehr daraus abzuleiten wäre Kaffeesatz. Die übrigen acht Achsen
 * bleiben dem Gespräch und den Check-ins vorbehalten.
 */
async function energieInsProfil(
  userId: string,
  hauptgruppe: string | null,
  titel: string,
  energie: number,
): Promise<void> {
  if (energie === 3) return;
  const mochte = energie > 3;
  const staerke = Math.abs(energie - 3) / 2; // 0,5 oder 1,0

  const dimensionen: [Arbeitsdimension, number][] = [
    ["lernen", mochte ? 0.5 + staerke * 0.4 : 0.5 - staerke * 0.3],
    ["wiederholung", mochte ? 0.5 - staerke * 0.3 : 0.5 + staerke * 0.2],
  ];

  for (const [d, wert] of dimensionen) {
    await angabeErfassen(
      userId,
      d,
      Math.min(1, Math.max(0, wert)),
      "probe",
      `Arbeitsprobe „${titel}“${hauptgruppe ? ` (Berufsgruppe ${hauptgruppe})` : ""} — ${
        mochte ? "hat Energie gegeben" : "hat Energie gekostet"
      }`,
    );
  }
}

export interface Probenbilanz {
  versuche: number;
  richtig: number;
  /** Die Gruppen, in denen es Energie gab — nicht die mit den besten Ergebnissen. */
  gabEnergie: { hauptgruppe: string | null; titel: string; energie: number }[];
  kostenEnergie: { hauptgruppe: string | null; titel: string; energie: number }[];
}

/**
 * Was die Proben ergeben haben.
 *
 * Getrennt nach beiden Fragen. „Du warst gut darin" steht nicht neben
 * „das hat dir Spass gemacht" — es steht darunter, und beide Listen
 * dürfen verschiedene Berufe nennen. Genau darin liegt die Auskunft.
 */
export async function probenbilanz(): Promise<Probenbilanz> {
  const user = await requireUser();
  const db = await getDb();
  const zeilen = await withUser(db, user.id, (tx) =>
    tx
      .select({
        richtig: schema.probendurchlaeufe.richtig,
        energie: schema.probendurchlaeufe.energie,
        titel: schema.aufgabenproben.titel,
        hauptgruppe: schema.aufgabenproben.kldbHauptgruppe,
      })
      .from(schema.probendurchlaeufe)
      .innerJoin(schema.aufgabenproben, eq(schema.aufgabenproben.id, schema.probendurchlaeufe.probeId))
      .where(eq(schema.probendurchlaeufe.userId, user.id))
      .orderBy(desc(schema.probendurchlaeufe.erstelltAm)),
  ).catch(() => []);

  return {
    versuche: zeilen.length,
    richtig: zeilen.filter((z) => z.richtig === true).length,
    gabEnergie: zeilen
      .filter((z) => (z.energie ?? 0) >= 4)
      .map((z) => ({ hauptgruppe: z.hauptgruppe, titel: z.titel, energie: z.energie! })),
    kostenEnergie: zeilen
      .filter((z) => (z.energie ?? 3) <= 2)
      .map((z) => ({ hauptgruppe: z.hauptgruppe, titel: z.titel, energie: z.energie! })),
  };
}

/**
 * Was eine Arbeitsprobe belegt.
 *
 * ── Warum das der Kern des Ganzen ist ─────────────────────────
 *
 * Ein Lebenslauf ist eine unprüfbare Behauptung — deshalb rundet jeder
 * auf, deshalb rechnet jeder den Aufschlag heraus, deshalb wird
 * bestraft, wer ehrlich ist.
 *
 * Eine Arbeitsprobe kann schiefgehen. Genau deshalb bedeutet ein Beleg
 * daraus etwas: Er hat den Menschen etwas gekostet, und er ist
 * überprüfbar. `source_type` kennt `work_sample` seit dem ersten
 * Entwurf — geschrieben hat es nie jemand.
 *
 * ── Warum auch das Misslungene festgehalten wird ──────────────
 *
 * „Hat es dreimal versucht und jedes Mal Energieverlust berichtet" ist
 * eine der wertvollsten Auskünfte überhaupt — zuerst für die Person
 * selbst. Ein Profil, das nur Erfolge sammelt, ist wieder ein
 * Werbedokument.
 *
 * Deshalb: festhalten, aber NICHT teilen. Die Voreinstellung ist nicht
 * geteilt, und wer etwas Unangenehmes zeigt, entscheidet das selbst.
 */
async function belegAusProbe(
  userId: string,
  titel: string,
  richtig: boolean | null,
  energie: number,
  dauerSekunden: number,
): Promise<void> {
  /*
   * Aus einer Textaufgabe folgt gar nichts Beobachtetes.
   *
   * Hier stand zuerst nur eine Ausnahme für den Mittelwert — und damit
   * wäre aus „ich habe an dem Tag gern beraten" ein Beleg der Stufe
   * `beobachtet` geworden. Eine Selbstauskunft, die sich als
   * Beobachtung ausgibt: genau der Fehler, gegen den es diese Stufen
   * gibt.
   *
   * Bei einer Textaufgabe wird nichts bewertet. Es gibt nur die
   * Energieangabe, und die ist eine Aussage über sich selbst. Sie
   * fliesst über `energieInsProfil` in den Verlauf — dort kann sie
   * über Monate zu `berichtet` werden, was sie ehrlich beschreibt.
   */
  if (richtig === null) return;

  const teile: string[] = [];
  if (richtig === true) teile.push("hat sie wie üblich gelöst");
  if (richtig === false) teile.push("hat sie anders gelöst als üblich");
  if (energie >= 4) teile.push("und sagt, sie habe Energie gegeben");
  if (energie <= 2) teile.push("und sagt, sie habe Energie gekostet");
  if (teile.length === 0) return;

  const sekunden = Math.max(1, Math.round(dauerSekunden));
  const aussage = `Arbeitsprobe „${titel}“: ${teile.join(", ")} (${sekunden} ${sekunden === 1 ? "Sekunde" : "Sekunden"}).`;

  try {
    const db = await getDb();
    await withUser(db, userId, (tx) =>
      tx.insert(schema.evidenceItems).values({
        userId,
        /* `result`, nicht `skill`: Beobachtet wurde ein Ergebnis, keine
           Fähigkeit. Aus einer richtigen Antwort folgt nicht, dass
           jemand etwas kann — nur, dass er es hier konnte. */
        type: "result",
        statement: aussage,
        sourceType: "work_sample",
        sourceRef: `probe:${titel}`,
        /*
         * Hohe Zuversicht, weil beobachtet — aber nicht 1: Eine
         * einzelne Aufgabe ist eine einzelne Aufgabe.
         */
        confidence: 0.9,
        /*
         * Bestätigt: Der Mensch hat sie selbst gemacht. Es gibt hier
         * nichts nachzufragen — anders als bei einer Ableitung aus
         * einem Nebensatz.
         */
        userConfirmed: true,
        /* Nicht geteilt. Wer etwas Unangenehmes zeigt, entscheidet selbst. */
        geteilt: false,
      }),
    );
  } catch (e) {
    /* Ein Fehler hier darf den Versuch nicht entwerten. */
    console.error("[belege] Beleg aus Probe nicht erfasst:", e);
  }
}
