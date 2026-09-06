/**
 * Was liefert ein Anbieter WIRKLICH — Feld für Feld? (§26)
 *
 * Nicht nach Dokumentation programmieren, sondern die Antwort ansehen.
 * Sucht rekursiv nach allem, was nach Gehalt aussieht, und zeigt, ob es
 * belegt ist.
 *
 *   node scripts/rohantwort-pruefen.mjs bundesagentur
 */
import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

const MUSTER = /salary|salaer|gehalt|compensation|\bpay\b|wage|verg[üu]tung|entgelt|remuneration|income|verdienst|lohn/i;

function suche(o, pfad = "", treffer = [], tiefe = 0) {
  if (tiefe > 7 || o === null || typeof o !== "object") return treffer;
  for (const [k, v] of Object.entries(o)) {
    const p = pfad ? `${pfad}.${k}` : k;
    if (MUSTER.test(k)) treffer.push([p, v === null ? "null" : JSON.stringify(v).slice(0, 70)]);
    if (v && typeof v === "object") suche(v, Array.isArray(o) ? pfad : p, treffer, tiefe + 1);
  }
  return treffer;
}

const welcher = process.argv[2] ?? "bundesagentur";

if (welcher === "bundesagentur") {
  const url = new URL("https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v6/jobs");
  url.searchParams.set("was", "Sachbearbeitung");
  url.searchParams.set("size", "5");
  url.searchParams.set("page", "1");
  const r = await fetch(url, { headers: { "X-API-Key": "jobboerse-jobsuche" } });
  const j = await r.json();
  const erste = (j.stellenangebote ?? j.ergebnisliste ?? [])[0];
  console.log(`  HTTP ${r.status} · ${(j.stellenangebote ?? j.ergebnisliste ?? []).length} Treffer`);
  console.log(`\n  Felder der Suchantwort:`);
  console.log(`    ${Object.keys(erste ?? {}).join(", ")}`);
  const t = suche(j);
  console.log(`\n  Gehaltsartige Felder in der SUCHE: ${t.length === 0 ? "KEINE" : ""}`);
  for (const [p, v] of t.slice(0, 12)) console.log(`    ${p.padEnd(40)} ${v}`);

  if (erste?.refnr) {
    const b64 = Buffer.from(erste.refnr).toString("base64");
    const d = await fetch(`https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v4/jobdetails/${b64}`, {
      headers: { "X-API-Key": "jobboerse-jobsuche" },
    });
    const dj = await d.json();
    console.log(`\n  Detailabruf HTTP ${d.status}`);
    console.log(`  Felder des Details:`);
    console.log(`    ${Object.keys(dj ?? {}).join(", ").slice(0, 400)}`);
    const td = suche(dj);
    console.log(`\n  Gehaltsartige Felder im DETAIL: ${td.length === 0 ? "KEINE" : ""}`);
    for (const [p, v] of td.slice(0, 12)) console.log(`    ${p.padEnd(40)} ${v}`);
  }
}
process.exit(0);
