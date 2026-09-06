import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Prüft die EURES-Zugangsdaten, sobald sie in `.env.local` stehen.
 *
 * Der Endpunkt stammt nicht aus einer Dokumentation, sondern aus dem
 * Anwendungscode des Portals (chunk-DNI4MPYC.js):
 *
 *   post(t.jvseBaseUrl + "/public/jv-search/search", e)
 *
 * Ohne Freigabe antwortet der Basispfad mit 403 „Access Denied" — eine
 * Zugriffssperre, keine fehlende Route (die gäbe 404). Umgangen wird sie
 * nicht; dieses Skript probiert nur, was mit gültigen Daten funktioniert.
 *
 * Aufruf: node --experimental-strip-types scripts/eures-pruefung.mjs
 */
const schluessel = process.env.EURES_API_KEY?.trim();
const id = process.env.EURES_CLIENT_ID?.trim();
/* EURES gibt Schlüssel und Secret aus; der Zeilenname schwankt. */
const geheim = (process.env.EURES_API_SECRET ?? process.env.EURES_CLIENT_SECRET)?.trim();
const basis = process.env.EURES_BASE_URL?.trim() || "https://europa.eu/eures/api";

if (!schluessel && !(id && geheim)) {
  console.log("Keine EURES-Zugangsdaten gesetzt.");
  console.log("Erwartet wird in .env.local entweder EURES_API_KEY");
  console.log("oder das Paar EURES_CLIENT_ID und EURES_CLIENT_SECRET.");
  process.exit(0);
}

/* Mehrere übliche Formen, weil EURES noch nicht gesagt hat, welche gilt. */
const varianten = [];
if (schluessel) {
  varianten.push(["Bearer", { Authorization: `Bearer ${schluessel}` }]);
  varianten.push(["X-API-Key", { "X-API-Key": schluessel }]);
  varianten.push(["Ocp-Apim", { "Ocp-Apim-Subscription-Key": schluessel }]);
}
if (schluessel && geheim) {
  varianten.push(["Basic key:secret", {
    Authorization: `Basic ${Buffer.from(`${schluessel}:${geheim}`).toString("base64")}`,
  }]);
  varianten.push(["Kopfpaar", { "X-API-Key": schluessel, "X-API-Secret": geheim }]);
  varianten.push(["client_id/secret", { "client-id": schluessel, "client-secret": geheim }]);
}
if (id && geheim && id !== schluessel) {
  varianten.push(["Basic id:secret", {
    Authorization: `Basic ${Buffer.from(`${id}:${geheim}`).toString("base64")}`,
  }]);
}

const koerper = {
  page: 1,
  resultsPerPage: 5,
  sortSearch: "BY_PUBLICATION_DATE",
  keywords: [],
  locationCodes: ["AT"],
};

console.log(`Basis: ${basis}\n`);
for (const [name, kopf] of varianten) {
  try {
    const r = await fetch(`${basis}/public/jv-search/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "Paycheck/1.0", ...kopf },
      body: JSON.stringify(koerper),
      signal: AbortSignal.timeout(30000),
    });
    const text = await r.text();
    console.log(`${name.padEnd(10)} → HTTP ${r.status}`);
    if (r.ok) {
      let d = null;
      try { d = JSON.parse(text); } catch { /* kein JSON */ }
      const treffer = d?.numberRecords ?? d?.totalRecords ?? d?.total ?? "?";
      console.log(`  Treffer für Österreich: ${treffer}`);
      console.log(`  Felder: ${Object.keys(d ?? {}).join(", ").slice(0, 140)}`);
      console.log(`\nDiese Form funktioniert — damit baue ich den Adapter.`);
      process.exit(0);
    }
    console.log(`  ${text.slice(0, 100).replace(/\s+/g, " ")}`);
  } catch (e) {
    console.log(`${name.padEnd(10)} → ${String(e instanceof Error ? e.message : e).slice(0, 70)}`);
  }
  await new Promise((r) => setTimeout(r, 11000)); // Crawl-delay: 10 aus robots.txt
}
console.log("\nKeine der Formen wurde angenommen. Bitte die Angaben von EURES weitergeben.");
process.exit(1);
