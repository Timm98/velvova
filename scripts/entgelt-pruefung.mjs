import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Prüft die Entgeltatlas-Zugangsdaten. Gibt nie einen Wert aus.
 *
 * Aufruf: node --experimental-strip-types scripts/entgelt-pruefung.mjs
 */
const id = process.env.ENTGELTATLAS_CLIENT_ID?.trim();
const geheim = process.env.ENTGELTATLAS_CLIENT_SECRET?.trim();
if (!id || !geheim) { console.log("Zugangsdaten fehlen."); process.exit(1); }
console.log(`ID ${id.length} Zeichen · Secret ${geheim.length} Zeichen\n`);

const t = await fetch("https://rest.arbeitsagentur.de/oauth/gettoken_cc", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Paycheck/1.0", Accept: "application/json" },
  body: new URLSearchParams({ grant_type: "client_credentials", client_id: id, client_secret: geheim }),
  signal: AbortSignal.timeout(15000),
});
console.log(`Token: HTTP ${t.status}`);
console.log("  Kopfzeilen:", JSON.stringify(Object.fromEntries([...t.headers].filter(([k]) => /type|length|allow|www-auth/i.test(k)))));
if (!t.ok) { console.log((await t.text()).slice(0, 180)); process.exit(1); }
const { access_token, expires_in } = await t.json();
if (!access_token) { console.log("Kein Token in der Antwort."); process.exit(1); }
console.log(`  angenommen · gültig ${expires_in ?? "?"} s\n`);

/* Eine echte Abfrage: Berufsgattung 71304 = Kaufleute im Einzelhandel. */
for (const beruf of ["71304", "43414", "81104"]) {
  const u = new URL(`https://rest.arbeitsagentur.de/infosysbub/entgeltatlas/pc/v1/entgelte/${beruf}`);
  u.searchParams.set("l", "4");
  const r = await fetch(u, {
    headers: { Authorization: `Bearer ${access_token}`, Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  const text = await r.text();
  console.log(`Beruf ${beruf}: HTTP ${r.status}`);
  if (r.ok) {
    let d = null; try { d = JSON.parse(text); } catch { /* egal */ }
    const e = Array.isArray(d?.entgelte) ? d.entgelte[0] : d?.entgelte ?? d;
    console.log(`  Felder: ${Object.keys(e ?? {}).join(", ").slice(0, 120)}`);
    console.log(`  Median: ${e?.entgelt ?? e?.median ?? "—"}`);
  } else {
    console.log(`  ${text.slice(0, 120).replace(/\s+/g, " ")}`);
  }
  await new Promise((r) => setTimeout(r, 400));
}
process.exit(0);
