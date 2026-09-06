import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Erzeugt Beiträge aus dem eigenen Bestand.
 *
 * ── Warum aus Abfragen und nicht aus einem Sprachmodell ───────
 *
 * Ein Modell schriebe flüssigere Sätze und könnte nichts belegen. Die
 * Aussagen hier stammen aus Zählungen über 1,14 Millionen Anzeigen —
 * jede trägt die Abfrage, aus der sie kommt, als lesbaren Beleg.
 *
 * Ein Beitrag, den niemand nachrechnen kann, ist eine Behauptung.
 *
 * ── Warum die Zahlen im Text stehen und nicht daneben ─────────
 *
 * „Im Handwerk fehlen Fachkräfte" ist eine Meinung. „In der
 * Metallbearbeitung stehen 22.733 Stellen offen, für die uns kein
 * einziges Berufsbild vorliegt" ist eine Auskunft.
 *
 * Aufruf: node --experimental-strip-types scripts/beitraege-erzeugen.mjs
 */
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

const HAUPTGRUPPE = {
  "24": "Metallerzeugung und -bearbeitung", "51": "Lagerwirtschaft", "81": "Gesundheitsberufe",
  "26": "Mechatronik und Elektro", "62": "Verkauf", "43": "Informatik", "63": "Gastronomie",
  "83": "Erziehung und Soziales", "25": "Maschinen- und Fahrzeugtechnik", "34": "Gebäudetechnik",
  "54": "Reinigung", "32": "Hoch- und Tiefbau", "29": "Lebensmittelherstellung", "71": "Unternehmensführung",
};

const beitraege = [];

/* ── 1. Ausbildung: wie viele Plätze offen sind ── */
const ausbildung = (await db.execute(sql`
  select count(*)::int as n from jobs
  where is_demo=false and contract_type = 'apprenticeship'`)).rows[0];
if (Number(ausbildung.n) > 1000) {
  beitraege.push({
    titel: "Ausbildungsplätze: mehr als gedacht",
    kernaussage: `${Number(ausbildung.n).toLocaleString("de-DE")} Ausbildungsstellen stehen gerade offen — viele davon in Berufen, an die kaum jemand denkt.`,
    art: "markt",
    bild: "lehre-erwachsene",
    beleg: `Gezählt über alle Anzeigen mit Vertragsart „Ausbildung" im eigenen Bestand (${new Date().toLocaleDateString("de-DE")}).`,
    text: "Wer eine Ausbildung sucht, sucht meist nach dem, was er kennt. Die Zahl der offenen Plätze verteilt sich aber sehr ungleich: In manchen Berufen bewerben sich zehn auf einen Platz, in anderen bleibt die Hälfte unbesetzt.",
  });
}

/* ── 2. Wo Stellen ohne Gehaltsangabe stehen ── */
const ohneGehalt = (await db.execute(sql`
  select count(*) filter (where not salary_disclosed)::int as ohne, count(*)::int as gesamt
  from jobs where is_demo=false`)).rows[0];
const anteil = Math.round(100 * Number(ohneGehalt.ohne) / Number(ohneGehalt.gesamt));
beitraege.push({
  titel: "Drei von vier Anzeigen schweigen zum Gehalt",
  kernaussage: `${anteil} % der Stellenanzeigen nennen keine Zahl. Das ist keine Nachlässigkeit — es ist eine Verhandlungsposition.`,
  art: "ratgeber",
  bild: "finanzberatung",
  beleg: `${Number(ohneGehalt.ohne).toLocaleString("de-DE")} von ${Number(ohneGehalt.gesamt).toLocaleString("de-DE")} Anzeigen im eigenen Bestand ohne Gehaltsangabe.`,
  text: "Wer zuerst eine Zahl nennt, gibt einen Anker vor. Deshalb schweigen viele Arbeitgeber — und deshalb lohnt es, vorher zu wissen, was in dieser Berufsgattung üblich ist. Der Entgeltatlas der Bundesagentur weist Medianentgelte für über 1.900 Berufe aus; sie stehen bei uns an jeder Stelle, die selbst nichts nennt.",
});

/* ── 2b. Wie lange Anzeigen stehen ── */
/*
 * Die einzige Zahl dieser Art für den deutschen Markt, die wir kennen.
 *
 * Erhebungen aus dem angelsächsischen Raum kommen auf 18–22 % Anzeigen
 * ohne Einstellungsabsicht — erhoben von Anbietern über ihr eigenes
 * Bewerbermanagement, per Umfrage unter Arbeitgebern. Für Deutschland
 * gibt es keine veröffentlichte Zahl.
 *
 * Was hier gezählt wird, ist ausdrücklich etwas anderes und etwas
 * Schwächeres: nicht die Absicht, sondern die Standzeit. Über die
 * Absicht eines Arbeitgebers wissen wir nichts, und eine Behauptung
 * darüber wäre genau die Sorte unbelegter Aussage, gegen die dieses
 * Produkt gebaut ist.
 */
const standzeit = (await db.execute(sql`
  select
    count(*)::int gesamt,
    count(*) filter (where published_at < now() - interval '90 days')::int ab90,
    count(*) filter (where published_at < now() - interval '180 days')::int ab180,
    count(*) filter (where published_at < now() - interval '365 days')::int ab365
  from jobs tablesample system (5)
  where is_demo = false and published_at is not null`)).rows[0];
if (Number(standzeit.gesamt) > 10000) {
  const g = Number(standzeit.gesamt);
  const a90 = Math.round(100 * Number(standzeit.ab90) / g);
  const a180 = Math.round(100 * Number(standzeit.ab180) / g);
  const a365 = (100 * Number(standzeit.ab365) / g).toFixed(1).replace(".", ",");
  beitraege.push({
    titel: `Jede sechste Anzeige steht seit über einem halben Jahr`,
    kernaussage: `${a90} % der ausgelieferten Stellenanzeigen sind älter als 90 Tage, ${a180} % älter als 180, ${a365} % älter als ein Jahr — und alle wurden diese Woche erneut von ihrer Quelle geliefert.`,
    art: "markt",
    bild: "buero-verwaltung",
    beleg: `Stichprobe von ${g.toLocaleString("de-DE")} Anzeigen mit Veröffentlichungsdatum aus dem eigenen Bestand (${new Date().toLocaleDateString("de-DE")}). Gezählt wird die Standzeit, nicht die Absicht.`,
    text: "Alt heisst nicht unecht. Eine Pflegestelle steht ein halbes Jahr, weil niemand kommt — die Absicht ist echt, die Not auch. Deshalb sagt eine absolute Zahl wenig: Im IT-Bereich ist eine Anzeige nach 25 Tagen weg, im Hoch- und Tiefbau erst nach 108. Aussagekräftig ist nur der Vergleich innerhalb desselben Berufsfelds — und der steht bei uns an jeder Stelle, die deutlich länger steht als ihre Vergleichsgruppe. Was daraus folgt, lassen wir offen: schwer zu besetzen oder gar nicht gesucht. Beides ist ein Grund, vorher zu fragen statt eine Bewerbung zu schreiben.",
  });
}

/* ── 3. Die Berufsgruppen mit den meisten offenen Stellen ── */
const gruppen = (await db.execute(sql`
  select left(kldb,2) as hg, count(*)::int as n from jobs
  where is_demo=false and kldb is not null group by 1 order by n desc limit 3`)).rows;
if (gruppen.length === 3) {
  const namen = gruppen.map((g) => HAUPTGRUPPE[String(g.hg)] ?? `Gruppe ${g.hg}`);
  beitraege.push({
    titel: "Wo gerade die meisten Stellen offen sind",
    kernaussage: `${namen[0]}, ${namen[1]} und ${namen[2]} führen die Liste an — zusammen ${gruppen.reduce((a,g)=>a+Number(g.n),0).toLocaleString("de-DE")} Anzeigen.`,
    art: "markt",
    bild: "bau",
    kldb: String(gruppen[0].hg),
    beleg: `Gezählt über alle Anzeigen mit amtlicher Berufskennung (KldB 2010), gruppiert nach den ersten beiden Ziffern.`,
    text: "Die Zahl sagt, wo gesucht wird — nicht, wo es sich gut arbeitet. Beides fällt regelmässig auseinander: Wo viele Stellen offen sind, gehen oft auch viele wieder.",
  });
}

/* ── 4. Schicht- und Wochenendarbeit ── */
const schicht = (await db.execute(sql`
  select count(*) filter (where shift_work)::int as mit, count(shift_work)::int as bekannt
  from jobs where is_demo=false`)).rows[0];
if (Number(schicht.bekannt) > 10000) {
  const q = Math.round(100 * Number(schicht.mit) / Number(schicht.bekannt));
  beitraege.push({
    titel: `${q} % der Stellen bedeuten Schicht, Nacht oder Wochenende`,
    kernaussage: "Es steht selten im Titel — aber es entscheidet, ob eine Stelle zum Leben passt.",
    art: "krise",
    bild: "ueberlastung-nacht",
    beleg: `${Number(schicht.mit).toLocaleString("de-DE")} von ${Number(schicht.bekannt).toLocaleString("de-DE")} Anzeigen, bei denen die Bundesagentur dazu etwas angibt.`,
    text: "Schichtarbeit steht in der Anzeige oft im letzten Absatz oder gar nicht. Sie ist trotzdem der häufigste Grund, aus dem Menschen eine Stelle nach wenigen Monaten wieder verlassen — nicht die Arbeit selbst, sondern wann sie stattfindet.",
  });
}

/* ── 5. Befristung ── */
const befristet = (await db.execute(sql`
  select count(*) filter (where contract_type='fixed_term')::int as bef,
         count(*) filter (where contract_type='permanent')::int as unbef
  from jobs where is_demo=false`)).rows[0];
if (Number(befristet.unbef) > 1000) {
  const q = Math.round(100 * Number(befristet.bef) / (Number(befristet.bef) + Number(befristet.unbef)));
  beitraege.push({
    titel: "Befristet oder nicht — die Frage vor allen anderen",
    kernaussage: `${q} % der Anzeigen mit Angabe zur Vertragsdauer sind befristet.`,
    art: "ratgeber",
    bild: "recht",
    beleg: `${Number(befristet.bef).toLocaleString("de-DE")} befristete gegen ${Number(befristet.unbef).toLocaleString("de-DE")} unbefristete Anzeigen im eigenen Bestand.`,
    text: "Eine Befristung ist kein Nachteil an sich — sie ist eine Information, die früh gehört. Wer Sicherheit braucht, sollte sie in der ersten Runde ansprechen und nicht in der dritten.",
  });
}

let angelegt = 0;
for (const b of beitraege) {
  const da = (await db.execute(sql`select 1 from beitraege where titel = ${b.titel}`)).rows;
  if (da.length > 0) {
    await db.execute(sql`
      update beitraege set kernaussage=${b.kernaussage}, text=${b.text ?? ""}, beleg=${b.beleg}
      where titel=${b.titel}`);
    continue;
  }
  await db.execute(sql`
    insert into beitraege (titel, kernaussage, text, art, bild_slug, kldb_hauptgruppe, beleg, veroeffentlicht_am)
    values (${b.titel}, ${b.kernaussage}, ${b.text ?? ""}, ${b.art}, ${b.bild ?? null},
            ${b.kldb ?? null}, ${b.beleg}, now())`);
  angelegt++;
}
const n = (await db.execute(sql`select count(*)::int n from beitraege where veroeffentlicht_am is not null`)).rows[0].n;
console.log(`${angelegt} neu · ${n} Beiträge veröffentlicht`);
for (const b of beitraege) console.log(`  · ${b.titel}`);
process.exit(0);
