import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Die Bundesagentur über die Ortsachse ernten.
 *
 * ── Warum eine weitere Achse ──────────────────────────────────
 *
 * Die Jobbörse gibt je Suche höchstens 10.000 Anzeigen heraus. Über
 * Suchbegriffe und Arbeitszeitfilter stehen wir bei 779.669 von
 * 1.012.980 — 77 %. Die letzten 233.311 liegen unterhalb von Platz
 * 10.000 jeder bisherigen Abfrage und sind so nicht erreichbar.
 *
 * Ein Ort beginnt die Zählung von vorn: „Bäcker" bundesweit liefert
 * andere 10.000 als „Bäcker" im Umkreis von Cottbus. Dieselbe Technik,
 * die bei Adzuna aus 150.000 drei Millionen gemacht hat.
 *
 * ── Warum der Umkreis bei 50 bleibt ───────────────────────────
 *
 * Der Adapter setzt ihn fest, mit Begründung: Überschneidung kostet
 * Anfragen und bringt Dubletten, eine Lücke kostet Anzeigen für immer.
 * Eine doppelt geholte Anzeige führt der Import zusammen. Also
 * bleibt es dabei.
 *
 * Aufruf: node --experimental-strip-types scripts/ba-orte.mjs
 */
const { BundesagenturAdapter } = await import("../packages/jobs/src/sources/bundesagentur.ts");
const { ingestFromAdapter } = await import("../packages/jobs/src/ingest.ts");
const { decideForProvider } = await import("../packages/sources/src/index.ts");
const { berufsabfragen } = await import("../packages/jobs/src/berufsabfragen.ts");

/* Nach Einwohnerzahl — wo die meisten Anzeigen stehen, zuerst. */
const ORTE = [
  "Berlin", "Hamburg", "München", "Köln", "Frankfurt am Main", "Stuttgart", "Düsseldorf",
  "Leipzig", "Dortmund", "Essen", "Bremen", "Dresden", "Hannover", "Nürnberg", "Duisburg",
  "Bochum", "Wuppertal", "Bielefeld", "Bonn", "Münster", "Mannheim", "Karlsruhe", "Augsburg",
  "Wiesbaden", "Mönchengladbach", "Gelsenkirchen", "Braunschweig", "Kiel", "Aachen", "Chemnitz",
  "Halle (Saale)", "Magdeburg", "Freiburg im Breisgau", "Krefeld", "Mainz", "Lübeck", "Erfurt",
  "Oberhausen", "Rostock", "Kassel", "Hagen", "Saarbrücken", "Potsdam", "Ludwigshafen am Rhein",
  "Oldenburg", "Osnabrück", "Leverkusen", "Heidelberg", "Darmstadt", "Solingen", "Regensburg",
  "Herne", "Paderborn", "Neuss", "Ingolstadt", "Würzburg", "Fürth", "Wolfsburg", "Ulm", "Heilbronn",
  "Pforzheim", "Göttingen", "Bottrop", "Reutlingen", "Koblenz", "Bremerhaven", "Erlangen", "Jena",
  "Trier", "Siegen", "Hildesheim", "Salzgitter", "Cottbus", "Kaiserslautern", "Gütersloh", "Schwerin",
  "Flensburg", "Gera", "Zwickau", "Konstanz", "Passau", "Bayreuth", "Emden", "Görlitz",
];

/*
 * Die Arbeitszeitachse zusätzlich.
 *
 * Gemessen: Teilzeit fördert Anzeigen zutage, die ohne Filter
 * unterhalb von Platz 10.000 lagen. Ort mal Arbeitszeit vervierfacht
 * die erreichbaren Plätze noch einmal.
 */
const FILTER = [
  { name: "alle", zusatz: {} },
  { name: "teilzeit", zusatz: { arbeitszeit: "tz" } },
  { name: "schicht", zusatz: { arbeitszeit: "snw" } },
  { name: "befristet", zusatz: { befristung: "1" } },
];

const p = decideForProvider("bundesagentur");

/*
 * Die Suchbegriffe aus dem geernteten Wortschatz, nicht die fünf
 * Voreinstellungen.
 *
 * Mit „Sachbearbeitung, Kundenbetreuung, Disposition, Büromanagement,
 * Vertriebsinnendienst" fände eine Ortssuche in Görlitz vor allem
 * nichts. 120 Begriffe je Ort halten die Abfrage breit genug und die
 * Laufzeit je Ort im Rahmen.
 */
const ABFRAGEN = await berufsabfragen(120);
console.log(`Freigabe: ${p.decision} · ${ORTE.length} Orte × ${FILTER.length} Filter × ${ABFRAGEN.length} Begriffe\n`);

const t0 = Date.now();
let neu = 0;
for (const ort of ORTE) {
  let ortNeu = 0;
  for (const f of FILTER) {
    try {
      const e = await ingestFromAdapter(
        new BundesagenturAdapter({ orte: [ort], zusatz: f.zusatz, abfragen: ABFRAGEN }),
        { limit: 4000, policy: p },
      );
      neu += e.inserted ?? 0;
      ortNeu += e.inserted ?? 0;
    } catch (e) {
      const t = String(e instanceof Error ? e.message : e);
      console.log(`  ${ort} · ${f.name} ! ${t.slice(0, 90)}`);
      /* Weitermachen: Ein Fehlschlag je Ort ist kein Grund, den Rest zu verschenken. */
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  console.log(
    `  ${ort.padEnd(24)} neu ${String(ortNeu).padStart(6)} · gesamt ${String(neu).padStart(7)} · ` +
    `${((Date.now() - t0) / 60000).toFixed(0)} min`,
  );
}
console.log(`\nFertig: ${neu} neue Stellen von der Bundesagentur.`);
process.exit(0);
