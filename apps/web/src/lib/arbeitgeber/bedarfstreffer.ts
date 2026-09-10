"use server";

import { and, desc, eq, isNull, ne, sql } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";
import { computeFit } from "@paycheck/matching";
import {
  JobSchema,
  darfGesuchtWerden,
  bedingungPruefen,
  grundlageAus,
  istVeraltet,
  offeneTrefferpunkte,
  trefferlage,
  type Bedarfskandidat,
  type Bedingungslage,
  type Ebene,
  type Job,
  type Loesungsart,
  type Trefferlage,
} from "@paycheck/domain";
import { loadProfileContext } from "@/lib/matching";
import { protokolliere, verlangeRolle } from "./zugang";

/**
 * ══════════════════════════════════════════════════════════════════
 * Passende Menschen zu einem freigegebenen Bedarf
 * ══════════════════════════════════════════════════════════════════
 *
 * ── Wer überhaupt geprüft wird ──────────────────────────────────
 *
 * Nur Konten mit `user_settings.auffindbar = true` — dieselbe Menge
 * wie im Vorschlagslauf zu einer Stelle, und aus demselben Grund: Wer
 * nicht zugestimmt hat, wird nicht bewertet. Nicht „bewertet, aber
 * nicht angezeigt": Eine Bewertung, die entsteht und dann verworfen
 * wird, ist trotzdem entstanden.
 *
 * Ein registriertes Konto ist kein Kandidatenpool.
 *
 * ── Warum gegen das Angebot gerechnet wird, nicht gegen den Vorgang
 *
 * Ein Vorgang trägt eine Lage in eigenen Worten und einen gewählten
 * Weg — keine Rolle, keinen Ort, keine Konditionen. Menschen dagegen
 * zu rechnen ergäbe eine Zahl aus fast nichts, mit einer Abdeckung
 * nahe null, und die sähe trotzdem aus wie eine Passung.
 *
 * Deshalb steht dazwischen ein Angebot, das ein Mensch beschrieben
 * hat. Fehlt es, ist die Suche gesperrt — mit dem Satz, was zu tun
 * ist, statt mit einer leeren Liste.
 *
 * ── Was diese Vorschau NICHT tut ────────────────────────────────
 *
 * Sie schickt nichts hinaus. Kein Mensch erfährt von ihr, kein
 * Firmenname geht an jemanden, und keine Gehaltsuntergrenze einer
 * Person kommt beim Betrieb an — auch dann nicht, wenn sie passt.
 */

/** Wie viele Auffindbare eine Suche höchstens durchgeht. */
const PRUEFGRENZE = 500;

interface Angebotsdaten {
  id: string;
  rollenprofil: { rolle?: string | null; anforderungen?: string[] };
  konditionen: {
    gehaltVon?: number | null;
    gehaltBis?: number | null;
    arbeitszeit?: string | null;
    ort?: string | null;
    befristung?: string | null;
  };
  anonymBeschreibung: string;
  aktualisiertAm: Date;
}

/**
 * Aus dem Angebot wird ein `Job` für dieselbe Rechnung wie überall.
 *
 * Vieles bleibt `null` — Koordinaten, Sprachen, Lizenzen. Das ist
 * richtig: `computeFit` behandelt Unbekanntes als neutral und senkt
 * dafür die Abdeckung. Etwas zu erraten, damit die Zahl vollständiger
 * aussieht, hiesse die Datenbasis zu fälschen.
 */
function alsJob(a: Angebotsdaten): Job {
  return JobSchema.parse({
    id: a.id,
    title: a.rollenprofil.rolle ?? "",
    companyId: null,
    /* Vor dem Aufdecken ein Umriss, nie ein Name. */
    companyName: a.anonymBeschreibung,
    location: a.konditionen.ort ?? null,
    country: "DE",
    latitude: null,
    longitude: null,
    workModel: "unknown",
    remotePercent: null,
    salary: {
      min: a.konditionen.gehaltVon ?? null,
      max: a.konditionen.gehaltBis ?? null,
      currency: "EUR",
      /* Ein Angebot nennt den Monatsbetrag. Siehe `wunschprofil.ts`. */
      period: "month",
      source: "employer_stated",
    },
    contractType: null,
    weeklyHours: null,
    shiftWork: null,
    travelPercent: null,
    experienceLevel: null,
    industry: null,
    languageRequirements: {},
    requiredLicenses: [],
    workPermitRequired: null,
    coreTasks: a.rollenprofil.anforderungen ?? [],
    description: a.anonymBeschreibung,
  });
}

/**
 * Die harten Bedingungen dieses Angebots gegen eine Person.
 *
 * Drei, und alle drei enden oft auf `unbekannt`. Das ist keine Schwäche
 * der Prüfung, sondern die Datenlage — und sie als offenen Punkt zu
 * zeigen ist die einzige ehrliche Art, damit umzugehen.
 */
function bedingungen(
  a: Angebotsdaten,
  ort: string | null,
  land: string | null,
): Bedingungslage[] {
  const gleichOrt = (verlangt: string | number, vorhanden: string | number) =>
    String(verlangt).trim().toLowerCase() === String(vorhanden).trim().toLowerCase();

  return [
    bedingungPruefen("Arbeitsort", a.konditionen.ort ?? null, ort, gleichOrt),
    bedingungPruefen("Land", "DE", land, gleichOrt),
    bedingungPruefen(
      "Arbeitszeit",
      a.konditionen.arbeitszeit ?? null,
      /* Die Person hat dazu heute nichts Strukturiertes hinterlegt. */
      null,
      () => true,
    ),
  ];
}

export interface Trefferansicht {
  lage: Trefferlage;
  /** Ob seit dem Lauf etwas passiert ist, das ihn überholt. */
  veraltet: boolean;
  gelaufenAm: Date | null;
}

/**
 * Die Suche ausführen.
 *
 * Schreibt nach `bedarfstreffer` — eine interne Vorschau. Ein zweiter
 * Lauf aktualisiert dieselben Zeilen, er verdoppelt sie nicht.
 */
export async function trefferSuchen(orgId: string, vorgangId: string): Promise<Trefferlage> {
  const { user } = await verlangeRolle(orgId, "admin");
  const db = await getDb();

  const [v] = await withUser(db, user.id, (tx) =>
    tx
      .select({
        ebene: schema.bedarfsvorgaenge.ebene,
        weg: schema.bedarfsvorgaenge.weg,
        angebotId: schema.bedarfsvorgaenge.angebotId,
        aktualisiertAm: schema.bedarfsvorgaenge.aktualisiertAm,
      })
      .from(schema.bedarfsvorgaenge)
      .where(
        and(
          eq(schema.bedarfsvorgaenge.id, vorgangId),
          eq(schema.bedarfsvorgaenge.organizationId, orgId),
        ),
      )
      .limit(1),
  );
  if (!v) return { art: "gesperrt", grund: "Diesen Vorgang gibt es nicht." };

  const darf = darfGesuchtWerden(v.ebene as Ebene, v.weg as Loesungsart | null);
  if (!darf.ja) return { art: "gesperrt", grund: darf.grund };

  if (v.angebotId === null) {
    return {
      art: "gesperrt",
      grund:
        "Zu diesem Bedarf ist noch keine Rolle beschrieben. Ohne Rolle, Ort und Konditionen wäre jede Passung eine Zahl aus fast nichts.",
    };
  }

  /* Erst in eine Konstante, dann in den Rückruf: In einem Rückruf
     ist die Einengung von oben nicht mehr gültig. */
  const angebotId = v.angebotId;

  const [a] = await withUser(db, user.id, (tx) =>
    tx
      .select({
        id: schema.angebote.id,
        rollenprofil: schema.angebote.rollenprofil,
        konditionen: schema.angebote.konditionen,
        anonymBeschreibung: schema.angebote.anonymBeschreibung,
        aktualisiertAm: schema.angebote.aktualisiertAm,
      })
      .from(schema.angebote)
      .where(and(eq(schema.angebote.id, angebotId), eq(schema.angebote.organizationId, orgId)))
      .limit(1),
  );
  if (!a) return { art: "gesperrt", grund: "Das verknüpfte Angebot gibt es nicht mehr." };

  const angebot = a as unknown as Angebotsdaten;
  const job = alsJob(angebot);

  /*
   * Die Menge der Auffindbaren — dieselbe Bedingung wie im
   * Vorschlagslauf zu einer Stelle.
   */
  const auffindbare = await db
    .select({ userId: schema.userSettings.userId })
    .from(schema.userSettings)
    .innerJoin(schema.users, eq(schema.users.id, schema.userSettings.userId))
    .where(
      and(
        eq(schema.userSettings.auffindbar, true),
        isNull(schema.users.deletedAt),
        ne(schema.users.id, user.id),
      ),
    )
    .limit(PRUEFGRENZE);

  const kandidaten: Bedarfskandidat[] = [];
  for (const k of auffindbare) {
    const ctx = await loadProfileContext(k.userId).catch(() => null);
    if (!ctx) continue;

    const fit = computeFit({
      job,
      requirements: [],
      evidence: ctx.evidence,
      constraints: ctx.constraints,
      energisingTasks: ctx.energisingTasks,
      drainingTasks: ctx.drainingTasks,
      workStylePreferences: ctx.workStylePreferences,
      rankedValues: ctx.rankedValues,
      statedInterests: ctx.statedInterests,
    });

    kandidaten.push({
      userId: k.userId,
      passung: fit.score,
      abdeckung: fit.coverage,
      bedingungen: bedingungen(angebot, ctx.constraints.baseLocation, ctx.constraints.country),
      /*
       * Nur, was der Mensch zur Weitergabe freigegeben hat.
       * `nachweise.geteilt` ist die einzige Quelle dafür — ein Beleg,
       * den er nicht geteilt hat, gehört hier nicht hin.
       */
      freigegebeneNachweise: await geteilteNachweise(k.userId),
    });
  }

  const lage = trefferlage(
    v.ebene as Ebene,
    v.weg as Loesungsart | null,
    kandidaten,
    auffindbare.length,
  );

  if (lage.art === "vorschlaege") {
    const grundlage = grundlageAus({
      bedarfStand: v.aktualisiertAm.toISOString(),
      profilStand: angebot.aktualisiertAm.toISOString(),
      nachweisStand: String(lage.kandidaten.length),
    });

    for (const k of lage.kandidaten) {
      await withUser(db, user.id, (tx) =>
        tx
          .insert(schema.bedarfstreffer)
          .values({
            organizationId: orgId,
            vorgangId,
            userId: k.userId,
            passung: k.passung,
            abdeckung: k.abdeckung,
            bedingungen: [...k.bedingungen],
            offenePunkte: offeneTrefferpunkte(k),
            freigegebeneNachweise: [...k.freigegebeneNachweise],
            grundlage,
          })
          .onConflictDoUpdate({
            target: [schema.bedarfstreffer.vorgangId, schema.bedarfstreffer.userId],
            set: {
              passung: k.passung,
              abdeckung: k.abdeckung,
              bedingungen: [...k.bedingungen],
              offenePunkte: offeneTrefferpunkte(k),
              freigegebeneNachweise: [...k.freigegebeneNachweise],
              grundlage,
              aktualisiertAm: new Date(),
            },
          }),
      );
    }
  }

  await protokolliere(user.id, orgId, "bedarfstreffer_gesucht", vorgangId, {
    geprueft: auffindbare.length,
    gefunden: lage.art === "vorschlaege" ? lage.kandidaten.length : 0,
  });

  return lage;
}

/** Die Nachweise, die dieser Mensch ausdrücklich weitergegeben hat. */
async function geteilteNachweise(userId: string): Promise<string[]> {
  const db = await getDb();
  const zeilen = await withUser(db, userId, (tx) =>
    tx
      .select({ taetigkeit: schema.nachweise.taetigkeit })
      .from(schema.nachweise)
      .where(and(eq(schema.nachweise.userId, userId), eq(schema.nachweise.geteilt, true)))
      .limit(5),
  ).catch(() => []);
  return zeilen.map((z) => z.taetigkeit);
}

/** Was zuletzt gefunden wurde — ohne neu zu rechnen. */
export async function trefferLesen(
  orgId: string,
  vorgangId: string,
): Promise<{ zeilen: { userId: string; passung: number | null; offenePunkte: string[]; veraltet: boolean }[] }> {
  const { user } = await verlangeRolle(orgId, "viewer");
  const db = await getDb();

  const [v] = await withUser(db, user.id, (tx) =>
    tx
      .select({ aktualisiertAm: schema.bedarfsvorgaenge.aktualisiertAm })
      .from(schema.bedarfsvorgaenge)
      .where(eq(schema.bedarfsvorgaenge.id, vorgangId))
      .limit(1),
  );

  const zeilen = await withUser(db, user.id, (tx) =>
    tx
      .select({
        userId: schema.bedarfstreffer.userId,
        passung: schema.bedarfstreffer.passung,
        offenePunkte: schema.bedarfstreffer.offenePunkte,
        grundlage: schema.bedarfstreffer.grundlage,
      })
      .from(schema.bedarfstreffer)
      .where(
        sql`${schema.bedarfstreffer.vorgangId} = ${vorgangId} and ${schema.bedarfstreffer.organizationId} = ${orgId}`,
      )
      .orderBy(desc(schema.bedarfstreffer.passung))
      .limit(5),
  );

  return {
    zeilen: zeilen.map((z) => ({
      userId: z.userId,
      passung: z.passung,
      offenePunkte: z.offenePunkte ?? [],
      /*
       * Der Bedarfsstand steckt im Fingerabdruck. Hat sich der Vorgang
       * seither geändert, ist der Vorschlag keine Aussage über heute.
       */
      veraltet: v ? istVeraltet(z.grundlage.split("|")[0] ?? "", v.aktualisiertAm.toISOString()) : false,
    })),
  };
}
