/**
 * Welche Stellenquellen antworten — und was sie verlangen.
 *
 * Der Unterschied zwischen 401, 403 und einer HTML-Sperrseite ist der
 * Unterschied zwischen „registrieren", „verboten" und „Bot-Schutz".
 * Nur der erste Fall ist eine Aufgabe für den Betreiber; die anderen
 * beiden sind Absagen.
 *
 * Kein Abruf von Daten, nur eine Anfrage je Adresse.
 */
const KANDIDATEN = [
  // ── DACH ──────────────────────────────────────────────────
  ["DACH", "Bundesagentur (haben wir)", "https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v6/jobs?was=Koch&size=1", { "X-API-Key": "jobboerse-jobsuche" }],
  ["DACH", "job-room.ch (SECO, amtlich)", "https://api.job-room.ch/api/jobadverts/_search?page=0&size=1", {}],
  ["DACH", "karriere.at", "https://api.karriere.at/v3/jobs?limit=1", {}],
  ["DACH", "jobs.ch", "https://www.jobs.ch/api/v1/public/search?rows=1", {}],
  ["DACH", "Jobware", "https://api.jobware.de/v1/jobs?rows=1", {}],
  ["DACH", "Kimeta", "https://api.kimeta.de/v1/jobs?limit=1", {}],
  ["DACH", "Interamt (öffentl. Dienst)", "https://www.interamt.de/koop/app/api/stellen?size=1", {}],
  // ── Weltweit, frei oder mit Schlüssel ─────────────────────
  ["Welt", "Adzuna (haben wir)", "https://api.adzuna.com/v1/api/version", {}],
  ["Welt", "Reed.co.uk (UK)", "https://www.reed.co.uk/api/1.0/search?resultsToTake=1", {}],
  ["Welt", "USAJOBS (US-Regierung)", "https://data.usajobs.gov/api/search?ResultsPerPage=1", { Host: "data.usajobs.gov" }],
  ["Welt", "Careerjet", "https://public.api.careerjet.net/search?locale_code=de_DE&pagesize=1", {}],
  ["Welt", "Whatjobs", "https://api.whatjobs.com/api/v1/jobs?limit=1", {}],
  ["Welt", "Remotive (Remote)", "https://remotive.com/api/remote-jobs?limit=1", {}],
  ["Welt", "RemoteOK", "https://remoteok.com/api", {}],
  ["Welt", "Jobicy (Remote)", "https://jobicy.com/api/v2/remote-jobs?count=1", {}],
  ["Welt", "Himalayas (Remote)", "https://himalayas.app/jobs/api?limit=1", {}],
  ["Welt", "The Muse", "https://www.themuse.com/api/public/jobs?page=1", {}],
  ["Welt", "Findwork", "https://findwork.dev/api/jobs/", {}],
  ["Welt", "Workable (Board)", "https://apply.workable.com/api/v1/widget/accounts/workable?details=true", {}],
  ["Welt", "Teamtailor (Board)", "https://api.teamtailor.com/v1/jobs", {}],
  ["Welt", "Recruitee (Board)", "https://demo.recruitee.com/api/offers", {}],
  ["Welt", "Lever (Board)", "https://api.lever.co/v0/postings/leverdemo?mode=json", {}],
];

console.log("Quelle                          Status  Befund");
console.log("─".repeat(78));
for (const [raum, name, url, kopf] of KANDIDATEN) {
  const r = await fetch(url, {
    headers: { "User-Agent": "Paycheck/1.0", Accept: "application/json", ...kopf },
    signal: AbortSignal.timeout(15000),
  }).catch(() => null);

  let befund;
  if (!r) befund = "keine Antwort";
  else {
    const t = await r.text().catch(() => "");
    const html = /^\s*<(!doctype|html)/i.test(t);
    const server = r.headers.get("server") ?? "";
    befund =
      r.ok && !html ? `OFFEN · ${t.length} Zeichen`
      : r.status === 401 ? "Registrierung nötig"
      : r.status === 403 && /cloudflare/i.test(server) ? "Bot-Schutz (Cloudflare)"
      : r.status === 403 ? "Zugang abgelehnt"
      : r.status === 404 ? "Adresse gibt es nicht"
      : r.ok && html ? "HTML statt Daten"
      : `Status ${r.status}`;
  }
  console.log(`${(raum + " · " + name).padEnd(32)}${String(r?.status ?? "-").padStart(4)}  ${befund}`);
}
