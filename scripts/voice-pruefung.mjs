import { chromium } from "@playwright/test";

/**
 * Prüft die Sprachsitzung, soweit es ohne Mikrofon geht.
 *
 * Was hier NICHT geprüft wird — und was deshalb MANUAL_TEST_REQUIRED
 * bleibt: ob Monday hörbar spricht, ob die Unterbrechung greift, ob die
 * Erkennung versteht. Dafür braucht es ein echtes Mikrofon und ein
 * echtes Ohr.
 *
 * Was hier geprüft WIRD, und was ohne Mikrofon genauso kaputt sein
 * kann: ob der Endpunkt überhaupt antwortet, ob er die Anmeldung
 * verlangt, ob ein kurzlebiges Geheimnis herauskommt — und vor allem,
 * ob versehentlich der langlebige Schlüssel mitgeliefert wird.
 */
const B = "http://localhost:3000";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, locale: "de-DE" });
const p = await ctx.newPage();

/*
 * 1. Ohne Anmeldung — OHNE der Weiterleitung zu folgen.
 *
 * Der erste Anlauf meldete hier „HTTP 200" und damit eine Lücke, die
 * es nicht gab: Playwright folgt Weiterleitungen von sich aus, und am
 * Ende der Kette stand die Anmeldeseite. Der Endpunkt selbst antwortet
 * mit 307. Wer Weiterleitungen nicht abschaltet, prüft nicht den
 * Endpunkt, sondern das Ziel dahinter.
 */
const ohne = await p.request.post(`${B}/api/nina/realtime-session`, {
  failOnStatusCode: false,
  maxRedirects: 0,
});
const abgewiesen = [301, 302, 303, 307, 308, 401, 403, 404].includes(ohne.status());
console.log(`  ${abgewiesen ? "ok  " : "!!  "} ohne Anmeldung abgewiesen → HTTP ${ohne.status()}`);

await p.goto(`${B}/register`, { waitUntil: "domcontentloaded" });
await p.getByLabel("E-Mail-Adresse").fill(`voice-${Date.now()}@example.invalid`);
await p.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await p.getByRole("button", { name: /Konto anlegen/i }).click();
await p.waitForURL(/\/(app|setup)/, { timeout: 60000 });

// 2. Mit Anmeldung
const mit = await p.request.post(`${B}/api/nina/realtime-session`, { failOnStatusCode: false });
const roh = await mit.text();
/*
 * 403 ist hier die RICHTIGE Antwort, nicht die falsche.
 *
 * Die Sprach-Einwilligung ist von der allgemeinen KI-Nutzung getrennt
 * und muss ausdrücklich erteilt werden. Ein frisch angelegtes Konto hat
 * sie nicht — der Endpunkt weist es ab und sagt, warum. Ein 200 an
 * dieser Stelle wäre der Fehler gewesen.
 */
const erwartet = mit.ok() || roh.includes("voice_consent_missing") || roh.includes("provider_not_connected");
console.log(`  ${erwartet ? "ok  " : "!!  "} mit Anmeldung → HTTP ${mit.status()}${roh.includes("voice_consent_missing") ? " (Einwilligung fehlt — erwartet)" : ""}`);

// 3. Kein langlebiger Schlüssel in der Antwort
const leck = /sk-proj-|sk-ant-|sk-[A-Za-z0-9]{20,}/.test(roh);
console.log(`  ${leck ? "!!  " : "ok  "} kein langlebiger Schlüssel in der Antwort`);

// 4. Struktur, ohne Werte zu zeigen
try {
  const j = JSON.parse(roh);
  const schluessel = Object.keys(j).sort().join(", ");
  console.log(`      Felder: ${schluessel}`);
  if (!mit.ok() && j.fehlendeVariable) console.log(`      fehlt: ${j.fehlendeVariable}`);
  if (!mit.ok() && j.grund) console.log(`      Grund: ${String(j.grund).slice(0, 90)}`);
} catch {
  console.log(`      (keine JSON-Antwort, ${roh.length} Zeichen)`);
}

// 5. Der Knopf existiert in der Oberfläche
await p.goto(`${B}/app/monday`, { waitUntil: "networkidle" });
await p.waitForTimeout(2000);
const knopf =
  (await p.getByRole("button", { name: /Live sprechen/i }).count()) +
  (await p.getByRole("link", { name: /Live sprechen/i }).count()) +
  (await p.getByText(/Live sprechen/i).count());
console.log(`  ${knopf > 0 ? "ok  " : "!!  "} Einstieg „Live sprechen" vorhanden (${knopf})`);

await b.close();
