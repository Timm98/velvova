import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Jede Seite unter /admin muss die Rolle prüfen.
 *
 * ── Warum es diesen Test gibt ─────────────────────────────────
 *
 * `/admin/providers` und `/admin/sources` hatten keine Prüfung. Sie
 * lagen im Verzeichnis `admin`, hiessen wie Betriebswerkzeuge, zeigten
 * Anbieterzustände und Quellenentscheidungen — und antworteten jeder
 * angemeldeten Person mit 200. Die Geschwisterseiten `/admin` und
 * `/admin/reviews` prüften seit jeher korrekt.
 *
 * Auffällig ist, WIE es gefunden wurde: nicht beim Lesen des Codes,
 * sondern beim Abgehen aller Routen mit einem gewöhnlichen Konto. Beim
 * Lesen sieht eine Seite ohne Prüfung genauso aus wie eine, die keine
 * braucht — es fehlt ja nichts, es steht nur nichts da.
 *
 * Genau deshalb ist die Prüfung hier strukturell und nicht als
 * Browsertest: Sie greift, sobald jemand eine Datei anlegt, und nicht
 * erst, wenn jemand daran denkt, die neue Seite auch aufzurufen.
 *
 * ── Was der Test NICHT kann ───────────────────────────────────
 *
 * Er liest Text, er führt nichts aus. Eine Seite, die `notFound()` in
 * einem toten Zweig aufruft, käme durch. Das ist der Preis dafür, dass
 * er ohne Datenbank und ohne Browser läuft — und immer noch besser als
 * die Alternative, die es vorher gab: nichts.
 */

/*
 * Aus der Datei heraus, nicht aus dem Arbeitsverzeichnis.
 *
 * `process.cwd()` ist beim Lauf aus dem Wurzelverzeichnis des
 * Arbeitsbereichs nicht `apps/web` — der Test fand dann kein
 * Verzeichnis und fiel um, bevor er irgendetwas prüfen konnte.
 */
const WURZEL = path.dirname(fileURLToPath(import.meta.url));

function seiten(dir: string): string[] {
  const raus: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    if (statSync(p).isDirectory()) raus.push(...seiten(p));
    else if (e === "page.tsx") raus.push(p);
  }
  return raus;
}

describe("Betriebsbereich", () => {
  const dateien = seiten(WURZEL);

  it("findet überhaupt Seiten", () => {
    expect(dateien.length).toBeGreaterThan(0);
  });

  it.each(dateien.map((f) => [path.relative(WURZEL, f), f]))(
    "%s prüft die Rolle",
    (_name, datei) => {
      const q = readFileSync(datei as string, "utf8");

      // Sie muss wissen, wer da ist …
      expect(q, "requireUser fehlt").toMatch(/requireUser\s*\(/);

      /*
       * … BEIDE Rollen prüfen …
       *
       * Der erste Anlauf verlangte nur `role !== "operator" | "admin"`
       * — ein Muster, das schon von einer der beiden Bedingungen
       * erfüllt wird. Beim Gegentest habe ich `"operator"` verfälscht,
       * und der Test blieb grün, weil `"admin"` in derselben Zeile
       * stehen blieb.
       *
       * Ein Wächtertest, der die halbe Wache durchgehen lässt, ist
       * keiner. Beide Rollen einzeln.
       */
      expect(q, 'Prüfung auf "operator" fehlt').toMatch(/role\s*!==\s*["']operator["']/);
      expect(q, 'Prüfung auf "admin" fehlt').toMatch(/role\s*!==\s*["']admin["']/);

      /*
       * … und mit 404 antworten, nicht mit 403.
       *
       * Ein 403 bestätigt, dass es die Seite gibt. Wer den
       * Betriebsbereich sucht, hat damit schon die halbe Antwort.
       */
      expect(q, "notFound() fehlt").toMatch(/notFound\s*\(\s*\)/);
    },
  );
});
