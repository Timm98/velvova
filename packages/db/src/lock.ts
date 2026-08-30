import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * Ein Schreiber je Datenverzeichnis.
 *
 * PGlite ist Postgres als WebAssembly, und es ist **Einzelschreiber**.
 * Öffnen zwei Prozesse dasselbe Verzeichnis, zerlegen sie sich
 * gegenseitig den WASM-Speicher. Was dabei herauskommt, ist keine
 * Fehlermeldung, sondern ein Abbruch:
 *
 *     Aborted(). Build with -sASSERTIONS for more info.
 *
 * Diese Zeile sagt niemandem etwas. Sie erscheint auf einer beliebigen
 * Seite, die gerade die Datenbank anfasst — Anmeldung, Registrierung,
 * Gespräch — und sieht nach einem Fehler in genau dieser Seite aus.
 * Tatsächlich lag die Ursache beim Start eines zweiten Prozesses,
 * womöglich Minuten vorher.
 *
 * Genau das ist im Projekt passiert: `turbo run dev` startet den
 * Webserver **und** den Worker, und beide öffnen `.data/pglite`.
 *
 * Diese Sperre macht daraus einen verständlichen Zustand. Wer zuerst
 * kommt, bekommt die Datenbank. Wer zweiter kommt, bekommt einen Satz,
 * der erklärt, was los ist — und stürzt nicht ab.
 */

export class PgliteBusyError extends Error {
  readonly ownerPid: number;
  readonly dataDir: string;

  constructor(dataDir: string, ownerPid: number) {
    super(
      `Die eingebettete Datenbank in "${dataDir}" wird bereits von Prozess ${ownerPid} benutzt. ` +
        "PGlite lässt genau einen Schreiber zu; ein zweiter würde beide zum Absturz bringen " +
        "(„Aborted()“). Beende den anderen Prozess, oder stelle auf einen echten " +
        "Postgres-Server um (DATABASE_DRIVER=pg, DATABASE_URL=…), der mehrere Verbindungen " +
        "verträgt.",
    );
    this.name = "PgliteBusyError";
    this.ownerPid = ownerPid;
    this.dataDir = dataDir;
  }
}

const LOCK_DATEI = ".pglite-owner.lock";

/** Lebt der Prozess noch? Signal 0 prüft, ohne etwas zu senden. */
function lebt(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM heisst: der Prozess existiert, gehört aber jemand anderem.
    // Auch dann ist er da und die Datenbank belegt.
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

export interface Lock {
  release: () => void;
}

/**
 * Die Sperre setzen.
 *
 * Eine verwaiste Sperre — der eintragende Prozess lebt nicht mehr —
 * wird übernommen. Ohne das bliebe das Projekt nach einem harten
 * Abbruch dauerhaft gesperrt, und niemand wüsste warum.
 */
export function acquirePgliteLock(dataDir: string, pid = process.pid): Lock {
  mkdirSync(dataDir, { recursive: true });
  const datei = path.join(dataDir, LOCK_DATEI);

  let vorhanden: number | null = null;
  try {
    vorhanden = Number.parseInt(readFileSync(datei, "utf8").trim(), 10);
  } catch {
    vorhanden = null;
  }

  if (vorhanden !== null && vorhanden !== pid && lebt(vorhanden)) {
    throw new PgliteBusyError(dataDir, vorhanden);
  }

  /*
   * Rückstand eines unsauberen Endes wegräumen.
   *
   * PGlite legt eine `postmaster.pid` an. Endet der Prozess hart — oder
   * schreiben zwei Prozesse gleichzeitig —, bleibt sie liegen, und das
   * Verzeichnis kann bei der nächsten Abfrage mit „Aborted()" abbrechen.
   *
   * Der Zeitpunkt macht das sicher: wir sind gerade an der Sperre
   * vorbeigekommen, also hält kein lebender Prozess dieses Verzeichnis.
   * Eine noch vorhandene `postmaster.pid` ist damit per Definition
   * verwaist. Genau so verfährt Postgres beim Wiederanlauf auch.
   */
  const postmaster = path.join(dataDir, "postmaster.pid");
  try {
    rmSync(postmaster, { force: true });
  } catch {
    /* Nicht vorhanden oder nicht entfernbar: dann eben nicht. */
  }

  writeFileSync(datei, String(pid), "utf8");

  let freigegeben = false;
  const release = () => {
    if (freigegeben) return;
    freigegeben = true;
    try {
      // Nur die eigene Sperre entfernen. Hat inzwischen ein anderer
      // übernommen, gehört sie ihm.
      const jetzt = Number.parseInt(readFileSync(datei, "utf8").trim(), 10);
      if (jetzt === pid) rmSync(datei, { force: true });
    } catch {
      /* Datei schon weg: nichts zu tun. */
    }
  };

  // Beim Beenden aufräumen, damit der nächste Start nicht auf eine
  // verwaiste Sperre trifft.
  process.once("exit", release);
  process.once("SIGINT", release);
  process.once("SIGTERM", release);

  return { release };
}

/**
 * Sieht das Datenverzeichnis nach einem unsauberen Ende aus?
 *
 * Für die Betriebsansicht und für eine ehrliche Fehlermeldung: wer
 * „Aborted()" gesehen hat, soll erfahren, dass das Verzeichnis neu
 * aufgebaut werden muss — und wie.
 */
export function looksUnclean(dataDir: string): boolean {
  try {
    readFileSync(path.join(dataDir, "postmaster.pid"), "utf8");
    return pgliteOwner(dataDir) === null;
  } catch {
    return false;
  }
}

export const RECOVERY_HINT =
  "Das eingebettete Datenverzeichnis ist beschädigt — meist die Folge davon, dass zwei " +
  "Prozesse es gleichzeitig geöffnet haben. Sichere es (`mv .data/pglite .data/pglite-alt`) " +
  "und baue es neu auf: `pnpm db:migrate && pnpm db:seed`.";

/** Wer hält die Sperre gerade? null, wenn niemand. */
export function pgliteOwner(dataDir: string): number | null {
  try {
    const pid = Number.parseInt(readFileSync(path.join(dataDir, LOCK_DATEI), "utf8").trim(), 10);
    return lebt(pid) ? pid : null;
  } catch {
    return null;
  }
}
