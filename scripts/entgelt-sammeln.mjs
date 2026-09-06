import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Entgelt-Referenz aus der offenen Jobsuche der Bundesagentur.
 *
 * ── Wozu ──────────────────────────────────────────────────────
 *
 * Für rund ein Drittel der Stellen konnte das Produkt keine
 * Gehaltsgrössenordnung nennen. Der Entgeltatlas verlangt eine
 * Registrierung; die Jobsuche derselben Behörde nicht. Sie liefert je
 * Anzeige die amtliche Berufsbezeichnung, und 29 % ihrer Anzeigen
 * tragen ein vom Arbeitgeber angegebenes Gehalt.
 *
 * Zwei Durchgänge:
 *
 *   1. `zuordnung` — jeden Stellentitel unseres Bestands einer
 *      amtlichen Bezeichnung zuordnen.
 *   2. `entgelt` — je Bezeichnung eine Stichprobe echter Angaben
 *      sammeln und daraus Quartile bilden.
 *
 * ── Wie hier mit einem fremden Dienst umgegangen wird ─────────
 *
 * Pause zwischen den Aufrufen, ein Versuch je Anfrage, Abbruch bei
 * 429 oder 5xx. Der Lauf ist wiederaufnehmbar: was schon in der
 * Datenbank steht, wird übersprungen. Ein abgebrochener Lauf kostet
 * deshalb nichts ausser Zeit.
 *
 * Aufruf:
 *   node --experimental-strip-types scripts/entgelt-sammeln.mjs zuordnung [anzahl]
 *   node --experimental-strip-types scripts/entgelt-sammeln.mjs entgelt   [anzahl]
 */

const { titelNormalisieren, haeufigsterBeruf, abfragestufen, MIN_ANGABEN } = await import(
  "../apps/web/src/lib/jobs/berufsreferenz.ts"
);
const { KEIN_VOLLZEITVERGLEICH } = await import("../apps/web/src/lib/jobs/beschaeftigungsform.ts");
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

const BASIS = "https://rest.arbeitsagentur.de/jobboerse/jobsuche-service";
const KOPF = { "X-API-Key": "jobboerse-jobsuche", "User-Agent": "Paycheck/1.0" };
const PAUSE = 320;
/** Höchstens so viele Detailabrufe je Beruf. Für Quartile reicht das weit. */
const PROBEN_JE_BERUF = 28;
/** Höchstens so viele Werte je Arbeitgeber — sonst prägt ein Grossversender den Median. */
const JE_ARBEITGEBER = 2;
const GRENZEN = { year: [12_000, 400_000], month: [800, 40_000], hour: [10, 200] };

const warte = (ms) => new Promise((r) => setTimeout(r, ms));

let abbruch = false;
async function hol(url) {
  if (abbruch) return null;
  const a = await fetch(url, { headers: KOPF, signal: AbortSignal.timeout(25_000) }).catch(() => null);
  await warte(PAUSE);
  if (!a) return null;
  if (a.status === 429 || a.status >= 500) {
    // Kein Nachfassen. Wer bei Überlastung schneller fragt, ist das Problem.
    console.error(`\n  Abbruch: Dienst antwortete ${a.status}. Später fortsetzen.`);
    abbruch = true;
    return null;
  }
  if (!a.ok) return null;
  return a.json().catch(() => null);
}

async function durchgangZuordnung(grenze) {
  const stellen = (await db.execute(sql`select title from jobs`)).rows;
  const titel = new Set();
  for (const s of stellen) {
    const roh = String(s.title ?? "");
    // Werkstudium und Praktikum bekommen keine Vollzeitspanne — also
    // auch keine Zuordnung und keine fremde Anfrage.
    if (KEIN_VOLLZEITVERGLEICH.test(roh)) continue;
    const n = titelNormalisieren(roh);
    if (n.length >= 3) titel.add(n);
  }
  const bekannt = new Set(
    (await db.execute(sql`select titel from beruf_zuordnung`)).rows.map((r) => r.titel),
  );
  const offen = [...titel].filter((t) => !bekannt.has(t)).slice(0, grenze);
  console.log(`${titel.size} Titel, ${bekannt.size} bereits zugeordnet, ${offen.length} in diesem Lauf.`);

  let gefunden = 0;
  for (const [i, t] of offen.entries()) {
    // Von genau nach allgemein, bis eine Stufe etwas hergibt.
    let beruf = null, treffer = 0, gesamt = 0;
    for (const stufe of abfragestufen(t)) {
      const d = await hol(`${BASIS}/pc/v6/jobs?was=${encodeURIComponent(stufe)}&size=100&page=1`);
      if (abbruch) break;
      const r = haeufigsterBeruf(d?.ergebnisliste ?? []);
      gesamt = Math.max(gesamt, r.gesamt);
      if (r.beruf) { beruf = r.beruf; treffer = r.treffer; gesamt = r.gesamt; break; }
    }
    if (abbruch) break;
    if (beruf) gefunden++;
    await db.execute(sql`
      insert into beruf_zuordnung (titel, beruf, treffer, gesamt, gefragt_am)
      values (${t}, ${beruf}, ${treffer}, ${gesamt}, now())
      on conflict (titel) do update set beruf = excluded.beruf, treffer = excluded.treffer,
        gesamt = excluded.gesamt, gefragt_am = now()`);
    if ((i + 1) % 25 === 0) {
      process.stdout.write(`\r  ${i + 1}/${offen.length} — ${gefunden} zugeordnet`);
    }
  }
  console.log(`\nFertig: ${gefunden} von ${offen.length} zugeordnet.`);
}

function aufsJahr(betrag, art) {
  if (betrag === null || !Number.isFinite(betrag)) return null;
  if (art === "JAHRESGEHALT") return betrag;
  if (art === "MONATSGEHALT") return betrag * 12;
  // 47 Arbeitswochen: Urlaub und Feiertage sind nicht gearbeitete Zeit.
  if (art === "STUNDENLOHN") return betrag * 40 * 47;
  return null;
}

function zeitraum(art) {
  return art === "JAHRESGEHALT" ? "year" : art === "MONATSGEHALT" ? "month" : art === "STUNDENLOHN" ? "hour" : null;
}

async function durchgangEntgelt(grenze) {
  const berufe = (await db.execute(sql`
    select z.beruf, count(*)::int n from beruf_zuordnung z
    where z.beruf is not null
      and not exists (select 1 from beruf_entgelt e where e.beruf = z.beruf)
    group by 1 order by 2 desc`)).rows;
  const offen = berufe.slice(0, grenze);
  console.log(`${berufe.length} Berufe ohne Referenz, ${offen.length} in diesem Lauf.`);

  let geschrieben = 0;
  for (const [i, { beruf, n }] of offen.entries()) {
    const d = await hol(`${BASIS}/pc/v6/jobs?was=${encodeURIComponent(beruf)}&size=100&page=1`);
    if (abbruch) break;
    const liste = (d?.ergebnisliste ?? []).filter(
      (s) => s.hauptberuf === beruf && s.verguetungsangabe && s.verguetungsangabe !== "KEINE_ANGABEN",
    );

    const werte = [];
    const firmen = new Map();
    for (const s of liste.slice(0, PROBEN_JE_BERUF)) {
      const firma = String(s.firma ?? "?").toLowerCase().trim();
      if ((firmen.get(firma) ?? 0) >= JE_ARBEITGEBER) continue;
      const kod = Buffer.from(String(s.referenznummer), "utf8").toString("base64");
      const det = await hol(`${BASIS}/pc/v4/jobdetails/${kod}`);
      if (abbruch) break;
      if (!det) continue;
      const art = det.verguetungsangabe;
      const z = zeitraum(art);
      if (!z) continue;
      const hatSpanne = det.gehaltsspanneVon != null || det.gehaltsspanneBis != null;
      const von = hatSpanne ? det.gehaltsspanneVon ?? null : det.festgehalt ?? null;
      const bis = hatSpanne ? det.gehaltsspanneBis ?? null : det.festgehalt ?? null;
      const mitte = von != null && bis != null ? (von + bis) / 2 : (bis ?? von);
      if (mitte == null) continue;
      // Gegen Tippfehler in der Anzeige: „15 € im Jahr" ist keine Angabe.
      const [u, o] = GRENZEN[z];
      if (mitte < u || mitte > o) continue;
      const jahr = aufsJahr(mitte, art);
      if (jahr === null || jahr < 15_000 || jahr > 250_000) continue;
      werte.push(Math.round(jahr));
      firmen.set(firma, (firmen.get(firma) ?? 0) + 1);
    }
    if (abbruch) break;

    if (werte.length >= MIN_ANGABEN) {
      werte.sort((a, b) => a - b);
      const bei = (q) => werte[Math.min(werte.length - 1, Math.floor(werte.length * q))];
      await db.execute(sql`
        insert into beruf_entgelt (beruf, q1, median, q3, anzahl, quelle, stand)
        values (${beruf}, ${bei(0.25)}, ${bei(0.5)}, ${bei(0.75)}, ${werte.length}, 'bundesagentur', now())
        on conflict (beruf) do update set q1 = excluded.q1, median = excluded.median,
          q3 = excluded.q3, anzahl = excluded.anzahl, quelle = excluded.quelle, stand = now()`);
      geschrieben++;
    }
    console.log(
      `  ${i + 1}/${offen.length} ${beruf} — ${werte.length} Angaben${werte.length >= MIN_ANGABEN ? " ✓" : " (zu wenige)"} [${n} eigene Stellen]`,
    );
  }
  console.log(`Fertig: ${geschrieben} Referenzen geschrieben.`);
}

const durchgang = process.argv[2] ?? "zuordnung";
const grenze = Number(process.argv[3] ?? 100000);
if (durchgang === "zuordnung") await durchgangZuordnung(grenze);
else if (durchgang === "entgelt") await durchgangEntgelt(grenze);
else console.error("Unbekannter Durchgang. Erlaubt: zuordnung, entgelt");
process.exit(abbruch ? 1 : 0);
