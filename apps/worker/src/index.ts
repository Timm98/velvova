import { loadRuntimeConfig } from "@paycheck/config";
import { pgliteOwner, resolveDataDir } from "@paycheck/db";
import { runRetention } from "./tasks/retention.ts";
import { markExpired, runLinkCheck } from "./tasks/linkCheck.ts";
import { createCheckInReminders, createFollowUpReminders } from "./tasks/reminders.ts";
import { runEntgeltReferenz } from "./tasks/entgeltreferenz.ts";
import { runProfilsynthese } from "./tasks/profilsynthese.ts";
import { runGeodaten } from "./tasks/geodaten.ts";
import { runBedarfsschnappschuss } from "./tasks/bedarfsschnappschuss.ts";

/**
 * Der Worker.
 *
 * Bewusst ohne Queue-Infrastruktur: die Aufgaben sind wenige, laufen
 * periodisch und vertragen einen Neustart. Eine Warteschlange waere eine
 * Abhaengigkeit ohne heutigen Nutzen. Siehe docs/adr/0006.
 *
 * Mit --once laeuft jede Aufgabe einmal und der Prozess endet - so laesst
 * sich derselbe Code aus einem Cron heraus verwenden.
 */

const cfg = loadRuntimeConfig();
const INTERVAL_MS = 15 * 60_000;

async function runAll(): Promise<void> {
  const started = Date.now();

  const results = await Promise.allSettled([
    runRetention(),
    runLinkCheck(),
    markExpired(),
    createFollowUpReminders(),
    createCheckInReminders(),
    runEntgeltReferenz(),
    /*
     * Die Profilsynthese steht zuletzt.
     *
     * Sie ist die einzige Aufgabe hier, die Geld kostet — und die
     * einzige, die von einem fremden Dienst abhängt. Was vor ihr
     * steht, läuft auch dann durch, wenn der Anbieter gerade nicht
     * antwortet.
     */
    runProfilsynthese(),
    /*
     * Koordinaten für neu importierte Stellen.
     *
     * Reine Rechenzeit gegen die eigene Referenztabelle — kein
     * Modell, kein fremder Dienst. Sie steht hinter der Synthese,
     * weil sie ohne Netz auskommt und deshalb nie hängen bleibt.
     */
    runGeodaten(),
    /*
     * Der Bedarfsschnappschuss.
     *
     * Läuft einmal am Tag und ist der einzige Auftrag hier, dessen
     * Ausfall sich nicht nachholen lässt: Ein Tag ohne Aufzeichnung
     * ist ein Tag, über den nie jemand etwas sagen kann. Er steht
     * trotzdem hinten, weil er ohne fremden Dienst auskommt und
     * deshalb nie hängen bleibt.
     */
    runBedarfsschnappschuss(),
  ]);

  const names = ["Aufbewahrung", "Linkcheck", "Abgelaufene Anzeigen", "Nachfass-Erinnerungen", "Check-ins", "Gehalts-Referenz", "Profilsynthese", "Geodaten", "Bedarfsschnappschuss"];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      console.log(`  ${names[i]}: ${JSON.stringify(r.value)}`);
    } else {
      // Eine fehlgeschlagene Aufgabe darf die anderen nicht verhindern.
      console.error(`  ${names[i]}: fehlgeschlagen -`, r.reason instanceof Error ? r.reason.message : r.reason);
    }
  });

  console.log(`Durchlauf beendet in ${Date.now() - started} ms.`);
}

const once = process.argv.includes("--once");

/*
 * Gehört die Datenbank schon jemandem?
 *
 * PGlite ist Einzelschreiber. Läuft der Webserver, hält er das
 * Datenverzeichnis — und jede Aufgabe hier bricht mit
 * "Aborted(). Build with -sASSERTIONS for more info." ab. Fünf
 * Fehlermeldungen alle fünfzehn Minuten, keine davon verständlich.
 *
 * `turbo run dev` startet beide zusammen, das ist also der Normalfall
 * in der Entwicklung und kein Sonderfall.
 *
 * Deshalb: einmal nachsehen, einmal erklären, dann ruhig sein. Ein
 * Worker, der nicht darf, ist kein Fehler — er ist ein Worker, der
 * wartet.
 */
if (cfg.db.driver === "pglite") {
  const dataDir = resolveDataDir(cfg.db.pgliteDataDir);

  /*
   * Im Dauerbetrieb gar nicht erst antreten.
   *
   * Der erste Versuch prüfte hier nur die Sperre — und die war beim
   * Start des Workers noch gar nicht gesetzt, weil der Webserver die
   * Datenbank erst beim ersten Zugriff öffnet. Der Worker hielt sich
   * also für allein, lief los und bekam bei jeder Aufgabe „Aborted()".
   *
   * Eine Prüfung, die vom Zufall der Startreihenfolge abhängt, ist
   * keine Prüfung. Deshalb hier eine Regel statt einer Messung: mit
   * PGlite läuft der Worker nur einmalig und nur, wenn ihn jemand
   * ausdrücklich dazu auffordert.
   */
  if (!once) {
    console.log(
      `Worker läuft nicht im Dauerbetrieb: die Datenbank ist PGlite in "${dataDir}".`,
    );
    console.log(
      "PGlite ist Einzelschreiber — Webserver und Worker zusammen zerlegen sich den " +
        "WASM-Speicher, und heraus kommt „Aborted()“ auf einer beliebigen Seite.",
    );
    console.log(
      "Einmalig ausführen: `pnpm --filter @paycheck/worker dev -- --once` (bei beendetem " +
        "Webserver). Für den Dauerbetrieb einen echten Postgres-Server einrichten: " +
        "DATABASE_DRIVER=pg und DATABASE_URL setzen.",
    );
    process.exit(0);
  }

  const besitzer = pgliteOwner(dataDir);
  if (besitzer !== null && besitzer !== process.pid) {
    console.log(
      `Worker läuft nicht: die Datenbank in "${dataDir}" gehört gerade Prozess ${besitzer} ` +
        "— vermutlich dem Webserver. Beende ihn zuerst.",
    );
    process.exit(0);
  }
}

console.log(`Worker gestartet (Modus: ${cfg.mode}, Datenbank: ${cfg.db.driver}).`);
await runAll();

if (!once) {
  setInterval(() => {
    void runAll().catch((e) => console.error("Durchlauf fehlgeschlagen:", e));
  }, INTERVAL_MS);
  console.log(`Naechster Durchlauf in ${INTERVAL_MS / 60_000} Minuten.`);
} else {
  process.exit(0);
}
