#!/usr/bin/env node
/**
 * ══════════════════════════════════════════════════════════════════
 * Kann ein Modell die Senioritätsstufe aus der Anzeige lesen?
 * ══════════════════════════════════════════════════════════════════
 *
 * `marktwert-probe.mjs` hat gezeigt, woran der Marktwert scheitert:
 * Bei 81,8 % der Anzeigen verrät der Titel die Stufe nicht, und ohne
 * Stufe ist jede Vergleichsgruppe eine Mischung aus Einsteigern und
 * Abteilungsleitern.
 *
 * Dieses Skript prüft den einzigen verbliebenen Weg — die Anzeige
 * lesen lassen — und zwar so, dass sich das Ergebnis überprüfen lässt,
 * ohne dass jemand von Hand Anzeigen einstuft:
 *
 *   KONTROLLE  Anzeigen, deren Titel eindeutig ist („Senior …",
 *              „Teamleiter …"). Hier ist die Antwort bekannt. Weicht
 *              das Modell hier ab, taugt es auch dort nicht, wo
 *              niemand nachsehen kann.
 *   GEWINN     Anzeigen, bei denen der Titel schweigt. Hier zeigt
 *              sich, wie viel das Lesen überhaupt erschliesst.
 *
 * ── Warum das Modell „unbekannt" antworten DARF ─────────────────
 *
 * Weil ein Modell, das raten muss, rät — und dann steht in der
 * Vergleichsgruppe wieder eine Mischung, nur diesmal ohne dass man es
 * sieht. Eine Anzeige ohne Hinweis auf die Stufe ist ein gültiges
 * Ergebnis, kein Fehlschlag.
 *
 * ── Kosten ──────────────────────────────────────────────────────
 *
 * Ruft OpenAI direkt und nicht über die Registry: Das hier ist eine
 * einmalige Messung, keine Produktfunktion. Die Obergrenze steht als
 * Argument und ist klein voreingestellt.
 *
 * Aufruf aus der Repo-Wurzel:
 *   node --env-file=.env.local packages/db/scripts/stufe-lesen.mjs [anzahl]
 */

import pg from "pg";

const ANZAHL = Math.min(Number(process.argv[2] ?? 150), 3000);
const MODELL = process.env.OPENAI_MODEL_FAST ?? "gpt-4.1-mini";
const schluessel = process.env.OPENAI_API_KEY;
const url = process.env.DATABASE_URL;

if (!schluessel || !url) {
  console.error("OPENAI_API_KEY oder DATABASE_URL fehlt.");
  process.exit(1);
}

function libpqSemantik(roh) {
  let u;
  try { u = new URL(roh); } catch { return roh; }
  const modus = u.searchParams.get("sslmode");
  if (modus === "verify-ca" || modus === "verify-full" || modus === "disable") return roh;
  if (!u.searchParams.has("uselibpqcompat")) {
    u.searchParams.set("uselibpqcompat", "true");
    if (!modus) u.searchParams.set("sslmode", "require");
  }
  return u.toString();
}

/* Wörtlich aus packages/domain/src/marktwert.ts — die Kontrolle taugt
   nur, wenn hier dieselbe Regel gilt wie dort. */
const MUSTER = [
  ["leitung", /(\blead\b|\bhead of\b|\bprincipal\b|\bdirector\b|\bvorstand|\bleiter|\bleitung|\bchefarzt|\bchefärzt|\bgeschäftsführ|\w*leiter|\w*leitung|\w*leiterin)/i],
  ["einstieg", /(\bjunior\b|\bjr\.?\b|\btrainee\b|\bvolontär|\bpraktikant|\bpraktikum\b|\bwerkstudent|\bstudentische|\bazubi\b|\bauszubildende|\bausbildung\b|\beinsteiger|\bberufseinsteiger|\bquereinsteiger|\babsolvent|\bentry.level\b|\bschulabg)/i],
  ["senior", /(\bsenior\b|\bsr\.?\b|\bexpert\b|\bexpertin\b|\bspezialist|\bspecialist\b|\barchitekt|\bstaff engineer\b|\berfahrene?r?\b)/i],
  ["erfahren", /(\bmid.level\b|\bprofessional\b|\bregular\b)/i],
];
const stufeAusTitel = (t) => {
  for (const [s, m] of MUSTER) if (m.test(t ?? "")) return s;
  return "unbekannt";
};

const ANWEISUNG = `Du liest deutsche Stellenanzeigen und bestimmst, welche Senioritätsstufe die Stelle verlangt.

Stufen:
- einstieg: Berufseinsteiger, Ausbildung, Praktikum, Werkstudent, Trainee, bis ~1 Jahr Erfahrung
- erfahren: eigenständige Fachkraft, etwa 2 bis 5 Jahre Erfahrung, keine Führung
- senior: ausgeprägte Fachtiefe, etwa ab 5 Jahren, fachliche Anleitung anderer, aber keine Personalverantwortung
- leitung: Personal- oder Budgetverantwortung, Team-, Abteilungs- oder Bereichsleitung, Geschäftsführung
- unbekannt: die Anzeige lässt es offen

Wichtig: "unbekannt" ist eine richtige Antwort. Rate nicht. Wenn die Anzeige weder Berufserfahrung, noch Verantwortungsumfang, noch Anforderungstiefe erkennen lässt, antworte "unbekannt".

Antworte NUR mit JSON: {"stufe":"...","grund":"<max 8 Wörter>"}`;

async function lesen(anzeige) {
  const antwort = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${schluessel}` },
    body: JSON.stringify({
      model: MODELL,
      temperature: 0,
      max_tokens: 60,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: ANWEISUNG },
        { role: "user", content: `Titel: ${anzeige.title}\n\nAnzeige:\n${(anzeige.description ?? "").slice(0, 1400)}` },
      ],
    }),
  });
  if (!antwort.ok) throw new Error(`${antwort.status} ${(await antwort.text()).slice(0, 120)}`);
  const d = await antwort.json();
  const roh = d.choices?.[0]?.message?.content ?? "{}";
  const verbrauch = d.usage ?? {};
  try {
    const j = JSON.parse(roh);
    return { stufe: j.stufe ?? "unbekannt", grund: j.grund ?? "", verbrauch };
  } catch {
    return { stufe: "unbekannt", grund: "unlesbare Antwort", verbrauch };
  }
}

const pool = new pg.Pool({ connectionString: libpqSemantik(url), max: 2 });

try {
  const haelfte = Math.ceil(ANZAHL / 2);
  console.log(`Modell: ${MODELL} · Stichprobe: ${ANZAHL}\n`);

  const { rows } = await pool.query(
    `select title, description, salary_min, salary_max, kldb, location
       from jobs
      where country = 'DE'
        and salary_provenance in ('provider','text','employer')
        and salary_period = 'year' and salary_currency = 'EUR'
        and salary_min between 15000 and 400000
        and description is not null and length(description) > 400
      limit $1`,
    [ANZAHL * 6],
  );

  const mitTitel = rows.filter((r) => stufeAusTitel(r.title) !== "unbekannt").slice(0, haelfte);
  const ohneTitel = rows.filter((r) => stufeAusTitel(r.title) === "unbekannt").slice(0, ANZAHL - haelfte);
  console.log(`Kontrolle (Titel eindeutig): ${mitTitel.length}`);
  console.log(`Gewinn    (Titel schweigt) : ${ohneTitel.length}\n`);

  let ein = 0, aus = 0;
  const laufen = async (liste, name) => {
    const ergebnisse = [];
    for (let i = 0; i < liste.length; i += 8) {
      const teil = liste.slice(i, i + 8);
      const antworten = await Promise.all(
        teil.map((a) => lesen(a).catch((e) => ({ stufe: "fehler", grund: String(e).slice(0, 60), verbrauch: {} }))),
      );
      antworten.forEach((r, k) => {
        ein += r.verbrauch.prompt_tokens ?? 0;
        aus += r.verbrauch.completion_tokens ?? 0;
        ergebnisse.push({ ...teil[k], modell: r.stufe, grund: r.grund, titelstufe: stufeAusTitel(teil[k].title) });
      });
      process.stdout.write(`\r  ${name}: ${ergebnisse.length}/${liste.length}`);
    }
    process.stdout.write("\n");
    return ergebnisse;
  };

  const k = await laufen(mitTitel, "Kontrolle");
  const g = await laufen(ohneTitel, "Gewinn   ");

  console.log("\n── Kontrolle: stimmt das Modell mit dem eindeutigen Titel überein? ──");
  const treffer = k.filter((r) => r.modell === r.titelstufe).length;
  const abweichung = k.filter((r) => r.modell !== r.titelstufe && r.modell !== "unbekannt");
  console.log(`  übereinstimmend      ${treffer} von ${k.length}  (${((treffer / k.length) * 100).toFixed(1)} %)`);
  console.log(`  Modell sagt unbekannt ${k.filter((r) => r.modell === "unbekannt").length}`);
  console.log(`  echte Abweichung      ${abweichung.length}`);
  for (const r of abweichung.slice(0, 5)) {
    console.log(`    „${String(r.title).slice(0, 52)}" Titel=${r.titelstufe} Modell=${r.modell} (${r.grund})`);
  }

  console.log("\n── Gewinn: was erschliesst das Lesen zusätzlich? ──");
  const verteilung = {};
  for (const r of g) verteilung[r.modell] = (verteilung[r.modell] ?? 0) + 1;
  for (const [s, n] of Object.entries(verteilung).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${s.padEnd(11)} ${String(n).padStart(4)}  ${((n / g.length) * 100).toFixed(1)} %`);
  }
  const erschlossen = g.filter((r) => r.modell !== "unbekannt" && r.modell !== "fehler").length;
  console.log(`\n  erschlossen: ${erschlossen} von ${g.length} (${((erschlossen / g.length) * 100).toFixed(1)} %)`);

  /* Was eine Vollerhebung kosten würde — die Zahl, um die es bei der
     Entscheidung tatsächlich geht. */
  const proAnzeige = (ein + aus) / (k.length + g.length);
  const kosten1M = ((proAnzeige * 1_000_000) / 1_000_000) * 0.4;
  console.log(`\n── Kosten ──`);
  console.log(`  Token je Anzeige       ${Math.round(proAnzeige)}`);
  console.log(`  dieser Lauf            ~${(((ein + aus) / 1_000_000) * 0.4).toFixed(3)} $`);
  console.log(`  hochgerechnet 85.512   ~${(((proAnzeige * 85512) / 1_000_000) * 0.4).toFixed(2)} $`);
  console.log(`  hochgerechnet 1 Mio    ~${kosten1M.toFixed(2)} $`);
} finally {
  await pool.end();
}
