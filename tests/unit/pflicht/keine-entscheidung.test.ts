import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";

/**
 * ══════════════════════════════════════════════════════════════════
 * Pflichttest: Es gibt keine Funktion, die für einen Menschen
 * entscheidet
 * ══════════════════════════════════════════════════════════════════
 *
 * Velvova nimmt kein Angebot an, lehnt keines ab, kündigt nicht,
 * unterschreibt nicht und ändert kein Gehalt. Das ist keine
 * Zurückhaltung, sondern die Grenze, an der das Produkt steht oder
 * fällt: Ein System, das solche Funktionen hat, wird sie irgendwann
 * benutzen — versehentlich, durch einen Fehler, durch einen
 * eingeschleusten Text.
 *
 * ── Warum ein Suchtest und keine Absichtserklärung ──────────────
 *
 * Weil eine Regel, die nicht geprüft wird, nach drei Umbauten nicht
 * mehr existiert. Dieser Test findet den Namen, bevor jemand die
 * Funktion schreibt — und zwingt zu einer bewussten Entscheidung,
 * falls sie doch einmal nötig wäre.
 *
 * Er sucht nach Namen, nicht nach Verhalten. Das ist grob und fängt
 * nicht alles; es fängt aber den Weg, auf dem so etwas normalerweise
 * entsteht: Jemand nennt eine Funktion `angebotAnnehmen`, weil sie
 * genau das tun soll.
 */

/** Namen, die es in diesem Projekt nicht geben darf. */
const VERBOTEN = [
  "angebotAnnehmen",
  "acceptOffer",
  "angebotAblehnen",
  "rejectOffer",
  "declineOffer",
  "vertragUnterschreiben",
  "signContract",
  "kuendigungAussprechen",
  "kuendigen",
  "terminateEmployment",
  "gehaltAendern",
  "setSalary",
  "einstellen(",
  "hireCandidate",
  "bewerberAblehnen",
];

/** Wo gesucht wird. Tests und Dokumente dürfen die Namen nennen. */
const ORTE = ["apps/web/src", "packages"];

function suche(begriff: string): string[] {
  try {
    const roh = execFileSync(
      "grep",
      [
        "-rn",
        "--include=*.ts",
        "--include=*.tsx",
        "--exclude=*.test.ts",
        "--exclude=*.test.tsx",
        "-F",
        begriff,
        ...ORTE,
      ],
      { encoding: "utf8", cwd: process.cwd() },
    );
    return roh.split("\n").filter(Boolean);
  } catch {
    /* grep endet mit 1, wenn nichts gefunden wurde. Das ist der Normalfall. */
    return [];
  }
}

describe("Pflichttest: keine Entscheidung durch die Maschine", () => {
  for (const name of VERBOTEN) {
    it(`kennt keine Funktion \`${name}\``, () => {
      const treffer = suche(name);
      expect(
        treffer,
        treffer.length > 0
          ? `\`${name}\` gefunden. Velvova entscheidet nicht für Menschen — ` +
              `wenn diese Funktion wirklich nötig ist, gehört die Entscheidung ` +
              `dokumentiert und dieser Test bewusst geändert.\n${treffer.join("\n")}`
          : "",
      ).toEqual([]);
    });
  }

  it("sucht dort, wo der Code liegt", () => {
    /*
     * Ein Suchtest, der ins Leere greift, ist grün und wertlos. Diese
     * Zeile prüft, dass die Suche überhaupt etwas findet.
     */
    expect(suche("export function").length).toBeGreaterThan(100);
  });
});
