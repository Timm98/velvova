/** Führt die Jobbörse Stellen ausserhalb Deutschlands? */
const K = { "X-API-Key": "jobboerse-jobsuche", "User-Agent": "Paycheck/1.0" };
const B = "https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v6/jobs";
const hole = async (p) => {
  const u = new URL(B);
  for (const [k, v] of Object.entries(p)) u.searchParams.set(k, v);
  const r = await fetch(u, { headers: K, signal: AbortSignal.timeout(25000) });
  return r.ok ? r.json() : { fehler: r.status };
};
for (const ort of ["Wien", "Zürich", "Salzburg", "Basel", "Innsbruck", "Graz"]) {
  const d = await hole({ wo: ort, umkreis: "25", size: "3", page: "1" });
  const erste = (d?.stellenangebote ?? d?.ergebnisliste ?? [])[0];
  const a = erste?.stellenlokationen?.[0]?.adresse;
  console.log(
    `${ort.padEnd(11)} Treffer ${String(d?.maxErgebnisse ?? d?.fehler ?? "—").padStart(7)}` +
    `   Beispiel: ${[a?.ort, a?.region, a?.land].filter(Boolean).join(" / ") || "—"}`,
  );
  await new Promise((r) => setTimeout(r, 300));
}
process.exit(0);
