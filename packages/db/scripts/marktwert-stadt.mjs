#!/usr/bin/env node
/**
 * ══════════════════════════════════════════════════════════════════
 * Der Beweislauf: eine Stadt vollständig, mit gelesenen Stufen
 * ══════════════════════════════════════════════════════════════════
 *
 * Zwei Messungen liegen vor:
 *
 *   marktwert-probe.mjs   Ohne gelesene Stufen erreichen 7,4 % der
 *                         Anzeigen eine tragfähige Vergleichsgruppe,
 *                         und die grössten Gruppen mischen alle Stufen.
 *   stufe-lesen.mjs       Ein Modell stimmt bei eindeutigen Titeln zu
 *                         90 % überein und erschliesst 70 % der Fälle,
 *                         in denen der Titel schweigt.
 *
 * Was fehlt, ist die Verbindung: Hebt das Lesen die Abdeckung so weit,
 * dass ein Marktwert überhaupt aussagbar wird? Das lässt sich nur an
 * einem vollständigen Ausschnitt zeigen — eine Stadt, alle Anzeigen.
 *
 * Ausgegeben wird beides nebeneinander: die Abdeckung wie bisher und
 * die mit gelesenen Stufen. Der Unterschied ist die Entscheidung.
 *
 * Aufruf aus der Repo-Wurzel:
 *   node --env-file=.env.local packages/db/scripts/marktwert-stadt.mjs Berlin
 */

import pg from "pg";
import { writeFileSync } from "node:fs";

const STADT = process.argv[2] ?? "Berlin";
const GRENZE = Math.min(Number(process.argv[3] ?? 4000), 8000);
const GLEICHZEITIG = 6;
const MINDESTZAHL = 30;
const MODELL = process.env.OPENAI_MODEL_FAST ?? "gpt-4.1-mini";
const schluessel = process.env.OPENAI_API_KEY;
const url = process.env.DATABASE_URL;
if (!schluessel || !url) { console.error("OPENAI_API_KEY oder DATABASE_URL fehlt."); process.exit(1); }

function libpqSemantik(roh) {
  let u; try { u = new URL(roh); } catch { return roh; }
  const m = u.searchParams.get("sslmode");
  if (m === "verify-ca" || m === "verify-full" || m === "disable") return roh;
  if (!u.searchParams.has("uselibpqcompat")) { u.searchParams.set("uselibpqcompat", "true"); if (!m) u.searchParams.set("sslmode", "require"); }
  return u.toString();
}

const MUSTER = [
  ["leitung", /(\blead\b|\bhead of\b|\bprincipal\b|\bdirector\b|\bvorstand|\bleiter|\bleitung|\bchefarzt|\bchefärzt|\bgeschäftsführ|\w*leiter|\w*leitung|\w*leiterin)/i],
  ["einstieg", /(\bjunior\b|\bjr\.?\b|\btrainee\b|\bvolontär|\bpraktikant|\bpraktikum\b|\bwerkstudent|\bstudentische|\bazubi\b|\bauszubildende|\bausbildung\b|\beinsteiger|\bberufseinsteiger|\bquereinsteiger|\babsolvent|\bentry.level\b|\bschulabg)/i],
  ["senior", /(\bsenior\b|\bsr\.?\b|\bexpert\b|\bexpertin\b|\bspezialist|\bspecialist\b|\barchitekt|\bstaff engineer\b|\berfahrene?r?\b)/i],
  ["erfahren", /(\bmid.level\b|\bprofessional\b|\bregular\b)/i],
];
const stufeAusTitel = (t) => { for (const [s, m] of MUSTER) if (m.test(t ?? "")) return s; return "unbekannt"; };

const ANWEISUNG = `Du liest deutsche Stellenanzeigen und bestimmst, welche Senioritätsstufe die Stelle verlangt.

Stufen:
- einstieg: Berufseinsteiger, Ausbildung, Praktikum, Werkstudent, Trainee, bis ~1 Jahr Erfahrung
- erfahren: eigenständige Fachkraft, etwa 2 bis 5 Jahre Erfahrung, keine Führung
- senior: ausgeprägte Fachtiefe, etwa ab 5 Jahren, fachliche Anleitung anderer, aber keine Personalverantwortung
- leitung: Personal- oder Budgetverantwortung, Team-, Abteilungs- oder Bereichsleitung, Geschäftsführung
- unbekannt: die Anzeige lässt es offen

Wichtig: "unbekannt" ist eine richtige Antwort. Rate nicht.

Antworte NUR mit JSON: {"stufe":"..."}`;

/**
 * Die gültigen Antworten.
 *
 * Ein Modell antwortet „erfahrung" statt „erfahren", und schon zählt
 * eine eigene Stufe mit, die niemand definiert hat — im ersten Lauf
 * 47 Mal. Was nicht auf dieser Liste steht, ist `unbekannt`: Eine
 * unlesbare Antwort ist keine Auskunft über die Stelle.
 */
const STUFEN = new Set(["einstieg", "erfahren", "senior", "leitung", "unbekannt"]);

const warte = (ms) => new Promise((f) => setTimeout(f, ms));

/**
 * Eine Anzeige lesen — mit Wiederholung.
 *
 * Ohne sie liefen im ersten Lauf 38,9 % der Anfragen in die
 * Ratenbegrenzung und wurden still als „fehler" verbucht. Das war
 * nicht bloss unvollständig, sondern irreführend: Die Abdeckung wurde
 * an einer Grundmenge gemessen, von der ein Drittel fehlte.
 */
async function lesen(a, versuche = 4) {
  for (let v = 0; v < versuche; v++) {
    let r;
    try {
      r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${schluessel}` },
        body: JSON.stringify({
          model: MODELL, temperature: 0, max_tokens: 24,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: ANWEISUNG },
            { role: "user", content: `Titel: ${a.title}\n\nAnzeige:\n${(a.description ?? "").slice(0, 1400)}` },
          ],
        }),
      });
    } catch {
      await warte(800 * (v + 1));
      continue;
    }
    if (r.status === 429 || r.status >= 500) {
      /* Wartezeit steigt, mit Streuung — sonst laufen alle
         gleichzeitig gebremsten Anfragen gleichzeitig wieder los. */
      await warte(1200 * (v + 1) + Math.random() * 600);
      continue;
    }
    if (!r.ok) return { stufe: "fehler", verbrauch: {}, grund: `HTTP ${r.status}` };
    const d = await r.json();
    let stufe = "unbekannt";
    try { stufe = JSON.parse(d.choices?.[0]?.message?.content ?? "{}").stufe ?? "unbekannt"; } catch {}
    if (!STUFEN.has(stufe)) stufe = "unbekannt";
    return { stufe, verbrauch: d.usage ?? {} };
  }
  return { stufe: "fehler", verbrauch: {}, grund: "aufgegeben" };
}

const mitte = (v, b) => (Number(v) + Math.max(Number(v), Number(b ?? v))) / 2;
const quantil = (s, p) => { if (s.length === 1) return s[0]; const pos = (s.length - 1) * p, u = Math.floor(pos), o = Math.ceil(pos); return u === o ? s[u] : s[u] + (s[o] - s[u]) * (pos - u); };

const pool = new pg.Pool({ connectionString: libpqSemantik(url), max: 2 });
try {
  console.log(`Stadt: ${STADT} · Modell: ${MODELL}\n`);
  /*
   * Zwei Schritte statt einem.
   *
   * `split_part(location, ',', 1) = 'Berlin'` ist ein Ausdruck ohne
   * Index und damit ein vollständiger Durchlauf über 3,5 Mio. Zeilen —
   * die Verbindung bricht ab, bevor eine Zeile zurückkommt.
   *
   * Deshalb erst die schmale Auswahl holen, die nachweislich
   * durchläuft, dann in Node filtern und die Beschreibungen gezielt
   * für die verbleibenden Kennungen nachladen.
   */
  process.stdout.write("Lade deutsche Stellen mit echtem Gehalt … ");
  const { rows: schmal } = await pool.query(
    `select id, location, kldb, salary_min, salary_max, title
       from jobs
      where country='DE'
        and salary_provenance in ('provider','text','employer')
        and salary_period='year' and salary_currency='EUR'
        and salary_min between 15000 and 400000
        and title is not null`,
  );
  console.log(`${schmal.length}`);

  const inStadt = schmal
    .filter((r) => String(r.location ?? "").split(",")[0].trim().toLowerCase() === STADT.toLowerCase())
    .slice(0, GRENZE);
  console.log(`davon in ${STADT}: ${inStadt.length}`);

  process.stdout.write("Lade Anzeigentexte … ");
  const { rows: texte } = await pool.query(
    `select id, description from jobs where id = any($1::uuid[]) and length(description) > 400`,
    [inStadt.map((r) => r.id)],
  );
  const textNach = new Map(texte.map((t) => [t.id, t.description]));
  const rows = inStadt
    .filter((r) => textNach.has(r.id))
    .map((r) => ({ ...r, description: textNach.get(r.id) }));
  console.log(`${rows.length} Anzeigen mit Text.\n`);

  let ein = 0, aus = 0, fertig = 0;
  const ergebnis = [];
  for (let i = 0; i < rows.length; i += GLEICHZEITIG) {
    const teil = rows.slice(i, i + GLEICHZEITIG);
    const antworten = await Promise.all(teil.map((a) => lesen(a).catch((e) => ({ stufe: "fehler", verbrauch: {}, grund: String(e).slice(0, 40) }))));
    antworten.forEach((r, k) => {
      ein += r.verbrauch.prompt_tokens ?? 0;
      aus += r.verbrauch.completion_tokens ?? 0;
      ergebnis.push({
        kldb: teil[k].kldb, wert: mitte(teil[k].salary_min, teil[k].salary_max),
        titelstufe: stufeAusTitel(teil[k].title), modellstufe: r.stufe, titel: teil[k].title,
      });
    });
    fertig += teil.length;
    process.stdout.write(`\r  gelesen ${fertig}/${rows.length}`);
  }
  process.stdout.write("\n\n");

  /*
   * Die Fehlerquote steht VOR den Ergebnissen.
   *
   * Im ersten Lauf standen unten schöne Gruppen, und dass ein Drittel
   * der Grundmenge fehlte, sah man nirgends. Eine Abdeckung, die auf
   * unvollständigen Daten beruht, ist keine schwache Aussage, sondern
   * eine falsche.
   */
  const fehler = ergebnis.filter((r) => r.modellstufe === "fehler").length;
  console.log(`── Vollständigkeit ──`);
  console.log(`  gelesen        ${ergebnis.length - fehler} von ${ergebnis.length}`);
  console.log(`  fehlgeschlagen ${fehler} (${((fehler / ergebnis.length) * 100).toFixed(1)} %)`);
  if (fehler / ergebnis.length > 0.05) {
    console.log("  ⚠ Über 5 % Ausfall — die Zahlen unten sind nicht belastbar.");
  }
  console.log();

  const gruppieren = (feld) => {
    const g = new Map();
    for (const r of ergebnis) {
      if (!r.kldb || !Number.isFinite(r.wert) || r.wert <= 0) continue;
      const s = r[feld];
      if (s === "fehler") continue;
      const k = `${String(r.kldb).slice(0, 3)}|${s}`;
      (g.get(k) ?? g.set(k, []).get(k)).push(r.wert);
    }
    return g;
  };

  const zeige = (name, feld) => {
    const g = gruppieren(feld);
    const tragfaehig = [...g.entries()].filter(([, w]) => w.length >= MINDESTZAHL);
    const abgedeckt = tragfaehig.reduce((n, [, w]) => n + w.length, 0);
    const ohneStufe = ergebnis.filter((r) => r[feld] === "unbekannt").length;
    console.log(`── ${name} ──`);
    console.log(`  Stufe unbekannt        ${ohneStufe} (${((ohneStufe / ergebnis.length) * 100).toFixed(1)} %)`);
    console.log(`  Gruppen ≥ ${MINDESTZAHL}           ${tragfaehig.length} von ${g.size}`);
    console.log(`  abgedeckte Anzeigen    ${abgedeckt} (${((abgedeckt / ergebnis.length) * 100).toFixed(1)} %)\n`);
    return tragfaehig;
  };

  zeige("Wie bisher: Stufe aus dem Titel", "titelstufe");
  const mitModell = zeige("Neu: Stufe aus der gelesenen Anzeige", "modellstufe");

  console.log("── Die tragfähigen Gruppen ──");
  for (const [k, w] of mitModell.sort((a, b) => b[1].length - a[1].length).slice(0, 14)) {
    const s = [...w].sort((a, b) => a - b);
    const [gruppe, stufe] = k.split("|");
    console.log(`  kldb ${gruppe}  ${stufe.padEnd(10)} n=${String(w.length).padStart(4)}  ` +
      `p25 ${Math.round(quantil(s, 0.25)).toLocaleString("de-DE").padStart(7)}  ` +
      `median ${Math.round(quantil(s, 0.5)).toLocaleString("de-DE").padStart(7)}  ` +
      `p75 ${Math.round(quantil(s, 0.75)).toLocaleString("de-DE").padStart(7)}`);
  }

  const datei = `/tmp/marktwert-${STADT.toLowerCase()}.json`;
  writeFileSync(datei, JSON.stringify(ergebnis, null, 1));
  console.log(`\nRohdaten: ${datei}`);
  console.log(`Kosten dieses Laufs: ~${(((ein + aus) / 1_000_000) * 0.4).toFixed(3)} $`);
} finally { await pool.end(); }
