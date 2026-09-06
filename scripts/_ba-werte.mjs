/** Wie gross ist jede Teilmenge der Jobbörse? Zählwerk je Filterwert. */
const K = { "X-API-Key": "jobboerse-jobsuche", "User-Agent": "Paycheck/1.0" };
const B = "https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v6/jobs";

async function zaehle(p) {
  const u = new URL(B);
  u.searchParams.set("size", "1"); u.searchParams.set("page", "1");
  for (const [k, v] of Object.entries(p)) u.searchParams.set(k, v);
  const r = await fetch(u, { headers: K, signal: AbortSignal.timeout(20000) }).catch(() => null);
  if (!r?.ok) return `HTTP ${r?.status ?? "—"}`;
  return (await r.json())?.maxErgebnisse ?? 0;
}

const PROBEN = [
  ["ohne Filter", {}],
  ["arbeitszeit=vz  Vollzeit", { arbeitszeit: "vz" }],
  ["arbeitszeit=tz  Teilzeit", { arbeitszeit: "tz" }],
  ["arbeitszeit=snw Schicht/Nacht/WE", { arbeitszeit: "snw" }],
  ["arbeitszeit=ho  Heim/Telearbeit", { arbeitszeit: "ho" }],
  ["arbeitszeit=mj  Minijob", { arbeitszeit: "mj" }],
  ["angebotsart=1   Arbeit", { angebotsart: "1" }],
  ["angebotsart=2   Selbstständig", { angebotsart: "2" }],
  ["angebotsart=4   Ausbildung", { angebotsart: "4" }],
  ["angebotsart=34  Praktikum", { angebotsart: "34" }],
  ["behinderung=true", { behinderung: "true" }],
  ["zeitarbeit=false", { zeitarbeit: "false" }],
  ["befristung=1    befristet", { befristung: "1" }],
  ["befristung=2    unbefristet", { befristung: "2" }],
];
for (const [name, p] of PROBEN) {
  const n = await zaehle(p);
  console.log(name.padEnd(34), typeof n === "number" ? n.toLocaleString("de-DE").padStart(11) : String(n).padStart(11));
  await new Promise((r) => setTimeout(r, 250));
}
process.exit(0);
