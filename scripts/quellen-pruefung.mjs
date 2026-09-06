/**
 * Welche amtlichen Gehaltsquellen ohne Zugangsdaten antworten.
 *
 * Nachvollziehbar statt behauptet: Dieses Skript fragt jede Quelle
 * einmal und schreibt hin, was zurückkommt. Wer die Aussage „der
 * Entgeltatlas ist zu" nicht glaubt, lässt es laufen.
 *
 * Es verändert nichts und braucht keine Datenbank.
 */
const K = { "X-API-Key": "jobboerse-jobsuche", "User-Agent": "Paycheck/1.0" };

const quellen = [
  ["Jobsuche — Stellen (offen, in Betrieb)", "https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v6/jobs?was=Buchhalter&size=1&page=1", K],
  ["Jobsuche — Berufsvorschläge", "https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v1/vorschlaege/berufe?was=Buchhalter", K],
  ["Entgeltatlas — Entgelte", "https://rest.arbeitsagentur.de/infosysbub/entgeltatlas/pc/v1/entgelte/43414", K],
  ["Entgeltatlas — Entgelte (ohne Kennung)", "https://rest.arbeitsagentur.de/infosysbub/entgeltatlas/pc/v1/entgelte/43414", {}],
  ["Entgeltatlas — Token", "https://rest.arbeitsagentur.de/oauth/gettoken_cc", K],
  ["Berufenet", "https://rest.arbeitsagentur.de/infosysbub/berufenet/pc/v1/berufe?suchwoerter=Buchhalter", K],
  ["GENESIS — whoami", "https://www-genesis.destatis.de/genesisWS/rest/2020/helloworld/whoami", {}],
  ["GENESIS — Tabelle (Gastzugang)", "https://www-genesis.destatis.de/genesisWS/rest/2020/data/table?username=GAST&password=GAST&name=62361-0010&language=de", {}],
];

console.log("Amtliche Gehaltsquellen, geprüft ohne eigene Zugangsdaten:\n");
for (const [name, url, kopf] of quellen) {
  const a = await fetch(url, { headers: { ...kopf }, signal: AbortSignal.timeout(20000) }).catch((e) => null);
  if (!a) { console.log(`  —    ${name}: keine Antwort`); continue; }
  const typ = a.headers.get("content-type") ?? "";
  const koerper = await a.text().catch(() => "");
  const html = /^\s*<(!doctype|html)/i.test(koerper);
  const befund =
    a.status === 200 && html ? "200, aber HTML statt Daten (Gastzugang abgeschaltet)"
    : a.status === 200 ? `200, ${typ.split(";")[0]}`
    : String(a.status);
  console.log(`  ${befund.padEnd(46)} ${name}`);
}
console.log("\nBeide amtlichen Statistiken verlangen eine Registrierung, die nur der Betreiber");
console.log("vornehmen kann. Die offene Jobsuche antwortet — auf ihr beruht die Referenz in");
console.log("`beruf_entgelt`. Siehe apps/web/src/lib/jobs/berufsreferenz.ts.");
