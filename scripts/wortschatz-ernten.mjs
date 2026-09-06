import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Berufsbezeichnungen aus den Anzeigen der Jobbörse ernten.
 *
 * ── Wozu ──────────────────────────────────────────────────────
 *
 * Die Suchbegriffe stammten aus dem eigenen Bestand: Wir fanden nur
 * Berufe, die wir schon hatten. Gemessen deckten die so gewonnenen 236
 * Bezeichnungen 573.662 der 999.398 Anzeigen ab — der Rest lag hinter
 * Begriffen, nach denen nie jemand gefragt hatte.
 *
 * Jede Anzeige trägt `hauptberuf` und `alleBerufe`. Das sind Begriffe
 * aus der Klassifikation der Berufe, mit denen die Jobbörse ihren
 * eigenen Bestand verschlagwortet. Wer liest, sammelt sie ein.
 *
 * ── Zwei Durchgänge ───────────────────────────────────────────
 *
 *   1. **Breit lesen** — ohne Suchwort blättern. Das trifft den
 *      Bestand quer und findet, was häufig ist.
 *   2. **Abschluss bilden** — jede neu gefundene Bezeichnung einmal
 *      suchen und wieder einsammeln, was dabei auftaucht. Das erreicht
 *      Nischen, die im breiten Lesen nie vorkommen.
 *
 * Ende, wenn eine ganze Runde nichts Neues bringt.
 *
 * Aufruf:
 *   node --experimental-strip-types scripts/wortschatz-ernten.mjs [runden]
 */
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

const B = "https://rest.arbeitsagentur.de/jobboerse/jobsuche-service";
const K = { "X-API-Key": "jobboerse-jobsuche", "User-Agent": "Paycheck/1.0" };
const PAUSE = 160;
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

let abbruch = false;
async function hol(url) {
  if (abbruch) return null;
  const a = await fetch(url, { headers: K, signal: AbortSignal.timeout(25_000) }).catch(() => null);
  await warte(PAUSE);
  if (!a) return null;
  if (a.status === 429 || a.status >= 500) {
    console.error(`\n  Abbruch: Jobbörse antwortete ${a.status}. Später fortsetzen.`);
    abbruch = true;
    return null;
  }
  return a.ok ? a.json().catch(() => null) : null;
}

/** Alles einsammeln, was eine Trefferliste an Bezeichnungen hergibt. */
function einsammeln(liste, hinein) {
  for (const s of liste ?? []) {
    if (s.hauptberuf) hinein.set(String(s.hauptberuf).trim(), (hinein.get(String(s.hauptberuf).trim()) ?? 0) + 1);
    for (const b of s.alleBerufe ?? []) {
      const t = String(b).trim();
      if (t) hinein.set(t, (hinein.get(t) ?? 0) + 1);
    }
  }
}

async function speichern(gefunden) {
  if (gefunden.size === 0) return 0;
  const eintraege = [...gefunden.entries()].filter(([b]) => b.length >= 3 && b.length <= 200);
  let neu = 0;
  for (let i = 0; i < eintraege.length; i += 200) {
    const teil = eintraege.slice(i, i + 200);
    const werte = sql.join(
      teil.map(([b, n]) => sql`(${b}, 'jobboerse', ${n})`),
      sql`, `,
    );
    const r = await db.execute(sql`
      insert into beruf_wortschatz (beruf, quelle, vorkommen) values ${werte}
      on conflict (beruf) do update set vorkommen = beruf_wortschatz.vorkommen + excluded.vorkommen
      returning (xmax = 0) as war_neu`);
    neu += r.rows.filter((x) => x.war_neu === true || x.war_neu === "t").length;
  }
  return neu;
}

const maxRunden = Number(process.argv[2] ?? 6);

// ── Durchgang 1: breit lesen ───────────────────────────────────
console.log("Breit lesen, ohne Suchwort:");
const breit = new Map();
for (let seite = 1; seite <= 100 && !abbruch; seite++) {
  const d = await hol(`${B}/pc/v6/jobs?size=100&page=${seite}`);
  const vorher = breit.size;
  einsammeln(d?.ergebnisliste, breit);
  if (seite % 20 === 0) console.log(`  Seite ${seite}: ${breit.size} Bezeichnungen (+${breit.size - vorher} zuletzt)`);
}
let neu = await speichern(breit);
console.log(`  → ${breit.size} gesammelt, davon ${neu} neu.\n`);

// ── Durchgang 2: Abschluss bilden ──────────────────────────────
for (let runde = 1; runde <= maxRunden && !abbruch; runde++) {
  const offen = (await db.execute(sql`
    select beruf from beruf_wortschatz where anzeigen is null order by vorkommen desc limit 400`)).rows;
  if (offen.length === 0) {
    console.log("Alle Bezeichnungen abgefragt — der Wortschatz ist geschlossen.");
    break;
  }

  const gefunden = new Map();
  for (const { beruf } of offen) {
    if (abbruch) break;
    const d = await hol(`${B}/pc/v6/jobs?was=${encodeURIComponent(beruf)}&size=100&page=1`);
    einsammeln(d?.ergebnisliste, gefunden);
    await db.execute(sql`
      update beruf_wortschatz set anzeigen = ${d?.maxErgebnisse ?? 0} where beruf = ${beruf}`);
  }
  neu = await speichern(gefunden);
  const gesamt = (await db.execute(sql`select count(*)::int n from beruf_wortschatz`)).rows[0].n;
  console.log(`Runde ${runde}: ${offen.length} abgefragt · ${neu} neue Bezeichnungen · Wortschatz ${gesamt}`);
  if (neu === 0) {
    console.log("Nichts Neues mehr — Schluss.");
    break;
  }
}

const e = (await db.execute(sql`
  select count(*)::int n,
         count(anzeigen)::int gefragt,
         coalesce(sum(least(anzeigen, 10000)), 0)::bigint erreichbar
  from beruf_wortschatz`)).rows[0];
console.log(`\nWortschatz: ${e.n} Bezeichnungen · ${e.gefragt} mit bekannter Trefferzahl`);

/*
 * Die Summe ist KEINE Zahl erreichbarer Anzeigen.
 *
 * Dieselbe Anzeige trägt mehrere Berufsbezeichnungen und zählt unter
 * jeder mit. Bei 2.629 Begriffen ergibt die Summe zweistellige
 * Millionen — der gesamte Bestand der Jobbörse sind 999.398.
 *
 * Sie taugt trotzdem für eine Aussage: Solange sie den Gesamtbestand
 * weit übersteigt, ist nicht der Wortschatz der Engpass.
 */
const summe = Number(e.erreichbar);
console.log(`Summe der Treffer über alle Begriffe: ${summe.toLocaleString("de-DE")}`);
console.log(`Gesamtbestand der Jobbörse: 999.398 — die Summe übersteigt ihn um das ${(summe / 999398).toFixed(0)}-fache.`);
console.log("Das ist Überschneidung, keine Reserve: Eine Anzeige zählt unter jedem ihrer Berufe mit.");
process.exit(abbruch ? 1 : 0);
