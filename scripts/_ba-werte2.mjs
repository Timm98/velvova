const K = { "X-API-Key": "jobboerse-jobsuche", "User-Agent": "Paycheck/1.0" };
const B = "https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v6/jobs";
for (const [name, art] of [["Ausbildung", "4"], ["Praktikum", "34"], ["Arbeit", "1"], ["Selbstständig", "2"]]) {
  const u = new URL(B);
  u.searchParams.set("size", "3"); u.searchParams.set("page", "1"); u.searchParams.set("angebotsart", art);
  const d = await (await fetch(u, { headers: K, signal: AbortSignal.timeout(20000) })).json();
  console.log(`\n── ${name} ──`);
  for (const s of (d?.stellenangebote ?? d?.ergebnisliste ?? []).slice(0, 3)) {
    console.log(`  art=${JSON.stringify(s.stellenangebotsart)} ausb=${JSON.stringify(s.ausbildungsart)} ` +
      `titel=${JSON.stringify(s.stellenangebotsTitel)?.slice(0, 34)} hauptberuf=${JSON.stringify(s.hauptberuf)?.slice(0, 34)}`);
    console.log(`     minijob=${s.istGeringfuegigeBeschaeftigung} ho=${s.homeofficemoeglich} schicht=${s.arbeitszeitSchichtNachtWochenende} vz=${s.arbeitszeitVollzeit} tz=${s.arbeitszeitTeilzeitFlexibel}`);
  }
  await new Promise((r) => setTimeout(r, 300));
}
process.exit(0);
