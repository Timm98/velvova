/**
 * Der stündliche Suchlauf über alle veröffentlichten Stellen.
 *
 * ── Warum dieses Skript nur eine Anfrage stellt ───────────────
 *
 * Die Rechnung steckt in der Anwendung — `matcher.ts` benutzt den
 * Profilkontext, der über die Pfadaliase von Next importiert. Sie hier
 * nachzubauen hiesse, dieselbe Paarung könnte zwei verschiedene Zahlen
 * bekommen, je nachdem wer sie ausgelöst hat.
 *
 * Also ruft dieses Skript den Endpunkt auf, den die Anwendung dafür
 * hat. Ein Aufrufweg mehr, keine zweite Rechnung.
 */
const basis = process.env.NEXT_PUBLIC_APP_URL ?? `http://127.0.0.1:${process.env.WEB_PORT ?? 3000}`;
const secret = process.env.JOBS_REFRESH_SECRET;

if (!secret) {
  console.error("JOBS_REFRESH_SECRET fehlt — ohne Geheimnis nimmt der Endpunkt nichts an.");
  process.exit(1);
}

const antwort = await fetch(new URL("/api/intern/matches", basis), {
  method: "POST",
  headers: { authorization: `Bearer ${secret}` },
}).catch((e) => {
  console.error("Der Entwicklungsserver ist nicht erreichbar:", String(e).slice(0, 120));
  process.exit(1);
});

if (!antwort.ok) {
  console.error(`Der Lauf wurde abgelehnt: ${antwort.status}`);
  process.exit(1);
}

const r = await antwort.json();
console.log(
  `Suchlauf: ${r.stellen} Stellen, ${r.geprueft} Profile geprüft, ` +
    `${r.neu} neue Vorschläge, ${r.aktualisiert} aktualisiert.`,
);
if (r.fehler?.length) {
  console.log(`  ${r.fehler.length} Stellen mit Fehler:`);
  for (const f of r.fehler.slice(0, 5)) console.log(`    ${f}`);
}
