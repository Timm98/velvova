import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ══════════════════════════════════════════════════════════════════
 * Notfallmodus — Anforderung 21
 * ══════════════════════════════════════════════════════════════════
 *
 * „Fallen alle KI-Anbieter aus, müssen Suche, gespeicherte Jobs,
 * Bewerbungsstatus und Dokumente weiter funktionieren."
 *
 * Heute stimmt das. Es stimmt aber nicht, weil jemand es
 * sichergestellt hätte, sondern weil es sich so ergeben hat — und
 * was sich ergeben hat, ergibt sich beim nächsten Mal anders. Es
 * genügt ein `import { ... } from "@paycheck/ai"` in einer
 * Hilfsfunktion, die eine dieser Seiten benutzt, und beim nächsten
 * Ausfall von OpenAI ist die Bewerbungsübersicht mit weg.
 *
 * Auffallen würde das niemandem: Die Seiten laden weiter, solange
 * die Anbieter laufen. Der Fehler zeigt sich erst an dem Tag, an dem
 * er am meisten schadet.
 *
 * Deshalb läuft dieser Test den Importpfad ab — nicht nur die erste
 * Zeile der Seite, sondern alles, was sie mitzieht.
 *
 * ── Was er nicht prüft ──────────────────────────────────────────
 *
 * Ob die Seiten inhaltlich sinnvoll bleiben. Eine Jobliste ohne
 * Matching-Punkte ist ärmer, aber sie ist da — und darum geht es:
 * Der Mensch kommt an seine Daten, auch wenn kein Modell antwortet.
 */

const WURZEL = resolve(new URL("../..", import.meta.url).pathname);

/** Die Wege, die einen Ausfall überleben müssen. */
const KERNWEGE = [
  "src/app/app/jobs/page.tsx",
  "src/app/app/jobs/[id]/page.tsx",
  "src/app/app/applications/page.tsx",
  "src/app/app/documents/page.tsx",
  "src/app/app/suchauftraege/page.tsx",
];

/** Was in diesen Wegen nichts zu suchen hat. */
const VERBOTEN = [/@paycheck\/ai(\/|"|$)/, /\/lib\/ai\//, /@\/lib\/nina\/(?!workflow-state)/];

/**
 * Module, die die KI berühren dürfen — mit Grund.
 *
 * Die Regel lautet nicht „keine Zeile KI in der Nähe", sondern: Die
 * Seite darf die KI nicht BRAUCHEN. Ein Modul, dessen einzige
 * Aufgabe die Frage „antwortet gerade ein Modell?" ist und das die
 * Antwort `nein` sauber zurückgibt, erfüllt genau das — es ist der
 * Grund, warum die Seite den Ausfall überlebt, nicht die Gefahr.
 *
 * Eine grobe Regel hätte hier einen richtigen Bau als Verstoss
 * gemeldet. Wer sie dann abschwächt, verliert den Test ganz; wer den
 * Code ändert, macht ihn schlechter. Deshalb steht die Ausnahme hier,
 * einzeln und mit Begründung, statt dass die Regel weicher wird.
 *
 * Wer diese Liste erweitert, muss denselben Satz sagen können:
 * Die Seite funktioniert weiter, wenn kein Modell antwortet.
 */
const ERLAUBT: { modul: RegExp; weil: string }[] = [
  {
    modul: /\/lib\/suchauftrag\/modellrufer$/,
    weil:
      "`modellBereit()` fängt den Ausfall ab und gibt {bereit:false} zurück; " +
      "die Seite blendet die Funktion dann aus, statt zu scheitern.",
  },
  {
    modul: /\/lib\/jobs\/uebersetzung$/,
    weil:
      "Jeder Modellaufruf liegt im try; scheitert er, steht die Anzeige im " +
      "Original da. (Genau das stimmte hier nicht: `selectProvider()` stand " +
      "ausserhalb, und die Detailseite antwortete bei KI-Ausfall mit 500.)",
  },
];

/*
 * Die Grenze dieser Prüfung, damit sie nicht überschätzt wird.
 *
 * Sie liest Importe, kein Verhalten. Ob ein erlaubtes Modul seinen
 * Ausfall wirklich abfängt, sieht sie nicht — das steht in der
 * Begründung und muss beim Eintragen stimmen. Ihre Aufgabe ist eine
 * andere: NEUE Kopplungen zu melden, bevor sie selbstverständlich
 * werden. Die beiden vorhandenen sind geprüft und benannt.
 */

function importeVon(datei: string): string[] {
  const inhalt = readFileSync(datei, "utf8");
  const treffer = [...inhalt.matchAll(/(?:from|import)\s+["']([^"']+)["']/g)];
  return treffer.map((t) => t[1]!);
}

/** `@/x` und `./x` zu einer Datei auflösen. Alles andere ist ein Paket. */
function aufloesen(spezifizierer: string, von: string): string | null {
  let basis: string;
  if (spezifizierer.startsWith("@/")) basis = join(WURZEL, "src", spezifizierer.slice(2));
  else if (spezifizierer.startsWith(".")) basis = resolve(dirname(von), spezifizierer);
  else return null;

  for (const endung of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const pfad = basis.replace(/\.js$/, "") + endung;
    if (existsSync(pfad) && !pfad.endsWith("/")) {
      try {
        if (readFileSync(pfad).length >= 0) return pfad;
      } catch {
        /* Verzeichnis, kein Modul. */
      }
    }
  }
  return null;
}

/** Alles, was diese Datei mitzieht — samt Weg dorthin. */
function abhaengigkeiten(start: string): Map<string, string[]> {
  const gefunden = new Map<string, string[]>();
  const offen: { datei: string; weg: string[] }[] = [{ datei: start, weg: [start] }];

  while (offen.length > 0) {
    const { datei, weg } = offen.pop()!;
    if (gefunden.has(datei)) continue;
    gefunden.set(datei, weg);

    for (const spez of importeVon(datei)) {
      /* Fremde Pakete: nur notieren, nicht weiterverfolgen. */
      const aufgeloest = aufloesen(spez, datei);
      if (aufgeloest) {
        if (!gefunden.has(aufgeloest)) offen.push({ datei: aufgeloest, weg: [...weg, aufgeloest] });
      } else {
        gefunden.set(`paket:${spez}`, [...weg, spez]);
      }
    }
  }
  return gefunden;
}

describe("Notfallmodus", () => {
  for (const weg of KERNWEGE) {
    const datei = join(WURZEL, weg);
    if (!existsSync(datei)) continue;

    it(`${weg} kommt ohne KI aus`, () => {
      const alles = abhaengigkeiten(datei);
      const verstoesse: string[] = [];

      for (const [knoten, pfad] of alles) {
        const name = knoten.startsWith("paket:") ? knoten.slice(6) : knoten;
        /* Der Weg dorthin führte über ein ausdrücklich erlaubtes Modul. */
        const durchtor = pfad.some((p) =>
          ERLAUBT.some((e) => e.modul.test(p.replace(/\.tsx?$/, ""))),
        );
        if (!durchtor && VERBOTEN.some((r) => r.test(name))) {
          verstoesse.push(
            `${name}\n      über: ${pfad.map((p) => p.replace(WURZEL + "/", "")).join("\n         → ")}`,
          );
        }
      }

      expect(verstoesse, `Diese Seite zieht die KI mit:\n    ${verstoesse.join("\n    ")}`).toEqual([]);
    });
  }

  it("prüft überhaupt etwas", () => {
    /* Ein Test, der nur über nicht vorhandene Dateien läuft, ist
       immer grün und sagt nichts. */
    const vorhanden = KERNWEGE.filter((w) => existsSync(join(WURZEL, w)));
    expect(vorhanden.length).toBeGreaterThanOrEqual(3);
  });
});
