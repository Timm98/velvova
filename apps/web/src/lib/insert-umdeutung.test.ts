import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Wächter gegen still verschluckte Spalten.
 *
 * ══════════════════════════════════════════════════════════════
 * Der Fehler, den diese Prüfung fängt
 * ══════════════════════════════════════════════════════════════
 *
 * In `packages/jobs/src/ingest.ts` stand über einer Anforderungsliste
 * ein handgeschriebener Typ mit vier Feldern, während der Adapter
 * längst neun lieferte. Die zusätzlichen fünf wurden hineingeschrieben,
 * vom Typ ausgeblendet und vom Insert klaglos geschluckt — weil dort
 * `values(anforderungen as never)` stand.
 *
 * Das Tückische ist, dass nichts rot wird: Der Adapter setzt die
 * Felder, sein Test bestätigt sie, Typecheck und Build laufen durch.
 * In der Datenbank stehen trotzdem NULL-Spalten, und das fällt erst
 * auf, wenn jemand die Daten braucht.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum die Umdeutung auf der Zeilenliste und nicht im Feld
 * ══════════════════════════════════════════════════════════════
 *
 * Erlaubt bleibt eine Umdeutung an einem einzelnen Feld:
 *
 *   values({ userId, data: bedingungen as never })   ← in Ordnung
 *
 * Das betrifft eine jsonb-Spalte, deren Inhalt Drizzle ohnehin nicht
 * prüfen kann; die übrigen Spalten werden weiterhin geprüft.
 *
 * Verboten ist die Umdeutung der ganzen Zeilenliste:
 *
 *   values(zeilen as never)                          ← verschluckt alles
 *
 * Denn dann prüft nichts mehr, ob die Objekte zur Tabelle passen — und
 * genau das war der Fehler.
 */

const WURZEL = path.resolve(import.meta.dirname, "../../../..");

/**
 * `values(` gefolgt von etwas, das mit `as never`/`as any` endet.
 *
 * Die Klammernzählung übernimmt der Aufrufer, weil ein Ausdruck wie
 * `values(x.map((z) => z.werte) as never)` verschachtelte Klammern
 * enthält und ein reiner regulärer Ausdruck daran scheitert.
 */
function umdeutungenFinden(inhalt: string): string[] {
  const treffer: string[] = [];
  const start = /\.values\(/g;
  let m: RegExpExecArray | null;
  while ((m = start.exec(inhalt))) {
    let tiefe = 1;
    let i = m.index + m[0].length;
    for (; i < inhalt.length && tiefe > 0; i++) {
      if (inhalt[i] === "(") tiefe++;
      else if (inhalt[i] === ")") tiefe--;
    }
    const argument = inhalt.slice(m.index + m[0].length, i - 1);

    /*
     * Nur die äusserste Umdeutung zählt.
     *
     * `as never` am Ende des ganzen Arguments deutet die Zeilenliste
     * um. Steht es mitten im Ausdruck, gehört es zu einem Feld — und
     * das ist die erlaubte Form.
     */
    if (/\bas\s+(never|any)\s*$/.test(argument.trim())) {
      treffer.push(argument.trim().replace(/\s+/g, " ").slice(0, 90));
    }
  }
  return treffer;
}

/** Alle Nicht-Test-Quelldateien unter `packages` und `apps/web/src`. */
function alleQuelldateien(): string[] {
  const gefunden: string[] = [];
  const lauf = (rel: string) => {
    for (const eintrag of readdirSync(path.join(WURZEL, rel), { withFileTypes: true })) {
      const kind = `${rel}/${eintrag.name}`;
      if (eintrag.isDirectory()) {
        /* Fremder und erzeugter Code ist nicht unserer. */
        if (/^(node_modules|dist|\.next.*|drizzle|coverage)$/.test(eintrag.name)) continue;
        lauf(kind);
      } else if (eintrag.name.endsWith(".ts") && !eintrag.name.endsWith(".test.ts")) {
        gefunden.push(kind);
      }
    }
  };
  lauf("packages");
  lauf("apps/web/src");
  return gefunden;
}

describe("Insert-Umdeutungen", () => {
  it("deutet keine Zeilenliste als never oder any um", () => {
    /*
     * Das Dateisystem, nicht `git ls-files`.
     *
     * Zwei Gründe. Erstens überspringt ein Muster wie
     * `packages/*​/src/**​/*.ts` die erste Ebene, weil `**` mindestens
     * ein Verzeichnis verlangt — `packages/jobs/src/ingest.ts` fiele
     * heraus, ausgerechnet die Datei, in der der Fehler stand.
     *
     * Zweitens, und wichtiger: Dieses Repo bleibt auf Anweisung
     * uncommitted. `git ls-files` sieht nur Eingechecktes und wäre
     * damit blind für neuen Code — also für genau die Stelle, an der
     * ein solcher Fehler entsteht.
     */
    const dateien = alleQuelldateien();

    /* Ohne Untergrenze prüfte ein leeres Ergebnis stillschweigend nichts. */
    expect(dateien.length).toBeGreaterThan(200);
    expect(dateien).toContain("packages/jobs/src/ingest.ts");

    const gefunden: string[] = [];
    for (const datei of dateien) {
      const inhalt = readFileSync(path.join(WURZEL, datei), "utf8");
      if (!inhalt.includes(".values(")) continue;
      for (const t of umdeutungenFinden(inhalt)) gefunden.push(`${datei}: ${t}`);
    }

    expect(gefunden).toEqual([]);
  });

  it("erkennt die verbotene Form", () => {
    expect(umdeutungenFinden("db.insert(t).values(zeilen as never);")).toHaveLength(1);
  });

  it("erkennt sie auch mit verschachtelten Klammern", () => {
    // Genau die Form, die im Import stand.
    expect(
      umdeutungenFinden("db.insert(t).values(liste.map((z) => z.werte) as never);"),
    ).toHaveLength(1);
  });

  it("lässt eine Umdeutung an einem einzelnen Feld zu", () => {
    // Bei jsonb bleibt nichts anderes; die übrigen Spalten prüfen weiter.
    expect(
      umdeutungenFinden("db.insert(t).values({ userId, data: inhalt as never });"),
    ).toEqual([]);
  });

  it("lässt einen gewöhnlichen Insert zu", () => {
    expect(umdeutungenFinden("db.insert(t).values(zeilen);")).toEqual([]);
  });
});
