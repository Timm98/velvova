"use server";

import { and, desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema, withUser } from "@paycheck/db";
import { computeContentHash, leistungsnamen } from "@paycheck/jobs";
import { beschreibungsTokens } from "@paycheck/matching";
import { requireUser } from "@/lib/auth";
import { protokolliere, verlangeRolle, verlangeStelle } from "./zugang.ts";
import { pruefeAnzeige } from "./anzeigenpruefung.ts";

/**
 * Stellen, die ein Arbeitgeber selbst einstellt.
 *
 * ── Warum ein Entwurf kein Job ist ────────────────────────────
 *
 * Eine Anzeige entsteht hier als `job_postings`-Zeile und ist für
 * niemanden ausserhalb der Organisation sichtbar. Erst beim
 * Veröffentlichen entsteht daneben eine Zeile in `jobs` — der Tabelle,
 * aus der die Stellensuche liest.
 *
 * Der Unterschied ist wichtiger, als er klingt: Ein Entwurf enthält oft
 * Platzhalter, ein falsches Gehalt, den Firmennamen des Kunden. Wäre er
 * von Anfang an ein Job, stünde all das im Index — und ein Index, aus
 * dem man Anzeigen wieder herausnehmen muss, ist ein Index, dem niemand
 * traut.
 *
 * ── Warum nur bestätigte Organisationen veröffentlichen ───────
 *
 * Sonst könnte jeder eine Organisation „Siemens AG" nennen und in deren
 * Namen Stellen ausschreiben. Menschen bewerben sich darauf und
 * schicken ihre Unterlagen an jemanden, den sie für diesen Arbeitgeber
 * halten. Das ist kein Randfall, sondern das erste, was jemand
 * versuchen wird.
 */

export interface Stellenwerte {
  title: string;
  location: string;
  country: string;
  workModel: string | null;
  contractType: string | null;
  weeklyHours: number | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  salaryPeriod: string;
  description: string;

  /*
   * Die erweiterten Angaben.
   *
   * Alle optional: Eine Anzeige entsteht in mehreren Anläufen, und ein
   * Entwurf, den man nicht speichern kann, wird nicht fertig. Was
   * fehlt, meldet `pruefeAnzeige` — und blockiert dort, wo es muss.
   */
  team: string | null;
  bereich: string | null;
  starttermin: string | null;
  aufgaben: string | null;
  mussFaehigkeiten: string[];
  kannFaehigkeiten: string[];
  gewuenschteErfahrung: string | null;
  arbeitssprache: string | null;
  reiseanteil: string | null;
  verantwortungsumfang: string | null;
  berichtslinie: string | null;
  interviewablauf: string | null;
  antwortzeit: string | null;
  kontaktperson: string | null;
}

function bereinige(w: Partial<Stellenwerte>): Partial<Stellenwerte> {
  const zahl = (v: unknown): number | null => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(String(v).replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
  };
  return {
    ...(w.title !== undefined ? { title: w.title.trim().slice(0, 200) } : {}),
    ...(w.location !== undefined ? { location: w.location.trim().slice(0, 160) } : {}),
    ...(w.country !== undefined ? { country: (w.country.trim() || "DE").slice(0, 2).toUpperCase() } : {}),
    ...(w.workModel !== undefined ? { workModel: w.workModel || null } : {}),
    ...(w.contractType !== undefined ? { contractType: w.contractType || null } : {}),
    ...(w.weeklyHours !== undefined ? { weeklyHours: zahl(w.weeklyHours) } : {}),
    ...(w.salaryMin !== undefined ? { salaryMin: zahl(w.salaryMin) } : {}),
    ...(w.salaryMax !== undefined ? { salaryMax: zahl(w.salaryMax) } : {}),
    ...(w.salaryCurrency !== undefined ? { salaryCurrency: w.salaryCurrency || "EUR" } : {}),
    ...(w.salaryPeriod !== undefined ? { salaryPeriod: w.salaryPeriod || "year" } : {}),
    ...(w.description !== undefined ? { description: w.description.slice(0, 40_000) } : {}),

    /*
     * Die erweiterten Felder gehen durch dieselbe Bereinigung wie die
     * alten: getrimmt, begrenzt, leer wird `null`.
     *
     * `""` und `null` sind hier nicht dasselbe: Ein leerer String
     * sähe in der Datenbank aus wie eine gemachte Angabe, und die
     * Anzeigenprüfung fände nichts zu beanstanden.
     */
    ...text(w, "team", 120),
    ...text(w, "bereich", 120),
    ...text(w, "starttermin", 120),
    ...text(w, "aufgaben", 8000),
    ...text(w, "gewuenschteErfahrung", 2000),
    ...text(w, "arbeitssprache", 200),
    ...text(w, "reiseanteil", 200),
    ...text(w, "verantwortungsumfang", 2000),
    ...text(w, "berichtslinie", 300),
    ...text(w, "interviewablauf", 4000),
    ...text(w, "antwortzeit", 200),
    ...text(w, "kontaktperson", 200),

    ...(w.mussFaehigkeiten !== undefined ? { mussFaehigkeiten: liste(w.mussFaehigkeiten) } : {}),
    ...(w.kannFaehigkeiten !== undefined ? { kannFaehigkeiten: liste(w.kannFaehigkeiten) } : {}),
  };
}

/** Ein Textfeld: getrimmt, begrenzt, leer wird `null`. */
function text(
  w: Partial<Stellenwerte>,
  feld: keyof Stellenwerte,
  laenge: number,
): Partial<Stellenwerte> {
  const wert = w[feld];
  if (wert === undefined) return {};
  const t = typeof wert === "string" ? wert.trim().slice(0, laenge) : "";
  return { [feld]: t.length > 0 ? t : null } as Partial<Stellenwerte>;
}

/**
 * Eine Fähigkeitenliste.
 *
 * Leere Einträge fallen weg, Dubletten auch — sonst steht dieselbe
 * Anforderung zweimal in der Liste und zählt in der Prüfung doppelt.
 * Zwanzig ist die Obergrenze: Wer mehr braucht, beschreibt keine
 * Stelle mehr.
 */
function liste(werte: unknown): string[] {
  if (!Array.isArray(werte)) return [];
  const sauber = werte
    .map((w) => (typeof w === "string" ? w.trim().slice(0, 120) : ""))
    .filter((w) => w.length > 0);
  return [...new Set(sauber)].slice(0, 20);
}

export async function stelleAnlegen(
  orgId: string,
  titel: string,
): Promise<{ ok: boolean; text: string; id?: string }> {
  const { user } = await verlangeRolle(orgId, "recruiter");
  const sauber = titel.trim().slice(0, 200);
  if (sauber.length < 3) return { ok: false, text: "Der Titel braucht mindestens drei Zeichen." };

  const db = await getDb();
  const [z] = await withUser(db, user.id, (tx) =>
    tx
      .insert(schema.jobPostings)
      .values({ organizationId: orgId, createdBy: user.id, title: sauber })
      .returning({ id: schema.jobPostings.id }),
  );
  await protokolliere(user.id, orgId, "stelle_angelegt", z!.id, { titel: sauber });
  revalidatePath("/business/stellen");
  return { ok: true, text: "Entwurf angelegt.", id: z!.id };
}

export async function stelleSpeichern(
  orgId: string,
  postingId: string,
  werte: Partial<Stellenwerte>,
): Promise<{ ok: boolean; text: string }> {
  const { user } = await verlangeRolle(orgId, "recruiter");
  await verlangeStelle(user.id, orgId, postingId);

  const db = await getDb();
  const sauber = bereinige(werte);
  /*
   * Die Leistungen werden aus dem Text gelesen, nicht abgefragt.
   *
   * Derselbe Erkenner wie bei fremden Anzeigen. Ein eigenes Formular mit
   * Häkchen für „Jobticket" und „Altersvorsorge" hätte den Vorteil
   * strukturierter Daten und den Nachteil, dass die Häkchen und der Text
   * auseinanderlaufen — und dann steht in der Anzeige etwas anderes als
   * in der Merkmalsliste daneben.
   */
  const leistungen =
    sauber.description !== undefined ? leistungsnamen(sauber.description) : undefined;

  try {
    await withUser(db, user.id, (tx) =>
      tx
        .update(schema.jobPostings)
        .set({
          ...sauber,
          ...(leistungen ? { benefits: leistungen } : {}),
          updatedAt: new Date(),
        })
        .where(eq(schema.jobPostings.id, postingId)),
    );
  } catch (e) {
    console.error("[arbeitgeber] Stelle nicht gespeichert:", e);
    return { ok: false, text: "Das konnte ich nicht speichern." };
  }

  /*
   * Eine bereits veröffentlichte Stelle wird im Index mitgeführt.
   *
   * Sonst stünde in der Suche weiter die alte Fassung, während der
   * Arbeitgeber die neue vor sich hat — und beide hielten ihre für die
   * gültige.
   */
  await indexAbgleichen(user.id, orgId, postingId);

  revalidatePath("/business/stellen");
  return { ok: true, text: "Gespeichert." };
}

export async function stelleVeroeffentlichen(
  orgId: string,
  postingId: string,
): Promise<{ ok: boolean; text: string }> {
  const { user } = await verlangeRolle(orgId, "admin");
  const posting = await verlangeStelle(user.id, orgId, postingId);

  const db = await getDb();
  const [org] = await withUser(db, user.id, (tx) =>
    tx.select().from(schema.organizations).where(eq(schema.organizations.id, orgId)).limit(1),
  );

  if (!org?.verifiedAt) {
    return {
      ok: false,
      text:
        "Diese Organisation ist noch nicht bestätigt. Solange wir die Zugehörigkeit zum " +
        "Unternehmen nicht geprüft haben, kann hier niemand in seinem Namen ausschreiben.",
    };
  }

  /*
   * Dieselbe Prüfung wie im Formular — hier ist sie verbindlich.
   *
   * Im Editor ist sie ein Hinweis, den man lesen kann. Hier entscheidet
   * sie. Eine Serveraktion ist ein Endpunkt: Sie lässt sich aufrufen,
   * ohne das Formular je gesehen zu haben, und dann schützt eine
   * Prüfung, die nur im Browser läuft, gar nichts.
   */
  const blocker = pruefeAnzeige({
    title: posting.title,
    location: posting.location,
    description: posting.description,
    workModel: posting.workModel,
    contractType: posting.contractType,
    weeklyHours: posting.weeklyHours,
    salaryMin: posting.salaryMin,
    salaryMax: posting.salaryMax,
    salaryPeriod: posting.salaryPeriod,
  }).filter((b) => b.gewicht === "blockiert");

  if (blocker.length > 0) {
    return { ok: false, text: `Dafür fehlt noch: ${blocker.map((b) => b.titel).join(", ")}.` };
  }

  /*
   * Fehler werden gemeldet, nicht verschluckt.
   *
   * Ohne diesen Rahmen warf die Aktion, die Serveraktion antwortete mit
   * einem Fehler, und in der Oberfläche passierte NICHTS — kein Text,
   * kein Zustand, kein Hinweis. Genau an der Stelle, an der eine Anzeige
   * öffentlich werden soll: Man klickt, nichts geschieht, und man
   * klickt wieder.
   *
   * Der eigentliche Fehler steht im Serverprotokoll; hier steht ein
   * Satz, mit dem jemand etwas anfangen kann.
   */
  try {
    await withUser(db, user.id, (tx) =>
      tx
        .update(schema.jobPostings)
        .set({ status: "published", publishedAt: new Date(), closedAt: null, updatedAt: new Date() })
        .where(eq(schema.jobPostings.id, postingId)),
    );
    await indexAbgleichen(user.id, orgId, postingId);
  } catch (e) {
    console.error("[arbeitgeber] Veröffentlichen fehlgeschlagen:", e);
    return {
      ok: false,
      text: "Beim Veröffentlichen ist etwas schiefgegangen. Die Stelle ist nicht in der Suche.",
    };
  }
  await protokolliere(user.id, orgId, "stelle_veroeffentlicht", postingId);
  revalidatePath("/business/stellen");
  revalidatePath("/app/jobs");
  return { ok: true, text: "Veröffentlicht. Die Stelle erscheint jetzt in der Suche." };
}

export async function stelleSchliessen(
  orgId: string,
  postingId: string,
): Promise<{ ok: boolean; text: string }> {
  const { user } = await verlangeRolle(orgId, "admin");
  const posting = await verlangeStelle(user.id, orgId, postingId);
  const db = await getDb();

  await withUser(db, user.id, (tx) =>
    tx
      .update(schema.jobPostings)
      .set({ status: "closed", closedAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.jobPostings.id, postingId)),
  );

  /*
   * Aus dem Index nehmen heisst: ablaufen lassen, nicht löschen.
   *
   * Eine gelöschte Zeile nimmt die Bewerbungen mit, die daran hängen —
   * und für jemanden, der sich beworben hat, verschwände die Stelle
   * spurlos aus seiner Übersicht. `expires_at` ist der Weg, den der
   * Index für abgelaufene Anzeigen ohnehin kennt.
   */
  if (posting.jobId) {
    await db
      .update(schema.jobs)
      .set({ expiresAt: new Date() })
      .where(eq(schema.jobs.id, posting.jobId));
  }
  await protokolliere(user.id, orgId, "stelle_geschlossen", postingId);
  revalidatePath("/business/stellen");
  revalidatePath("/app/jobs");
  return { ok: true, text: "Geschlossen. Sie erscheint nicht mehr in der Suche." };
}

/**
 * Die veröffentlichte Stelle im gemeinsamen Index anlegen oder pflegen.
 *
 * Nur für veröffentlichte Stellen und bestätigte Organisationen. Der
 * Eintrag trägt eine eigene Quelle: Wer die Anzeige liest, soll sehen,
 * dass sie vom Arbeitgeber selbst kommt und nicht aus einem Portal.
 */
async function indexAbgleichen(userId: string, orgId: string, postingId: string): Promise<void> {
  const db = await getDb();
  const [p] = await withUser(db, userId, (tx) =>
    tx.select().from(schema.jobPostings).where(eq(schema.jobPostings.id, postingId)).limit(1),
  );
  if (!p || p.status !== "published") return;

  const [org] = await withUser(db, userId, (tx) =>
    tx.select().from(schema.organizations).where(eq(schema.organizations.id, orgId)).limit(1),
  );
  if (!org?.verifiedAt) return;

  const quelle = await quelleFuerArbeitgeber();
  const firma = await firmaFuer(org.name, org.companyId);

  /*
   * Die abgeleiteten Felder gehören dazu, nicht dahinter.
   *
   * `content_hash`, `description_tokens` und `description_length` sind
   * NOT NULL — und sie entstehen sonst im Adapter, den dieser Weg nicht
   * durchläuft. Die erste Fassung liess sie weg; der Einfügeversuch
   * scheiterte an der Datenbank, die Serveraktion warf, und in der
   * Oberfläche passierte schlicht nichts. Ein stiller Fehlschlag genau
   * an der Stelle, an der eine Anzeige öffentlich werden soll.
   *
   * Dieselben Funktionen wie im Import: Zwei Fassungen desselben
   * Hashes hiessen, dass eine Arbeitgeberanzeige und dieselbe Anzeige
   * aus einem Portal nicht als Dublette erkannt würden.
   */
  const werte = {
    contentHash: computeContentHash({
      title: p.title,
      companyName: org.name,
      location: p.location,
      description: p.description,
    }),
    descriptionTokens: beschreibungsTokens(p.description),
    descriptionLength: p.description.trim().length,
    sourceId: quelle,
    externalId: `posting:${p.id}`,
    companyId: firma,
    title: p.title,
    location: p.location,
    country: p.country,
    workModel: (p.workModel ?? "on_site") as "on_site" | "hybrid" | "remote",
    contractType: p.contractType as never,
    weeklyHours: p.weeklyHours,
    salaryMin: p.salaryMin,
    salaryMax: p.salaryMax,
    salaryCurrency: p.salaryCurrency,
    salaryPeriod: p.salaryPeriod as "year" | "month" | "hour",
    /*
     * `disclosed: true` und Herkunft „Arbeitgeber".
     *
     * Diese Zahl stammt nicht aus einer Textauswertung und nicht aus der
     * Schätzung eines Portals, sondern von dem, der sie zahlt. Das ist
     * die verlässlichste Herkunft, die es im ganzen Index gibt, und sie
     * soll auch so gekennzeichnet sein.
     */
    salaryDisclosed: p.salaryMin !== null || p.salaryMax !== null,
    salaryProvenance: "employer" as never,
    description: p.description,
    benefits: p.benefits,
    applyMethod: "internal" as never,
    applyTarget: `/app/jobs/bewerben/${p.id}`,
    publishedAt: p.publishedAt,
    expiresAt: null,
    fetchedAt: new Date(),
    isDemo: false,
  };

  if (p.jobId) {
    await db.update(schema.jobs).set(werte as never).where(eq(schema.jobs.id, p.jobId));
    return;
  }

  const [neu] = await db
    .insert(schema.jobs)
    .values(werte)
    .returning({ id: schema.jobs.id });

  await withUser(db, userId, (tx) =>
    tx.update(schema.jobPostings).set({ jobId: neu!.id }).where(eq(schema.jobPostings.id, p.id)),
  );
}

/** Die Quelle „Arbeitgeber direkt". Wird beim ersten Mal angelegt. */
async function quelleFuerArbeitgeber(): Promise<string> {
  const db = await getDb();
  const [vorhanden] = await db
    .select({ id: schema.jobSources.id })
    .from(schema.jobSources)
    .where(eq(schema.jobSources.key, "employer_direct"))
    .limit(1);
  if (vorhanden) return vorhanden.id;

  const [neu] = await db
    .insert(schema.jobSources)
    .values({
      key: "employer_direct",
      displayName: "Direkt vom Arbeitgeber",
      /*
       * `employer_feed` und `licensed`.
       *
       * Die Anzeige kommt vom Arbeitgeber selbst — kein Portal, kein
       * Abruf, keine Lizenzfrage. Das ist die sauberste Herkunft im
       * ganzen Index, und die Kennzeichnung soll das sagen: Wer sie
       * liest, sieht „Direkt vom Arbeitgeber" statt eines Portalnamens.
       */
      kind: "employer_feed",
      licenseStatus: "licensed",
      attributionRequired: false,
      attributionText: "Diese Stelle hat der Arbeitgeber selbst über Velvova eingestellt.",
      enabled: true,
    })
    .returning({ id: schema.jobSources.id });
  return neu!.id;
}

async function firmaFuer(name: string, companyId: string | null): Promise<string> {
  const db = await getDb();
  if (companyId) return companyId;
  const [vorhanden] = await db
    .select({ id: schema.companies.id })
    .from(schema.companies)
    .where(eq(schema.companies.name, name))
    .limit(1);
  if (vorhanden) return vorhanden.id;
  const [neu] = await db
    .insert(schema.companies)
    .values({ name })
    .returning({ id: schema.companies.id });
  return neu!.id;
}

/** Die Stellen einer Organisation, mit der Zahl der Bewerbungen. */
export async function ladeStellen(orgId: string) {
  const user = await requireUser();
  const db = await getDb();
  return withUser(db, user.id, (tx) =>
    tx
      .select({
        posting: schema.jobPostings,
        bewerbungen: sql<number>`(
          SELECT count(*)::int FROM posting_candidates pc
          WHERE pc.posting_id = ${schema.jobPostings.id} AND pc.withdrawn_at IS NULL
        )`,
      })
      .from(schema.jobPostings)
      .where(eq(schema.jobPostings.organizationId, orgId))
      .orderBy(desc(schema.jobPostings.createdAt)),
  );
}

export async function ladeStelle(orgId: string, postingId: string) {
  const user = await requireUser();
  const db = await getDb();
  const [z] = await withUser(db, user.id, (tx) =>
    tx
      .select()
      .from(schema.jobPostings)
      .where(
        and(eq(schema.jobPostings.id, postingId), eq(schema.jobPostings.organizationId, orgId)),
      )
      .limit(1),
  );
  return z ?? null;
}
