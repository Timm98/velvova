import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Ninas Eigeninitiative gegen die echte Datenbank.
 *
 * ══════════════════════════════════════════════════════════════
 * Was echt ist
 * ══════════════════════════════════════════════════════════════
 *
 *   echt        die Stellen, ihre Gehälter, Verträge, Standorte
 *   synthetisch die Person und ihre Klicks
 *
 * Die Klicks müssen erfunden sein — es gibt keinen Menschen, der
 * heute für einen Test durch die Anwendung geht. Sie sind als solche
 * gekennzeichnet: Das Konto liegt unter `@example.invalid`.
 *
 * Kein Modellaufruf. Diese ganze Schicht kommt ohne aus.
 *
 * Aufruf: node --experimental-strip-types scripts/proaktiv-echtlauf.mjs [--konto N]
 */

const { getDb, schema, withSystem, withUser } = await import("../packages/db/src/index.ts");
const { sql, eq } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const j = await import("../packages/jobs/src/index.ts");

const db = await getDb();
const nr = (() => {
  const i = process.argv.indexOf("--konto");
  return i > 0 ? (process.argv[i + 1] ?? "1") : "1";
})();
const ADRESSE = `nina-proaktiv-${nr}@example.invalid`;
const SITZUNG = `probe-${Date.now()}`;

const trenner = (t) => console.log(`\n${"═".repeat(62)}\n${t}\n${"═".repeat(62)}`);

/* ── 1. Konto ─────────────────────────────────────────────── */
trenner("1. Synthetisches Konto");
let [nutzer] = await withSystem(db, (tx) =>
  tx.select().from(schema.users).where(eq(schema.users.email, ADRESSE)).limit(1),
);
if (!nutzer) {
  [nutzer] = await withSystem(db, (tx) =>
    tx.insert(schema.users).values({ email: ADRESSE, displayName: "Proaktiv-Probe" }).returning(),
  );
}
console.log(`${ADRESSE}\n${nutzer.id}`);

/* ── 2. Echte Stellen aussuchen ───────────────────────────── */
trenner("2. Echte Stellen aus dem Bestand");
const stellen = (await db.execute(sql`
  select j.id, j.title, j.location, j.salary_min, j.salary_max, j.salary_disclosed,
         j.contract_type, j.weekly_hours, j.work_model, c.name as arbeitgeber
    from job_analysen a
    join jobs j on j.id = a.job_id
left join companies c on c.id = j.company_id
   where a.status = 'fertig' and j.title ilike '%lager%'
order by j.fetched_at desc
   limit 3
`)).rows;

if (stellen.length < 2) {
  console.error("Zu wenige echte Lagerstellen im Bestand.");
  process.exit(1);
}
for (const s of stellen)
  console.log(
    `  ${String(s.title).slice(0, 48).padEnd(50)} ${s.arbeitgeber ?? "?"} · ${s.location}\n` +
      `    Gehalt ${s.salary_disclosed ? `${s.salary_min ?? "?"}–${s.salary_max ?? "?"}` : "nicht genannt"} · ` +
      `${s.contract_type ?? "Vertrag unbekannt"} · ${s.weekly_hours ?? "Stunden unbekannt"}`,
  );

/* ── 3. Erfundene Klicks ──────────────────────────────────── */
trenner("3. Klicks (synthetisch)");
const jetzt = new Date();
const vor = (min) => new Date(jetzt.getTime() - min * 60_000);

let gemeldet = 0;
for (const [i, s] of stellen.slice(0, 2).entries()) {
  const basis = 40 - i * 15;
  for (const [art, min, kontext] of [
    ["job_viewed", basis, {}],
    ["job_reopened", basis - 5, {}],
    ["job_view_duration", basis - 4, { sekunden: 95 }],
    ["salary_opened", basis - 3, {}],
    ["requirements_opened", basis - 2, {}],
  ]) {
    const b = await j.ereignisAufnehmen(db, nutzer.id, {
      art,
      jobId: s.id,
      sitzungId: SITZUNG,
      geschehenAm: vor(min),
      kontext,
    });
    if (b.ok && b.neu) gemeldet++;
  }
}
console.log(`${gemeldet} Ereignisse aufgenommen, verteilt auf 2 Stellen.`);

/* ── 4. Der Durchgang ─────────────────────────────────────── */
trenner("4. Durchgang — ohne Modellaufruf");
const befund = await j.proaktivLauf(db, nutzer.id, { jetzt, sitzungId: SITZUNG });
console.log(JSON.stringify(befund, null, 2));

/* ── 5. Was dabei herauskam ───────────────────────────────── */
trenner("5. Von Nina automatisch");
const handlungen = await withUser(db, nutzer.id, (tx) =>
  tx.execute(sql`
    select h.handlung, h.klasse, h.zustand, h.begruendung, h.nachricht, h.ergebnis,
           h.policy_fassung, jsonb_array_length(h.beleg_ereignisse) as belege, jb.title
      from nina_handlungen h
 left join jobs jb on jb.id = h.job_id
     where h.user_id = ${nutzer.id}
  order by h.erstellt_am desc limit 10
  `),
);

for (const h of handlungen.rows) {
  console.log(`\n── ${h.handlung}  [${h.klasse} · ${h.zustand} · ${h.policy_fassung}]`);
  if (h.title) console.log(`   ${String(h.title).slice(0, 60)}`);
  console.log(`   Warum: ${h.begruendung}`);
  console.log(`   Belege: ${h.belege} Ereignisse`);
  if (h.nachricht) console.log(`   Sagt: „${h.nachricht}"`);
  const e = h.ergebnis;
  if (e?.fragen) {
    console.log("   Offene Fragen:");
    for (const f of e.fragen) console.log(`     · ${f.frage}`);
  }
  if (e?.vergleich) {
    console.log(`   Vergleich (${e.vergleich.titel.map((t) => t.slice(0, 22)).join(" | ")})`);
    console.log(`   Unterschiede: ${e.vergleich.unterschiede.join(", ")}`);
    for (const z of e.vergleich.zeilen.filter((x) => x.unterschiedlich))
      console.log(`     ${z.merkmal.padEnd(16)} ${z.werte.map((w) => w ?? "—").join("  |  ")}`);
    if (e.vergleich.offen.length > 0)
      console.log(`   Ohne Angabe bei mindestens einer: ${e.vergleich.offen.join(", ")}`);
  }
}

/* ── 6. Was Nina sagt ─────────────────────────────────────── */
trenner("6. Was Nina von sich aus sagt");
const gesagt = await j.naechsteNachricht(db, nutzer.id, jetzt);
if (gesagt) {
  console.log(`„${gesagt.text}"`);
  console.log(`  Zustimmung nötig: ${gesagt.brauchtZustimmung ? "ja" : "nein"}`);
  console.log(`  Warum: ${gesagt.begruendung}`);
} else {
  console.log("Nichts zu sagen.");
}
const zweite = await j.naechsteNachricht(db, nutzer.id, jetzt);
console.log(`Zweiter Abruf (anderer Tab): ${zweite ? "NOCH EINMAL — Fehler" : "nichts, richtig"}`);

/* ── 7. Zurücknehmen ──────────────────────────────────────── */
trenner("7. Rücknahme — die Nachricht war schon gesagt");
const [erste] = await withUser(db, nutzer.id, (tx) =>
  tx
    .select()
    .from(schema.ninaHandlungen)
    .where(eq(schema.ninaHandlungen.handlung, "job_vormerken"))
    .limit(1),
);
if (erste) {
  await j.handlungBeantworten(db, nutzer.id, erste.id, "verworfen");
  const [nachher] = await withUser(db, nutzer.id, (tx) =>
    tx.select().from(schema.ninaHandlungen).where(eq(schema.ninaHandlungen.id, erste.id)),
  );
  const nochmal = await j.proaktivLauf(db, nutzer.id, { jetzt, sitzungId: SITZUNG });
  console.log(
    `Handlung ist jetzt: ${nachher.zustand}\n` +
      `Zweiter Durchgang danach: ${nochmal.ausgefuehrt} ausgeführt (erwartet 0)`,
  );
}

/* ── 8. Prüfspur ──────────────────────────────────────────── */
trenner("8. Prüfspur — nur für innen");
const spur = await j.pruefspur(db, nutzer.id, { seit: new Date(jetzt.getTime() - 3600_000) });
console.log(j.pruefspurAlsText(spur));

/* ── 9. Verbrauch ─────────────────────────────────────────── */
trenner("9. Verbrauch dieser Reise");
const verbrauch = await db.execute(sql`
  select count(*)::int as laeufe, coalesce(sum(cost_eur_cents),0)::numeric as cent,
         coalesce(sum(input_tokens),0)::int as ein, coalesce(sum(output_tokens),0)::int as aus
  from ai_runs where user_id = ${nutzer.id}
`);
const v = verbrauch.rows[0];
console.log(
  [
    `Ereignisse aufgenommen: ${gemeldet}`,
    `Regelentscheidungen:    ${befund.gelegenheiten}`,
    `Handlungen ausgeführt:  ${befund.ausgefuehrt}`,
    `Meldungen:              ${befund.meldungen}`,
    `Modellaufrufe:          ${v.laeufe}`,
    `Merkmale ein/aus:       ${v.ein} / ${v.aus}`,
    /* Ohne hinterlegte Preistafel gibt es keine Kostenaussage. Eine
       erfundene wäre schlimmer als keine. */
    `Kosten:                 ${Number(v.laeufe) === 0 ? "0 (kein Aufruf)" : (v.cent ?? "unbekannt")}`,
  ].join("\n"),
);

trenner("Kein Modellaufruf");
console.log("Diese ganze Schicht kommt ohne Anbieter aus.");
process.exit(0);
