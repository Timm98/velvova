/** Welche Felder liefert die Jobbörse je Stellenart? */
const K = { "X-API-Key": "jobboerse-jobsuche", "User-Agent": "Paycheck/1.0" };
const B = "https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v6/jobs";
for (const [name, art] of [["Ausbildung", "4"], ["Praktikum", "34"], ["Arbeit", "1"]]) {
  const u = new URL(B);
  u.searchParams.set("size", "2"); u.searchParams.set("page", "1"); u.searchParams.set("angebotsart", art);
  const d = await (await fetch(u, { headers: K, signal: AbortSignal.timeout(20000) })).json();
  const s = d?.stellenangebote?.[0] ?? d?.ergebnisliste?.[0];
  console.log(`\n── ${name} (angebotsart=${art}) ──`);
  console.log("Felder:", Object.keys(s ?? {}).join(", "));
  console.log("titel:", s?.titel, "| beruf:", s?.beruf, "| angebotsart:", s?.angebotsart);
  await new Promise((r) => setTimeout(r, 300));
}
process.exit(0);
