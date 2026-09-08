import fs from "node:fs";
const roh = JSON.parse(fs.readFileSync("/tmp/kandidaten.json", "utf8"));
const gesehen = new Set(); const kand = [];
for (const r of roh) {
  const d = String(r.website).trim().toLowerCase().replace(/^https?:\/\//,"").replace(/\/.*$/,"").replace(/^www\./,"");
  if (!d.includes(".") || d.length < 4) continue;
  if (/^(bit\.ly|goo\.gl|t\.co|tinyurl\.com|linkedin\.com|facebook\.com|xn--)/.test(d)) continue;
  if (gesehen.has(d)) continue; gesehen.add(d); kand.push(d);
}
// Bewerbersysteme, nach Hostmuster. Die ersten fünf haben wir.
const SYSTEME = {
  "greenhouse (haben wir)": /greenhouse\.io/i, "lever (haben wir)": /lever\.co/i,
  "ashby (haben wir)": /ashbyhq\.com/i, "smartrecruiters (haben wir)": /smartrecruiters\.com/i,
  "recruitee (haben wir)": /recruitee\.com/i,
  personio: /personio\.(de|com)/i, workday: /myworkdayjobs\.com|workday\.com/i,
  softgarden: /softgarden\.(de|io)/i, "rexx": /rexx-systems\.com|rexx\.jobs/i,
  dvinci: /dvinci\.de|d-vinci\.de/i, concludis: /concludis\.de/i,
  successfactors: /successfactors\.(com|eu)|sapsf\.(com|eu)/i, taleo: /taleo\.net/i,
  umantis: /umantis\.com/i, guidecom: /guidecom\.de/i, talention: /talention\.com/i,
  "onlyfy/xing": /onlyfy\.com|xing\.com\/jobs/i, join: /join\.com/i,
  jobvite: /jobvite\.com/i, teamtailor: /teamtailor\.com/i, workable: /workable\.com/i,
  bamboohr: /bamboohr\.com/i, "jobs.ch": /jobs\.ch/i, stepstone: /stepstone\.de/i,
  indeed: /indeed\.com/i, "eigenes Formular": /(bewerbung|karriere|jobs)[^"']{0,40}\.(php|aspx)/i,
};
const PFADE = ["", "/karriere", "/jobs", "/careers", "/stellenangebote", "/career"];
const zaehler = {}; const beispiele = {};
let mitHtml = 0, geprueft = 0;
const probe = JSON.parse(fs.readFileSync("/tmp/nicht-dienstleister.json","utf8"));
const NEBEN = 6;
async function arbeiter(liste) {
  for (const d of liste) {
    let html = "", habe = false;
    for (const p of PFADE) {
      const ac = new AbortController(); const uhr = setTimeout(() => ac.abort(), 10000);
      try {
        const r = await fetch(`https://${d}${p}`, { signal: ac.signal, redirect: "follow",
          headers: { "user-agent": "VelvovaJobs/1.0 (+https://paycheck.example/bot)", accept: "text/html" } });
        if (r.ok && (r.headers.get("content-type") ?? "").includes("html")) {
          html += (await r.text()).slice(0, 400000); habe = true;
        }
      } catch {} finally { clearTimeout(uhr); }
      await new Promise(r => setTimeout(r, 300));
    }
    if (habe) mitHtml++;
    for (const [name, re] of Object.entries(SYSTEME)) {
      const m = html.match(re);
      if (m) { zaehler[name] = (zaehler[name]||0)+1; (beispiele[name] ??= []).push(d); }
    }
    geprueft++;
  }
}
const t0 = Date.now();
await Promise.all(Array.from({length:NEBEN},(_,i)=>arbeiter(probe.filter((_,j)=>j%NEBEN===i))).map(p=>p));
console.log("Geprüft:", geprueft, "| mit HTML:", mitHtml, "| Dauer:", Math.round((Date.now()-t0)/1000)+"s\n");
console.log("Bewerbersystem auf der Karriereseite gefunden:");
const sortiert = Object.entries(zaehler).sort((a,b)=>b[1]-a[1]);
if (!sortiert.length) console.log("  — keines —");
for (const [n,c] of sortiert) console.log("  "+String(c).padStart(3)+"  "+n.padEnd(24)+beispiele[n].slice(0,3).join(", "));
process.exit(0);
