import { NextResponse } from "next/server";
import { loadRuntimeConfig } from "@paycheck/config";
import { adapterByKey, ingestFromAdapter, type IngestResult } from "@paycheck/jobs";
import { currentUser } from "@/lib/auth";
import { decideForProvider } from "@paycheck/sources";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Echte Stellen abrufen — im Serverprozess.
 *
 * Warum nicht als Skript von außen: die eingebettete Datenbank läuft in
 * genau einem Prozess. Ein Abruf aus einem zweiten Prozess schreibt in
 * dieselbe Ablage, aber der laufende Server sieht davon nichts — und man
 * sucht den Fehler stundenlang an der falschen Stelle. Im Betrieb mit
 * einem eigenständigen Postgres gilt das nicht mehr; dann kann derselbe
 * Aufruf aus einem Zeitplan kommen.
 *
 * Der Lauf ist wiederholbar: zweimal ausgeführt entsteht nichts doppelt.
 */
export async function POST(request: Request) {
  const cfg = loadRuntimeConfig();

  // Zwei Wege hinein, beide bewusst eng: eine angemeldete Person, oder
  // ein Zeitplan mit dem passenden Geheimnis. Offen wäre der Endpunkt
  // eine Einladung, die Quelle in unserem Namen zu belästigen.
  const secret = process.env.JOBS_REFRESH_SECRET;
  const header = request.headers.get("authorization");
  const authorisedBySecret = !!secret && header === `Bearer ${secret}`;

  if (!authorisedBySecret && !(await currentUser())) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  /*
   * Die Policy Engine ist die einzige Instanz, die über den Abruf
   * entscheidet.
   *
   * Vorher filterte zusätzlich die Registry nach „eingerichtet" — mit
   * dem Ergebnis, dass eine nicht eingerichtete Quelle die Prüfung nie
   * erreichte und im Bericht auch nicht auftauchte. Zwei Filter für
   * dieselbe Frage sind einer zu viel; der schwächere gewinnt dann
   * stillschweigend.
   */
  const adapters = cfg.jobs.sources
    .filter((key) => key !== "user_text" && key !== "seed")
    .map((key) => adapterByKey(key))
    .filter((a): a is NonNullable<typeof a> => a !== undefined);

  if (adapters.length === 0) {
    return NextResponse.json(
      {
        error:
          "Es ist keine abrufbare Stellenquelle aktiv. Trage sie in JOB_SOURCES ein — " +
          "zum Beispiel JOB_SOURCES=arbeitnow.",
      },
      { status: 409 },
    );
  }

  const limit = Math.min(200, Number(new URL(request.url).searchParams.get("limit") ?? 100));
  const results: IngestResult[] = [];

  const skipped: { key: string; reason: string }[] = [];

  for (const adapter of adapters) {
    // Jede Quelle einzeln. Eine gesperrte blockiert nicht die anderen —
    // und eine freigegebene deckt keine gesperrte mit ab.
    const policy = decideForProvider(adapter.key);

    if (policy.decision !== "approved") {
      skipped.push({ key: adapter.key, reason: policy.reason });
      continue;
    }

    // Freigegeben, aber ohne Zugangsdaten: auch das gehört in den
    // Bericht statt in einen stillen Abbruch.
    if (!adapter.isConfigured()) {
      skipped.push({
        key: adapter.key,
        reason: "Freigegeben, aber es sind keine Zugangsdaten hinterlegt.",
      });
      continue;
    }

    results.push(
      await ingestFromAdapter(adapter, {
        limit,
        policy: {
          decision: policy.decision,
          allowedOperations: policy.allowedOperations,
          reason: policy.reason,
        },
      }),
    );
  }

  const total = results.reduce(
    (acc, r) => ({
      fetched: acc.fetched + r.fetched,
      inserted: acc.inserted + r.inserted,
      updated: acc.updated + r.updated,
      unchanged: acc.unchanged + r.unchanged,
      merged: acc.merged + r.merged,
      failed: acc.failed + r.failed,
    }),
    { fetched: 0, inserted: 0, updated: 0, unchanged: 0, merged: 0, failed: 0 },
  );

  return NextResponse.json({
    // Was NICHT abgerufen wurde und warum — das gehört in dieselbe
    // Antwort wie das, was abgerufen wurde.
    skipped,
    total,
    sources: results.map((r) => ({
      key: r.sourceKey,
      fetched: r.fetched,
      inserted: r.inserted,
      updated: r.updated,
      unchanged: r.unchanged,
      // Anzeigen, die zu einer bereits bekannten Stelle gehörten.
      merged: r.merged,
      failed: r.failed,
      // Nur die erste Meldung, und ohne Anzeigentext: Fehlermeldungen
      // landen in Protokollen, und dort gehören keine Volltexte hin.
      firstError: r.errors[0] ?? null,
      durationMs: r.finishedAt.getTime() - r.startedAt.getTime(),
    })),
  });
}
