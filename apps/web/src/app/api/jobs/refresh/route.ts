import { NextResponse } from "next/server";
import { loadRuntimeConfig } from "@paycheck/config";
import { activeAdapters, ingestFromAdapter, type IngestResult } from "@paycheck/jobs";
import { suchbegriffeAusProfilen } from "@/lib/jobs/suchbegriffe";
import { currentUser } from "@/lib/auth";
import { decideForProvider } from "@paycheck/sources";
import { ATS_BOARDS, loadRegistrations, setBoardRegistrations } from "@paycheck/jobs";

export const dynamic = "force-dynamic";
/*
 * Fünf Minuten statt zwei.
 *
 * Bei zwei Minuten und achtundzwanzig Quellen bekam jede rund vier
 * Sekunden, bevor der Lauf abbrach — und die hinteren kamen gar nicht
 * mehr dran. Was abgeschnitten wird, fehlt im Bestand, und niemand
 * sieht warum: Der Bericht meldet die Quellen, die noch liefen.
 */
export const maxDuration = 300;

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
  /*
   * Die registrierten Arbeitgeberboards laden, bevor die Adapter
   * gebaut werden.
   *
   * Ohne diesen Schritt meldet jeder ATS-Adapter „nicht eingerichtet"
   * — was formal stimmt, aber die falsche Ursache nennt: nicht die
   * Zugangsdaten fehlen, sondern die Liste der Arbeitgeber, die uns
   * berechtigt haben.
   */
  for (const board of ATS_BOARDS) {
    setBoardRegistrations(board, await loadRegistrations(board));
  }

  /*
   * Dieselbe Liste wie im Kommandozeilenlauf.
   *
   * Hier stand `cfg.jobs.sources` — die Aufzählung aus `JOB_SOURCES`.
   * Genau die Falle, die aus der Registry entfernt wurde, steckte damit
   * weiter in diesem Pfad: `JOB_SOURCES=arbeitnow` stand in der
   * Konfiguration, und ein Zeitplan, der diesen Endpunkt aufruft, hätte
   * für immer nur eine einzige Quelle abgerufen — ohne Fehler, ohne
   * Hinweis, mit einem Bericht, der „erfolgreich" meldet.
   *
   * Zwei Wege in denselben Abruf brauchen dieselbe Antwort auf die
   * Frage, welche Quellen laufen. `activeAdapters()` ist diese
   * Antwort: eingerichtet, lizenziert, nicht ausdrücklich abgeschaltet.
   */
  /*
   * Wonach gesucht wird, kommt aus den Profilen im System.
   *
   * Bis hierher fragte die Bundesagentur mit fünf fest eingetragenen
   * Begriffen. Der Bestand wuchs deshalb in genau fünf Richtungen —
   * und wer in eine sechste wollte, fand dort nichts. Nicht weil es
   * nichts gibt, sondern weil nie jemand danach gefragt hatte.
   *
   * Die Begriffe ERGÄNZEN die Grundausstattung, sie ersetzen sie nicht:
   * Über 63 Konten mit Belegen überschritten nur drei abgeleitete
   * Richtungen die Schwelle. Ein Austausch hätte verengt statt
   * erweitert.
   *
   * Schlägt die Ableitung fehl, läuft der Abruf mit der
   * Grundausstattung weiter. Ein Abruf, der wegen der Suchbegriffe gar
   * nichts holt, wäre schlimmer als einer mit den alten.
   */
  let ausProfilen: string[] = [];
  try {
    ausProfilen = (await suchbegriffeAusProfilen()).map((b) => b.begriff);
  } catch {
    ausProfilen = [];
  }

  const adapters = activeAdapters(cfg, { abfragen: ausProfilen }).filter(
    (a) => a.key !== "user_private_import" && a.key !== "seed",
  );

  if (adapters.length === 0) {
    return NextResponse.json(
      {
        error:
          "Es ist keine abrufbare Stellenquelle eingerichtet. Eine Quelle läuft, sobald " +
          "ihre Zugangsdaten hinterlegt sind und ihr Eintrag im Quellenverzeichnis " +
          "freigegeben ist. Den Stand zeigt `node scripts/provider-status.mjs`.",
      },
      { status: 409 },
    );
  }

  /*
   * Bis zu 500 Anzeigen je Quelle.
   *
   * Vorher 200. Die Zahl ist eine Obergrenze gegen Vertipper im
   * Zeitplan, keine fachliche Grenze — die setzen die Anbieter selbst
   * über ihre Kontingente, und die Adapter halten sich daran.
   */
  const limit = Math.min(500, Number(new URL(request.url).searchParams.get("limit") ?? 100));
  const skipped: { key: string; reason: string }[] = [];

  /*
   * ══════════════════════════════════════════════════════════════
   * Quellenfamilien nebeneinander, Länder darin nacheinander
   * ══════════════════════════════════════════════════════════════
   *
   * Hier lief eine einzige Schleife: achtundzwanzig Quellen, eine nach
   * der anderen. Die Wartezeiten addierten sich, obwohl fast alle auf
   * VERSCHIEDENE Anbieter warten — und bei zwei Minuten Zeitrahmen kam
   * das Ende der Liste nie dran.
   *
   * Alles gleichzeitig zu starten wäre der falsche Schluss. Von den
   * achtundzwanzig Quellen sind achtzehn Adzuna-Länder — DERSELBE
   * Anbieter. Achtzehn Anfragen auf einmal ist genau das, wogegen ein
   * Ratenlimit gebaut ist, und wir haben uns verpflichtet, keines zu
   * umgehen.
   *
   * Deshalb: gruppiert nach Anbieter (der Teil des Schlüssels vor dem
   * ersten Unterstrich — `adzuna_de`, `adzuna_ch`, … gehören zusammen).
   * Die Gruppen laufen nebeneinander, die Quellen innerhalb einer
   * Gruppe weiterhin nacheinander. Jeder Anbieter sieht damit genau
   * eine Anfrage von uns zur Zeit — wie vorher.
   *
   * Die Dauer eines Laufs ist danach die der LÄNGSTEN Gruppe statt der
   * Summe aller.
   */
  const familien = new Map<string, typeof adapters>();
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

    const familie = adapter.key.split("_")[0] ?? adapter.key;
    const liste = familien.get(familie);
    if (liste) liste.push(adapter);
    else familien.set(familie, [adapter]);
  }

  const results: IngestResult[] = (
    await Promise.all(
      [...familien.values()].map(async (gruppe) => {
        const ausGruppe: IngestResult[] = [];
        for (const adapter of gruppe) {
          const policy = decideForProvider(adapter.key);
          ausGruppe.push(
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
        return ausGruppe;
      }),
    )
  ).flat();

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
