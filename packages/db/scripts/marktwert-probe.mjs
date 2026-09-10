#!/usr/bin/env node
/**
 * ══════════════════════════════════════════════════════════════════
 * Trägt die Methode? — der schmale Versuch
 * ══════════════════════════════════════════════════════════════════
 *
 * Bevor irgendeine Oberfläche einen Marktwert anzeigt, muss eine Frage
 * beantwortet sein: Reicht das, was wir haben, für eine Zahl, die ein
 * Mensch als richtig erkennt?
 *
 * Dieses Skript beantwortet sie, ohne dass eine Zeile Produktcode
 * entsteht. Es lädt die deutschen Stellen mit ECHTER Gehaltsangabe,
 * bildet Vergleichsgruppen aus Berufskennung, Region und Stufe und
 * zeigt, wie viele davon die Mindeststichprobe erreichen.
 *
 * Das Ergebnis ist eine Entscheidungsgrundlage, keine Anzeige:
 *
 *   Viele Gruppen über der Grenze  → die Methode trägt, weiterbauen.
 *   Fast keine                     → die Vergleichbarkeit fehlt, und
 *                                    alles Weitere wäre verschwendet.
 *
 * Aufruf aus der Repo-Wurzel:
 *   node --env-file=.env.local packages/db/scripts/marktwert-probe.mjs
 */

import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL fehlt. Aufruf: node --env-file=.env.local packages/db/scripts/marktwert-probe.mjs");
  process.exit(1);
}

/* Dieselbe TLS-Behandlung wie packages/db/src/client.ts. */
function libpqSemantik(roh) {
  let u;
  try {
    u = new URL(roh);
  } catch {
    return roh;
  }
  const modus = u.searchParams.get("sslmode");
  if (modus === "verify-ca" || modus === "verify-full" || modus === "disable") return roh;
  if (!u.searchParams.has("uselibpqcompat")) {
    u.searchParams.set("uselibpqcompat", "true");
    if (!modus) u.searchParams.set("sslmode", "require");
  }
  return u.toString();
}

/* ── Die Regeln, gespiegelt aus @paycheck/domain ────────────────
   Das Skript läuft ohne Bau; `marktwert.test.ts` hält die Fassungen
   dort fest. Weicht hier etwas ab, ist der Versuch wertlos — deshalb
   stehen die Muster wörtlich so wie dort. */
const MUSTER = [
  ["leitung", /(\blead\b|\bhead of\b|\bprincipal\b|\bdirector\b|\bvorstand|\bleiter|\bleitung|\bchefarzt|\bchefärzt|\bgeschäftsführ|\w*leiter|\w*leitung|\w*leiterin)/i],
  ["einstieg", /(\bjunior\b|\bjr\.?\b|\btrainee\b|\bvolontär|\bpraktikant|\bpraktikum\b|\bwerkstudent|\bstudentische|\bazubi\b|\bauszubildende|\bausbildung\b|\beinsteiger|\bberufseinsteiger|\bquereinsteiger|\babsolvent|\bentry.level\b|\bschulabg)/i],
  ["senior", /(\bsenior\b|\bsr\.?\b|\bexpert\b|\bexpertin\b|\bspezialist|\bspecialist\b|\barchitekt|\bstaff engineer\b|\berfahrene?r?\b)/i],
  ["erfahren", /(\bmid.level\b|\bprofessional\b|\bregular\b)/i],
];
const stufe = (t) => {
  for (const [s, m] of MUSTER) if (m.test(t ?? "")) return s;
  return "unbekannt";
};

/**
 * Der Ort, auf eine vergleichbare Form gebracht.
 *
 * `location` ist Freitext: „München", „München, Bayern", „80331
 * München", „Raum München". Ohne Normalisierung ist jede Schreibweise
 * eine eigene Gruppe, und keine erreicht die Mindeststichprobe.
 *
 * Genommen wird der erste Teil vor dem Komma, ohne Postleitzahl und
 * ohne Vorsatzwörter. Das ist grob und reicht für die Frage, die hier
 * beantwortet wird: ob überhaupt genug zusammenkommt.
 */
function ort(roh) {
  if (!roh) return null;
  const erste = roh.split(",")[0].trim();
  const sauber = erste
    .replace(/^\d{4,5}\s+/, "")
    .replace(/^(raum|region|grossraum|großraum|nähe|near)\s+/i, "")
    .replace(/\s+\(.*\)$/, "")
    .trim();
  return sauber.length >= 3 ? sauber.toLowerCase() : null;
}

const mitte = (von, bis) => (Number(von) + Math.max(Number(von), Number(bis ?? von))) / 2;
const quantil = (s, p) => {
  if (s.length === 1) return s[0];
  const pos = (s.length - 1) * p;
  const u = Math.floor(pos), o = Math.ceil(pos);
  return u === o ? s[u] : s[u] + (s[o] - s[u]) * (pos - u);
};

const MINDESTZAHL = 30;
const pool = new pg.Pool({ connectionString: libpqSemantik(url), max: 2 });

try {
  console.log("Lade deutsche Stellen mit echter Gehaltsangabe …");
  const { rows } = await pool.query(`
    select title, location, kldb, salary_min, salary_max
      from jobs
     where country = 'DE'
       and salary_provenance in ('provider','text','employer')
       and salary_period = 'year'
       and salary_currency = 'EUR'
       and salary_min between 15000 and 400000
       and title is not null`);
  console.log(`  ${rows.length} Zeilen.\n`);

  /* Wie viel geht schon vor der Gruppierung verloren? Das ist die
     eigentliche Auskunft dieses Laufs. */
  const ohneKldb = rows.filter((r) => !r.kldb).length;
  const ohneOrt = rows.filter((r) => !ort(r.location)).length;
  const stufen = {};
  for (const r of rows) stufen[stufe(r.title)] = (stufen[stufe(r.title)] ?? 0) + 1;

  console.log("Was fehlt je Zeile:");
  console.log(`  ohne Berufskennung  ${ohneKldb} (${((ohneKldb / rows.length) * 100).toFixed(1)} %)`);
  console.log(`  ohne brauchbaren Ort ${ohneOrt} (${((ohneOrt / rows.length) * 100).toFixed(1)} %)`);
  console.log("\nStufe aus dem Titel:");
  for (const [s, n] of Object.entries(stufen).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${s.padEnd(11)} ${String(n).padStart(6)}  ${((n / rows.length) * 100).toFixed(1)} %`);
  }

  /* ── Vergleichsgruppen ───────────────────────────────────────
     Beruf (3-stellige Kennung) × Ort × Stufe. Gröber wäre
     unvergleichbar, feiner erreicht die Mindestzahl nicht. */
  const gruppen = new Map();
  for (const r of rows) {
    const o = ort(r.location);
    if (!r.kldb || !o) continue;
    const s = stufe(r.title);
    const schluessel = `${String(r.kldb).slice(0, 3)}|${o}|${s}`;
    const wert = mitte(r.salary_min, r.salary_max);
    if (!Number.isFinite(wert) || wert <= 0) continue;
    (gruppen.get(schluessel) ?? gruppen.set(schluessel, []).get(schluessel)).push(wert);
  }

  const tragfaehig = [...gruppen.entries()].filter(([, w]) => w.length >= MINDESTZAHL);
  const abgedeckt = tragfaehig.reduce((n, [, w]) => n + w.length, 0);

  console.log("\n── Vergleichsgruppen (Beruf × Ort × Stufe) ──────────────");
  console.log(`  Gruppen gesamt                 ${gruppen.size}`);
  console.log(`  davon mit ≥ ${MINDESTZAHL} Anzeigen        ${tragfaehig.length}`);
  console.log(`  Anzeigen in tragfähigen Gruppen ${abgedeckt} von ${rows.length}` +
    `  (${((abgedeckt / rows.length) * 100).toFixed(1)} %)`);

  console.log("\n── Die zehn grössten Gruppen ────────────────────────────");
  for (const [k, w] of tragfaehig.sort((a, b) => b[1].length - a[1].length).slice(0, 10)) {
    const s = [...w].sort((a, b) => a - b);
    const [gruppe, o, st] = k.split("|");
    console.log(
      `  ${gruppe} ${o.slice(0, 18).padEnd(18)} ${st.padEnd(10)} ` +
        `n=${String(w.length).padStart(4)}  ` +
        `p25 ${Math.round(quantil(s, 0.25)).toLocaleString("de-DE").padStart(7)}  ` +
        `median ${Math.round(quantil(s, 0.5)).toLocaleString("de-DE").padStart(7)}  ` +
        `p75 ${Math.round(quantil(s, 0.75)).toLocaleString("de-DE").padStart(7)}`,
    );
  }
} finally {
  await pool.end();
}
