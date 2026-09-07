import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Die ganze Kette mit echten Daten, von einem Satz bis zur Mailvorschau.
 *
 * ══════════════════════════════════════════════════════════════
 * Was hier echt ist und was nicht
 * ══════════════════════════════════════════════════════════════
 *
 *   echt        der Stellenbestand, die Koordinaten, die Einbettungen,
 *               Systemprompt 1, Systemprompt 2, Systemprompt 3
 *   synthetisch die Person: ein Testkonto unter `@example.invalid`
 *
 * ══════════════════════════════════════════════════════════════
 * Warum die Person synthetisch ist — und warum diese Adresse
 * ══════════════════════════════════════════════════════════════
 *
 * Kein realer Nutzer wird ungefragt für einen Test verwendet. Ein
 * Suchauftrag schreibt in seine Zeilen, und eine Abnahme, die fremde
 * Daten anfasst, ist keine Abnahme, sondern ein Übergriff.
 *
 * `.invalid` ist nach RFC 2606 dauerhaft reserviert und wird von
 * keinem Namensdienst aufgelöst. An diese Adresse kann nichts
 * zugestellt werden — auch nicht versehentlich, auch nicht in einem
 * Jahr, wenn jemand die Sicherung dieses Skripts entfernt.
 *
 * ══════════════════════════════════════════════════════════════
 * Es versendet nicht
 * ══════════════════════════════════════════════════════════════
 *
 * Die Mail wird gebaut und ausgegeben. Der Versandweg wird nicht
 * einmal geladen.
 *
 * Aufruf: node --experimental-strip-types scripts/abnahme-echtlauf.mjs
 */

const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const { schema, withUser, withSystem } = await import("../packages/db/src/index.ts");
const { loadRuntimeConfig } = await import("../packages/config/src/index.ts");
const { selectProvider, preistafel, kostenCent } = await import("../packages/ai/src/index.ts");
const j = await import("../packages/jobs/src/index.ts");
const m = await import("../packages/matching/src/index.ts");
const { eq, and } = await import("../packages/db/node_modules/drizzle-orm/index.js");

const db = await getDb();
const cfg = loadRuntimeConfig();

const SATZ =
  "Such für mich Lager- oder Logistikjobs bis 30 km um Karlsruhe, mindestens 36.000 € brutto, keine Zeitarbeit und möglichst geregelte Arbeitszeiten.";
/*
 * Die Kennung ist überschreibbar.
 *
 * Nicht um die Budgetgrenze zu umgehen — die gilt je Nutzer und Tag
 * und hat im Lauf vom 6. September korrekt bei 50 Cent gestoppt.
 * Sondern weil jeder Abnahmelauf ein eigener Prüfling ist: Ein
 * zweiter Durchgang auf demselben Konto misst einen Auftrag, der
 * schon Treffer kennt, und nicht mehr den Weg von vorn.
 *
 * Aufruf mit `--konto 2` legt ein zweites synthetisches Konto an.
 */
const schwelle = (() => {
  const i = process.argv.indexOf("--schwelle");
  return i > 0 ? Number(process.argv[i + 1]) : null;
})();
const kontoNummer = (() => {
  const i = process.argv.indexOf("--konto");
  return i > 0 ? (process.argv[i + 1] ?? "1") : "1";
})();
const TESTADRESSE = `nina-abnahme-${kontoNummer}@example.invalid`;

const trenner = (t) => console.log(`\n${"═".repeat(64)}\n${t}\n${"═".repeat(64)}`);

/* ═══════════════════════════════════════════════════════════════
   Der Modellrufer
   ═══════════════════════════════════════════════════════════════

   Derselbe Anbieter, dieselbe Temperatur und dieselben Prompts wie im
   Betrieb. Der Adapter in `apps/web` trägt `import "server-only"` und
   ist aus einem Node-Prozess nicht auffindbar — die Prompts, die
   Prüfung der Belege und die Verschmelzung liegen aber im Paket und
   sind hier dieselben.                                             */

let modellKosten = 0;
let modellAufrufe = 0;
const rufer = async (auftrag) => {
  const provider = await selectProvider(cfg);
  const antwort = await provider.structuredGenerate({
    system: auftrag.system,
    messages: [{ role: "user", content: auftrag.eingabe }],
    schema: auftrag.schema,
    schemaName: auftrag.schemaName,
    tier: auftrag.tier,
    temperature: 0,
  });
  modellAufrufe++;
  const tafel = preistafel();
  const kosten = kostenCent(
    antwort.usage.inputTokens, antwort.usage.outputTokens, tafel.tafel, tafel.hinterlegt,
  );
  modellKosten += kosten.cent ?? 0;
  return {
    data: antwort.data,
    usage: { ...antwort.usage, kostenCent: kosten.cent },
  };
};

const einbetter = async (texte) => (await selectProvider(cfg)).embed(texte);
const einbettungsmodell = { name: cfg.ai.modelEmbed, stapel: j.EINBETTUNG_STAPEL };

/* ═══════════════════════════════════════════════════════════════
   Die Prompts — dieselben Konstanten wie im Betrieb
   ═══════════════════════════════════════════════════════════════ */
const P = await import("../packages/ai/src/prompts/suchauftrag.ts");
const PROMPT1 = {
  anweisung: P.SUCHPROFIL_ANWEISUNG,
  schema: P.SuchprofilAntwortSchema,
  fassung: P.SUCHPROFIL_PROMPT_FASSUNG,
};
const PROMPT2 = {
  anweisung: P.MATCHING_ANWEISUNG,
  schema: P.MatchbelegeAntwortSchema,
  fassung: P.MATCHING_PROMPT_FASSUNG,
};
const PROMPT3 = {
  anweisung: P.MAILTEXT_ANWEISUNG,
  schema: P.MailtextAntwortSchema,
  fassung: P.MAILTEXT_PROMPT_FASSUNG,
};

/* ═══════════════════════════════════════════════════════════════
   1. Das Testkonto
   ═══════════════════════════════════════════════════════════════ */
trenner("1. Testkonto");

let [nutzer] = await withSystem(db, (tx) =>
  tx.select().from(schema.users).where(eq(schema.users.email, TESTADRESSE)).limit(1),
);
if (!nutzer) {
  [nutzer] = await withSystem(db, (tx) =>
    tx
      .insert(schema.users)
      .values({ email: TESTADRESSE, displayName: "Monday-Abnahme (synthetisch)" })
      .returning(),
  );
  console.log(`neu angelegt: ${nutzer.id}`);
} else {
  console.log(`vorhanden:    ${nutzer.id}`);
}
console.log(`Adresse:      ${TESTADRESSE}  (RFC 2606, nicht zustellbar)`);

/* ═══════════════════════════════════════════════════════════════
   1b. Das Berufsprofil der synthetischen Person
   ═══════════════════════════════════════════════════════════════

   ══════════════════════════════════════════════════════════════
   Warum das sein muss, und was der erste Lauf ohne es zeigte
   ══════════════════════════════════════════════════════════════

   Der erste Abnahmelauf ergab null Empfehlungen. Der naheliegende
   Verdacht war der Bestand — zu wenige Anzeigen nennen ein Gehalt.

   Er war falsch. Der Fit misst Person gegen Stelle: bestätigte
   Fähigkeiten, Tätigkeiten, die Energie geben, Arbeitsweise, Werte,
   genannte Zielrollen. Das Testkonto hatte davon nichts. Jeder Faktor
   war `null`, die Abdeckung damit 0, und unter 0,55 zeigt `fit.ts`
   bewusst keine Zahl.

   Das ist kein Fehler, sondern die Regel, die verhindert, dass eine
   Zahl aus dem Nichts entsteht. Nur misst ein Abnahmelauf mit leerem
   Profil eben nicht die Kette, sondern das leere Profil.

   ── Was hier synthetisch ist ──────────────────────────────────

   Diese Belege. Sie sind erfunden und als solche gekennzeichnet:
   `source_type = user_stated`, `source_ref` trägt „abnahme".
   Erfunden ist die Person — nicht eine einzige Stelle, kein
   Unternehmen, kein Gehalt.                                        */
trenner("1b. Berufsprofil (synthetisch)");

const [profil] = await withUser(db, nutzer.id, async (tx) => {
  const vorhanden = await tx
    .select()
    .from(schema.careerProfiles)
    .where(eq(schema.careerProfiles.userId, nutzer.id))
    .limit(1);
  if (vorhanden.length > 0) return vorhanden;
  return tx
    .insert(schema.careerProfiles)
    .values({
      userId: nutzer.id,
      careerCompass:
        "Sucht körperliche, gut planbare Arbeit im Lager oder in der Logistik; " +
        "mag geregelte Zeiten und ein festes Team.",
      confirmedByUser: true,
      confirmedAt: new Date(),
      coverage: 0.8,
    })
    .returning();
});

const BELEGE = [
  ["skill", "Kommissionierung nach Pickliste, zuletzt zwei Jahre täglich", "abnahme:tasks_and_energy"],
  ["skill", "Warenannahme und Wareneingangskontrolle", "abnahme:tasks_and_energy"],
  ["qualification", "Staplerschein, gültig", "abnahme:qualifications"],
  ["skill", "Ladungssicherung nach VDI 2700", "abnahme:tasks_and_energy"],
  ["preference", "Körperliche Arbeit gibt mir Energie", "abnahme:tasks_and_energy"],
  ["preference", "Ständige Unterbrechungen kosten mich Kraft", "abnahme:tasks_and_energy"],
  ["work_environment", "Festes Team, klare Zuständigkeiten", "abnahme:work_style_and_environment"],
  ["work_environment", "Frühschicht ist mir am liebsten", "abnahme:work_style_and_environment"],
  ["motive", "Verlässlichkeit ist mir wichtiger als schnelle Karriere", "abnahme:values_and_motives"],
  ["motive", "Ein Betrieb, der Zusagen einhält", "abnahme:values_and_motives"],
  ["role", "Fachkraft für Lagerlogistik", "abnahme:learning_goals"],
  ["role", "Lagerist", "abnahme:learning_goals"],
];

const vorhandeneBelege = await withUser(db, nutzer.id, (tx) =>
  tx.select().from(schema.evidenceItems).where(eq(schema.evidenceItems.userId, nutzer.id)),
);
if (vorhandeneBelege.length === 0) {
  await withUser(db, nutzer.id, (tx) =>
    tx.insert(schema.evidenceItems).values(
      BELEGE.map(([art, satz, ref]) => ({
        userId: nutzer.id,
        profileId: profil.id,
        type: art,
        statement: satz,
        sourceType: "user_stated",
        sourceRef: ref,
        confidence: 0.9,
        userConfirmed: true,
      })),
    ),
  );
  console.log(`${BELEGE.length} synthetische Belege angelegt.`);
} else {
  console.log(`${vorhandeneBelege.length} Belege bereits vorhanden.`);
}
console.log("Profil bestätigt, Abdeckung 0,8 — erfunden, damit der Fit etwas zu messen hat.");

/* ═══════════════════════════════════════════════════════════════
   2. Systemprompt 1 — aus dem Satz ein Suchauftrag
   ═══════════════════════════════════════════════════════════════ */
trenner("2. Systemprompt 1 — echter Modellaufruf");
console.log(`Satz: „${SATZ}"\n`);

const p1 = await j.suchprofilAusText(db, {
  userId: nutzer.id,
  text: SATZ,
  quelle: "chat",
  rufer,
  prompt: PROMPT1,
});

if (!p1.ok) {
  console.error(`Systemprompt 1 gescheitert: ${p1.grund}`);
  process.exit(1);
}

console.log(`Auftrag:      ${p1.auftragId}`);
console.log(`Bestätigung:  ${p1.bestaetigungstext ?? "—"}`);
if (p1.rueckfrage) console.log(`Rückfrage:    ${p1.rueckfrage}`);
if (p1.verworfen?.length) console.log(`Verworfen:    ${JSON.stringify(p1.verworfen)}`);

const kriterien = await withUser(db, nutzer.id, (tx) =>
  tx
    .select()
    .from(schema.suchKriterien)
    .where(eq(schema.suchKriterien.profilId, p1.profilId)),
);
console.log(`\nKriterien (${kriterien.length}) — Stärke aus der deterministischen Schicht:`);
for (const k of kriterien) {
  const marker = m.staerkeFuerKriterium(
    SATZ,
    Array.isArray(k.wert) ? k.wert.map(String) : [String(k.wert)],
  );
  console.log(
    `  ${String(k.staerke).padEnd(10)} ${String(k.kriterium).padEnd(22)} ` +
      `${JSON.stringify(k.wert).slice(0, 34).padEnd(36)} ` +
      `${marker.marker ? `← „${marker.marker}"` : "(kein Marker im Satz)"}`,
  );
}

/* ═══════════════════════════════════════════════════════════════
   3. Bestätigen und aktivieren
   ═══════════════════════════════════════════════════════════════ */
trenner("3. Bestätigung — die Handlung der Person");

await withUser(db, nutzer.id, (tx) =>
  tx
    .update(schema.suchKriterien)
    .set({ bestaetigungsstatus: "bestaetigt" })
    .where(eq(schema.suchKriterien.profilId, p1.profilId)),
);

const aktiv = await j.auftragAktivieren(db, nutzer.id, p1.auftragId);
console.log(`Aktivierung: ${JSON.stringify(aktiv)}`);

/* ═══════════════════════════════════════════════════════════════
   4. Der Lauf — Systemprompt 2 mit echten Kandidaten
   ═══════════════════════════════════════════════════════════════ */
trenner("4. Suchlauf — Vorauswahl, Semantik, Systemprompt 2");
if (schwelle !== null) {
  console.log(`⚠ Empfehlungsschwelle für diesen Lauf auf ${schwelle} gesetzt (Betrieb: 70).`);
  console.log("  Diagnose, keine Produkteinstellung.\n");
}

const [auftragszeile] = await withUser(db, nutzer.id, (tx) =>
  tx.select().from(schema.suchAuftraege).where(eq(schema.suchAuftraege.id, p1.auftragId)).limit(1),
);

const lauf = await j.auftragslaufRunde(
  db,
  {
    id: auftragszeile.id,
    userId: nutzer.id,
    name: auftragszeile.name,
    aktiveProfilVersion: auftragszeile.aktiveProfilVersion,
  },
  {
    einbetter,
    einbettungsmodell,
    rufer,
    prompt2: PROMPT2,
    grenze: 60,
    /*
     * Die Empfehlungsschwelle ist überschreibbar — als Diagnose,
     * nicht als Produkteinstellung.
     *
     * Im Betrieb gilt `EMPFEHLUNG_V1.schwelle = 70`. Der beste echte
     * Treffer des Abnahmelaufs erreicht 12: Er ist zulässig — jede
     * Muss-Prüfung erfüllt —, aber der Fit bleibt niedrig, weil
     * `skills` und `profile_skills` leer sind und der
     * Fähigkeitsabgleich deshalb nichts findet.
     *
     * Mit `--schwelle 10` läuft die Kette bis zur fertigen Mail
     * durch. Was dabei herauskommt, ist eine Vorschau des
     * Zustellwegs, keine Aussage darüber, dass die Stelle passt.
     */
    schwelle: schwelle ?? undefined,
  },
);

console.log(
  [
    `geprüft:        ${lauf.geprueft}`,
    `davon semantisch gefunden: ${lauf.semantisch}`,
    `vom Modell belegt:         ${lauf.belegt}`,
    `neu:            ${lauf.neu}`,
    `empfohlen:      ${lauf.empfohlen}`,
    `zurückgestellt: ${lauf.zurueckgestellt}`,
    `ausgeschlossen: ${lauf.ausgeschlossen}`,
    `Grund:          ${lauf.grund ?? "—"}`,
  ].join("\n"),
);

/* ═══════════════════════════════════════════════════════════════
   5. Die Treffer im Einzelnen
   ═══════════════════════════════════════════════════════════════ */
trenner("5. Treffer — je Stelle die geprüften Kriterien");

const treffer = await withUser(db, nutzer.id, (tx) =>
  tx.execute(sql`
    select t.job_id, t.zulaessigkeit, t.fit_score, t.fit_abdeckung, t.empfehlungsstatus,
           t.gruende, t.caveat, t.kriterien_ergebnisse, t.offene_punkte, t.zustand,
           j.title, j.location, j.geo_status, j.geo_stadt, j.latitude, j.longitude,
           j.salary_min, j.salary_max, j.contract_type, j.work_model, c.name as arbeitgeber
      from auftrag_treffer t
      join jobs j on j.id = t.job_id
 left join companies c on c.id = j.company_id
     where t.auftrag_id = ${p1.auftragId}
  order by (t.empfehlungsstatus = 'empfohlen') desc, t.fit_score desc nulls last
     limit 25
  `),
);

console.log(`Treffer in der Datenbank: ${treffer.rows.length}\n`);
let pruefungen = 0;
for (const t of treffer.rows) {
  const km =
    t.latitude && t.longitude
      ? m.luftlinieKm(49.0078, 8.4199, Number(t.latitude), Number(t.longitude)).toFixed(1)
      : "—";
  console.log(
    `── ${String(t.title).slice(0, 62)}\n` +
      `   ${t.arbeitgeber ?? "?"} · ${t.location} · ${t.geo_status} · ${km} km von Karlsruhe\n` +
      `   ${t.contract_type} · ${t.work_model} · Gehalt ${t.salary_min ?? "—"}–${t.salary_max ?? "—"}\n` +
      `   Zulässigkeit: ${t.zulaessigkeit} · Fit ${t.fit_score ?? "—"} ` +
      `(Abdeckung ${t.fit_abdeckung ?? "—"}) · ${t.empfehlungsstatus}`,
  );
  const erg = Array.isArray(t.kriterien_ergebnisse) ? t.kriterien_ergebnisse : [];
  for (const e of erg) {
    pruefungen++;
    console.log(
      `      ${String(e.status ?? "?").padEnd(18)} ${String(e.kriterium ?? "?").padEnd(24)}` +
        `${e.begruendung ? ` — ${String(e.begruendung).slice(0, 62)}` : ""}`,
    );
  }
  if (t.caveat) console.log(`      Vorbehalt: ${t.caveat}`);
}
console.log(`\nEinzelne Kriterienprüfungen insgesamt: ${pruefungen}`);

/* ═══════════════════════════════════════════════════════════════
   6. Die Mail — gebaut, nicht versendet
   ═══════════════════════════════════════════════════════════════ */
trenner("6. Mailvorschau — Systemprompt 3, nichts wird versendet");

const zus = await j.zusammenfassungBauen(db, nutzer.id, {
  basisUrl: "https://velvova.de",
  mailVorbereiten: true,
  rufer,
  prompt: PROMPT3,
  anrede: null,
});
console.log(`Befund: ${JSON.stringify(zus, null, 2).slice(0, 900)}`);

const [mail] = zus.ausgangId
  ? await withUser(db, nutzer.id, (tx) =>
      tx.select().from(schema.mailAusgang).where(eq(schema.mailAusgang.id, zus.ausgangId)).limit(1),
    )
  : [];

if (mail) {
  console.log(`\nBetreff:   ${mail.betreff}`);
  console.log(`Empfänger: ${mail.an}`);
  console.log(`Zustand:   ${mail.zustand}`);
  console.log(`Abmelde-URL vorhanden: ${mail.abmeldeUrl ? "ja" : "nein"}`);
  console.log(`\n── Textfassung ${"─".repeat(46)}\n`);
  console.log(String(mail.text ?? "").slice(0, 2600));
} else {
  /*
   * ══════════════════════════════════════════════════════════════
   * Keine Mail im Ausgang — und warum das richtig ist
   * ══════════════════════════════════════════════════════════════
   *
   * Der Kanal steht auf `nur_app`, weil die Adresse nicht bestätigt
   * ist. Eine Datenbankbedingung erzwingt das:
   *
   *   CHECK (NOT email_aktiv OR adresse_bestaetigt_am IS NOT NULL)
   *
   * Sie liesse sich für dieses Testkonto von Hand setzen. Das wäre
   * eine Bestätigung, die niemand gegeben hat — genau das, was die
   * Bedingung verhindern soll.
   *
   * Für die Vorschau reicht die Vorlage. Sie bekommt hier die echten
   * ausgewählten Posten und rendert, was in der Mail stünde.
   */
  console.log("Kanal `nur_app` — kein Ausgangseintrag. Die Adresse ist nicht bestätigt,");
  console.log("und die Datenbankbedingung lässt E-Mail ohne Bestätigung nicht zu.\n");

  const posten = await withUser(db, nutzer.id, (tx) =>
    tx.execute(sql`
      select p.grund, p.caveat, p.art, j.title, j.location, c.name as arbeitgeber,
             t.fit_score, j.original_url
        from zusammenfassung_posten p
        join auftrag_treffer t on t.id = p.treffer_id
        join jobs j on j.id = p.job_id
   left join companies c on c.id = j.company_id
       where p.zusammenfassung_id = ${zus.zusammenfassungId}
    order by p.position
    `),
  );

  const fassung = j.zusammenfassungRendern({
    anrede: null,
    betreff: `${posten.rows.length} neue Stelle für dich`,
    einleitung: "Monday hat deinen bestätigten Suchauftrag weitergeführt.",
    abschluss: "Wenn etwas nicht passt, sag es Monday — sie ändert den Auftrag.",
    basisLabel: j.basisLabel(["chat"], new Date()),
    posten: posten.rows.map((r) => ({
      jobId: "vorschau",
      titel: String(r.title),
      arbeitgeber: String(r.arbeitgeber ?? "—"),
      ort: String(r.location),
      gehalt: null,
      fitScore: r.fit_score === null ? null : Number(r.fit_score),
      grund: String(r.grund ?? ""),
      caveat: r.caveat === null ? null : String(r.caveat),
      art: String(r.art),
      url: String(r.original_url ?? "https://velvova.de"),
    })),
    einstellungenUrl: "https://velvova.de/app/suchauftraege",
    abmeldeUrl: "https://velvova.de/abmelden?token=VORSCHAU",
    absenderName: "Monday von Velvova",
  });

  console.log(`Betreff: ${fassung.betreff}`);
  console.log(`\n── Textfassung ${"─".repeat(46)}\n`);
  console.log(fassung.text);
  console.log(`\n── HTML: ${fassung.html.length} Zeichen, nicht ausgegeben.`);
}

trenner("Modellverbrauch dieses Laufs");
console.log(`Aufrufe: ${modellAufrufe} · geschätzte Kosten: ${modellKosten.toFixed(2)} Cent`);
console.log("\nVersendet wurde nichts. Der Versandweg wurde nicht geladen.");
process.exit(0);
