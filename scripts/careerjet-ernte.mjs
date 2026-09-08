import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Careerjet über Ort MAL Begriff — dieselbe Multiplikation wie bei Adzuna.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum es diesen Lauf braucht
 * ══════════════════════════════════════════════════════════════
 *
 * Careerjet begrenzt jede Abfrage auf rund zehn Seiten. Gemessen am
 * 8. September 2026: `location=Deutschland` ohne Begriff lieferte 491
 * Anzeigen — bei einem Bestand von 570.182. Das sind 0,09 %.
 *
 * Die Decke hängt an der ABFRAGE, nicht am Bestand. Ein Ort beginnt
 * die Zählung neu, ein Begriff ebenso. Gemessen über neun Abfragen:
 *
 *     Land allein                  491 Anzeigen
 *     + fünf Städte              2.853 eindeutig
 *     + zwei Begriffe            3.563 eindeutig
 *     + Berlin × Pflege          3.962 eindeutig
 *
 *     Überschneidung insgesamt: 9 %
 *
 * Neunzig Prozent jeder zusätzlichen Abfrage sind neu. Deshalb Orte
 * mal Begriffe statt einer tieferen Blätterung, die es nicht gibt.
 *
 * ── Warum Ort vor Begriff ────────────────────────────────────
 *
 * Wie bei `adzuna-orte.mjs`: Wird der Lauf abgebrochen, ist eine
 * Stadt vollständig besser als zwanzig angefangene. Die grösste Stadt
 * zuerst, dort stehen die meisten Anzeigen.
 *
 * ── Warum die Begriffe je Sprache stehen ─────────────────────
 *
 * `Pflege` findet in Frankreich nichts. Careerjet sucht im Volltext
 * der Anzeige, und der ist in der Landessprache. Ein englischer
 * Begriffssatz für alle Länder wäre bequem und würde ausserhalb des
 * englischsprachigen Raums fast nichts bringen.
 *
 * Aufruf: node --experimental-strip-types scripts/careerjet-ernte.mjs [land]
 */
const { CareerjetAdapter, CAREERJET_LAENDER } = await import("../packages/jobs/src/sources/careerjet.ts");
const { ingestFromAdapter } = await import("../packages/jobs/src/ingest.ts");
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

/* Die grössten Arbeitsmärkte je Land, absteigend. */
const ORTE = {
  JP: ["東京","大阪","横浜","名古屋","札幌","福岡","神戸","京都","川崎","さいたま","広島","仙台"],
  US: ["New York","Los Angeles","Chicago","Houston","Phoenix","Philadelphia","San Antonio","San Diego",
       "Dallas","Austin","Seattle","Denver","Boston","Atlanta","Miami","Washington","Detroit","Minneapolis"],
  DE: ["Berlin","München","Hamburg","Köln","Frankfurt am Main","Stuttgart","Düsseldorf","Leipzig",
       "Hannover","Nürnberg","Dortmund","Essen","Bremen","Dresden","Karlsruhe","Mannheim","Münster","Augsburg"],
  FR: ["Paris","Marseille","Lyon","Toulouse","Nice","Nantes","Strasbourg","Montpellier","Bordeaux","Lille","Rennes"],
  BR: ["São Paulo","Rio de Janeiro","Brasília","Belo Horizonte","Salvador","Curitiba","Porto Alegre","Recife"],
  GB: ["London","Birmingham","Manchester","Leeds","Glasgow","Liverpool","Bristol","Sheffield",
       "Edinburgh","Cardiff","Nottingham","Leicester","Newcastle","Southampton"],
  IT: ["Roma","Milano","Napoli","Torino","Palermo","Genova","Bologna","Firenze","Bari","Catania"],
  MX: ["Ciudad de México","Guadalajara","Monterrey","Puebla","Tijuana","León","Querétaro"],
  IN: ["Bengaluru","Mumbai","Delhi","Hyderabad","Chennai","Pune","Kolkata","Ahmedabad"],
  PL: ["Warszawa","Kraków","Łódź","Wrocław","Poznań","Gdańsk","Katowice","Szczecin"],
  CA: ["Toronto","Montreal","Vancouver","Calgary","Ottawa","Edmonton","Winnipeg"],
  AR: ["Buenos Aires","Córdoba","Rosario","Mendoza","La Plata"],
  NL: ["Amsterdam","Rotterdam","Den Haag","Utrecht","Eindhoven","Groningen","Tilburg"],
  CZ: ["Praha","Brno","Ostrava","Plzeň","Olomouc"],
  ZA: ["Johannesburg","Cape Town","Durban","Pretoria","Port Elizabeth"],
  BE: ["Bruxelles","Antwerpen","Gent","Charleroi","Liège"],
  AU: ["Sydney","Melbourne","Brisbane","Perth","Adelaide","Canberra"],
  SE: ["Stockholm","Göteborg","Malmö","Uppsala","Linköping"],
  ES: ["Madrid","Barcelona","Valencia","Sevilla","Zaragoza","Málaga","Bilbao","Murcia"],
  SG: ["Singapore"],
  PT: ["Lisboa","Porto","Braga","Coimbra"],
  TR: ["İstanbul","Ankara","İzmir","Bursa","Antalya"],
  IE: ["Dublin","Cork","Galway","Limerick"],
  FI: ["Helsinki","Espoo","Tampere","Vantaa","Turku"],
  DK: ["København","Aarhus","Odense","Aalborg"],
  HU: ["Budapest","Debrecen","Szeged","Miskolc"],
  RO: ["București","Cluj-Napoca","Timișoara","Iași","Constanța"],
  NO: ["Oslo","Bergen","Trondheim","Stavanger"],
  UA: ["Київ","Харків","Одеса","Дніпро","Львів"],
  NZ: ["Auckland","Wellington","Christchurch"],
  AT: ["Wien","Graz","Linz","Salzburg","Innsbruck"],
  CH: ["Zürich","Genève","Basel","Bern","Lausanne"],
};

/*
 * Breite Berufsfelder in der Landessprache.
 *
 * Bewusst keine Titel, sondern Felder: `Pflege` trifft Pflegefachkraft,
 * Altenpflege und Pflegehilfe zugleich. Titel würden die Achse
 * verlängern, ohne sie breiter zu machen.
 */
const BEGRIFFE = {
  de: ["Pflege","Lager","Verkauf","Büro","IT","Technik","Bau","Gastronomie","Fahrer","Produktion",
       "Vertrieb","Reinigung","Erzieher","Buchhaltung","Ingenieur","Elektriker","Logistik","Kundenservice"],
  en: ["nurse","warehouse","sales","office","software","engineer","construction","hospitality","driver",
       "production","marketing","cleaning","teacher","accounting","mechanic","electrician","logistics","support"],
  fr: ["infirmier","logistique","vente","bureau","informatique","ingénieur","bâtiment","restauration",
       "chauffeur","production","commercial","nettoyage","enseignant","comptabilité","électricien","technicien"],
  es: ["enfermería","almacén","ventas","oficina","informática","ingeniero","construcción","hostelería",
       "conductor","producción","comercial","limpieza","profesor","contabilidad","electricista","técnico"],
  it: ["infermiere","magazzino","vendite","ufficio","informatica","ingegnere","edilizia","ristorazione",
       "autista","produzione","commerciale","pulizie","insegnante","contabilità","elettricista","tecnico"],
  pt: ["enfermagem","armazém","vendas","escritório","informática","engenheiro","construção","restauração",
       "motorista","produção","comercial","limpeza","professor","contabilidade","eletricista","técnico"],
  nl: ["verpleegkundige","magazijn","verkoop","kantoor","ICT","ingenieur","bouw","horeca",
       "chauffeur","productie","commercieel","schoonmaak","leraar","boekhouding","elektricien","techniek"],
  pl: ["pielęgniarka","magazyn","sprzedaż","biuro","informatyka","inżynier","budownictwo","gastronomia",
       "kierowca","produkcja","handlowiec","sprzątanie","nauczyciel","księgowość","elektryk","technik"],
  sv: ["sjuksköterska","lager","försäljning","kontor","IT","ingenjör","bygg","restaurang","chaufför","produktion"],
  da: ["sygeplejerske","lager","salg","kontor","IT","ingeniør","byggeri","restaurant","chauffør","produktion"],
  no: ["sykepleier","lager","salg","kontor","IT","ingeniør","bygg","restaurant","sjåfør","produksjon"],
  fi: ["sairaanhoitaja","varasto","myynti","toimisto","IT","insinööri","rakennus","ravintola","kuljettaja","tuotanto"],
  cs: ["zdravotní sestra","sklad","prodej","kancelář","IT","inženýr","stavebnictví","gastronomie","řidič","výroba"],
  hu: ["ápoló","raktár","értékesítés","iroda","informatika","mérnök","építőipar","vendéglátás","sofőr","termelés"],
  ro: ["asistent medical","depozit","vânzări","birou","IT","inginer","construcții","ospătar","șofer","producție"],
  tr: ["hemşire","depo","satış","ofis","yazılım","mühendis","inşaat","restoran","şoför","üretim"],
  ja: ["看護","倉庫","営業","事務","エンジニア","建設","飲食","ドライバー","製造","販売"],
  uk: ["медсестра","склад","продажі","офіс","ІТ","інженер","будівництво","кухар","водій","виробництво"],
};

const land = (process.argv[2] ?? "DE").toUpperCase();
const eintrag = CAREERJET_LAENDER.find((l) => l.code === land);
if (!eintrag) { console.error(`Careerjet kennt ${land} nicht.`); process.exit(1); }
const orte = ORTE[land] ?? [];
if (!orte.length) { console.error(`Keine Orte für ${land}.`); process.exit(1); }
const sprache = eintrag.locale.split("_")[0];
const begriffe = BEGRIFFE[sprache] ?? BEGRIFFE.en;

const zaehl = async () =>
  Number((await db.execute(sql`select reltuples::bigint n from pg_class where relname = 'jobs'`)).rows[0].n);

const vorher = await zaehl();
console.log(
  `${land} · ${orte.length} Orte × ${begriffe.length + 1} Begriffe (${sprache}) · ` +
  `Bestand laut Careerjet ${eintrag.bestand.toLocaleString("de-DE")} · unser Bestand etwa ${vorher.toLocaleString("de-DE")}\n`,
);

const t0 = Date.now();
let neu = 0, fehler = 0, abfragen = 0;

for (const ort of orte) {
  let ortNeu = 0;
  /* `null` zuerst: der Ort ohne Begriff ist die breiteste Abfrage. */
  for (const begriff of [null, ...begriffe]) {
    abfragen++;
    try {
      const e = await ingestFromAdapter(
        new CareerjetAdapter({ country: land, ort, abfragen: begriff ? [begriff] : [] }),
        { limit: 600 },
      );
      neu += e.inserted;
      ortNeu += e.inserted;
    } catch (e) {
      fehler++;
      /*
       * Weitermachen statt abbrechen. Careerjet sperrt bei zu vielen
       * Anfragen kurzzeitig die IP — gemessen erholt sich das nach
       * etwa 45 Sekunden. Ein Abbruch verschenkte den Rest des Laufs.
       */
      const t = String(e instanceof Error ? e.message : e);
      await new Promise((r) => setTimeout(r, /403|429/.test(t) ? 45_000 : 5_000));
    }
  }
  console.log(
    `  ${ort.padEnd(22)} neu ${String(ortNeu).padStart(6)} · gesamt ${String(neu).padStart(7)} · ` +
    `${abfragen} Abfragen · ${fehler} Fehler · ${((Date.now() - t0) / 60000).toFixed(0)} min`,
  );
}

console.log(`\nFertig: ${neu} neue Stellen aus ${land}. Bestand jetzt etwa ${(await zaehl()).toLocaleString("de-DE")}.`);
process.exit(0);
