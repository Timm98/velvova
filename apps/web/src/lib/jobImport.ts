import { eq } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";
import { decideForUrl, restrictFields, findByUrl } from "@paycheck/sources";
import { beschreibungsTokens } from "@paycheck/matching";

/**
 * Eine einzelne Anzeige von einer freigegebenen Quelle holen.
 *
 * Zwei Dinge unterscheiden das von einem gewöhnlichen `fetch`:
 *
 * **Verbunden wird zur geprüften Adresse, nicht zum Namen.** Sonst
 * wäre die SSRF-Prüfung wirkungslos — zwischen Prüfung und Abruf kann
 * sich die Namensauflösung ändern, und genau darauf beruht DNS
 * Rebinding.
 *
 * **Gespeichert wird nur, was die Quelle erlaubt.** `restrictFields()`
 * wirft weg, was nicht in `allowedFields` steht. Der Anbieter liefert
 * oft mehr, als wir zeigen dürfen.
 */

export interface ImportResult {
  ok: boolean;
  modus: "imported" | "bookmark" | "failed";
  jobId?: string;
  titel?: string;
  unternehmen?: string;
  quelle?: string;
  hinweis?: string;
  fehler?: string;
}

/** Anzeigen sind Text. Alles darüber ist etwas anderes. */
const MAX_BYTES = 2 * 1024 * 1024;

export async function importFromUrl(
  userId: string,
  url: URL,
  addresses: string[],
): Promise<ImportResult> {
  const entscheidung = decideForUrl(url.href);
  const eintrag = findByUrl(url.href);

  if (entscheidung.decision !== "approved") {
    return {
      ok: false,
      modus: "bookmark",
      hinweis: entscheidung.reason,
    };
  }

  let rohtext: string;
  try {
    rohtext = await fetchLimited(url, addresses[0]);
  } catch (error) {
    return {
      ok: false,
      modus: "failed",
      fehler: error instanceof Error ? error.message : String(error),
    };
  }

  /*
   * JSON-LD ist der einzige Weg, aus einer fremden Seite verlässlich
   * strukturierte Daten zu lesen, ohne ihr HTML zu interpretieren.
   * Steht dort kein JobPosting, wird nichts geraten: die Person
   * bekommt die Bitte, den Text einzufügen.
   */
  const posting = extractJobPosting(rohtext);
  if (!posting) {
    return {
      ok: false,
      modus: "bookmark",
      hinweis:
        "Auf der Seite stehen keine strukturierten Stellendaten. Füge den Anzeigentext ein, " +
        "dann analysiert Monday ihn.",
    };
  }

  const erlaubt = restrictFields(entscheidung, {
    title: posting.title,
    company: posting.company,
    location: posting.location,
    description: posting.description,
    source_url: url.href,
  }) as Record<string, string | null>;

  const db = await getDb();
  const jobId = await withUser(db, userId, async (tx) => {
    const [company] = await tx
      .insert(schema.companies)
      .values({ name: erlaubt.company ?? "Nicht angegeben" })
      .onConflictDoNothing()
      .returning({ id: schema.companies.id });

    const companyId =
      company?.id ??
      (
        await tx
          .select({ id: schema.companies.id })
          .from(schema.companies)
          .where(eq(schema.companies.name, erlaubt.company ?? "Nicht angegeben"))
          .limit(1)
      )[0]?.id;

    if (!companyId) return null;

    const [source] = await tx
      .select({ id: schema.jobSources.id })
      .from(schema.jobSources)
      .where(eq(schema.jobSources.key, eintrag?.providerKey ?? "user_url"))
      .limit(1);

    if (!source) return null;

    const beschreibung = erlaubt.description ?? "";
    const [job] = await tx
      .insert(schema.jobs)
      .values({
        title: erlaubt.title ?? "Ohne Titel",
        companyId,
        location: erlaubt.location ?? "Nicht angegeben",
        workModel: "on_site",
        description: beschreibung,
        /*
         * Die Ableitungen gehören zum Schreibvorgang, nicht zur Kür.
         *
         * Die Spalten haben einen Standardwert in der Datenbank — was
         * bequem ist und deshalb gefährlich: ohne diese zwei Zeilen
         * hätte der Typprüfer geschwiegen, die Zeile wäre entstanden,
         * und die Stelle wäre für immer mit leerer Wortmenge bewertet
         * worden. Kein Fehler, keine Warnung, nur ein Passungswert, der
         * zwei seiner sieben Achsen nicht kennt.
         */
        descriptionTokens: beschreibungsTokens(beschreibung),
        descriptionLength: beschreibung.length,
        sourceId: source.id,
        originalUrl: url.href,
        contentHash: `import:${url.href}`,
        publishedAt: posting.publishedAt,
        expiresAt: posting.validThrough,
      })
      .returning({ id: schema.jobs.id });

    return job?.id ?? null;
  });

  if (!jobId) {
    return { ok: false, modus: "failed", fehler: "Die Anzeige konnte nicht gespeichert werden." };
  }

  return {
    ok: true,
    modus: "imported",
    jobId,
    titel: erlaubt.title ?? undefined,
    unternehmen: erlaubt.company ?? undefined,
    quelle: eintrag?.displayName ?? url.hostname,
  };
}

/**
 * Abrufen mit Obergrenze, Zeitlimit und ohne Weiterleitungen.
 *
 * Weiterleitungen sind ausgeschaltet, weil sie die Adressprüfung
 * aushebeln: eine geprüfte öffentliche Adresse darf mit einem 302 auf
 * 127.0.0.1 zeigen, und der Abruf folgt brav. Eine Weiterleitung wird
 * deshalb als Ergebnis gemeldet, nicht verfolgt.
 */
async function fetchLimited(url: URL, address: string | undefined): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(url, {
      redirect: "manual",
      signal: controller.signal,
      headers: {
        // Ehrlich sagen, wer da anfragt. Ein getarnter User-Agent wäre
        // der erste Schritt zu genau dem Verhalten, das dieses Produkt
        // ablehnt.
        "user-agent": "VelvovaJobImport/1.0 (+https://paycheck.example/bot)",
        accept: "text/html,application/xhtml+xml",
        ...(address ? { host: url.host } : {}),
      },
    });

    if (response.status >= 300 && response.status < 400) {
      throw new Error(
        "Die Seite leitet weiter. Weiterleitungen werden nicht verfolgt — " +
          "öffne die Zieladresse und füge sie direkt ein.",
      );
    }

    if (!response.ok) {
      throw new Error(`Die Seite antwortet mit ${response.status}.`);
    }

    const laenge = Number(response.headers.get("content-length") ?? 0);
    if (laenge > MAX_BYTES) {
      throw new Error("Die Seite ist zu gross für einen Anzeigenimport.");
    }

    const text = await response.text();
    if (text.length > MAX_BYTES) {
      throw new Error("Die Seite ist zu gross für einen Anzeigenimport.");
    }
    return text;
  } finally {
    clearTimeout(timer);
  }
}

export interface ParsedPosting {
  title: string | null;
  company: string | null;
  location: string | null;
  description: string | null;
  publishedAt: Date | null;
  validThrough: Date | null;
}

/**
 * `JobPosting` aus JSON-LD lesen.
 *
 * Bewusst kein HTML-Parser. Was in einem `<script type="application/ld+json">`
 * steht, hat der Arbeitgeber selbst als maschinenlesbare Beschreibung
 * seiner Stelle veröffentlicht — genau dafür ist das Format da. Aus dem
 * Fliesstext einer Seite dasselbe herauszuraten wäre eine Auslegung
 * fremder Inhalte, und die steht uns nicht zu.
 */
export function extractJobPosting(html: string): ParsedPosting | null {
  const bloecke = [...html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )];

  for (const block of bloecke) {
    let daten: unknown;
    try {
      daten = JSON.parse(block[1]!.trim());
    } catch {
      continue;
    }

    // JSON-LD erlaubt ein Objekt, eine Liste oder einen @graph.
    const kandidaten: unknown[] = Array.isArray(daten)
      ? daten
      : typeof daten === "object" && daten !== null && "@graph" in daten
        ? ((daten as { "@graph": unknown[] })["@graph"] ?? [])
        : [daten];

    for (const kandidat of kandidaten) {
      if (typeof kandidat !== "object" || kandidat === null) continue;
      const o = kandidat as Record<string, unknown>;
      if (String(o["@type"] ?? "") !== "JobPosting") continue;

      return {
        title: str(o.title),
        company: str((o.hiringOrganization as Record<string, unknown> | undefined)?.name),
        location: leseOrt(o.jobLocation),
        description: str(o.description)?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() ?? null,
        publishedAt: datum(o.datePosted),
        validThrough: datum(o.validThrough),
      };
    }
  }

  return null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function datum(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function leseOrt(value: unknown): string | null {
  const erster = Array.isArray(value) ? value[0] : value;
  if (typeof erster !== "object" || erster === null) return null;
  const adresse = (erster as Record<string, unknown>).address;
  if (typeof adresse !== "object" || adresse === null) return null;
  const a = adresse as Record<string, unknown>;
  return str(a.addressLocality) ?? str(a.addressRegion) ?? str(a.addressCountry);
}
