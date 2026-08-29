import { loadRuntimeConfig } from "@paycheck/config";
import { runRetention } from "./tasks/retention.ts";
import { markExpired, runLinkCheck } from "./tasks/linkCheck.ts";
import { createCheckInReminders, createFollowUpReminders } from "./tasks/reminders.ts";

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
  ]);

  const names = ["Aufbewahrung", "Linkcheck", "Abgelaufene Anzeigen", "Nachfass-Erinnerungen", "Check-ins"];
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
