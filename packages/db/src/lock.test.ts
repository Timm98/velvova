import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PgliteBusyError, RECOVERY_HINT, acquirePgliteLock, looksUnclean, pgliteOwner } from "./lock.ts";

/**
 * Ein Schreiber je Datenverzeichnis.
 *
 * PGlite ist Postgres als WebAssembly und lässt genau einen Schreiber
 * zu. Öffnen zwei Prozesse dasselbe Verzeichnis, zerlegen sie sich den
 * WASM-Speicher, und heraus kommt:
 *
 *     Aborted(). Build with -sASSERTIONS for more info.
 *
 * Diese Zeile sagt niemandem etwas. Sie erscheint auf einer beliebigen
 * Seite, die gerade die Datenbank anfasst — Anmeldung, Registrierung,
 * Gespräch — und sieht nach einem Fehler in genau dieser Seite aus.
 * Tatsächlich lag die Ursache beim Start eines zweiten Prozesses,
 * womöglich Minuten vorher.
 *
 * Genau das ist passiert: `turbo run dev` startet Webserver und Worker,
 * und beide öffnen `.data/pglite`.
 */

const verzeichnisse: string[] = [];
const neuesVerzeichnis = () => {
  const d = mkdtempSync(path.join(tmpdir(), "pglite-lock-"));
  verzeichnisse.push(d);
  return d;
};

afterEach(() => {
  for (const d of verzeichnisse.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("Sperre", () => {
  it("lässt den ersten Prozess durch", () => {
    // Mit der eigenen PID: `pgliteOwner` meldet nur einen Besitzer, der
    // tatsächlich noch lebt. Eine erfundene Nummer gilt zu Recht als
    // verwaist.
    const d = neuesVerzeichnis();
    const lock = acquirePgliteLock(d, process.pid);
    expect(pgliteOwner(d)).toBe(process.pid);
    lock.release();
    expect(pgliteOwner(d)).toBeNull();
  });

  it("weist den zweiten mit einer lesbaren Meldung ab", () => {
    // Das ist der ganze Zweck: statt „Aborted()" ein Satz, aus dem
    // hervorgeht, was zu tun ist.
    const d = neuesVerzeichnis();
    acquirePgliteLock(d, process.pid);

    expect(() => acquirePgliteLock(d, process.pid + 1)).toThrow(PgliteBusyError);
    try {
      acquirePgliteLock(d, process.pid + 1);
      expect.unreachable();
    } catch (e) {
      const m = (e as Error).message;
      expect(m).toContain("genau einen Schreiber");
      expect(m).toContain("DATABASE_DRIVER=pg");
      // Das Wort "Aborted" steht ausdrücklich DRIN: wer danach sucht,
      // weil es auf seinem Bildschirm stand, soll hier landen.
      expect(m).toContain("Aborted");
    }
  });

  it("nennt den haltenden Prozess", () => {
    const d = neuesVerzeichnis();
    acquirePgliteLock(d, process.pid);
    try {
      acquirePgliteLock(d, process.pid + 1);
      expect.unreachable();
    } catch (e) {
      expect((e as PgliteBusyError).ownerPid).toBe(process.pid);
    }
  });

  it("lässt denselben Prozess erneut zugreifen", () => {
    const d = neuesVerzeichnis();
    acquirePgliteLock(d, 4242);
    expect(() => acquirePgliteLock(d, 4242)).not.toThrow();
  });

  it("übernimmt eine verwaiste Sperre", () => {
    // Nach einem harten Abbruch bleibt die Datei liegen. Ohne diese
    // Regel wäre das Projekt dauerhaft gesperrt, und niemand wüsste
    // warum.
    const d = neuesVerzeichnis();
    // Eine PID, die es mit an Sicherheit grenzender Wahrscheinlichkeit
    // nicht mehr gibt.
    writeFileSync(path.join(d, ".pglite-owner.lock"), "999999", "utf8");

    expect(pgliteOwner(d)).toBeNull();
    expect(() => acquirePgliteLock(d, process.pid)).not.toThrow();
    expect(pgliteOwner(d)).toBe(process.pid);
  });

  it("gibt beim Freigeben nur die eigene Sperre frei", () => {
    const d = neuesVerzeichnis();
    const lock = acquirePgliteLock(d, process.pid);
    // Ein anderer hat inzwischen übernommen.
    writeFileSync(path.join(d, ".pglite-owner.lock"), "7777", "utf8");
    lock.release();
    expect(readFileSync(path.join(d, ".pglite-owner.lock"), "utf8")).toBe("7777");
  });

  it("meldet niemanden, wenn keine Sperre da ist", () => {
    expect(pgliteOwner(neuesVerzeichnis())).toBeNull();
  });
});

describe("Rückstand eines unsauberen Endes", () => {
  it("räumt eine verwaiste postmaster.pid beim Sperren weg", () => {
    // Genau dieser Rückstand hat das Verzeichnis in „Aborted()" laufen
    // lassen. Zum Zeitpunkt des Sperrens hält kein lebender Prozess das
    // Verzeichnis — die Datei ist damit per Definition verwaist.
    const d = neuesVerzeichnis();
    writeFileSync(path.join(d, "postmaster.pid"), "999999", "utf8");

    acquirePgliteLock(d, process.pid);

    expect(() => readFileSync(path.join(d, "postmaster.pid"), "utf8")).toThrow();
  });

  it("erkennt ein unsauber beendetes Verzeichnis", () => {
    const d = neuesVerzeichnis();
    expect(looksUnclean(d)).toBe(false);
    writeFileSync(path.join(d, "postmaster.pid"), "999999", "utf8");
    expect(looksUnclean(d)).toBe(true);
  });

  it("nennt im Hinweis den Weg zur Reparatur", () => {
    expect(RECOVERY_HINT).toContain("pnpm db:migrate");
    expect(RECOVERY_HINT).toContain("zwei");
  });
});
