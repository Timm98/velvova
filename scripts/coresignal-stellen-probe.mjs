import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Was gibt Coresignals Stellen-Endpunkt her?
 *
 * ══════════════════════════════════════════════════════════════
 * Warum es diese Probe gibt
 * ══════════════════════════════════════════════════════════════
 *
 * `job_base` steht in der Zugangsprüfung und antwortete am
 * 31. August mit 200 — der Endpunkt ist für unser Abo offen. Benutzt
 * wird er nirgends. Der Name taucht im Code genau einmal auf: in der
 * Liste, die prüft, ob der Zugang funktioniert.
 *
 * Bevor jemand einen Adapter dafür baut, muss vier Fragen beantwortet
 * sein, und keine davon lässt sich raten:
 *
 *   1. Wie viele Stellen liefert eine Suche für Deutschland?
 *   2. Welche Felder kommen zurück — und welche davon brauchen wir?
 *   3. Was kostet ein Datensatz wirklich?
 *   4. Steht in den Daten, woher sie stammen?
 *
 * Die vierte ist die wichtigste. Coresignal sammelt unter anderem aus
 * Portalen, die wir selbst nicht auslesen dürfen. Ob ein Lizenzvertrag
 * das für uns in Ordnung bringt, steht in einem Vertrag und nicht in
 * einer API-Antwort — aber ob das Feld überhaupt mitgeliefert wird,
 * lässt sich hier sehen. Ohne Herkunftsangabe liesse sich die Frage
 * später gar nicht mehr stellen.
 *
 * ══════════════════════════════════════════════════════════════
 * Was diese Probe NICHT tut
 * ══════════════════════════════════════════════════════════════
 *
 * Sie schreibt nichts. Keine Stelle, keine Firma, keine Zeile. Sie
 * ruft ab, zählt und zeigt — mehr nicht.
 *
 * Aufruf:
 *   node --experimental-strip-types scripts/coresignal-stellen-probe.mjs [anzahl]
 *
 * `anzahl` ist die Zahl der abgeholten Datensätze. Jeder kostet zehn
 * Einheiten. Grundwert 3, damit ein versehentlicher Aufruf 30 Einheiten
 * kostet und nicht dreitausend.
 */

const BASIS = "https://api.coresignal.com/cdapi/v2";
const schluessel = process.env.CORESIGNAL_API_KEY;
if (!schluessel) {
  console.error("CORESIGNAL_API_KEY fehlt. Nichts abgefragt.");
  process.exit(1);
}

/*
 * Die Obergrenze ist hart.
 *
 * Ein Tippfehler in der Kommandozeile darf keine Rechnung erzeugen.
 * Zehn Datensätze sind hundert Einheiten — genug, um die Form der
 * Daten zu beurteilen, und wenig genug, um es nicht zu merken.
 */
const MAX = 10;
const anzahl = Math.min(Math.max(Number(process.argv[2] ?? 3) || 3, 1), MAX);

const trenner = (t) => console.log(`\n${"═".repeat(62)}\n${t}\n${"═".repeat(62)}`);

async function ruf(pfad, koerper) {
  const antwort = await fetch(`${BASIS}${pfad}`, {
    method: koerper ? "POST" : "GET",
    headers: {
      apikey: schluessel,
      ...(koerper ? { "content-type": "application/json" } : {}),
    },
    body: koerper ? JSON.stringify(koerper) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const text = await antwort.text();
  let daten = null;
  try {
    daten = JSON.parse(text);
  } catch {
    /* Kein JSON — dann zeigt der Rohtext, was los ist. */
  }
  return { status: antwort.status, daten, roh: text.slice(0, 300) };
}

/* ═══════════════════════════════════════════════════════════════
   1. Wie viele Stellen gibt es für Deutschland?
   ═══════════════════════════════════════════════════════════════

   Die Suche ist frei — sie liefert nur Kennungen. Erst das Abholen
   kostet.                                                          */
trenner("1. Suche (kostenlos) — wie gross ist der Bestand?");

const suchen = [
  { name: "Deutschland, alle", koerper: { country: "Germany" } },
  { name: "Deutschland, Lager", koerper: { country: "Germany", title: "Lager" } },
  { name: "Deutschland, Pflege", koerper: { country: "Germany", title: "Pflege" } },
  { name: "nur Titel „Customer Success“", koerper: { title: "Customer Success" } },
];

let ersteIds = [];
for (const s of suchen) {
  const r = await ruf("/job_base/search/filter", s.koerper);
  const n = Array.isArray(r.daten) ? r.daten.length : null;
  console.log(
    `  ${s.name.padEnd(32)} ${String(r.status).padEnd(5)} ${
      n === null ? r.roh.replace(/\s+/g, " ").slice(0, 60) : `${n} Kennungen`
    }`,
  );
  if (n && ersteIds.length === 0) ersteIds = r.daten;
}

if (ersteIds.length === 0) {
  trenner("Keine Kennungen — nichts abzuholen");
  console.log("Der Endpunkt liefert für diesen Schlüssel keine Treffer. Nichts bezahlt.");
  process.exit(0);
}

/* ═══════════════════════════════════════════════════════════════
   2. Was steht in einem Datensatz?
   ═══════════════════════════════════════════════════════════════ */
trenner(`2. Abholen — ${anzahl} Datensätze à 10 Einheiten = ${anzahl * 10} Einheiten`);

const saetze = [];
for (const id of ersteIds.slice(0, anzahl)) {
  const r = await ruf(`/job_base/collect/${id}`);
  if (r.status !== 200 || !r.daten) {
    console.log(`  ${id}: ${r.status} — ${r.roh.replace(/\s+/g, " ").slice(0, 70)}`);
    continue;
  }
  saetze.push(r.daten);
}
console.log(`  ${saetze.length} von ${anzahl} abgeholt.`);

if (saetze.length === 0) process.exit(0);

/* ═══════════════════════════════════════════════════════════════
   3. Welche Felder kommen, und wie oft sind sie gefüllt?
   ═══════════════════════════════════════════════════════════════ */
trenner("3. Felder — was ist gefüllt?");

const felder = new Map();
for (const s of saetze) {
  for (const [k, v] of Object.entries(s)) {
    const leer = v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
    const e = felder.get(k) ?? { gefuellt: 0, beispiel: null };
    if (!leer) {
      e.gefuellt++;
      if (e.beispiel === null) e.beispiel = String(Array.isArray(v) ? v[0] : v).slice(0, 48);
    }
    felder.set(k, e);
  }
}

for (const [k, e] of [...felder].sort((a, b) => b[1].gefuellt - a[1].gefuellt)) {
  console.log(
    `  ${k.padEnd(30)} ${String(e.gefuellt).padStart(2)}/${saetze.length}  ${e.beispiel ?? ""}`,
  );
}

/* ═══════════════════════════════════════════════════════════════
   4. Steht die Herkunft drin?
   ═══════════════════════════════════════════════════════════════

   Die entscheidende Frage. Ohne Herkunftsangabe lässt sich später
   nicht mehr klären, ob eine Stelle aus einem Portal stammt, das wir
   selbst nicht auslesen dürften.                                    */
trenner("4. Herkunft — dürfen wir das überhaupt anzeigen?");

const herkunftsfelder = [...felder.keys()].filter((k) =>
  /source|origin|url|link|domain|board|via|provider/i.test(k),
);
if (herkunftsfelder.length === 0) {
  console.log("  KEIN Herkunftsfeld gefunden.");
  console.log("  Damit liesse sich nicht sagen, aus welchem Portal eine Stelle stammt —");
  console.log("  und die Frage, ob wir sie anzeigen dürfen, wäre nicht mehr beantwortbar.");
} else {
  for (const k of herkunftsfelder) {
    const werte = [...new Set(saetze.map((s) => s[k]).filter(Boolean).map((v) => String(v).slice(0, 70)))];
    console.log(`  ${k}:`);
    for (const w of werte.slice(0, 5)) console.log(`     ${w}`);
  }
}

/* ═══════════════════════════════════════════════════════════════
   5. Was uns fehlen würde
   ═══════════════════════════════════════════════════════════════ */
trenner("5. Passt das zu unserem Stellenmodell?");

/* Die Felder, ohne die eine Stelle bei uns nichts wert ist. */
const GEBRAUCHT = {
  Titel: /^(title|job_title|position)$/i,
  Arbeitgeber: /^(company|company_name|employer)$/i,
  Ort: /^(location|city|job_location)$/i,
  Beschreibung: /^(description|job_description|content)$/i,
  Gehalt: /salary|compensation|pay/i,
  Vertragsart: /employment|contract|job_type/i,
  Veroeffentlicht: /posted|created|published|date/i,
  Originallink: /^(url|job_url|apply_url|link)$/i,
};

for (const [was, muster] of Object.entries(GEBRAUCHT)) {
  const treffer = [...felder.keys()].filter((k) => muster.test(k));
  const gefuellt = treffer.reduce((n, k) => Math.max(n, felder.get(k).gefuellt), 0);
  console.log(
    `  ${was.padEnd(16)} ${treffer.length === 0 ? "FEHLT" : `${treffer.join(", ")} (${gefuellt}/${saetze.length})`}`,
  );
}

trenner("Nichts geschrieben");
console.log(
  `Diese Probe hat ${saetze.length * 10} Einheiten gekostet und keine Zeile in der Datenbank verändert.`,
);
process.exit(0);
