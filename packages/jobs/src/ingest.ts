import { anzeigenklartext } from "@paycheck/domain";
import { fortschreiben, standAusFundstellen, type Verfuegbarkeitsstand } from "@paycheck/domain";
import { randomUUID } from "node:crypto";
import { kennungAusRohdaten } from "./berufskennung.ts";
import { analyseEinreihen } from "./analyse-warteschlange.ts";
import { desc, eq, sql, inArray } from "drizzle-orm";
import { getDb, schema, type Database } from "@paycheck/db";
import { DEFAULT_CAPABILITIES, normalise, type JobSourceAdapter, type NormalisedListing } from "./adapter.ts";
import { aehnlicherText } from "./zusammenfuehren.ts";
import { decideForProvider } from "@paycheck/sources";
import { canonicalKey } from "./canonical.ts";
import { breakerFor } from "./health.ts";

/**
 * Echte Anzeigen in die Datenbank bringen.
 *
 * Drei Regeln, die den Unterschied zu einem naiven Import ausmachen:
 *
 * 1. Der Lauf ist wiederholbar. Dieselbe Anzeige zweimal abgerufen führt
 *    zu einem aktualisierten Datensatz, nicht zu einem zweiten. Der
 *    Inhaltshash entscheidet, ob sich überhaupt etwas geändert hat.
 *
 * 2. Ein Fehler bei einer Anzeige beendet nicht den ganzen Lauf, aber er
 *    wird gezählt und gemeldet. Ein stiller Teilausfall wäre schlimmer
 *    als ein lauter Totalausfall: er sieht aus wie Erfolg.
 *
 * 3. Echte Stellen tragen `isDemo: false`, Demo-Stellen `true`. Die
 *    Oberfläche trennt beides sichtbar. Vermischt wird nie.
 */

export interface IngestResult {
  sourceKey: string;
  fetched: number;
  inserted: number;
  updated: number;
  unchanged: number;
  /** Anzeigen, die zu einer bereits bekannten Stelle gehörten und
   *  deshalb als weitere Fundstelle angehängt wurden statt als Dublette
   *  in der Liste zu landen. */
  merged: number;
  failed: number;
  /**
   * Ob dieser Lauf den GANZEN Bestand der Quelle gesehen hat.
   *
   * Nur dann bedeutet eine fehlende Stelle etwas. Bei einem
   * abgeschnittenen Lauf — Stückzahlgrenze, Zeitbudget, Fehler — folgt
   * aus einem Fehlen nichts, und es darf nichts geschlossen werden.
   */
  feedVollstaendig: boolean;
  /**
   * Der Lauf wurde von aussen abgebrochen, weil seine Frist ablief.
   *
   * Das ist etwas anderes als ein Fehler: Der Anbieter hat nichts
   * falsch gemacht, wir hatten keine Zeit mehr. Der Unterschied zählt
   * an zwei Stellen — die Sicherung darf nicht auslösen, und die
   * Antwort darf das nicht als Anbieterausfall melden.
   */
  abgebrochen?: boolean;
  errors: string[];
  startedAt: Date;
  finishedAt: Date;
}

/** Die Quelle in der Datenbank anlegen oder auffrischen. */
async function upsertSource(
  db: Awaited<ReturnType<typeof getDb>>,
  adapter: JobSourceAdapter,
): Promise<string> {
  const existing = await db
    .select({ id: schema.jobSources.id })
    .from(schema.jobSources)
    .where(eq(schema.jobSources.key, adapter.key))
    .limit(1);

  if (existing[0]) {
    await db
      .update(schema.jobSources)
      .set({
        displayName: adapter.displayName,
        licenseStatus: adapter.licenseStatus,
        attributionRequired: adapter.attributionRequired,
        attributionText: adapter.attributionText,
        termsUrl: adapter.termsUrl,
        enabled: true,
      })
      .where(eq(schema.jobSources.id, existing[0].id));
    return existing[0].id;
  }

  const [created] = await db
    .insert(schema.jobSources)
    .values({
      key: adapter.key,
      displayName: adapter.displayName,
      kind: adapter.kind,
      licenseStatus: adapter.licenseStatus,
      attributionRequired: adapter.attributionRequired,
      attributionText: adapter.attributionText,
      termsUrl: adapter.termsUrl,
      enabled: true,
    })
    .returning({ id: schema.jobSources.id });

  return created!.id;
}

/**
 * Unternehmen nach Namen zusammenführen.
 *
 * Bewusst konservativ: nur exakte, normalisierte Namensgleichheit. Eine
 * unscharfe Zusammenführung würde zwei verschiedene Arbeitgeber zu einem
 * machen, und daran hinge später eine Bewertung, die nicht zu ihnen
 * gehört.
 */
async function findOrCreateCompany(
  db: Awaited<ReturnType<typeof getDb>>,
  name: string,
): Promise<string> {
  const normalised = name.trim();
  const existing = await db
    .select({ id: schema.companies.id })
    .from(schema.companies)
    .where(sql`lower(${schema.companies.name}) = lower(${normalised})`)
    .limit(1);

  if (existing[0]) return existing[0].id;

  const [created] = await db
    .insert(schema.companies)
    .values({ name: normalised, isDemo: false })
    .returning({ id: schema.companies.id });

  return created!.id;
}

/**
 * Eine Fundstelle festhalten.
 *
 * Idempotent: derselbe Abruf zweimal erzeugt eine Zeile, nicht zwei.
 * Der Schlüssel dafür ist (Quelle, externe Kennung) — dieselbe Anzeige
 * beim selben Anbieter ist dieselbe Fundstelle, auch wenn sich die
 * Adresse ändert.
 */
async function verknuepfe(
  db: Awaited<ReturnType<typeof getDb>>,
  jobId: string,
  sourceId: string,
  n: NormalisedListing,
  canonical: string | null,
): Promise<void> {
  await db
    .insert(schema.jobSourceLinks)
    .values({
      jobId,
      sourceId,
      externalId: n.externalId,
      url: n.job.originalUrl ?? "",
      canonicalKey: canonical,
      lastSeenAt: n.job.fetchedAt,
    })
    .onConflictDoUpdate({
      target: [schema.jobSourceLinks.sourceId, schema.jobSourceLinks.externalId],
      set: {
        jobId,
        url: n.job.originalUrl ?? "",
        canonicalKey: canonical,
        lastSeenAt: n.job.fetchedAt,
      },
    });
}

/**
 * Die Spalten einer Stelle, aus einer normalisierten Anzeige.
 *
 * Ausgelagert, weil zwei Wege sie brauchen — der Reihe nach und
 * gebündelt. Stünde die Liste zweimal da, liefen die beiden Wege
 * irgendwann auseinander: Ein neues Feld käme in einem an und im
 * anderen nicht, und niemand sähe es, weil beide weiter funktionieren.
 */
function jobWerte(n: NormalisedListing, companyId: string, sourceId: string, kldb: string | null = null) {
  const j = n.job;
  return {
    /*
     * Die amtliche Kennung kommt aus den Rohdaten, nicht aus dem Titel.
     *
     * Die Anzeigen der Bundesagentur tragen `hauptberuf` — die
     * Bezeichnung, die die Behörde selbst vergeben hat. Sie landete
     * bisher nur in der Momentaufnahme, und ein eigener Nachtragslauf
     * holte dieselbe Information über einen Netzaufruf je Titel wieder
     * herein.
     *
     * `null` bei allen Quellen, die nichts Vergleichbares liefern.
     * Dort bleibt der Nachtrag über den Titel der einzige Weg.
     */
    kldb,
    /*
     * Titel und Aufgaben ohne Auszeichnungszeichen.
     *
     * Gemessen im Bestand: 108 Titel je 66.000 tragen `**` oder
     * HTML-Reste, 6,6 Prozent der Aufgabenlisten enthalten Punkte wie
     * „**Ihre Aufgaben:**" — die Überschrift des Quellsystems, als
     * Aufgabe gespeichert.
     *
     * Gesäubert wird hier und nicht erst bei der Anzeige, weil auf
     * diesen Feldern gesucht, gruppiert und verglichen wird. Ein
     * Titel mit Sternen findet sich nicht, und zwei Anzeigen mit und
     * ohne Sterne gelten als verschieden.
     *
     * Die Beschreibung bleibt roh: Sie ist der Originaltext, und die
     * Oberfläche zerlegt ihn beim Anzeigen.
     */
    title: anzeigenklartext(j.title ?? "") || j.title,
    companyId,
    location: j.location,
    country: j.country,
    workModel: j.workModel,
    remotePercent: j.remotePercent,
    salaryMin: j.salary.min,
    salaryMax: j.salary.max,
    salaryCurrency: j.salary.currency,
    salaryPeriod: j.salary.period,
    salaryDisclosed: j.salary.disclosed,
    salaryProvenance: j.salary.provenance,
    salaryEvidence: j.salary.evidence,
    contractType: j.contractType,
    weeklyHours: j.weeklyHours,
    shiftWork: j.shiftWork,
    travelPercent: j.travelPercent,
    experienceLevel: j.experienceLevel,
    industry: j.industry,
    languageRequirements: j.languageRequirements,
    requiredLicenses: j.requiredLicenses,
    workPermitRequired: j.workPermitRequired,
    /*
     * `?? []` ist kein Schmuck.
     *
     * Nicht jede Quelle liefert Aufgaben, und `normalise` setzt das
     * Feld dann gar nicht. Ohne den Rückfall wirft `.map` — und zwar
     * für einen ganzen Schwung von 250 Anzeigen auf einmal, weil der
     * Import bündelweise schreibt. Genau so ist es passiert.
     */
    coreTasks: (j.coreTasks ?? [])
      .map((t) => anzeigenklartext(t) || t)
      .filter((t) => t.length > 0),
    description: j.description ?? "",
    descriptionTokens: j.descriptionTokens,
    descriptionLength: j.descriptionLength,
    benefits: j.benefits,
    applyMethod: j.applyMethod,
    applyTarget: j.applyTarget,
    publishedAt: j.publishedAt,
    expiresAt: j.expiresAt,
    fetchedAt: j.fetchedAt,
    originalUrl: j.originalUrl,
    sourceId,
    contentHash: j.contentHash,
    isDemo: false,
  };
}

/**
 * Was beim Fortschreiben überschrieben wird.
 *
 * Alles ausser der Kennung — und abgeleitet aus derselben Liste, die
 * auch das Anlegen benutzt. Eine von Hand gepflegte zweite Aufzählung
 * wäre genau die Stelle, an der ein neues Feld künftig vergessen wird.
 */
function aktualisierbareSpalten() {
  /*
   * Ein leerer Platzhalter, nur um an die Feldnamen zu kommen.
   *
   * `jobWerte` liest verschachtelte Felder (`j.salary.min`), deshalb
   * genügt kein leeres Objekt — es müsste zur Laufzeit stolpern, und
   * zwar bei jedem Schreibvorgang.
   */
  const beispiel = jobWerte(
    {
      job: { salary: {} },
      companyName: "",
      externalId: "",
      requirements: [],
      raw: null,
    } as never,
    "",
    "",
  );
  const set: Record<string, unknown> = {};
  for (const spalte of Object.keys(beispiel)) {
    const c = (schema.jobs as unknown as Record<string, { name?: string }>)[spalte];
    if (!c?.name) continue;

    /*
     * Eine vorhandene Kennung wird nicht durch nichts ersetzt.
     *
     * Der Import setzt `kldb` nur, wenn die Quelle `hauptberuf`
     * mitliefert — bei allen anderen bleibt sie leer. Ohne `coalesce`
     * würde jedes erneute Einlesen einer fremden Anzeige die Kennung
     * löschen, die der Nachtrag mühsam gesetzt hat.
     *
     * Der Fehler wäre still: Die Zahl der Stellen mit Kennung sänke
     * bei jedem Importlauf, und niemand sähe, woher.
     */
    set[spalte] =
      spalte === "kldb"
        ? sql.raw(`coalesce(excluded."${c.name}", "jobs"."${c.name}")`)
        : sql.raw(`excluded."${c.name}"`);
  }
  return set as never;
}

/**
 * Ein ganzer Schwung Anzeigen auf einmal.
 *
 * ── Warum es diese Funktion gibt ──────────────────────────────
 *
 * `writeListing()` macht acht bis zehn Hin- und Rückwege zur Datenbank
 * je Anzeige: Firma nachschlagen, vorhandene Stelle suchen, zweimal auf
 * Dubletten prüfen, schreiben, Fundstelle, Anforderungen,
 * Momentaufnahme. Bei einer Datenbank in der Cloud ist jeder davon rund
 * fünfzehn Millisekunden.
 *
 * Gemessen im echten Importlauf: **6,7 Anzeigen je Sekunde**. Für einen
 * Bestand in sechsstelliger Grösse sind das Tage. Dieselbe Datenbank
 * nimmt gebündelt 4.355 Zeilen je Sekunde entgegen — Faktor 208,
 * gemessen mit `scripts/_batch.mjs`.
 *
 * ── Was sich dabei NICHT ändern darf ──────────────────────────
 *
 * Die vier Entscheidungen: neu, unverändert, geändert, zusammengeführt.
 * Sie sind der Unterschied zwischen einer Metasuche und drei Listen
 * nebeneinander, und ein Fehler darin sieht aus wie eine kürzere Liste,
 * nicht wie ein Fehler. `ingest-schreibpfad.test.ts` hält sie fest —
 * geschrieben, bevor diese Funktion existierte.
 *
 * ── Der Aufbau ────────────────────────────────────────────────
 *
 *   1. **Nachschlagen** — alles, was der Schwung an Vorwissen braucht,
 *      in wenigen Abfragen statt in tausend.
 *   2. **Entscheiden** — ohne Datenbank, rein im Speicher.
 *   3. **Schreiben** — je Tabelle eine Anweisung.
 *
 * Damit sind es rund zehn Abfragen je Schwung statt zehn je Anzeige.
 */
async function writeListings(
  db: Awaited<ReturnType<typeof getDb>>,
  sourceId: string,
  liste: NormalisedListing[],
): Promise<{ ergebnisse: ("inserted" | "updated" | "unchanged" | "merged")[]; fehler: string[] }> {
  const ergebnisse: ("inserted" | "updated" | "unchanged" | "merged")[] = new Array(liste.length);
  const fehler: string[] = [];
  if (liste.length === 0) return { ergebnisse, fehler };

  // ── 1. Nachschlagen ────────────────────────────────────────

  /*
   * Firmen: erst alle vorhandenen holen, dann die fehlenden in EINER
   * Anweisung anlegen. Der Vergleich läuft kleingeschrieben, wie in
   * `findOrCreateCompany` — sonst entstünde „Muster GmbH" neben
   * „muster gmbh".
   */
  const firmennamen = [...new Set(liste.map((n) => n.companyName.trim()))];
  const firmenZeilen = await db
    .select({ id: schema.companies.id, name: schema.companies.name })
    .from(schema.companies)
    .where(
      sql`lower(${schema.companies.name}) in (${sql.join(
        firmennamen.map((f) => sql`lower(${f})`),
        sql`, `,
      )})`,
    );
  const firmaNach = new Map(firmenZeilen.map((f) => [f.name.toLowerCase(), f.id]));

  const fehlendeFirmen = firmennamen.filter((f) => !firmaNach.has(f.toLowerCase()));
  if (fehlendeFirmen.length > 0) {
    const angelegt = await db
      .insert(schema.companies)
      .values(fehlendeFirmen.map((name) => ({ name, isDemo: false })))
      .returning({ id: schema.companies.id, name: schema.companies.name });
    for (const f of angelegt) firmaNach.set(f.name.toLowerCase(), f.id);
  }

  /* Vorhandene Stellen dieser Quelle, über die Originaladresse. */
  const adressen = [...new Set(liste.map((n) => n.job.originalUrl).filter(Boolean))] as string[];
  const vorhandene =
    adressen.length === 0
      ? []
      : await db
          .select({
            id: schema.jobs.id,
            originalUrl: schema.jobs.originalUrl,
            contentHash: schema.jobs.contentHash,
            salaryMin: schema.jobs.salaryMin,
            salaryMax: schema.jobs.salaryMax,
          })
          .from(schema.jobs)
          .where(
            sql`${schema.jobs.sourceId} = ${sourceId} and ${schema.jobs.originalUrl} in (${sql.join(
              adressen.map((a) => sql`${a}`),
              sql`, `,
            )})`,
          );
  const bekannteAdresse = new Map(vorhandene.map((v) => [v.originalUrl ?? "", v]));

  /* Die kanonischen Schlüssel des Schwungs — für beide Dublettenfragen. */
  const schluesselJe = liste.map((n) =>
    canonicalKey({ title: n.job.title, companyName: n.companyName, location: n.job.location }),
  );
  const schluessel = [...new Set(schluesselJe.filter(Boolean))] as string[];

  const fundstellen =
    schluessel.length === 0
      ? []
      : await db
          .select({
            jobId: schema.jobSourceLinks.jobId,
            canonicalKey: schema.jobSourceLinks.canonicalKey,
            sourceId: schema.jobSourceLinks.sourceId,
            description: schema.jobs.description,
          })
          .from(schema.jobSourceLinks)
          .innerJoin(schema.jobs, eq(schema.jobs.id, schema.jobSourceLinks.jobId))
          .where(
            sql`${schema.jobSourceLinks.canonicalKey} in (${sql.join(
              schluessel.map((k) => sql`${k}`),
              sql`, `,
            )})`,
          );

  /* Fremde Anbieter: dieselbe Stelle, anderswo gefunden. */
  const anderswoNach = new Map<string, string>();
  /* Eigener Anbieter: Kandidaten für eine Wiederholung, mit Text. */
  const eigeneNach = new Map<string, { jobId: string; description: string | null }[]>();
  for (const f of fundstellen) {
    const k = f.canonicalKey;
    if (!k) continue;
    if (f.sourceId !== sourceId) {
      if (!anderswoNach.has(k)) anderswoNach.set(k, f.jobId);
    } else {
      const liste2 = eigeneNach.get(k) ?? [];
      // Dieselbe Grenze wie zuvor: mehr Zeilen mit demselben Schlüssel
      // sprechen eher für viele echte Stellen als für eine Wiederholung.
      if (liste2.length < 5) liste2.push({ jobId: f.jobId, description: f.description });
      eigeneNach.set(k, liste2);
    }
  }

  // ── 2. Entscheiden ─────────────────────────────────────────

  /*
   * Die Form kommt von `jobWerte`, nicht von `Record<string, unknown>`.
   *
   * Ein Record prüft nichts: Ein vertippter Spaltenname, ein Feld mit
   * dem falschen Typ, eine Spalte, die `jobWerte` vergisst — nichts
   * davon fällt beim Übersetzen auf. Erst der Insert merkt es, und
   * das ist im Import ein Lauf über tausende Anzeigen.
   *
   * `id` steht getrennt, weil es beim Anlegen dazukommt und beim
   * Fortschreiben schon da ist. Der Rest hängt an der Quelle.
   */
  type Jobzeile = ReturnType<typeof jobWerte> & { id?: string };
  const anzulegen: { kennung: string; werte: Jobzeile; index: number }[] = [];
  const fortzuschreiben: { kennung: string; werte: Jobzeile; index: number }[] = [];
  const nurGesehen: string[] = [];
  const verknuepfungen: {
    jobId: string;
    externalId: string;
    url: string;
    canonicalKey: string | null;
    lastSeenAt: Date;
    /**
     * Die Bewerbungsfrist laut DIESER Quelle.
     *
     * Getrennt von `jobs.expires_at` gehalten, weil zwei Quellen zur
     * selben Stelle verschiedene Fristen nennen können — und dann ist
     * die der näheren Quelle die richtige.
     *
     * `null`, wo die Quelle keine nennt. Greenhouse hat das Feld
     * (`application_deadline`), füllt es aber selten; Lever, Ashby
     * und SmartRecruiters haben gar keines.
     */
    validThrough: Date | null;
  }[] = [];
  /*
   * Der Typ kommt vom Adapter, statt hier wiederholt zu werden.
   *
   * Vorher stand hier eine ausgeschriebene Liste von vier Feldern. Die
   * Einstufung des Adapters — zwingend, erlernbar, wichtigkeit,
   * konfidenz, belegstelle — fiel damit beim Durchreichen still weg:
   * `push({...r})` schreibt sie hinein, der Typ blendet sie aus, und
   * `values(… as never)` beschwert sich nicht. Ein `as never` verdeckt
   * genau solche Verluste, deshalb hängt die Form jetzt an der Quelle.
   */
  const anforderungen: (NormalisedListing["requirements"][number] & { jobId: string })[] = [];
  /*
   * `unknown` war hier eine Notlüge.
   *
   * Der Adapter liefert `Record<string, unknown>`, die Spalte erwartet
   * dasselbe — dazwischen stand ein `unknown`, das beide Enden
   * voneinander trennte, und ein `as never` am Insert, das die
   * Beschwerde verschluckte.
   */
  const momentaufnahmen: { jobId: string; rawPayload: Record<string, unknown>; contentHash: string }[] = [];

  /*
   * Stellen, die angelegt oder fortgeschrieben wurden.
   *
   * Nur diese kommen in die Analysewarteschlange — nicht die, bei denen
   * sich bloss `last_seen_at` geändert hat. Der Import sieht dieselbe
   * Anzeige täglich wieder; würde das einen Auftrag erzeugen, liefe die
   * teuerste Arbeit im System täglich für eine Million unveränderte
   * Anzeigen.
   *
   * Ein `Set`, weil eine Stelle in einem Lauf mehrfach auftauchen kann
   * — etwa als Dublette aus zwei Quellen.
   */
  const zuAnalysieren = new Set<string>();
  const alteAnforderungenLoeschen: string[] = [];

  /*
   * Ein Schwung kann dieselbe Stelle zweimal enthalten.
   *
   * Der Reihe nach geschrieben fiel das nicht auf: Die erste Anzeige
   * legte an, die zweite fand sie und führte zusammen. Gebündelt
   * fallen beide Entscheidungen, bevor eine davon geschrieben ist —
   * also muss die Kandidatenliste während des Entscheidens mitwachsen.
   *
   * Wichtig ist dabei, WELCHE Prüfung sie füttert. Alles in einem
   * Schwung kommt von DERSELBEN Quelle. Es darf deshalb nur in die
   * Wiederholungsprüfung gehen, die zusätzlich den Text vergleicht —
   * niemals in die Prüfung „dieselbe Stelle bei einem anderen
   * Anbieter", die allein auf Titel, Firma und Ort beruht.
   *
   * Ein erster Entwurf machte genau das, und der Kennzeichnungstest
   * fing es sofort: Zwei echte Ausschreibungen „Kundenberater (m/w/d)"
   * desselben Callcenters wurden zu einer. Vier von fünf Stellen wären
   * still verschwunden, und die kürzere Liste hätte vollständig
   * ausgesehen.
   */

  /*
   * Die amtlichen Kennungen für den ganzen Stapel auf einmal.
   *
   * Die Nachschlagetabelle liegt im Speicher und wird stündlich
   * erneuert — je Anzeige zu fragen wären bei 3.000 Anzeigen 3.000
   * Netzrunden für eine Tabelle, die sich in Stunden nicht ändert.
   */
  const kennungen = await Promise.all(liste.map((n) => kennungAusRohdaten(n.raw).catch(() => null)));

  for (const [i, n] of liste.entries()) {
    const j = n.job;
    const k = schluesselJe[i] ?? null;
    const companyId = firmaNach.get(n.companyName.trim().toLowerCase());
    if (!companyId) {
      fehler.push(`${n.externalId}: Arbeitgeber konnte nicht angelegt werden`);
      continue;
    }

    const bekannt = j.originalUrl ? bekannteAdresse.get(j.originalUrl) : undefined;

    if (!bekannt && k) {
      const anderswo = anderswoNach.get(k);
      if (anderswo) {
        verknuepfungen.push({
          jobId: anderswo,
          externalId: n.externalId,
          url: j.originalUrl ?? "",
          canonicalKey: k,
          lastSeenAt: j.fetchedAt,
          validThrough: j.expiresAt ?? null,
        });
        ergebnisse[i] = "merged";
        continue;
      }
      const kandidaten = eigeneNach.get(k) ?? [];
      const wiederholung = kandidaten.find((c) =>
        aehnlicherText(c.description ?? "", j.description ?? ""),
      );
      if (wiederholung) {
        verknuepfungen.push({
          jobId: wiederholung.jobId,
          externalId: n.externalId,
          url: j.originalUrl ?? "",
          canonicalKey: k,
          lastSeenAt: j.fetchedAt,
          validThrough: j.expiresAt ?? null,
        });
        ergebnisse[i] = "merged";
        continue;
      }
    }

    const werte = jobWerte(n, companyId, sourceId, kennungen[i] ?? null);

    if (bekannt) {
      const neuGewonnen =
        (j.salary.min !== null || j.salary.max !== null) &&
        bekannt.salaryMin === null &&
        bekannt.salaryMax === null;

      if (bekannt.contentHash === j.contentHash && !neuGewonnen) {
        nurGesehen.push(bekannt.id);
        verknuepfungen.push({
          jobId: bekannt.id,
          externalId: n.externalId,
          url: j.originalUrl ?? "",
          canonicalKey: k,
          lastSeenAt: j.fetchedAt,
          validThrough: j.expiresAt ?? null,
        });
        ergebnisse[i] = "unchanged";
        continue;
      }

      fortzuschreiben.push({ kennung: bekannt.id, werte, index: i });
      alteAnforderungenLoeschen.push(bekannt.id);
      verknuepfungen.push({
        jobId: bekannt.id,
        externalId: n.externalId,
        url: j.originalUrl ?? "",
        canonicalKey: k,
        lastSeenAt: j.fetchedAt,
        validThrough: j.expiresAt ?? null,
      });
      for (const r of n.requirements) anforderungen.push({ ...r, jobId: bekannt.id });
      momentaufnahmen.push({ jobId: bekannt.id, rawPayload: n.raw, contentHash: j.contentHash });
      zuAnalysieren.add(bekannt.id);
      ergebnisse[i] = "updated";
      continue;
    }

    /*
     * Die Kennung entsteht hier, nicht in der Datenbank.
     *
     * Nur so lassen sich Anlegen und Fortschreiben in EINER Anweisung
     * erledigen — und nur so kennen Fundstelle, Anforderungen und
     * Momentaufnahme ihre Stelle schon, bevor sie geschrieben ist.
     */
    const kennung = randomUUID();
    anzulegen.push({ kennung, werte: { ...werte, id: kennung }, index: i });
    if (k) {
      const bisher = eigeneNach.get(k) ?? [];
      bisher.push({ jobId: kennung, description: j.description ?? "" });
      eigeneNach.set(k, bisher);
    }
    verknuepfungen.push({
      jobId: kennung,
      externalId: n.externalId,
      url: j.originalUrl ?? "",
      canonicalKey: k,
      lastSeenAt: j.fetchedAt,
      validThrough: j.expiresAt ?? null,
    });
    for (const r of n.requirements) anforderungen.push({ ...r, jobId: kennung });
    momentaufnahmen.push({ jobId: kennung, rawPayload: n.raw, contentHash: j.contentHash });
    zuAnalysieren.add(kennung);
    ergebnisse[i] = "inserted";
  }

  // ── 3. Schreiben ───────────────────────────────────────────

  /*
   * Anlegen und Fortschreiben in einer Anweisung.
   *
   * Beide setzen dieselben Spalten; der Unterschied ist nur, ob die
   * Zeile schon da ist. `on conflict (id)` beantwortet das der
   * Datenbank überlassen — und spart eine zweite Runde.
   */
  const zuSchreiben = [...anzulegen, ...fortzuschreiben.map((f) => ({ ...f, werte: { ...f.werte, id: f.kennung } }))];
  if (zuSchreiben.length > 0) {
    await db
      .insert(schema.jobs)
      .values(zuSchreiben.map((z) => z.werte))
      .onConflictDoUpdate({
        target: schema.jobs.id,
        set: aktualisierbareSpalten(),
      });
  }

  if (nurGesehen.length > 0) {
    /*
     * Die Anzeige lebt noch — mehr sagt dieser Lauf über sie nicht.
     * Alle Zeitpunkte eines Laufs sind derselbe, deshalb genügt eine
     * Anweisung für alle.
     */
    await db
      .update(schema.jobs)
      .set({ fetchedAt: liste[0]!.job.fetchedAt })
      .where(
        sql`${schema.jobs.id} in (${sql.join(
          nurGesehen.map((id) => sql`${id}::uuid`),
          sql`, `,
        )})`,
      );
  }

  if (verknuepfungen.length > 0) {
    /*
     * Ein Schwung kann dieselbe (Quelle, externe Kennung) zweimal
     * enthalten. `on conflict` allein hilft dann nicht — Postgres
     * weigert sich, dieselbe Zeile in einer Anweisung zweimal zu
     * behandeln. Also vorher eindeutig machen; die letzte gewinnt, wie
     * beim Schreiben der Reihe nach.
     */
    const eindeutig = new Map(verknuepfungen.map((v) => [`${sourceId}|${v.externalId}`, v]));
    await db
      .insert(schema.jobSourceLinks)
      .values([...eindeutig.values()].map((v) => ({ ...v, sourceId })))
      .onConflictDoUpdate({
        target: [schema.jobSourceLinks.sourceId, schema.jobSourceLinks.externalId],
        set: {
          jobId: sql`excluded.job_id`,
          url: sql`excluded.url`,
          canonicalKey: sql`excluded.canonical_key`,
          lastSeenAt: sql`excluded.last_seen_at`,
          validThrough: sql`excluded.valid_through`,
        },
      });
  }

  if (alteAnforderungenLoeschen.length > 0) {
    await db.delete(schema.jobRequirements).where(
      sql`${schema.jobRequirements.jobId} in (${sql.join(
        alteAnforderungenLoeschen.map((id) => sql`${id}::uuid`),
        sql`, `,
      )})`,
    );
  }
  if (anforderungen.length > 0) {
    await db.insert(schema.jobRequirements).values(anforderungen);
  }
  if (momentaufnahmen.length > 0) {
    await db
      .insert(schema.jobSnapshots)
      .values(momentaufnahmen.map((m) => ({ ...m, sourceId })));
  }

  await analyseEinreihen(db, [...zuAnalysieren]);

  return { ergebnisse, fehler };
}

async function writeListing(
  db: Awaited<ReturnType<typeof getDb>>,
  sourceId: string,
  n: NormalisedListing,
): Promise<"inserted" | "updated" | "unchanged" | "merged"> {
  const companyId = await findOrCreateCompany(db, n.companyName);
  const j = n.job;

  /*
   * Zwei Fragen, in dieser Reihenfolge:
   *
   *   1. Kennen wir GENAU DIESE Anzeige schon? (gleiche Quelle, gleiche
   *      Adresse) — dann wird sie fortgeschrieben.
   *   2. Kennen wir DIESE STELLE schon, von woanders? — dann bekommt der
   *      vorhandene Datensatz eine weitere Fundstelle statt einer
   *      Dublette.
   *
   * Die zweite Frage ist der eigentliche Unterschied zwischen einer
   * Metasuche und drei nebeneinanderlaufenden Listen.
   */
  const existing = await db
    /*
     * Das Gehalt kommt mit, damit die Abkürzung unten prüfen kann, ob
     * ein neuer Lauf etwas mitbringt, das der gespeicherte Datensatz
     * noch nicht hat.
     */
    .select({
      id: schema.jobs.id,
      contentHash: schema.jobs.contentHash,
      salaryMin: schema.jobs.salaryMin,
      salaryMax: schema.jobs.salaryMax,
    })
    .from(schema.jobs)
    .where(sql`${schema.jobs.originalUrl} = ${j.originalUrl} and ${schema.jobs.sourceId} = ${sourceId}`)
    .limit(1);

  const schluessel = canonicalKey({
    title: j.title,
    companyName: n.companyName,
    location: j.location,
  });

  if (!existing[0] && schluessel) {
    const anderswo = await gleicheStelleBeiAnderemAnbieter(db, schluessel, sourceId);
    if (anderswo) {
      await verknuepfe(db, anderswo, sourceId, n, schluessel);
      return "merged";
    }

    /*
     * Wiederholungen desselben Anbieters.
     *
     * Beobachtet an echten Daten: Speechify stellt dieselbe Stelle
     * zweimal bei Arbeitnow ein — „Munich" und „Munich, Bavaria,
     * Germany", zwei Kennungen, fast gleicher Text. Ohne diesen Schritt
     * steht sie doppelt in der Liste.
     *
     * Entschieden wird über den Beschreibungstext, nicht über die
     * Herkunft: fünf offene Stellen „Kundenberater (m/w/d)" in einem
     * Callcenter haben denselben Titel und verschiedene Texte und
     * bleiben getrennt.
     */
    const wiederholung = await wiederholungBeiGleichemAnbieter(
      db,
      schluessel,
      sourceId,
      // `description` ist im Jobtyp optional; für den Vergleich zählt
      // ein leerer Text als „zu kurz für ein Urteil" und führt nichts
      // zusammen.
      j.description ?? "",
    );
    if (wiederholung) {
      await verknuepfe(db, wiederholung, sourceId, n, schluessel);
      return "merged";
    }
  }

  const values = {
    /* Wie im Stapelweg: aus `hauptberuf`, wo die Quelle sie liefert. */
    kldb: await kennungAusRohdaten(n.raw).catch(() => null),
    title: j.title,
    companyId,
    location: j.location,
    country: j.country,
    workModel: j.workModel,
    remotePercent: j.remotePercent,
    salaryMin: j.salary.min,
    salaryMax: j.salary.max,
    salaryCurrency: j.salary.currency,
    salaryPeriod: j.salary.period,
    salaryDisclosed: j.salary.disclosed,
    salaryProvenance: j.salary.provenance,
    salaryEvidence: j.salary.evidence,
    contractType: j.contractType,
    weeklyHours: j.weeklyHours,
    shiftWork: j.shiftWork,
    travelPercent: j.travelPercent,
    experienceLevel: j.experienceLevel,
    industry: j.industry,
    languageRequirements: j.languageRequirements,
    requiredLicenses: j.requiredLicenses,
    workPermitRequired: j.workPermitRequired,
    coreTasks: j.coreTasks.map((t) => anzeigenklartext(t) || t).filter((t) => t.length > 0),
    description: j.description ?? "",
    descriptionTokens: j.descriptionTokens,
    descriptionLength: j.descriptionLength,
    benefits: j.benefits,
    applyMethod: j.applyMethod,
    applyTarget: j.applyTarget,
    publishedAt: j.publishedAt,
    expiresAt: j.expiresAt,
    fetchedAt: j.fetchedAt,
    originalUrl: j.originalUrl,
    sourceId,
    contentHash: j.contentHash,
    isDemo: false,
  };

  if (existing[0]) {
    /*
     * Der Hash erkennt Änderungen an der QUELLE, nicht an unserer
     * ZUORDNUNG.
     *
     * Genau daran ist ein Gehaltsnachtrag gescheitert: Der Adapter der
     * Bundesagentur las `gehaltsspanneVon`/`-Bis` neu aus — Felder, die
     * die Antwort immer schon enthielt. Der Anzeigentext war unverändert,
     * also blieb der Hash gleich, also wurde nur `fetchedAt`
     * fortgeschrieben. Von 248 bestehenden Stellen bekam genau eine das
     * neue Gehalt; die übrigen behielten ihr leeres Feld.
     *
     * Das gilt allgemein: Jede Verbesserung an einer Zuordnung erreicht
     * sonst nur Stellen, die nach ihr neu eingelesen werden — die
     * bestehenden bleiben für immer auf dem alten Stand, ohne dass
     * irgendetwas fehlschlägt.
     *
     * Deshalb vor der Abkürzung eine zweite Frage: Bringt der neue Lauf
     * etwas mit, das der gespeicherte Datensatz nicht hat? Dann wird
     * geschrieben, auch wenn die Quelle sich nicht gerührt hat.
     */
    const neuGewonnen =
      (values.salaryMin !== null || values.salaryMax !== null) &&
      existing[0].salaryMin === null &&
      existing[0].salaryMax === null;

    if (existing[0].contentHash === j.contentHash && !neuGewonnen) {
      // Nur den Abrufzeitpunkt fortschreiben: die Anzeige lebt noch.
      await db
        .update(schema.jobs)
        .set({ fetchedAt: j.fetchedAt })
        .where(eq(schema.jobs.id, existing[0].id));
      await verknuepfe(db, existing[0].id, sourceId, n, schluessel);
      return "unchanged";
    }

    await db.update(schema.jobs).set(values).where(eq(schema.jobs.id, existing[0].id));
    await verknuepfe(db, existing[0].id, sourceId, n, schluessel);
    await db.delete(schema.jobRequirements).where(eq(schema.jobRequirements.jobId, existing[0].id));
    if (n.requirements.length > 0) {
      await db
        .insert(schema.jobRequirements)
        .values(n.requirements.map((r) => ({ ...r, jobId: existing[0]!.id })));
    }
    await db.insert(schema.jobSnapshots).values({
      jobId: existing[0].id,
      sourceId,
      rawPayload: n.raw,
      contentHash: j.contentHash,
    });
    return "updated";
  }

  const [created] = await db.insert(schema.jobs).values(values).returning({ id: schema.jobs.id });

  /*
   * ── Die Fundstelle fehlte hier ────────────────────────────────
   *
   * Jeder andere Zweig dieser Funktion trug sie ein — nur der, der
   * eine Stelle ANLEGT, nicht. Eine frisch importierte Anzeige stand
   * damit in `jobs`, aber nicht in `job_source_links`.
   *
   * Das ist nicht bloss eine fehlende Herkunftsangabe. Genau diese
   * Tabelle fragt `gleicheStelleBeiAnderemAnbieter()` ab, um dieselbe
   * Stelle über Anbietergrenzen hinweg zu erkennen. Eine Anzeige, die
   * nie fortgeschrieben wurde, war dort unsichtbar — und kam ein
   * zweiter Anbieter mit derselben Stelle, wurde sie als neue Stelle
   * angelegt.
   *
   * Die quellenübergreifende Entdopplung — der Unterschied zwischen
   * einer Metasuche und drei Listen nebeneinander — griff also nur bei
   * Anzeigen, die mindestens einmal aktualisiert worden waren.
   *
   * Gemessen bei 20.277 Stellen: 3.218 hatten eine Fundstelle, also
   * 15,9 %. Dass es trotzdem noch keine Dubletten gab, lag daran, dass
   * sich unsere Quellen bisher kaum überschneiden — nicht daran, dass
   * die Entdopplung funktionierte.
   *
   * Gefunden hat es kein Testlauf, sondern ein Kennzeichnungstest, der
   * vor einem Umbau festhalten sollte, was der Schreibpfad tut.
   */
  await verknuepfe(db, created!.id, sourceId, n, schluessel);

  if (n.requirements.length > 0) {
    await db
      .insert(schema.jobRequirements)
      .values(n.requirements.map((r) => ({ ...r, jobId: created!.id })));
  }
  await db.insert(schema.jobSnapshots).values({
    jobId: created!.id,
    sourceId,
    rawPayload: n.raw,
    contentHash: j.contentHash,
  });

  return "inserted";
}

/**
 * Die Entscheidung der Policy Engine, wie der Abruf sie braucht.
 *
 * Der Ingest kennt die Engine nicht — sie lebt in der Anwendung. Er
 * bekommt die Entscheidung übergeben und weigert sich, ohne sie zu
 * arbeiten. So kann kein Aufrufer sie versehentlich überspringen.
 */
export interface IngestPolicy {
  decision: "approved" | "link_only" | "private_import" | "blocked" | "pending_review";
  allowedOperations: string[];
  reason: string;
}

export async function ingestFromAdapter(
  adapter: JobSourceAdapter,
  options: {
    limit?: number;
    since?: Date;
    policy?: IngestPolicy;
    /**
     * Die Frist für DIESEN Lauf, vom Aufrufer gesetzt.
     *
     * ══════════════════════════════════════════════════════════
     * Warum es die geben muss
     * ══════════════════════════════════════════════════════════
     *
     * Ohne sie ist ein Adapter unbegrenzt. Die Adapter setzen zwar
     * `mitFrist(options.signal)` — aber ohne übergebenes Signal
     * erzeugt das je AUFRUF eine neue Frist von 45 Sekunden. Careerjet
     * läuft über Suchbegriffe mal Seiten; bei zehn Begriffen und fünf
     * Seiten sind das fünfzig Anfragen mit je eigener Frist.
     *
     * Genau daran ist der Abruf in Produktion mit 504 gestorben: Der
     * Aufrufer prüfte sein Budget zwischen den Adaptern, konnte einen
     * laufenden aber nicht mehr anhalten.
     *
     * Mit einem Signal wird aus jeder Einzelfrist ein
     * `AbortSignal.any([unseres, 45s])` — unseres gewinnt, sobald es
     * früher fällt.
     */
    signal?: AbortSignal;
  } = {},
): Promise<IngestResult> {
  const startedAt = new Date();

  /*
   * Ohne Freigabe wird nichts abgerufen.
   *
   * Zwei Eigenschaften machen den Riegel wirksam, und beide sind hier
   * bewusst gesetzt:
   *
   * **Er steht vor dem ersten Netzzugriff.** Ein Abruf, der erst
   * hinterher als unzulässig erkannt wird, hat stattgefunden; die Daten
   * liegen dann schon da, und die Rechtsfrage ist bereits beantwortet,
   * falsch.
   *
   * **Er ist nicht optional.** Die erste Fassung nahm die Entscheidung
   * als Parameter entgegen — wer ihn vergass, rief ungeprüft ab, ohne
   * dass irgendetwas fehlschlug. Die Entscheidung wird jetzt hier
   * geholt. `options.policy` bleibt nur, um sie im Test zu setzen, und
   * kann den Riegel nicht abschalten: fehlt sie, wird gefragt.
   */
  {
    const { decision, allowedOperations, reason } =
      options.policy ?? decideForProvider(adapter.key);
    if (decision !== "approved" || !allowedOperations.includes("Search")) {
      return {
        sourceKey: adapter.key,
        fetched: 0,
        inserted: 0,
        updated: 0,
        unchanged: 0,
        merged: 0,
        failed: 0,
        /* Vorgabe: nicht vollständig. Ein Lauf, der scheitert oder gar
           nicht stattfindet, hat den Bestand nicht gesehen. */
        feedVollstaendig: false,
        errors: [`Abruf nicht freigegeben (${decision}): ${reason}`],
        startedAt,
        finishedAt: new Date(),
      };
    }
  }

  /*
   * Die Sicherung.
   *
   * Nach drei Fehlschlägen in Folge wird fünf Minuten lang nicht mehr
   * gefragt. Das schützt nicht uns — ein fehlgeschlagener Abruf kostet
   * uns nichts — sondern den anderen: einen überlasteten Dienst weiter
   * im Minutentakt anzufragen, verlängert seinen Ausfall.
   */
  const breaker = breakerFor(adapter.key);
  if (!breaker.allows()) {
    const sekunden = Math.ceil(breaker.retryInMs() / 1000);
    return {
      sourceKey: adapter.key,
      fetched: 0, inserted: 0, updated: 0, unchanged: 0, merged: 0, failed: 0,
      /* Ein ausgesetzter Abruf hat gar nichts gesehen. */
      feedVollstaendig: false,
      errors: [
        `Abruf ausgesetzt: die letzten Versuche sind fehlgeschlagen. ` +
          `Nächster Versuch in ${sekunden} Sekunden.`,
      ],
      startedAt,
      finishedAt: new Date(),
    };
  }

  const db = await getDb();
  const sourceId = await upsertSource(db, adapter);

  const result: IngestResult = {
    sourceKey: adapter.key,
    fetched: 0,
    inserted: 0,
    updated: 0,
    unchanged: 0,
    merged: 0,
    failed: 0,
    /* Vorgabe: nicht vollständig. Ein Lauf, der scheitert oder gar
       nicht stattfindet, hat den Bestand nicht gesehen. */
    feedVollstaendig: false,
    errors: [],
    startedAt,
    finishedAt: startedAt,
  };

  /*
   * ══════════════════════════════════════════════════════════════
   * Woran ein Lauf merkt, dass er den Bestand ganz gesehen hat
   * ══════════════════════════════════════════════════════════════
   *
   * Daran, dass er WENIGER geliefert hat, als er durfte. Wer die
   * Grenze ausschöpft, wurde abgeschnitten und hat den Rest nicht
   * gesehen; wer darunter bleibt, ist der Quelle ausgegangen.
   *
   * ── Warum diese Regel und keine Angabe je Adapter ───────────
   *
   * Weil sie für alle gilt, ohne einen einzigen anzufassen. Ein Feld,
   * das jeder Adapter selbst setzen müsste, wäre bei der Hälfte
   * falsch — und falsch heisst hier: Der Bestand wird geschlossen.
   *
   * ── Und wenn eine Quelle zufällig genau `grenze` Stellen hat ──
   *
   * Dann gilt der Lauf als unvollständig, obwohl er es nicht war. Das
   * ist die harmlose Richtung: Es wird nichts geschlossen, was noch
   * offen ist. Der umgekehrte Irrtum kostet den Bestand.
   */
  const grenze = options.limit ?? 100;

  let listings;
  try {
    /*
     * „Seit wann" nur, wo der Anbieter es wirklich kann.
     *
     * `capabilities.since` ist die entscheidende Frage. Ein Anbieter,
     * der den Filter nicht kennt, ignoriert ihn stillschweigend und
     * liefert trotzdem etwas — man bekommt ein plausibles Ergebnis und
     * hält es für gefiltert. Die Voreinstellung in
     * `DEFAULT_CAPABILITIES` ist deshalb `false`: wer nichts über sich
     * sagt, kann es nicht.
     *
     * Wo er es kann, kommt der Zeitpunkt aus dem letzten
     * ERFOLGREICHEN Lauf. Das spart bei Anbietern mit Kontingent
     * spürbar — und bei allen anderen wenigstens Zeit.
     *
     * Ein ausdrücklich übergebenes `since` gewinnt: der Aufrufer weiss
     * mehr als die Protokolltabelle, etwa beim Nachholen einer Lücke.
     */
    const kannSeit = (adapter.capabilities ?? DEFAULT_CAPABILITIES).since;
    const seit = options.since ?? (kannSeit ? await letzterErfolgreicherLauf(db, adapter.key) : null);

    listings = await adapter.fetchListings({
      limit: grenze,
      since: seit ?? undefined,
      signal: options.signal,
    });
  } catch (error) {
    /*
     * Abbruch ist kein Anbieterfehler.
     *
     * Wenn UNSERE Frist zuschlägt, hat der Anbieter nichts falsch
     * gemacht. Ihn dafür in die Sicherung zu schicken — drei Fehler,
     * fünf Minuten Pause — bestrafte ihn für unsere Knappheit, und
     * beim nächsten Lauf wäre er ausgesetzt, obwohl er verfügbar ist.
     */
    const abgebrochen = options.signal?.aborted === true ||
      (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError"));
    if (!abgebrochen) breaker.recordFailure();
    result.abgebrochen = abgebrochen;
    result.failed = abgebrochen ? 0 : 1;
    result.errors.push(
      abgebrochen
        ? "Zeitbudget erschöpft — der Lauf wurde abgebrochen, nicht der Anbieter."
        : error instanceof Error ? error.message : String(error),
    );
    result.finishedAt = new Date();
    await db
      .update(schema.jobSources)
      .set({ lastRunAt: result.finishedAt, lastRunOk: false, lastRunError: result.errors[0] ?? null })
      .where(eq(schema.jobSources.id, sourceId));
    // Auch der gescheiterte Lauf wird festgehalten. Ein Protokoll, das
    // nur Erfolge kennt, lässt eine Quelle, die seit Tagen ausfällt,
    // wie eine aussehen, die nie gefragt wurde.
    await protokolliereLauf(db, adapter.key, result);
    return result;
  }

  breaker.recordSuccess();
  result.fetched = listings.length;

  /*
   * Der Lauf hat den Bestand ganz gesehen, wenn er die Grenze nicht
   * ausgeschöpft hat. Nur dann darf ein Fehlen etwas bedeuten.
   */
  const feedVollstaendig = listings.length < grenze;
  result.feedVollstaendig = feedVollstaendig;
  const fetchedAt = new Date();

  /*
   * ── In Schwüngen statt einzeln ────────────────────────────────
   *
   * Der Reihe nach kostete jede Anzeige acht bis zehn Netzwege —
   * gemessen 6,7 Anzeigen je Sekunde. Gebündelt sind es rund zehn
   * Abfragen je Schwung, unabhängig von seiner Grösse.
   *
   * Warum 250 und nicht alles auf einmal: Eine Anweisung mit
   * zehntausend Zeilen ist mehrere Megabyte SQL und belegt für ihre
   * ganze Dauer eine Sperre. Kleine Schwünge halten die Anweisungen
   * handlich und machen einen Abbruch billig — was geschrieben ist,
   * bleibt geschrieben.
   */
  const SCHWUNG = 250;
  const normalisiert = listings.map((l) => normalise(l, fetchedAt));
  const tSchreiben = Date.now();

  for (let i = 0; i < normalisiert.length; i += SCHWUNG) {
    const teil = normalisiert.slice(i, i + SCHWUNG);
    try {
      const { ergebnisse, fehler } = await writeListings(db, sourceId, teil);
      for (const e of ergebnisse) if (e) result[e] += 1;
      for (const f of fehler) {
        result.failed += 1;
        result.errors.push(f);
      }
    } catch (error) {
      /*
       * Ein Schwung, der als Ganzes scheitert, darf nicht den ganzen
       * Lauf verlieren. Also einzeln nachfassen: Dann trifft es nur
       * die Anzeige, an der es wirklich hakt, und ihre Kennung steht
       * im Protokoll.
       */
      const ursache = error instanceof Error ? error.message : String(error);
      console.warn(
        `[ingest] Schwung von ${teil.length} Anzeigen fehlgeschlagen (${ursache.slice(0, 120)}) — einzeln nachgefasst.`,
      );
      for (const n of teil) {
        try {
          const outcome = await writeListing(db, sourceId, n);
          result[outcome] += 1;
        } catch (e2) {
          result.failed += 1;
          const u =
            e2 instanceof Error && e2.cause instanceof Error
              ? e2.cause.message
              : e2 instanceof Error
                ? e2.message
                : String(e2);
          result.errors.push(`${n.externalId}: ${u.replace(/\s+/g, " ").slice(0, 300)}`);
        }
      }
    }
  }

  /*
   * Die Schreibdauer gehört ins Protokoll.
   *
   * Sie war die entscheidende Zahl beim Umbau — und sie stand
   * nirgends. Abgeleitet werden musste sie aus den Zeiten zweier
   * Importgruppen, und das geht nur, wenn man beide zufällig
   * nebeneinander hat. Eine Zeile hier erspart das nächste Mal die
   * Rechnerei.
   */
  if (normalisiert.length > 0) {
    const s = Math.max(0.001, (Date.now() - tSchreiben) / 1000);
    console.log(
      `[ingest] ${adapter.key}: ${normalisiert.length} Anzeigen geschrieben in ${s.toFixed(1)} s ` +
        `(${(normalisiert.length / s).toFixed(0)}/s · neu ${result.inserted}, ` +
        `unverändert ${result.unchanged}, geändert ${result.updated}, zusammengeführt ${result.merged})`,
    );
  }

  for (const listing of [] as typeof listings) {
    try {
      const outcome = await writeListing(db, sourceId, normalise(listing, fetchedAt));
      result[outcome] += 1;
    } catch (error) {
      result.failed += 1;
      // Die Kennung der Anzeige, nicht ihr Inhalt: Fehlermeldungen
      // landen in Protokollen, und dort gehören keine Volltexte hin.
      /*
       * Die Ursache, nicht die Abfrage.
       *
       * Der Treiber packt die vollständige SQL-Anweisung in
       * `message` und den eigentlichen Grund — „duplicate key",
       * „value too long" — in `cause`. Protokolliert wurde bisher nur
       * das erste. Ergebnis: eine 4.000 Zeichen lange Zeile, in der
       * genau die Auskunft fehlte, wegen der man sie liest.
       */
      const ursache =
        error instanceof Error && error.cause instanceof Error
          ? error.cause.message
          : error instanceof Error
            ? error.message
            : String(error);
      result.errors.push(`${listing.externalId}: ${ursache.replace(/\s+/g, " ").slice(0, 300)}`);
    }
  }

  result.finishedAt = new Date();

  await db
    .update(schema.jobSources)
    .set({
      lastRunAt: result.finishedAt,
      lastRunOk: result.failed === 0,
      lastRunError: result.errors[0] ?? null,
      /* Nur ein vollständiger Lauf schreibt diesen Zeitpunkt. */
      ...(feedVollstaendig && result.failed === 0
        ? { lastFullSyncAt: result.finishedAt }
        : {}),
    })
    .where(eq(schema.jobSources.id, sourceId));

  /*
   * ══════════════════════════════════════════════════════════════
   * Was der Lauf NICHT mehr gesehen hat
   * ══════════════════════════════════════════════════════════════
   *
   * Erst hier, ganz am Ende, und nur nach einem vollständigen und
   * fehlerfreien Lauf. Vorher wäre jede Störung ein Massenschliessen.
   */
  if (feedVollstaendig && result.failed === 0) {
    await verfuegbarkeitFortschreiben(
      db,
      sourceId,
      new Set(listings.map((l) => l.externalId)),
      result.finishedAt,
    );
  }

  await protokolliereLauf(db, adapter.key, result);

  return result;
}

/**
 * Den Verfügbarkeitsstand aller Fundstellen einer Quelle fortschreiben.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das nur nach einem vollständigen Lauf aufgerufen wird
 * ══════════════════════════════════════════════════════════════
 *
 * Weil ein fehlender Job sonst nichts bedeutet. Wer diese Funktion
 * nach einem abgeschnittenen Lauf aufruft, zählt jede Stelle jenseits
 * der Grenze als vermisst — und nach zwei solchen Läufen ist der
 * halbe Bestand geschlossen.
 *
 * Der Aufrufer prüft das; hier steht es zur Erinnerung, weil die
 * Funktion es von aussen nicht erkennen kann.
 *
 * ── Warum in einem Rutsch und nicht Zeile für Zeile ─────────
 *
 * Bei einer Quelle mit zehntausend Fundstellen wären das zehntausend
 * Aktualisierungen. Gelesen wird einmal, gerechnet wird im Speicher,
 * und geschrieben wird nur, was sich geändert hat — bei einem
 * gewöhnlichen Lauf ist das eine Handvoll.
 */
async function verfuegbarkeitFortschreiben(
  db: Database,
  sourceId: string,
  gesehene: Set<string>,
  jetzt: Date,
): Promise<void> {
  const beruehrt = new Set<string>();

  const zeilen = await db
    .select({
      id: schema.jobSourceLinks.id,
      jobId: schema.jobSourceLinks.jobId,
      externalId: schema.jobSourceLinks.externalId,
      zustand: schema.jobSourceLinks.availabilityState,
      grund: schema.jobSourceLinks.availabilityReason,
      fehlt: schema.jobSourceLinks.missingSuccessfulSyncCount,
      geprueft: schema.jobSourceLinks.availabilityCheckedAt,
      gesehen: schema.jobSourceLinks.lastSeenAt,
      frist: schema.jobSourceLinks.validThrough,
    })
    .from(schema.jobSourceLinks)
    .where(eq(schema.jobSourceLinks.sourceId, sourceId));

  for (const z of zeilen) {
    const vorher: Verfuegbarkeitsstand = {
      zustand: z.zustand as Verfuegbarkeitsstand["zustand"],
      grund: z.grund,
      fehltSeitLaeufen: z.fehlt,
      geprueftAm: z.geprueft,
      zuletztGesehenAm: z.gesehen,
    };

    const nachher = fortschreiben(vorher, {
      gesehen: gesehene.has(z.externalId),
      feedVollstaendig: true,
      fristBis: z.frist,
      jetzt,
    });

    /*
     * Nur schreiben, was sich geändert hat.
     *
     * Bei einem gewöhnlichen Lauf ist fast alles unverändert — und
     * eine Aktualisierung, die nichts ändert, kostet trotzdem eine
     * Zeile im Schreibprotokoll und eine Runde gegen die Datenbank.
     */
    if (
      nachher.zustand === vorher.zustand &&
      nachher.fehltSeitLaeufen === vorher.fehltSeitLaeufen
    ) {
      continue;
    }

    await db
      .update(schema.jobSourceLinks)
      .set({
        availabilityState: nachher.zustand,
        availabilityReason: nachher.grund,
        availabilityCheckedAt: nachher.geprueftAm,
        missingSuccessfulSyncCount: nachher.fehltSeitLaeufen,
      })
      .where(eq(schema.jobSourceLinks.id, z.id));

    beruehrt.add(z.jobId);
  }

  if (beruehrt.size > 0) await stellenstandBilden(db, [...beruehrt]);
}

/**
 * Aus den Fundstellen einer Stelle ihren Zustand bilden.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das nicht die Aufgabe der einzelnen Quelle ist
 * ══════════════════════════════════════════════════════════════
 *
 * Eine Quelle weiss nur, was sie selbst sieht. Verschwindet eine
 * Stelle bei einem Aggregator, während das ATS des Arbeitgebers sie
 * weiter führt, ist sie aktiv — der Aggregator hat womöglich nur
 * seinen Feed geändert. Umgekehrt ist eine alte Kopie beim
 * Aggregator kein Beleg dafür, dass eine beim ATS verschwundene
 * Stelle noch offen ist.
 *
 * Deshalb wird der Zustand über ALLE Fundstellen gebildet, und
 * `rank` entscheidet, welche zählt. Die Regel steht in
 * `standAusFundstellen` und ist dort einzeln geprüft.
 *
 * Nur für die berührten Stellen: Bei einem gewöhnlichen Lauf sind das
 * eine Handvoll, nicht der Bestand.
 */
async function stellenstandBilden(db: Database, jobIds: string[]): Promise<void> {
  const zeilen = await db
    .select({
      jobId: schema.jobSourceLinks.jobId,
      rank: schema.jobSourceLinks.rank,
      zustand: schema.jobSourceLinks.availabilityState,
      grund: schema.jobSourceLinks.availabilityReason,
      fehlt: schema.jobSourceLinks.missingSuccessfulSyncCount,
      geprueft: schema.jobSourceLinks.availabilityCheckedAt,
      gesehen: schema.jobSourceLinks.lastSeenAt,
    })
    .from(schema.jobSourceLinks)
    .where(inArray(schema.jobSourceLinks.jobId, jobIds));

  const nachStelle = new Map<string, { naehe: number; stand: Verfuegbarkeitsstand }[]>();
  for (const z of zeilen) {
    const liste = nachStelle.get(z.jobId) ?? [];
    liste.push({
      naehe: z.rank,
      stand: {
        zustand: z.zustand as Verfuegbarkeitsstand["zustand"],
        grund: z.grund,
        fehltSeitLaeufen: z.fehlt,
        geprueftAm: z.geprueft,
        zuletztGesehenAm: z.gesehen,
      },
    });
    nachStelle.set(z.jobId, liste);
  }

  for (const [jobId, fundstellen] of nachStelle) {
    const stand = standAusFundstellen(fundstellen);
    await db
      .update(schema.jobs)
      .set({
        availabilityState: stand.zustand,
        availabilityReason: stand.grund,
        availabilityCheckedAt: stand.geprueftAm,
      })
      .where(eq(schema.jobs.id, jobId));
  }
}

/**
 * Jeden Lauf festhalten.
 *
 * ── Warum das gefehlt hat und was daran teuer war ─────────────
 *
 * Die Tabelle `job_ingestion_runs` gibt es seit dem ersten Entwurf. Die
 * Betriebsansicht liest sie und zeigt „Importläufe" als Kennzahl —
 * geschrieben hat sie nie jemand. Die Zahl war damit strukturell null,
 * und zwar für immer: keine Fehlermeldung, kein leeres Feld, nur eine
 * Null, die aussieht wie eine Messung.
 *
 * Ohne dieses Protokoll gibt es ausserdem kein „seit wann". Jeder Lauf
 * holt dann alles von vorn — bei Anbietern, die nach Datum filtern
 * können, ist das verschenktes Kontingent, und bei allen anderen
 * verschenkte Zeit.
 *
 * `jobSources.lastRunAt` beantwortet das nicht: dort steht nur der
 * letzte Lauf, überschrieben. Für „was hat sich seit dem letzten
 * ERFOLGREICHEN Lauf getan" braucht es die Reihe.
 */
async function protokolliereLauf(
  db: Awaited<ReturnType<typeof getDb>>,
  sourceKey: string,
  result: IngestResult,
): Promise<void> {
  try {
    await db.insert(schema.jobIngestionRuns).values({
      sourceKey,
      startedAt: result.startedAt,
      finishedAt: result.finishedAt,
      fetched: result.fetched,
      created: result.inserted,
      updated: result.updated,
      deduplicated: result.merged,
      failed: result.failed,
      // Nur die erste Meldung und gekürzt: Protokolle werden
      // weitergereicht, und in Fehlertexten von Anbietern steht
      // gelegentlich die gestellte Anfrage.
      errorSummary: result.errors[0]?.slice(0, 300) ?? null,
      durationMs: result.finishedAt.getTime() - result.startedAt.getTime(),
    });
  } catch {
    /*
     * Ein misslungenes Protokoll darf den Lauf nicht scheitern lassen.
     *
     * Die Stellen sind zu diesem Zeitpunkt bereits geschrieben. Hier
     * noch zu werfen hiesse: der Aufrufer sieht einen Fehlschlag,
     * obwohl die Arbeit getan ist — und startet den Lauf womöglich neu.
     */
  }
}

/**
 * Seit wann hat sich bei dieser Quelle etwas getan?
 *
 * Der Zeitpunkt des letzten Laufs, der wirklich etwas geholt hat. Läufe
 * mit Fehlern zählen nicht: nach einem Ausfall soll der nächste Lauf
 * die Lücke schliessen und nicht dort weitermachen, wo der gescheiterte
 * aufgehört hat.
 *
 * Gibt `null` zurück, wenn es keinen gab — dann wird alles geholt, und
 * das ist die richtige Antwort für den ersten Lauf.
 */
export async function letzterErfolgreicherLauf(
  db: Awaited<ReturnType<typeof getDb>>,
  sourceKey: string,
): Promise<Date | null> {
  const [zeile] = await db
    .select({ startedAt: schema.jobIngestionRuns.startedAt })
    .from(schema.jobIngestionRuns)
    .where(
      sql`${schema.jobIngestionRuns.sourceKey} = ${sourceKey}
          and ${schema.jobIngestionRuns.failed} = 0
          and ${schema.jobIngestionRuns.finishedAt} is not null`,
    )
    .orderBy(desc(schema.jobIngestionRuns.startedAt))
    .limit(1);
  return zeile?.startedAt ?? null;
}


/**
 * Dieselbe Stelle — aber bei einem ANDEREN Anbieter.
 *
 * ── Warum das „andere" hier steht ─────────────────────────────
 *
 * Der Schlüssel ist Titel, Arbeitgeber und Ort. Über Anbietergrenzen
 * hinweg ist das ein starkes Indiz: zwei Portale führen dieselbe
 * Anzeige. Innerhalb eines Anbieters ist es das Gegenteil — er hat
 * seinen eigenen Bestand längst entdoppelt. Fünf Zeilen „Kundenberater
 * (m/w/d), Muster GmbH, Karlsruhe" von TheirStack sind fünf offene
 * Stellen in einem Callcenter, nicht eine.
 *
 * Ohne diese Einschränkung wurden vier davon als „merged" verbucht und
 * verschwanden — dauerhaft, in der Datenbank. Das fällt niemandem auf:
 * eine kürzere Liste sieht aus wie eine vollständige, und die Zahl im
 * Kopf der Jobseite stimmt weiterhin mit dem überein, was gespeichert
 * ist.
 *
 * Aufgefallen ist es an der Zwillingsstelle im Arbeitsspeicher
 * (`fuehreZusammen`), bei einer Leistungsmessung: 500 Sätze fielen auf
 * einen zusammen. Derselbe Denkfehler, zwei Stellen — deshalb hier
 * dieselbe Regel.
 *
 * Eigene Funktion und nicht inline, damit sie prüfbar ist: eine
 * Zusammenführung, die zu viel zusammenführt, lässt sich sonst nur an
 * ihren Folgen erkennen.
 */
export async function gleicheStelleBeiAnderemAnbieter(
  db: Awaited<ReturnType<typeof getDb>>,
  canonicalKey: string,
  sourceId: string,
): Promise<string | null> {
  const [treffer] = await db
    .select({ jobId: schema.jobSourceLinks.jobId })
    .from(schema.jobSourceLinks)
    .where(
      sql`${schema.jobSourceLinks.canonicalKey} = ${canonicalKey} and ${schema.jobSourceLinks.sourceId} <> ${sourceId}`,
    )
    .limit(1);
  return treffer?.jobId ?? null;
}


/**
 * Dieselbe Stelle, nochmals vom selben Anbieter eingestellt.
 *
 * Nur wenn der Beschreibungstext übereinstimmt. Titel, Firma und Ort
 * allein reichen innerhalb eines Anbieters nicht: sie treffen auch auf
 * mehrere echte Ausschreibungen zu, und die dürfen nicht verschwinden.
 *
 * Höchstens fünf Kandidaten: mehr Zeilen mit demselben Schlüssel sind
 * eher ein Zeichen für viele echte Stellen als für eine Wiederholung,
 * und jeder Vergleich lädt einen Beschreibungstext.
 */
export async function wiederholungBeiGleichemAnbieter(
  db: Awaited<ReturnType<typeof getDb>>,
  canonicalKey: string,
  sourceId: string,
  beschreibung: string,
): Promise<string | null> {
  const kandidaten = await db
    .select({ jobId: schema.jobSourceLinks.jobId, description: schema.jobs.description })
    .from(schema.jobSourceLinks)
    .innerJoin(schema.jobs, eq(schema.jobs.id, schema.jobSourceLinks.jobId))
    .where(
      sql`${schema.jobSourceLinks.canonicalKey} = ${canonicalKey}
          and ${schema.jobSourceLinks.sourceId} = ${sourceId}`,
    )
    .limit(5);

  for (const k of kandidaten) {
    if (aehnlicherText(k.description ?? "", beschreibung)) return k.jobId;
  }
  return null;
}
