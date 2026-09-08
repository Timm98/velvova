import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb, schema } from "@paycheck/db";
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
    /*
     * ══════════════════════════════════════════════════════════════
     * Warum ein 401 hier mehr sagen darf als sonst
     * ══════════════════════════════════════════════════════════════
     *
     * Ein Zeitplan, der abgewiesen wird, meldet `401` — und damit
     * genau eine Information: „nein". Ob das Geheimnis auf dem Server
     * fehlt, ob es sich unterscheidet oder ob die Kopfzeile gar nicht
     * ankam, ist von aussen nicht zu trennen. Genau daran ist der
     * erste Einrichtungsversuch am 8. September 2026 hängen
     * geblieben.
     *
     * Deshalb steht hier eine Auskunft — aber nur aus WAHRHEITSWERTEN.
     * Kein Wert, kein Ausschnitt, keine Länge. Wer die Antwort liest,
     * erfährt, WELCHE der drei Ursachen vorliegt, und nichts sonst:
     *
     *   serverKennt=false    die Variable fehlt in der Laufzeit
     *   kopfzeileDa=false    die Kopfzeile kam nicht an
     *   formStimmt=false     kein `Bearer `-Präfix
     *   laengeGleich=false   beide da, aber verschiedene Werte
     *
     * `laengeGleich` vergleicht nur, es nennt keine Zahl. Damit lässt
     * sich ein angehängter Zeilenumbruch finden — der häufigste
     * Fehler beim Einfügen — ohne über den Wert etwas zu verraten.
     *
     * Die Auskunft gibt es nur, wenn überhaupt eine Kopfzeile
     * geschickt wurde. Ein zufälliger Besucher sieht weiterhin nur
     * „Nicht angemeldet."
     */
    if (header !== null) {
      const uebergeben = header.startsWith("Bearer ") ? header.slice(7) : null;
      return NextResponse.json(
        {
          error: "Nicht angemeldet.",
          diagnose: {
            serverKennt: !!secret,
            kopfzeileDa: true,
            formStimmt: uebergeben !== null,
            laengeGleich:
              secret !== undefined && uebergeben !== null
                ? secret.length === uebergeben.length
                : null,
          },
        },
        { status: 401 },
      );
    }
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

  /*
   * ══════════════════════════════════════════════════════════════
   * Zwei Sekunden Pause zwischen zwei Abrufen desselben Anbieters
   * ══════════════════════════════════════════════════════════════
   *
   * Der erste Lauf mit dreihundert Anzeigen je Quelle brachte 932
   * neue Stellen — und acht von vierzehn Adzuna-Ländern antworteten
   * gar nicht:
   *
   *     adzuna_de, at, ch, us, gb, nl    503
   *     adzuna_in, mx                    429
   *
   * 429 heisst „zu viele Anfragen". Wir haben uns verpflichtet, kein
   * Ratenlimit zu umgehen — und ein Limit umgeht man nicht nur durch
   * Tricks, sondern auch dadurch, dass man dagegenläuft und die
   * Fehler wegschaut.
   *
   * Mehr Anfragen sind hier ausserdem WENIGER Stellen: Sechs Länder
   * lieferten, acht nichts. Wer wartet, bekommt vierzehn.
   *
   * Die Pause steht zwischen den Ländern einer Familie, nicht
   * zwischen den Familien: Verschiedene Anbieter stören einander
   * nicht.
   */
  const warte = (ms: number) => new Promise<void>((fertig) => setTimeout(fertig, ms));
  const PAUSE_MS = 2_000;

  /*
   * ══════════════════════════════════════════════════════════════
   * Ein Lauf schafft nicht alle Länder — also reihum
   * ══════════════════════════════════════════════════════════════
   *
   * Gemessen an einem echten Lauf, Dauer je Adzuna-Land:
   *
   *     157 s, 87 s, 75 s, 56 s, 33 s, 23 s
   *
   * Sechs Länder brauchten zusammen über sieben Minuten. Achtzehn
   * passen in kein Zeitfenster, das man einem Endpunkt geben will —
   * und ein Lauf, der immer bei `adzuna_de` beginnt, kommt bei den
   * hinteren Ländern nie an.
   *
   * Deshalb rotiert der Startpunkt mit der Uhrzeit: Jeder Lauf beginnt
   * dort, wo der vorige aufgehört hätte. Bei acht Läufen am Tag ist
   * jedes Land regelmässig dran, ohne dass irgendwo Zustand
   * gespeichert werden muss — die Zeit selbst ist der Zeiger.
   *
   * Dazu ein Zeitbudget: Vier Minuten, dann bricht die Familie ab.
   * Was übrig bleibt, ist beim nächsten Lauf vorn.
   */
  const BUDGET_MS = 240_000;
  const beginn = Date.now();

  /*
   * ══════════════════════════════════════════════════════════════
   * Der Zeiger muss so schnell wandern wie der Zeitplan ruft
   * ══════════════════════════════════════════════════════════════
   *
   * Hier stand `3 * 60 * 60 * 1000` — drei Stunden, passend zum
   * damaligen Zeitplan `15 * / 3 * * *` mit acht Läufen am Tag.
   *
   * Der Zeitplan wurde auf `15 * * * *` umgestellt, also stündlich.
   * Diese Konstante blieb stehen — und damit bekamen die Läufe um
   * 00:15, 01:15 und 02:15 DENSELBEN Zeiger, dieselbe Reihenfolge und
   * damit dieselben Quellen. Vierundzwanzig Läufe am Tag ergaben acht
   * verschiedene Reihenfolgen; zwei von drei Läufen holten, was der
   * vorige schon geholt hatte, und die hinteren Länder einer Familie
   * kamen trotz des dichteren Takts nicht öfter dran als vorher.
   *
   * Der Fehler war unsichtbar, weil nichts fehlschlug: Jeder Lauf
   * meldete Erfolg, nur eben über denselben Ausschnitt.
   *
   * Deshalb steht die Schrittweite jetzt neben dem Zeitplan, aus dem
   * sie folgt. Wer den Zeitplan ändert, ändert sie mit — und wer es
   * vergisst, liest hier, warum das nicht folgenlos bleibt.
   */
  const ZEITPLAN_ABSTAND_MS = 60 * 60 * 1000; // .github/workflows/stellen-abruf.yml: "15 * * * *"
  const takt = Math.floor(beginn / ZEITPLAN_ABSTAND_MS);

  /*
   * ══════════════════════════════════════════════════════════════
   * Die ergiebigen Länder zuerst
   * ══════════════════════════════════════════════════════════════
   *
   * Die Reihenfolge innerhalb einer Familie war bisher die des
   * Verzeichnisses, rotiert nach Uhrzeit. Jedes Land kam gleich oft
   * dran — auch die, aus denen kaum noch etwas Neues kommt.
   *
   * Gemessen am 7. September, Ausbeute je Quelle über alle Läufe
   * (neue Stellen ÷ geholte Anzeigen):
   *
   *     adzuna_mx   86,1 %      adzuna_be    9,6 %
   *     adzuna_us   84,8 %      adzuna_it   20,3 %
   *     adzuna_in   84,6 %      adzuna_ca   17,1 %
   *     adzuna_de   36,0 %      usajobs      3,2 %
   *
   * Aus Mexiko ist fast jede geholte Anzeige neu, aus den USA
   * ebenso; `usajobs` ist praktisch leergeräumt. Bei gleichem Aufwand
   * bringt die obere Hälfte ein Vielfaches der unteren.
   *
   * Deshalb entscheidet jetzt die Ausbeute über die Reihenfolge, und
   * das Zeitbudget schneidet unten ab. Die Zahlen kommen aus
   * `job_ingestion_runs` — aus dem, was wirklich passiert ist, nicht
   * aus einer gepflegten Liste, die veraltet.
   *
   * ── Warum trotzdem rotiert wird ─────────────────────────────
   *
   * Ohne Rotation liefe immer dieselbe obere Hälfte, und die untere
   * käme nie dran — ihre Ausbeute bliebe hoch, weil sie ungenutzt
   * ist, und niemand merkte es. Der Versatz nach Uhrzeit bleibt
   * deshalb bestehen; er verschiebt nur eine bereits sortierte Liste.
   */
  const ausbeute = new Map<string, number>();
  try {
    const datenbank = await getDb();
    const zeilen = await datenbank
      .select({
        quelle: schema.jobIngestionRuns.sourceKey,
        neu: sql<number>`coalesce(sum(${schema.jobIngestionRuns.created}), 0)::int`,
        geholt: sql<number>`coalesce(sum(${schema.jobIngestionRuns.fetched}), 0)::int`,
      })
      .from(schema.jobIngestionRuns)
      .groupBy(schema.jobIngestionRuns.sourceKey);
    for (const z of zeilen) {
      /* Ohne Abrufe keine Aussage — solche Quellen kommen ans Ende
         der bekannten, aber vor die gar nicht gemessenen. */
      if (z.geholt > 0) ausbeute.set(z.quelle, z.neu / z.geholt);
    }
  } catch {
    /* Ohne Zahlen bleibt die Reihenfolge des Verzeichnisses. Ein
       Abruf ohne Sortierung ist besser als keiner. */
  }

  /*
   * Unbekannte Quellen bekommen 0,5 statt 0.
   *
   * Eine neue Quelle hat noch keine Läufe und damit keine Ausbeute.
   * Mit 0 stünde sie ganz hinten und käme wegen des Zeitbudgets nie
   * dran — sie könnte ihre Zahlen also nie beweisen. Mit 0,5 startet
   * sie im oberen Mittelfeld und sortiert sich nach dem ersten Lauf
   * selbst ein.
   */
  const rang = (schluessel: string) => ausbeute.get(schluessel) ?? 0.5;
  for (const gruppe of familien.values()) {
    if (gruppe.length > 1) gruppe.sort((a, b) => rang(b.key) - rang(a.key));
  }

  const results: IngestResult[] = (
    await Promise.all(
      [...familien.values()].map(async (gruppe) => {
        const ausGruppe: IngestResult[] = [];
        const versatz = gruppe.length > 1 ? takt % gruppe.length : 0;
        for (let n = 0; n < gruppe.length; n++) {
          if (Date.now() - beginn > BUDGET_MS) break;
          if (n > 0) await warte(PAUSE_MS);
          const adapter = gruppe[(versatz + n) % gruppe.length]!;
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
