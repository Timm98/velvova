import { writeFileSync, unlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";

/**
 * AI_ROUTING.md aus dem Router erzeugen.
 *
 * Dieselbe Regel wie bei der Quellendokumentation: eine von Hand
 * gepflegte Tabelle beschreibt irgendwann etwas anderes, als der Code
 * tut. Wer wissen will, welche Aufgabe auf welcher Stufe läuft, soll
 * eine Antwort bekommen, die stimmt — nicht eine, die einmal gestimmt hat.
 *
 *   node scripts/generate-ai-routing-doc.mjs
 */

const tmp = ".ai-routing.tmp.ts";
writeFileSync(
  tmp,
  `
import { ALL_TASKS, route, fallbackRoute } from "./packages/ai/src/router.ts";
console.log(JSON.stringify(ALL_TASKS.map((t) => {
  const d = route(t);
  return { ...d, fallbackTier: fallbackRoute(d)?.tier ?? null };
})));
`,
);

let rows;
try {
  const out = execFileSync("node", ["--experimental-strip-types", tmp], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  rows = JSON.parse(out);
} finally {
  unlinkSync(tmp);
}

const STUFEN = {
  TERRA: ["Boden", "Klassifizieren, extrahieren, normalisieren. Hohe Menge, geringe Tiefe."],
  SOL: ["Tageslicht", "Das Gespräch. Tempo vor Tiefe — ein Mensch wartet."],
  LUNA: ["Nachtarbeit", "Synthese, Urteil, Bewerbungstexte. Darf dauern, muss stimmen."],
  REALTIME: ["Sprache", "Eigener Pfad, eigene Zugangsdaten, kurze Lebensdauer."],
};

const gruppen = new Map();
for (const r of rows) {
  const list = gruppen.get(r.tier) ?? [];
  list.push(r);
  gruppen.set(r.tier, list);
}

const zeilen = [];
zeilen.push("# KI-Routing");
zeilen.push("");
zeilen.push("<!-- Erzeugt aus packages/ai/src/router.ts.");
zeilen.push("     Nicht von Hand ändern: `node scripts/generate-ai-routing-doc.mjs`. -->");
zeilen.push("");
zeilen.push(
  "Welche Aufgabe auf welcher Leistungsstufe läuft, steht an genau einer Stelle im Code.",
  "Dieses Dokument ist ein Abzug davon, kein zweiter Datenbestand.",
);
zeilen.push("");
zeilen.push("Die Stufennamen sind **keine Modellnamen**. Sie beschreiben ein Verhalten; welches");
zeilen.push("Modell dahintersteht, ist Konfiguration. Im Fachcode steht nie ein Modellname —");
zeilen.push("sonst wäre ein Anbieterwechsel ein Umbau statt einer Einstellung.");
zeilen.push("");

zeilen.push("## Die Stufen");
zeilen.push("");
zeilen.push("| Stufe | Bild | Wofür | Aufgaben |");
zeilen.push("| --- | --- | --- | --- |");
for (const [tier, [bild, zweck]] of Object.entries(STUFEN)) {
  zeilen.push(`| **${tier}** | ${bild} | ${zweck} | ${(gruppen.get(tier) ?? []).length} |`);
}
zeilen.push("");

zeilen.push("## Die Zuordnung");
zeilen.push("");
zeilen.push("| Aufgabe | Stufe | Begründung | Abbruch nach | Rückfall |");
zeilen.push("| --- | --- | --- | --- | --- |");
for (const r of rows) {
  zeilen.push(
    `| \`${r.task}\` | ${r.tier} | ${r.reason} | ${Math.round(r.timeoutMs / 1000)} s | ${
      r.fallbackTier ?? "— (kein Rückfall)"
    } |`,
  );
}
zeilen.push("");

zeilen.push("## Warum manche Aufgaben keinen Rückfall haben");
zeilen.push("");
zeilen.push(
  "Ein Rückfall ist nur dann richtig, wenn das schwächere Ergebnis noch dieselbe Frage",
  "beantwortet. Bei einer Klassifikation ist das so. Bei einer Profilsynthese nicht: ein",
  "Ergebnis vom schnellen Modell sähe aus wie ein Urteil, wäre aber keines — und niemand",
  "könnte es an der Ausgabe erkennen. Dort ist Scheitern die ehrlichere Antwort.",
);
zeilen.push("");
zeilen.push(
  `Stand: ${rows.length} Aufgaben, ${gruppen.size} belegte Stufen. ` +
    "Geprüft in `packages/ai/src/router.test.ts`.",
);
zeilen.push("");

writeFileSync("docs/AI_ROUTING.md", zeilen.join("\n"));
console.log(`docs/AI_ROUTING.md erzeugt — ${rows.length} Aufgaben.`);
