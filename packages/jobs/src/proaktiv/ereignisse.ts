import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { schema, withUser, type Database } from "@paycheck/db";
import {
  ereignisBekannt,
  type Ereignis,
  type Stellenangabenkurz,
  type Urheber,
} from "@paycheck/matching";

/**
 * Ereignisse aufnehmen und wieder herausgeben.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum die Aufnahme so streng ist
 * ══════════════════════════════════════════════════════════════
 *
 * Der Ereignisstrom kommt aus dem Browser. Alles darin ist das, was
 * jemand schicken will — nicht das, was tatsächlich passiert ist.
 *
 * Eine unbekannte Ereignisart würde als Schlüssel in der Tabelle
 * landen, den nie jemand auswertet; ein freier Text im Kontext würde
 * Angaben über die Person an einem Ort ablegen, der schnell wächst
 * und selten gelesen wird. Beides fällt hier heraus.
 */

/**
 * Ereignisse, die schon eine Tabelle haben.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum es zwei Tabellen gibt und keine dritte Wahrheit
 * ══════════════════════════════════════════════════════════════
 *
 * `application_events` zeichnet seit Langem auf, wann jemand eine
 * Stelle geöffnet, gemerkt oder eine Bewerbung begonnen hat — 581
 * Aufrufe von 275 Menschen, Stand 6. September 2026. Daran hängen
 * die Trichterdiagnose, die Arbeitsprobenseite und der
 * Datenschutzexport.
 *
 * Die erste Fassung dieses Moduls schrieb `job_viewed` ein zweites
 * Mal in `nutzer_ereignisse`. Zwei Aufzeichnungen desselben Klicks —
 * und irgendwann weichen sie voneinander ab, ohne dass jemand sagen
 * kann, welche stimmt.
 *
 * Jetzt gilt: Was der Trichter führt, führt der Trichter. Was neu
 * ist — Verweildauer, aufgeklappte Abschnitte —, steht in
 * `nutzer_ereignisse`. Ein Ereignis, eine Zeile, ein Ort.
 *
 * Der Nebengewinn: Die 581 bestehenden Aufrufe zählen sofort mit.
 */
const IM_TRICHTER = new Set(["job_viewed", "job_saved", "apply_started"]);

/** Wie die Ereignisart im Trichter heisst. */
const TRICHTERNAME: Record<string, string> = {
  job_viewed: "job_viewed",
  job_saved: "job_saved",
  apply_started: "application_started",
};

/** Wie viel Kontext ein Ereignis tragen darf. */
const KONTEXT_FELDER_MAX = 8;
const KONTEXT_TEXT_MAX = 64;

export interface Ereignismeldung {
  art: string;
  jobId?: string | null;
  auftragId?: string | null;
  sitzungId?: string | null;
  geschehenAm?: Date;
  kontext?: Record<string, unknown>;
  quelle?: "app" | "voice";
  /**
   * Wer es ausgelöst hat. Grundwert `user`.
   *
   * Der Endpunkt setzt ihn nie aus dem Rumpf: Sonst könnte eine
   * Meldung sich selbst als Nutzerhandlung ausgeben und damit ein
   * Signal verstärken, das niemand gesetzt hat.
   */
  urheber?: Urheber;
}

export type Aufnahmebefund =
  | { ok: true; id: string; neu: boolean }
  | { ok: false; grund: "unbekannte_art" | "ohne_bezug" };

/**
 * Kontext auf das reduzieren, was ein Ereignis tragen darf.
 *
 * ── Warum lange Texte gekürzt und nicht abgewiesen werden ─────
 *
 * Weil ein abgewiesenes Ereignis eine Lücke in der Beobachtung
 * hinterlässt, ein gekürzter Kontext aber nur eine ungenauere. Von
 * zwei Fehlern der kleinere.
 */
function kontextSaeubern(roh: Record<string, unknown> | undefined): Record<string, string | number | boolean> {
  const raus: Record<string, string | number | boolean> = {};
  if (!roh) return raus;
  for (const [k, v] of Object.entries(roh)) {
    if (Object.keys(raus).length >= KONTEXT_FELDER_MAX) break;
    if (typeof v === "number" && Number.isFinite(v)) raus[k] = v;
    else if (typeof v === "boolean") raus[k] = v;
    else if (typeof v === "string") raus[k] = v.slice(0, KONTEXT_TEXT_MAX);
  }
  return raus;
}

/**
 * Der Schlüssel, der Doppelmeldungen abfängt.
 *
 * Art, Stelle und angefangene Minute. Bewusst grob: Feiner wäre
 * genauer und liesse denselben Klick über zwei offene Tabs wieder
 * durch — und genau der ist der Fall, den es zu fangen gilt.
 */
export function ereignisSchluessel(m: Ereignismeldung, geschehenAm: Date): string {
  const minute = Math.floor(geschehenAm.getTime() / 60_000);
  return `${m.art}|${m.jobId ?? ""}|${minute}`;
}

export async function ereignisAufnehmen(
  db: Database,
  userId: string,
  meldung: Ereignismeldung,
): Promise<Aufnahmebefund> {
  if (!ereignisBekannt(meldung.art)) return { ok: false, grund: "unbekannte_art" };

  /*
   * Ein Ereignis ohne Bezug ist keins.
   *
   * `search_changed` und `filter_changed` betreffen keine einzelne
   * Stelle; alles andere braucht eine. Ohne diesen Zweig entstünden
   * Zeilen, die nichts beobachten und trotzdem gezählt werden.
   */
  const ohneStelle = meldung.art === "search_changed" || meldung.art === "filter_changed";
  if (!ohneStelle && !meldung.jobId) return { ok: false, grund: "ohne_bezug" };

  const geschehenAm = meldung.geschehenAm ?? new Date();
  const schluessel = ereignisSchluessel(meldung, geschehenAm);
  const urheber = meldung.urheber ?? "user";

  /*
   * Was der Trichter führt, führt der Trichter.
   *
   * ── Warum nur, was die Person selbst tat ────────────────────
   *
   * `application_events` ist die Aufzeichnung von Meilensteinen einer
   * Bewerbung. Eine Handlung Mondays gehört dort nicht hinein — sonst
   * stünde in der Trichterdiagnose ein Aufruf, den niemand gemacht
   * hat.
   */
  if (IM_TRICHTER.has(meldung.art) && urheber === "user" && meldung.jobId) {
    return trichterEreignis(db, userId, meldung, geschehenAm);
  }

  return withUser(db, userId, async (tx) => {
    const [zeile] = await tx
      .insert(schema.nutzerEreignisse)
      .values({
        userId,
        art: meldung.art,
        jobId: meldung.jobId ?? null,
        auftragId: meldung.auftragId ?? null,
        sitzungId: meldung.sitzungId ?? null,
        geschehenAm,
        kontext: kontextSaeubern(meldung.kontext),
        quelle: meldung.quelle ?? "app",
        urheber: meldung.urheber ?? "user",
        ereignisSchluessel: schluessel,
      })
      /* Zwei Tabs, ein Klick — die zweite Meldung fällt hier heraus. */
      .onConflictDoNothing()
      .returning({ id: schema.nutzerEreignisse.id });

    if (zeile) return { ok: true as const, id: zeile.id, neu: true };

    const [vorhanden] = await tx
      .select({ id: schema.nutzerEreignisse.id })
      .from(schema.nutzerEreignisse)
      .where(
        and(
          eq(schema.nutzerEreignisse.userId, userId),
          eq(schema.nutzerEreignisse.ereignisSchluessel, schluessel),
        ),
      )
      .limit(1);
    return { ok: true as const, id: vorhanden!.id, neu: false };
  });
}

/**
 * Ein Meilenstein in die bestehende Trichtertabelle.
 *
 * ── Warum die Entdopplung hier von Hand geschieht ─────────────
 *
 * `application_events` hat keinen Schlüssel gegen Doppelmeldungen —
 * sie entstand für Meilensteine, die je Bewerbung einmal vorkommen.
 * Zwei offene Tabs melden denselben Aufruf trotzdem zweimal, und
 * daraus würde ein „mehrfach geöffnet", das niemand getan hat.
 *
 * Statt die bestehende Tabelle umzubauen — daran hängen drei Leser —
 * wird hier nachgesehen, ob in derselben Minute schon eine gleiche
 * Zeile steht.
 */
async function trichterEreignis(
  db: Database,
  userId: string,
  meldung: Ereignismeldung,
  geschehenAm: Date,
): Promise<Aufnahmebefund> {
  const art = TRICHTERNAME[meldung.art]!;
  const minuteAb = new Date(Math.floor(geschehenAm.getTime() / 60_000) * 60_000);
  const minuteBis = new Date(minuteAb.getTime() + 60_000);

  return withUser(db, userId, async (tx) => {
    const [vorhanden] = await tx
      .select({ id: schema.applicationEvents.id })
      .from(schema.applicationEvents)
      .where(
        and(
          eq(schema.applicationEvents.userId, userId),
          eq(schema.applicationEvents.jobId, meldung.jobId!),
          eq(schema.applicationEvents.type, art as "job_viewed"),
          gte(schema.applicationEvents.occurredAt, minuteAb),
          lt(schema.applicationEvents.occurredAt, minuteBis),
        ),
      )
      .limit(1);

    if (vorhanden) return { ok: true as const, id: vorhanden.id, neu: false };

    const [zeile] = await tx
      .insert(schema.applicationEvents)
      .values({
        userId,
        jobId: meldung.jobId!,
        type: art as "job_viewed",
        occurredAt: geschehenAm,
      })
      .returning({ id: schema.applicationEvents.id });

    return { ok: true as const, id: zeile!.id, neu: true };
  });
}

/**
 * Wie weit Monday zurückblickt.
 *
 * Vierzehn Tage ist eine Produktentscheidung, kein Messwert — dieselbe
 * Spanne, nach der ein abgeleitetes Signal verfällt. Länger
 * zurückzublicken hiesse, Menschen an ihrer Vergangenheit
 * festzuhalten.
 */
export const RUECKBLICK_TAGE = 14;

export async function ereignisseLaden(
  db: Database,
  userId: string,
  jetzt: Date,
  tage = RUECKBLICK_TAGE,
): Promise<Ereignis[]> {
  const seit = new Date(jetzt.getTime() - tage * 24 * 60 * 60 * 1000);
  const [eigene, trichter] = await withUser(db, userId, (tx) =>
    Promise.all([
      tx
        .select()
        .from(schema.nutzerEreignisse)
        .where(
          and(
            eq(schema.nutzerEreignisse.userId, userId),
            gte(schema.nutzerEreignisse.geschehenAm, seit),
          ),
        )
        .orderBy(desc(schema.nutzerEreignisse.geschehenAm))
        .limit(2000),
      /*
       * Die Meilensteine aus der bestehenden Tabelle.
       *
       * Sie tragen keinen Urheber — sie entstehen ausschliesslich aus
       * einer Handlung der Person, und genau das bedeutet `user`.
       */
      tx
        .select()
        .from(schema.applicationEvents)
        .where(
          and(
            eq(schema.applicationEvents.userId, userId),
            gte(schema.applicationEvents.occurredAt, seit),
            inArray(schema.applicationEvents.type, [
              "job_viewed",
              "job_saved",
              "application_started",
            ]),
          ),
        )
        .orderBy(desc(schema.applicationEvents.occurredAt))
        .limit(2000),
    ]),
  );

  const ausTrichter: Ereignis[] = trichter
    .filter((z) => z.jobId !== null)
    .map((z) => ({
      id: z.id,
      art: (z.type === "application_started" ? "apply_started" : z.type) as Ereignis["art"],
      urheber: "user" as const,
      jobId: z.jobId,
      auftragId: null,
      sitzungId: null,
      geschehenAm: z.occurredAt,
      kontext: {},
    }));

  const eigeneEreignisse: Ereignis[] = eigene.map((z) => ({
    id: z.id,
    art: z.art as Ereignis["art"],
    urheber: (z.urheber as Urheber) ?? "user",
    jobId: z.jobId,
    auftragId: z.auftragId,
    sitzungId: z.sitzungId,
    geschehenAm: z.geschehenAm,
    kontext: z.kontext,
  }));

  return [...eigeneEreignisse, ...ausTrichter].sort(
    (a, b) => b.geschehenAm.getTime() - a.geschehenAm.getTime(),
  );
}

/** Welche der Stellen vollständig ortsunabhängig sind. */
export async function remoteMerkmale(
  db: Database,
  jobIds: readonly string[],
): Promise<Map<string, boolean | null>> {
  const karte = new Map<string, boolean | null>();
  const eindeutig = [...new Set(jobIds.filter(Boolean))];
  if (eindeutig.length === 0) return karte;

  const zeilen = (await db.execute(sql`
    select id, work_model, remote_percent
    from jobs
    where id in (select value::uuid from jsonb_array_elements_text(${JSON.stringify(eindeutig)}::jsonb))
  `)) as unknown as { rows: Record<string, unknown>[] };

  for (const z of zeilen.rows) {
    const modell = z.work_model === null ? null : String(z.work_model);
    /*
     * `null` heisst unbekannt und bleibt unbekannt.
     *
     * Eine Anzeige ohne Angabe zum Arbeitsmodell als „nicht remote"
     * zu zählen wäre eine Zustimmung aus fehlenden Angaben.
     */
    karte.set(
      String(z.id),
      modell === null ? null : modell === "remote" || z.remote_percent === 100,
    );
  }
  return karte;
}

/* ═══════════════════════════════════════════════════════════════
   Der gemeldete Zeitpunkt
   ═══════════════════════════════════════════════════════════════ */

/** Wie weit ein gemeldeter Zeitpunkt zurückliegen darf. */
export const MELDUNG_MAX_ALTER_MS = 24 * 60 * 60 * 1000;

/** Wieviel Uhrenversatz nach vorn geduldet wird. */
export const MELDUNG_VORLAUF_MS = 60_000;

/**
 * Den Zeitpunkt aus der Meldung übernehmen — oder die Serverzeit.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum der Browser überhaupt einen Zeitpunkt schicken darf
 * ══════════════════════════════════════════════════════════════
 *
 * Weil gebündelt wird. Ein Ereignis von vor vier Sekunden käme sonst
 * mit der Ankunftszeit des Stapels an, und drei Klicks in einer
 * Sekunde sähen aus wie drei gleichzeitige — was die Entdopplung
 * fälschlich als einen zählt.
 *
 * ══════════════════════════════════════════════════════════════
 * Und warum er ihn nicht frei wählen darf
 * ══════════════════════════════════════════════════════════════
 *
 * Ein Zeitpunkt aus der Zukunft bliebe für immer im Rückblickfenster
 * und zählte jeden Tag erneut — aus einem Klick würde dauerhaftes
 * Interesse. Einer von vor einem Jahr weckte eine alte Sitzung wieder
 * auf.
 *
 * Die Uhr im Browser geht oft ein paar Sekunden falsch; eine Minute
 * Vorlauf deckt das ab, ohne die Zukunft zu öffnen.
 */
export function gemeldeterZeitpunkt(roh: unknown, jetzt: Date): Date {
  if (typeof roh !== "string") return jetzt;
  const gemeldet = new Date(roh);
  if (Number.isNaN(gemeldet.getTime())) return jetzt;
  if (gemeldet.getTime() > jetzt.getTime() + MELDUNG_VORLAUF_MS) return jetzt;
  if (gemeldet.getTime() < jetzt.getTime() - MELDUNG_MAX_ALTER_MS) return jetzt;
  return gemeldet;
}

/**
 * Die Angaben, die ein Vergleich und die offenen Fragen brauchen.
 *
 * ── Warum nicht die ganze Stellenzeile ────────────────────────
 *
 * Weil der Fliesstext bei drei Stellen nichts wiegt und bei
 * dreihundert alles. Hier zählen die strukturierten Felder — und
 * genau die, aus denen sich eine Frage oder ein Unterschied ergibt.
 */
export async function stellenangabenKurz(
  db: Database,
  jobIds: readonly string[],
): Promise<Map<string, Stellenangabenkurz>> {
  const karte = new Map<string, Stellenangabenkurz>();
  const eindeutig = [...new Set(jobIds.filter(Boolean))];
  if (eindeutig.length === 0) return karte;

  const zeilen = (await db.execute(sql`
    select j.id, j.title, j.location, j.salary_min, j.salary_max, j.salary_disclosed,
           j.contract_type, j.weekly_hours, j.work_model, j.remote_percent,
           j.shift_work, j.experience_level, c.name as arbeitgeber
      from jobs j
 left join companies c on c.id = j.company_id
     where j.id in (select value::uuid from jsonb_array_elements_text(${JSON.stringify(eindeutig)}::jsonb))
  `)) as unknown as { rows: Record<string, unknown>[] };

  const zahl = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  const wort = (v: unknown) => (v === null || v === undefined ? null : String(v));

  for (const z of zeilen.rows) {
    karte.set(String(z.id), {
      jobId: String(z.id),
      titel: String(z.title),
      arbeitgeber: wort(z.arbeitgeber),
      ort: wort(z.location),
      /* Die Entfernung hängt am Suchauftrag, nicht an der Stelle. */
      entfernungKm: null,
      gehaltMin: zahl(z.salary_min),
      gehaltMax: zahl(z.salary_max),
      gehaltGenannt: z.salary_disclosed === true,
      vertragsform: wort(z.contract_type),
      wochenstunden: zahl(z.weekly_hours),
      arbeitsmodell: wort(z.work_model),
      remoteAnteil: zahl(z.remote_percent),
      /* `null` bleibt `null` — eine Anzeige ohne Angabe sagt nicht „nein". */
      schichtarbeit: z.shift_work === null || z.shift_work === undefined ? null : Boolean(z.shift_work),
      erfahrungsniveau: wort(z.experience_level),
    });
  }
  return karte;
}
