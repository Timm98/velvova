import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Die ISCO-08-Tabelle einlesen.
 *
 * ── Warum ohne Bibliothek ─────────────────────────────────────
 *
 * Eine xlsx-Datei ist ein Zip mit XML. Für einen einmaligen Import
 * von 436 Zeilen eine Tabellenbibliothek in die Abhängigkeiten zu
 * holen, wäre teurer als die dreissig Zeilen hier — und jede
 * Abhängigkeit muss danach gepflegt werden.
 *
 * Aufruf: node --experimental-strip-types scripts/isco-importieren.mjs [pfad]
 */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const pfad = process.argv[2] ?? `${process.env.HOME}/Downloads/berufe_isco08_zukunft_global.xlsx`;

/*
 * Das Auslesen macht Python.
 *
 * Node kann Zip nicht ohne Weiteres entpacken, und `zipfile` steht in
 * jeder macOS- und Linux-Installation bereit. Der Aufruf liefert JSON
 * zurück — die Grenze zwischen den beiden Welten ist damit eine
 * Datenstruktur und kein geteilter Zustand.
 */
const AUSLESER = `
import json, sys, zipfile
from xml.etree import ElementTree as ET
NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
z = zipfile.ZipFile(sys.argv[1])
sst = ET.fromstring(z.read("xl/sharedStrings.xml"))
ss = ["".join(t.text or "" for t in si.iter(NS+"t")) for si in sst.iter(NS+"si")]
root = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
zeilen = []
for row in root.iter(NS+"row"):
    w = {}
    for c in row.iter(NS+"c"):
        spalte = "".join(ch for ch in (c.get("r") or "") if ch.isalpha())
        t = c.get("t"); v = c.find(NS+"v")
        if v is None:
            isel = c.find(NS+"is")
            w[spalte] = "".join(x.text or "" for x in isel.iter(NS+"t")) if isel is not None else ""
        else:
            w[spalte] = ss[int(v.text)] if t == "s" else (v.text or "")
    zeilen.append(w)
print(json.dumps(zeilen, ensure_ascii=False))
`;

const roh = JSON.parse(execFileSync("python3", ["-c", AUSLESER, pfad], {
  encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
}));

const SPALTEN = ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q"];
const kopf = SPALTEN.map((s) => roh[0][s] ?? "");
console.log("Spalten:", kopf.length, "· Zeilen:", roh.length - 1);

const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

const QUELLE =
  "berufe_isco08_zukunft_global.xlsx — synthetisierte Einschätzung aus WEF Future of Jobs 2025, " +
  "US BLS Employment Projections 2024–2034, Stanford „Canaries in the Coal Mine“, ILO GenAI-Index, " +
  "Eloundou et al. (2023), Felten AIOE. Keine Messwerte.";
const STAND = "2026-09-01";

let n = 0, uebersprungen = 0;
for (const z of roh.slice(1)) {
  const w = (s) => String(z[s] ?? "").trim();
  const code = w("A");
  /* Nur vierstellige Unit Groups — Zwischenzeilen und Leerzeilen raus. */
  if (!/^\d{4}$/.test(code)) { uebersprungen++; continue; }
  const hg = w("B");
  const nummer = Number(hg.match(/^(\d+)/)?.[1] ?? 0);
  const zahl = (s) => { const x = Number(w(s)); return Number.isFinite(x) && x > 0 ? x : null; };

  await db.execute(sql`
    insert into isco_berufe (
      code, hauptgruppe, hauptgruppe_nummer, beruf_de, beruf_en, beispielberufe,
      qualifikationsniveau, zukunftssicherheit, ki_exposition, automatisierungsart,
      nachfrage, lohnaussicht, haupttreiber, plus, kontra, langzeit, kernargument,
      empfehlung, quelle, stand)
    values (${code}, ${hg}, ${nummer}, ${w("C")}, ${w("D")}, ${w("E")},
            ${w("F") || null}, ${zahl("G")}, ${w("H") || null}, ${w("I") || null},
            ${w("J") || null}, ${w("K") || null}, ${w("L") || null}, ${w("M") || null},
            ${w("N") || null}, ${w("O") || null}, ${w("P") || null}, ${w("Q") || null},
            ${QUELLE}, ${STAND}::date)
    on conflict (code) do update set
      hauptgruppe = excluded.hauptgruppe, hauptgruppe_nummer = excluded.hauptgruppe_nummer,
      beruf_de = excluded.beruf_de, beruf_en = excluded.beruf_en,
      beispielberufe = excluded.beispielberufe,
      qualifikationsniveau = excluded.qualifikationsniveau,
      zukunftssicherheit = excluded.zukunftssicherheit, ki_exposition = excluded.ki_exposition,
      automatisierungsart = excluded.automatisierungsart, nachfrage = excluded.nachfrage,
      lohnaussicht = excluded.lohnaussicht, haupttreiber = excluded.haupttreiber,
      plus = excluded.plus, kontra = excluded.kontra, langzeit = excluded.langzeit,
      kernargument = excluded.kernargument, empfehlung = excluded.empfehlung,
      quelle = excluded.quelle, stand = excluded.stand, importiert_am = now()`);
  n++;
}
console.log(`${n} Berufsgruppen importiert, ${uebersprungen} Zeilen übersprungen`);
const [p] = (await db.execute(sql`
  select count(*)::int n, count(zukunftssicherheit)::int mit_wert,
         round(avg(zukunftssicherheit)::numeric, 2) schnitt from isco_berufe`)).rows;
console.log(`in der Tabelle: ${p.n} · mit Zukunftswert: ${p.mit_wert} · Mittel ${p.schnitt}`);
process.exit(0);
