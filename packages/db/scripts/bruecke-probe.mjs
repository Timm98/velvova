#!/usr/bin/env node
/**
 * ══════════════════════════════════════════════════════════════════
 * Für wie viele Stellen ist ein Mensch heute schon qualifiziert?
 * ══════════════════════════════════════════════════════════════════
 *
 * Die Frage hinter dem Satz „du bist für 1.847 Stellen qualifiziert,
 * von denen du 1.800 nie in Betracht gezogen hättest".
 *
 * Sie lässt sich heute nicht beantworten, weil die Felder, die eine
 * echte Hürde von einer Wunschliste trennen, leer sind: 528.020 von
 * 529.166 Anforderungen stehen auf dem Standardwert `false`, und
 * `onboarding_learnable` ist nirgends gesetzt. Die Anzeige verlangt
 * acht Dinge, und niemand weiss, welche zwei davon wirklich zählen.
 *
 * Dieses Skript beantwortet die Frage für eine Stichprobe, indem ein
 * Modell die Anforderungen einer Stelle gegen ein konkretes Profil
 * hält. Das Ergebnis ist eine Quote, hochrechenbar auf den Bestand.
 *
 * ── Warum drei Antworten und nicht zwei ─────────────────────────
 *
 * `ja`, `knapp`, `nein`. Die mittlere Stufe ist der ganze Punkt: Eine
 * Stelle, die eine Person mit einer Einarbeitung antreten könnte, ist
 * weder qualifiziert noch ausgeschlossen. Sie zu den Ja-Fällen zu
 * zählen, macht aus der Zahl ein Versprechen; sie wegzulassen,
 * versteckt genau die Brücken, um die es geht.
 *
 * Aufruf aus der Repo-Wurzel:
 *   node --env-file=.env.local packages/db/scripts/bruecke-probe.mjs [anzahl]
 */

import pg from "pg";

const ANZAHL = Math.min(Number(process.argv[2] ?? 300), 2000);
const GLEICHZEITIG = 12;
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

/* Ein echtes, gewöhnliches Profil — kein Sonderfall, kein Akademiker
   mit seltener Kombination. Genau die Art Mensch, die sich für
   festgelegt hält. */
const PROFIL = `Pflegefachkraft, 34 Jahre, 9 Jahre Berufserfahrung.
Examinierte Gesundheits- und Krankenpflegerin (dreijährige Ausbildung).
Stationäre Akutpflege, innere Medizin. Erfahrung mit:
- Dokumentation in Pflegesoftware, Qualitätssicherung nach MDK-Prüfung
- Anleitung von Auszubildenden und Praktikanten seit 4 Jahren
- Dienstplanung für eine Station mit 14 Personen (Vertretung der Leitung)
- Angehörigengespräche, Beschwerdebearbeitung
- Medikamentenmanagement, Hygienebeauftragte der Station
Kein Studium. Führerschein. Deutsch Muttersprache, Englisch Grundkenntnisse.`;

const ANWEISUNG = `Du prüfst, ob eine konkrete Person eine Stelle HEUTE antreten könnte — ohne Umschulung, ohne neuen Abschluss.

Antworte streng nach diesen Stufen:
- "ja": Die Person erfüllt alle zwingenden Voraussetzungen. Fehlende Details wären in der Einarbeitung normal.
- "knapp": Die Person könnte die Stelle mit einer Einarbeitung von wenigen Wochen ausfüllen. Es fehlt Konkretes, aber nichts Formales oder gesetzlich Vorgeschriebenes.
- "nein": Es fehlt eine zwingende Voraussetzung — ein gesetzlich vorgeschriebener Abschluss, eine Zulassung, eine Fachrichtung, die Jahre braucht.

Sei streng. Ein verlangtes Studium, eine Approbation oder eine andere Ausbildungsrichtung sind "nein". Ein verlangtes Programm, eine Branche oder eine Methode, die man lernt, sind "knapp" oder "ja".

Antworte NUR mit JSON: {"stufe":"ja|knapp|nein","huerde":"<max 10 Wörter, was fehlt — bei ja: leer>"}`;

/*
 * Die Härtung, gespiegelt aus packages/domain/src/bruecke.ts.
 *
 * Das Skript läuft ohne Bau; `bruecke.test.ts` hält die Fassung dort
 * fest. Was hier durchfällt, wird nicht gezählt — unabhängig davon,
 * was das Modell geantwortet hat. Ein Modell ist überredbar, ein
 * Gesetz nicht.
 */
const REGLEMENTIERT = [
  /\bapprobation/i, /\bapprobiert/i, /\barzt\b|\bärztin\b|\bmediziner/i,
  /\bzahnarzt|\bzahnärzt/i, /\bapotheker/i, /\bpsychotherapeut/i,
  /\btierarzt|\btierärzt/i, /\bheilpraktiker/i, /\bhebamme|\bentbindungspfleger/i,
  /\bnotfallsanitäter/i, /\brettungsassistent/i,
  /\bexaminiert/i, /\bstaatlich (anerkannt|geprüft)/i,
  /\bpflegedienstleitung.{0,40}(weiterbildung|qualifikation|§\s?71)/i,
  /\beinrichtungsleitung/i, /\bheimleitung/i, /\berzieher(in)?\b/i,
  /\bsozialpädagog/i, /\bsozialarbeiter/i, /\bpädagogische fachkraft/i,
  /\bmeisterbrief|\bmeisterprüfung|\bhandwerksmeister/i,
  /\belektromeister|\banlagenmechanikermeister|\bkfz-meister/i, /\bschornsteinfeger/i,
  /\brechtsanwalt|\brechtsanwält/i, /\bsteuerberater/i, /\bwirtschaftsprüfer/i,
  /\bnotar/i, /\bvolljurist|\bzweites? staatsexamen/i,
  /\bsachverständige/i, /\bprüfsachverständige/i, /\bstatiker|\btragwerksplan/i,
  /\bfachkunde nach §\s?34a/i, /\bluftfahrt(technisch|personal)|\bpilot/i,
  /\bfahrdienstleiter|\btriebfahrzeugführer|\blokführer/i,
  /\blehramt|\bstaatsexamen für das lehramt|\bstudienrat/i,
];
const istReglementiert = (t) => REGLEMENTIERT.some((m) => m.test(String(t ?? "")));

const KURZSCHEINE = [
  [/\bstapler(schein|führerschein)?|\bgabelstapler/i, "Staplerschein", 2],
  [/\bersthelfer|\berste hilfe\b/i, "Ersthelfer-Kurs", 1],
  [/\bhygieneschulung|\binfektionsschutz|\bbelehrung nach §\s?43/i, "Infektionsschutzbelehrung", 1],
  [/\bsachkundenachweis §\s?34a|\bunterrichtung nach §\s?34a/i, "Unterrichtung §34a", 5],
  [/\bführungszeugnis/i, "Führungszeugnis", 14],
  [/\bbrandschutzhelfer/i, "Brandschutzhelfer", 1],
];
const kurzschein = (t) => KURZSCHEINE.find(([m]) => m.test(String(t ?? "")));

const warte = (ms) => new Promise((f) => setTimeout(f, ms));

async function pruefen(stelle, versuche = 4) {
  const anford = (stelle.anforderungen ?? []).slice(0, 14).map((a) => `- ${a}`).join("\n");
  for (let v = 0; v < versuche; v++) {
    let r;
    try {
      r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${schluessel}` },
        body: JSON.stringify({
          model: MODELL, temperature: 0, max_tokens: 60,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: ANWEISUNG },
            { role: "user", content: `PERSON:\n${PROFIL}\n\nSTELLE: ${stelle.title}\n\nANFORDERUNGEN:\n${anford || "(keine erfasst)"}` },
          ],
        }),
      });
    } catch { await warte(800 * (v + 1)); continue; }
    if (r.status === 429 || r.status >= 500) { await warte(1200 * (v + 1) + Math.random() * 600); continue; }
    if (!r.ok) return { stufe: "fehler", huerde: `HTTP ${r.status}` };
    const d = await r.json();
    try {
      const j = JSON.parse(d.choices?.[0]?.message?.content ?? "{}");
      const s = ["ja", "knapp", "nein"].includes(j.stufe) ? j.stufe : "fehler";
      return { stufe: s, huerde: String(j.huerde ?? "").slice(0, 60), verbrauch: d.usage ?? {} };
    } catch { return { stufe: "fehler", huerde: "unlesbar" }; }
  }
  return { stufe: "fehler", huerde: "aufgegeben" };
}

const pool = new pg.Pool({ connectionString: libpqSemantik(url), max: 2 });
try {
  console.log(`Profil: Pflegefachkraft, 9 Jahre · Stichprobe: ${ANZAHL} · Modell: ${MODELL}\n`);

  process.stdout.write("Lade Stellen mit erfassten Anforderungen … ");
  const { rows } = await pool.query(
    `select j.id, j.title, j.salary_min, j.salary_max, j.salary_period,
            array_agg(r.text order by r.id) filter (where r.text is not null) as anforderungen
       from jobs j
       join job_requirements r on r.job_id = j.id
      where j.country = 'DE' and j.title is not null
        and j.salary_min is not null
        and j.salary_provenance in ('provider','text','employer')
        and j.salary_period in ('year','month')
      group by j.id, j.title, j.salary_min, j.salary_period
      limit $1`,
    [ANZAHL],
  );
  console.log(`${rows.length}\n`);

  let ein = 0, aus = 0, fertig = 0;
  const ergebnis = [];
  for (let i = 0; i < rows.length; i += GLEICHZEITIG) {
    const teil = rows.slice(i, i + GLEICHZEITIG);
    const antworten = await Promise.all(teil.map((s) => pruefen(s).catch(() => ({ stufe: "fehler", huerde: "" }))));
    antworten.forEach((a, k) => {
      ein += a.verbrauch?.prompt_tokens ?? 0;
      aus += a.verbrauch?.completion_tokens ?? 0;
      const st = teil[k];
      /*
       * Die Härtung schlägt die Modellantwort.
       *
       * Der erste Lauf lieferte eine Einrichtungsleitung für 72.500 €
       * als „mit Einarbeitung erreichbar". Sie verlangt in Deutschland
       * eine formale Weiterbildung — die Hürde stand nicht im
       * Anforderungstext, sondern im Gesetz.
       */
      const titelGesperrt = istReglementiert(st.title);
      const textGesperrt = (st.anforderungen ?? []).find((x) => istReglementiert(x));
      const gesperrt = titelGesperrt || Boolean(textGesperrt);
      const schein = (st.anforderungen ?? []).map(kurzschein).find(Boolean);
      ergebnis.push({
        ...st, ...a,
        stufe: gesperrt && a.stufe !== "fehler" ? "gesperrt" : a.stufe,
        gesperrtWeil: titelGesperrt ? `Titel: ${String(st.title).slice(0, 50)}` : textGesperrt ? String(textGesperrt).slice(0, 50) : null,
        schein: schein ? { name: schein[1], tage: schein[2] } : null,
      });
    });
    fertig += teil.length;
    process.stdout.write(`\r  geprüft ${fertig}/${rows.length}`);
  }
  process.stdout.write("\n\n");

  const zaehl = {};
  for (const r of ergebnis) zaehl[r.stufe] = (zaehl[r.stufe] ?? 0) + 1;
  const gueltig = ergebnis.filter((r) => r.stufe !== "fehler");

  console.log("── Ergebnis ──");
  for (const s of ["ja", "knapp", "nein", "gesperrt", "fehler"]) {
    const n = zaehl[s] ?? 0;
    console.log(`  ${s.padEnd(7)} ${String(n).padStart(4)}  ${((n / ergebnis.length) * 100).toFixed(1)} %`);
  }

  const offen = (zaehl.ja ?? 0) + (zaehl.knapp ?? 0);
  const quote = offen / Math.max(gueltig.length, 1);
  console.log(`\n  erreichbar (ja + knapp): ${offen} von ${gueltig.length}  = ${(quote * 100).toFixed(1)} %`);

  /*
   * Erreichbar allein ist wertlos.
   *
   * Der erste Lauf zeigte als „Treffer" unter anderem Lagerhelfer,
   * Verpacker und Warenverräumung. Für eine Pflegefachkraft mit neun
   * Jahren Erfahrung ist das kein Angebot, sondern eine Beleidigung.
   * Eine Zahl, die Abstiege mitzählt, misst nichts.
   *
   * Deshalb die zweite Bedingung: mindestens so viel Geld wie heute.
   */
  const HEUTE = 48000; // 4.000 € brutto im Monat, üblich nach neun Jahren
  const aufJahr = (r) => {
    const roh = (Number(r.salary_min) + Math.max(Number(r.salary_min), Number(r.salary_max ?? r.salary_min))) / 2;
    if (!Number.isFinite(roh) || roh <= 0) return null;
    if (r.salary_period === "year") return roh;
    if (r.salary_period === "month") return roh * 12;
    return null;
  };

  const erreichbar = ergebnis.filter((r) => r.stufe === "ja" || r.stufe === "knapp");
  const mitGeld = erreichbar.map((r) => ({ ...r, jahr: aufJahr(r) })).filter((r) => r.jahr !== null);
  const besser = mitGeld.filter((r) => r.jahr >= HEUTE);
  const deutlich = mitGeld.filter((r) => r.jahr >= HEUTE * 1.1);

  console.log(`\n── Und was davon lohnt sich? (heute ~${HEUTE.toLocaleString("de-DE")} €) ──`);
  console.log(`  erreichbar mit Gehaltsangabe    ${mitGeld.length}`);
  console.log(`  davon mindestens gleichwertig   ${besser.length}  = ${((besser.length / Math.max(gueltig.length,1)) * 100).toFixed(1)} % aller geprüften`);
  console.log(`  davon 10 % darüber              ${deutlich.length}  = ${((deutlich.length / Math.max(gueltig.length,1)) * 100).toFixed(1)} %`);

  console.log(`\n── Die bestbezahlten erreichbaren Stellen ──`);
  for (const r of [...mitGeld].sort((a, b) => b.jahr - a.jahr).slice(0, 8)) {
    console.log(`  ${String(Math.round(r.jahr)).padStart(7)} €  ${r.stufe.padEnd(6)} ${String(r.title).slice(0, 60)}`);
  }

  const { rows: [g] } = await pool.query(`select count(*)::int n from jobs where country='DE'`);
  console.log(`\n── Hochrechnung ──`);
  console.log(`  Deutsche Stellen im Bestand      ${g.n.toLocaleString("de-DE")}`);
  console.log(`  davon für dieses Profil erreichbar ~${Math.round(g.n * quote).toLocaleString("de-DE")}`);
  const lohnquote = mitGeld.length > 0 ? (besser.length / Math.max(gueltig.length, 1)) : 0;
  console.log(`  davon erreichbar UND lohnend       ~${Math.round(g.n * lohnquote).toLocaleString("de-DE")}`);

  const scheinfaelle = ergebnis.filter((r) => r.stufe === "nein" && r.schein);
  if (scheinfaelle.length > 0) {
    const je = {};
    for (const r of scheinfaelle) je[r.schein.name] = (je[r.schein.name] ?? 0) + 1;
    console.log(`\n── Die billigsten Brücken ──`);
    for (const [n, anzahl] of Object.entries(je).sort((a, b) => b[1] - a[1])) {
      const tage = scheinfaelle.find((r) => r.schein.name === n).schein.tage;
      console.log(`  ${n}: ${anzahl} Stellen · ${tage} Tage Aufwand`);
    }
  }

  console.log(`\n── Die häufigsten echten Hürden ──`);
  const h = {};
  for (const r of ergebnis.filter((x) => x.stufe === "nein")) {
    const k = r.huerde.toLowerCase().slice(0, 40);
    if (k) h[k] = (h[k] ?? 0) + 1;
  }
  for (const [k, n] of Object.entries(h).sort((a, b) => b[1] - a[1]).slice(0, 8)) {
    console.log(`  ${String(n).padStart(3)}×  ${k}`);
  }

  /*
   * Nur, was ein Mensch tatsächlich sähe.
   *
   * Die vorige Fassung listete alles, was keine Hürde hatte — darunter
   * Reinigungskraft und Abbruchmitarbeiter. Ohne Gehaltsfilter zeigt
   * die Ausgabe etwas anderes als das Produkt, und dann prüft man das
   * Falsche.
   */
  console.log(`\n── Die Liste, wie sie ein Mensch sähe ──`);
  for (const r of besser.sort((a, b) => b.jahr - a.jahr).slice(0, 10)) {
    const marke = r.stufe === "ja" ? "sofort" : "Einarbeitung";
    console.log(`  ${String(Math.round(r.jahr)).padStart(6)} €  ${marke.padEnd(12)} ${String(r.title).slice(0, 58)}`);
  }
  console.log(`\nKosten: ~${(((ein + aus) / 1_000_000) * 0.4).toFixed(3)} $`);
} finally { await pool.end(); }
