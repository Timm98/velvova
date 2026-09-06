/**
 * Die Fotobibliothek: Berufsbilder und Krisenmotive.
 *
 * ── Woher die Zuordnung stammt ────────────────────────────────
 *
 * Die 132 Vorlagen kamen mit Dateinamen wie „ChatGPT Image Sep 3,
 * 2026, 02_17_16 PM (3).png" — aus denen ist nichts abzuleiten. Jedes
 * Bild wurde angesehen und von Hand benannt. Eine Datei war mit 34
 * Byte leer, sieben weitere waren Dubletten desselben Motivs
 * (Wahrnehmungs-Hash, nicht Dateigleichheit): von 132 bleiben 124.
 *
 * ── Wo diese Bilder NICHT hingehören ──────────────────────────
 *
 * Nicht an eine einzelne Stellenanzeige. `JobBild.tsx` begründet das:
 * „Ein Foto neben einer Anzeige liest sich als ‚so sieht es dort aus‘
 * — und das wissen wir nicht." Ein Foto einer hellen Werkstatt neben
 * einer Anzeige für eine Schreinerei behauptet etwas über diesen
 * Betrieb.
 *
 * Für eine BerufsGRUPPE gilt der Einwand nicht: „So sieht Arbeit als
 * Tischler ungefähr aus" ist eine Aussage über den Beruf, nicht über
 * einen Arbeitgeber. Dafür sind sie gedacht.
 *
 * ── Krisenmotive ──────────────────────────────────────────────
 *
 * Siebzehn Bilder zeigen Überlastung — teils allgemein am
 * Schreibtisch, teils berufsspezifisch (Pflege, Bau, Lager, Kasse,
 * Gastronomie, Friseur). Sie tragen `gruppe`, wo sie zu einem Beruf
 * gehören, damit ein Beitrag über Belastung in der Pflege nicht
 * versehentlich ein Büromotiv bekommt.
 *
 * Erzeugt von `scripts/fotos-aufbereiten.py`. Von Hand geändert wird
 * hier die Zuordnung, nicht die Dateiliste.
 */

/** Die fünfzehn Gruppen aus `berufsbild.ts`. */
export type Berufsgruppe =
  | "administration" | "customer_success" | "data_bi" | "design" | "education"
  | "finance" | "healthcare" | "hr" | "logistics" | "marketing"
  | "operations" | "research" | "sales" | "skilled_trades" | "software_data";

export interface Foto {
  /** `beruf` zeigt Arbeit, `krise` zeigt Belastung, `marke` ist ein Logo. */
  art: "beruf" | "krise" | "marke";
  slug: string;
  /** Was zu sehen ist — als Alternativtext verwendbar. */
  alt: string;
  /** Die Berufsgruppe, wenn das Motiv einer zuzuordnen ist. */
  gruppe: Berufsgruppe | null;
  /**
   * Die Berufshauptgruppen der KldB 2010, zu denen das Motiv passt.
   *
   * ── Warum zusätzlich zur `gruppe` ─────────────────────────
   *
   * Unsere fünfzehn Felder sind grob. „Gesundheit und Pflege" umfasst
   * die Pflegekraft, die Zahnärztin, den Rettungssanitäter, die
   * Tierärztin und die Physiotherapeutin — eine Pflegestelle bekam
   * deshalb schon ein Rettungswagenbild.
   *
   * Die amtliche Klassifikation trennt feiner: 36 Berufshauptgruppen
   * statt fünfzehn Felder, und jede Stelle trägt ihre Kennung seit
   * Migration 0041 in `jobs.kldb`. Die ersten beiden Ziffern genügen.
   *
   * Mehrere Einträge, wo ein Motiv ehrlich in mehrere passt: Ein Koch
   * gehört zur Lebensmittelherstellung (29) und zum Gastgewerbe (63).
   * Die Zuordnung ist eine Aussage über das Bild, keine Rangfolge.
   */
  kldb: readonly string[];
  /** 1200 px breit. */
  pfad: string;
  /** 480 px breit, für Listen und Karten. */
  klein: string;
}

export const FOTOS: readonly Foto[] = [
  { art: "beruf", slug: "windkraft-solar", gruppe: "operations", kldb: ["26"],
    alt: "Technikerin für erneuerbare Energien vor Windrädern und Solarfeld",
    pfad: "/fotos/beruf/windkraft-solar.webp", klein: "/fotos/beruf/windkraft-solar-klein.webp" },
  { art: "beruf", slug: "bibliothek", gruppe: "education", kldb: ["84", "91"],
    alt: "Bibliothekarin berät eine Besucherin am Regal",
    pfad: "/fotos/beruf/bibliothek.webp", klein: "/fotos/beruf/bibliothek-klein.webp" },
  { art: "marke", slug: "velvova-logo", gruppe: null, kldb: [],
    alt: "Velvova-Wortmarke, powered by Nina",
    pfad: "/fotos/marke/velvova-logo.webp", klein: "/fotos/marke/velvova-logo-klein.webp" },
  { art: "beruf", slug: "tiermedizin", gruppe: "healthcare", kldb: ["81"],
    alt: "Tierärztin untersucht einen Hund in der Praxis",
    pfad: "/fotos/beruf/tiermedizin.webp", klein: "/fotos/beruf/tiermedizin-klein.webp" },
  { art: "beruf", slug: "tischler", gruppe: "skilled_trades", kldb: ["22"],
    alt: "Tischler zeichnet an einem Werkstück in der Werkstatt",
    pfad: "/fotos/beruf/tischler.webp", klein: "/fotos/beruf/tischler-klein.webp" },
  { art: "beruf", slug: "hotel-empfang", gruppe: "customer_success", kldb: ["63"],
    alt: "Empfangsmitarbeiter begrüsst Gäste an der Hotelrezeption",
    pfad: "/fotos/beruf/hotel-empfang.webp", klein: "/fotos/beruf/hotel-empfang-klein.webp" },
  { art: "beruf", slug: "familienberatung", gruppe: "healthcare", kldb: ["83"],
    alt: "Beraterin im Gespräch mit einer Familie",
    pfad: "/fotos/beruf/familienberatung.webp", klein: "/fotos/beruf/familienberatung-klein.webp" },
  { art: "beruf", slug: "feuerwehr", gruppe: "operations", kldb: ["53"],
    alt: "Feuerwehrmann vor dem Löschfahrzeug",
    pfad: "/fotos/beruf/feuerwehr.webp", klein: "/fotos/beruf/feuerwehr-klein.webp" },
  { art: "beruf", slug: "kamera-video", gruppe: "design", kldb: ["92", "94"],
    alt: "Kameramann filmt ein Interview",
    pfad: "/fotos/beruf/kamera-video.webp", klein: "/fotos/beruf/kamera-video-klein.webp" },
  { art: "beruf", slug: "recht", gruppe: "administration", kldb: ["73"],
    alt: "Anwalt bei der Aktenarbeit am Schreibtisch",
    pfad: "/fotos/beruf/recht.webp", klein: "/fotos/beruf/recht-klein.webp" },
  { art: "beruf", slug: "beratung-business", gruppe: "sales", kldb: ["61", "71"],
    alt: "Berater erläutert etwas am Whiteboard",
    pfad: "/fotos/beruf/beratung-business.webp", klein: "/fotos/beruf/beratung-business-klein.webp" },
  { art: "beruf", slug: "labor-chemie", gruppe: "research", kldb: ["41"],
    alt: "Laborantin pipettiert im Chemielabor",
    pfad: "/fotos/beruf/labor-chemie.webp", klein: "/fotos/beruf/labor-chemie-klein.webp" },
  { art: "beruf", slug: "fitness", gruppe: "healthcare", kldb: ["82"],
    alt: "Fitnesstrainer betreut eine Kundin beim Training",
    pfad: "/fotos/beruf/fitness.webp", klein: "/fotos/beruf/fitness-klein.webp" },
  { art: "krise", slug: "ueberlastung-buero", gruppe: null, kldb: [],
    alt: "Erschöpfte Büroangestellte spät am Laptop",
    pfad: "/fotos/krise/ueberlastung-buero.webp", klein: "/fotos/krise/ueberlastung-buero-klein.webp" },
  { art: "krise", slug: "ueberlastung-aktenberg", gruppe: null, kldb: [],
    alt: "Angestellte zwischen Aktenstapeln, erschöpft",
    pfad: "/fotos/krise/ueberlastung-aktenberg.webp", klein: "/fotos/krise/ueberlastung-aktenberg-klein.webp" },
  { art: "krise", slug: "ueberlastung-nacht", gruppe: null, kldb: [],
    alt: "Frau am Monitor, Gesicht in den Händen, nachts",
    pfad: "/fotos/krise/ueberlastung-nacht.webp", klein: "/fotos/krise/ueberlastung-nacht-klein.webp" },
  { art: "krise", slug: "ueberlastung-fristen", gruppe: null, kldb: [],
    alt: "Frau hinter dem Laptop zwischen Fristenzetteln",
    pfad: "/fotos/krise/ueberlastung-fristen.webp", klein: "/fotos/krise/ueberlastung-fristen-klein.webp" },
  { art: "krise", slug: "ueberlastung-abend", gruppe: null, kldb: [],
    alt: "Frau am Laptop im abgedunkelten Büro",
    pfad: "/fotos/krise/ueberlastung-abend.webp", klein: "/fotos/krise/ueberlastung-abend-klein.webp" },
  { art: "krise", slug: "ueberlastung-allein", gruppe: null, kldb: [],
    alt: "Frau allein im Büro spät am Abend",
    pfad: "/fotos/krise/ueberlastung-allein.webp", klein: "/fotos/krise/ueberlastung-allein-klein.webp" },
  { art: "krise", slug: "ueberlastung-papierknaeuel", gruppe: null, kldb: [],
    alt: "Angestellte am Laptop, zerknülltes Papier auf dem Tisch",
    pfad: "/fotos/krise/ueberlastung-papierknaeuel.webp", klein: "/fotos/krise/ueberlastung-papierknaeuel-klein.webp" },
  { art: "krise", slug: "ueberlastung-kopf-in-haenden", gruppe: null, kldb: [],
    alt: "Angestellte hält sich beide Hände an den Kopf",
    pfad: "/fotos/krise/ueberlastung-kopf-in-haenden.webp", klein: "/fotos/krise/ueberlastung-kopf-in-haenden-klein.webp" },
  { art: "krise", slug: "ueberlastung-mann", gruppe: null, kldb: [],
    alt: "Erschöpfter Angestellter am Laptop",
    pfad: "/fotos/krise/ueberlastung-mann.webp", klein: "/fotos/krise/ueberlastung-mann-klein.webp" },
  { art: "krise", slug: "ueberlastung-morgen", gruppe: null, kldb: [],
    alt: "Erschöpfte Angestellte am Schreibtisch",
    pfad: "/fotos/krise/ueberlastung-morgen.webp", klein: "/fotos/krise/ueberlastung-morgen-klein.webp" },
  { art: "beruf", slug: "cybersicherheit", gruppe: "software_data", kldb: ["43"],
    alt: "Analyst vor einer Monitorwand mit Lagebild",
    pfad: "/fotos/beruf/cybersicherheit.webp", klein: "/fotos/beruf/cybersicherheit-klein.webp" },
  { art: "beruf", slug: "robotik", gruppe: "operations", kldb: ["26", "27"],
    alt: "Ingenieur justiert einen Roboterarm",
    pfad: "/fotos/beruf/robotik.webp", klein: "/fotos/beruf/robotik-klein.webp" },
  { art: "beruf", slug: "filmproduktion", gruppe: "design", kldb: ["92", "94"],
    alt: "Filmteam bei Dreharbeiten am Set",
    pfad: "/fotos/beruf/filmproduktion.webp", klein: "/fotos/beruf/filmproduktion-klein.webp" },
  { art: "beruf", slug: "windkraft", gruppe: "operations", kldb: ["26"],
    alt: "Ingenieurin an einer Windkraftanlage",
    pfad: "/fotos/beruf/windkraft.webp", klein: "/fotos/beruf/windkraft-klein.webp" },
  { art: "beruf", slug: "meeresbiologie", gruppe: "research", kldb: ["41", "42"],
    alt: "Meeresbiologin untersucht Algenproben",
    pfad: "/fotos/beruf/meeresbiologie.webp", klein: "/fotos/beruf/meeresbiologie-klein.webp" },
  { art: "beruf", slug: "fahrzeugentwicklung", gruppe: "operations", kldb: ["25", "27"],
    alt: "Entwickler am Antriebsstrang eines Elektroautos",
    pfad: "/fotos/beruf/fahrzeugentwicklung.webp", klein: "/fotos/beruf/fahrzeugentwicklung-klein.webp" },
  { art: "beruf", slug: "veranstaltungstechnik", gruppe: "operations", kldb: ["94"],
    alt: "Eventtechnikerin mit Tablet vor der Bühne",
    pfad: "/fotos/beruf/veranstaltungstechnik.webp", klein: "/fotos/beruf/veranstaltungstechnik-klein.webp" },
  { art: "beruf", slug: "drohnenvermessung", gruppe: "operations", kldb: ["31", "42"],
    alt: "Vermesser steuert eine Drohne im Gebirge",
    pfad: "/fotos/beruf/drohnenvermessung.webp", klein: "/fotos/beruf/drohnenvermessung-klein.webp" },
  { art: "beruf", slug: "musikproduktion", gruppe: "design", kldb: ["94"],
    alt: "Musikproduzent am Mischpult",
    pfad: "/fotos/beruf/musikproduktion.webp", klein: "/fotos/beruf/musikproduktion-klein.webp" },
  { art: "beruf", slug: "innenarchitektur", gruppe: "design", kldb: ["31", "93"],
    alt: "Innenarchitektin wählt Materialmuster aus",
    pfad: "/fotos/beruf/innenarchitektur.webp", klein: "/fotos/beruf/innenarchitektur-klein.webp" },
  { art: "beruf", slug: "meteorologie", gruppe: "research", kldb: ["42"],
    alt: "Meteorologe vor Wetterkarten",
    pfad: "/fotos/beruf/meteorologie.webp", klein: "/fotos/beruf/meteorologie-klein.webp" },
  { art: "beruf", slug: "vermessung-bergbau", gruppe: "operations", kldb: ["21", "31"],
    alt: "Vermesser mit Theodolit im Tagebau",
    pfad: "/fotos/beruf/vermessung-bergbau.webp", klein: "/fotos/beruf/vermessung-bergbau-klein.webp" },
  { art: "beruf", slug: "triebfahrzeugfuehrer", gruppe: "logistics", kldb: ["52"],
    alt: "Triebfahrzeugführer im Führerstand",
    pfad: "/fotos/beruf/triebfahrzeugfuehrer.webp", klein: "/fotos/beruf/triebfahrzeugfuehrer-klein.webp" },
  { art: "beruf", slug: "forstwirtschaft", gruppe: "operations", kldb: ["11"],
    alt: "Förster mit Tablet im Wald",
    pfad: "/fotos/beruf/forstwirtschaft.webp", klein: "/fotos/beruf/forstwirtschaft-klein.webp" },
  { art: "beruf", slug: "goldschmied", gruppe: "skilled_trades", kldb: ["93"],
    alt: "Goldschmiedin bei der Feinarbeit",
    pfad: "/fotos/beruf/goldschmied.webp", klein: "/fotos/beruf/goldschmied-klein.webp" },
  { art: "beruf", slug: "florist", gruppe: "skilled_trades", kldb: ["12"],
    alt: "Floristin bindet einen Strauss im Laden",
    pfad: "/fotos/beruf/florist.webp", klein: "/fotos/beruf/florist-klein.webp" },
  { art: "beruf", slug: "raumfahrt-leitstand", gruppe: "research", kldb: ["43", "42"],
    alt: "Operatorin im Satellitenleitstand",
    pfad: "/fotos/beruf/raumfahrt-leitstand.webp", klein: "/fotos/beruf/raumfahrt-leitstand-klein.webp" },
  { art: "beruf", slug: "augenoptik", gruppe: "customer_success", kldb: ["82", "62"],
    alt: "Augenoptikerin passt einer Kundin die Brille an",
    pfad: "/fotos/beruf/augenoptik.webp", klein: "/fotos/beruf/augenoptik-klein.webp" },
  { art: "beruf", slug: "getraenkeproduktion", gruppe: "operations", kldb: ["29"],
    alt: "Qualitätsprüferin an der Abfüllanlage",
    pfad: "/fotos/beruf/getraenkeproduktion.webp", klein: "/fotos/beruf/getraenkeproduktion-klein.webp" },
  { art: "beruf", slug: "theatertechnik", gruppe: "design", kldb: ["94"],
    alt: "Inspizientin mit Headset an der Bühne",
    pfad: "/fotos/beruf/theatertechnik.webp", klein: "/fotos/beruf/theatertechnik-klein.webp" },
  { art: "beruf", slug: "zahnmedizin", gruppe: "healthcare", kldb: ["81"],
    alt: "Zahnärztin mit Lupenbrille bei der Behandlung",
    pfad: "/fotos/beruf/zahnmedizin.webp", klein: "/fotos/beruf/zahnmedizin-klein.webp" },
  { art: "beruf", slug: "architektur", gruppe: "design", kldb: ["31"],
    alt: "Architekt am Entwurf mit Gebäudemodell",
    pfad: "/fotos/beruf/architektur.webp", klein: "/fotos/beruf/architektur-klein.webp" },
  { art: "beruf", slug: "restaurierung", gruppe: "skilled_trades", kldb: ["22", "93"],
    alt: "Restauratorin bei der Feinarbeit in der Werkstatt",
    pfad: "/fotos/beruf/restaurierung.webp", klein: "/fotos/beruf/restaurierung-klein.webp" },
  { art: "beruf", slug: "erziehung", gruppe: "education", kldb: ["83"],
    alt: "Erzieherin spielt mit Kindern am Tisch",
    pfad: "/fotos/beruf/erziehung.webp", klein: "/fotos/beruf/erziehung-klein.webp" },
  { art: "beruf", slug: "rettungsdienst", gruppe: "healthcare", kldb: ["81"],
    alt: "Rettungssanitäter im Gespräch am Rettungswagen",
    pfad: "/fotos/beruf/rettungsdienst.webp", klein: "/fotos/beruf/rettungsdienst-klein.webp" },
  { art: "beruf", slug: "geologie", gruppe: "research", kldb: ["42"],
    alt: "Geologin nimmt Gesteinsproben am Hang",
    pfad: "/fotos/beruf/geologie.webp", klein: "/fotos/beruf/geologie-klein.webp" },
  { art: "beruf", slug: "dolmetschen", gruppe: "administration", kldb: ["73", "91"],
    alt: "Dolmetscherin mit Headset in der Kabine",
    pfad: "/fotos/beruf/dolmetschen.webp", klein: "/fotos/beruf/dolmetschen-klein.webp" },
  { art: "beruf", slug: "halbleiterfertigung", gruppe: "operations", kldb: ["26", "21"],
    alt: "Reinraumtechniker mit einem Wafer",
    pfad: "/fotos/beruf/halbleiterfertigung.webp", klein: "/fotos/beruf/halbleiterfertigung-klein.webp" },
  { art: "beruf", slug: "seefahrt", gruppe: "logistics", kldb: ["52"],
    alt: "Schiffsoffizier auf der Brücke",
    pfad: "/fotos/beruf/seefahrt.webp", klein: "/fotos/beruf/seefahrt-klein.webp" },
  { art: "beruf", slug: "lebensmitteltechnik", gruppe: "operations", kldb: ["29"],
    alt: "Lebensmitteltechnikerin prüft die Produktion",
    pfad: "/fotos/beruf/lebensmitteltechnik.webp", klein: "/fotos/beruf/lebensmitteltechnik-klein.webp" },
  { art: "beruf", slug: "archaeologie", gruppe: "research", kldb: ["42", "91"],
    alt: "Archäologin bei der Ausgrabung",
    pfad: "/fotos/beruf/archaeologie.webp", klein: "/fotos/beruf/archaeologie-klein.webp" },
  { art: "beruf", slug: "netzwerktechnik", gruppe: "software_data", kldb: ["43"],
    alt: "Techniker am Serverschrank",
    pfad: "/fotos/beruf/netzwerktechnik.webp", klein: "/fotos/beruf/netzwerktechnik-klein.webp" },
  { art: "beruf", slug: "softwareentwicklung", gruppe: "software_data", kldb: ["43"],
    alt: "Entwickler am Code vor mehreren Monitoren",
    pfad: "/fotos/beruf/softwareentwicklung.webp", klein: "/fotos/beruf/softwareentwicklung-klein.webp" },
  { art: "beruf", slug: "medizintechnik", gruppe: "healthcare", kldb: ["27", "82"],
    alt: "Techniker wartet ein medizinisches Gerät",
    pfad: "/fotos/beruf/medizintechnik.webp", klein: "/fotos/beruf/medizintechnik-klein.webp" },
  { art: "beruf", slug: "apotheke", gruppe: "healthcare", kldb: ["81", "62"],
    alt: "Apothekerin berät eine Kundin",
    pfad: "/fotos/beruf/apotheke.webp", klein: "/fotos/beruf/apotheke-klein.webp" },
  { art: "beruf", slug: "gartenbau", gruppe: "operations", kldb: ["11", "12"],
    alt: "Gärtner prüft die Kulturen im Gewächshaus",
    pfad: "/fotos/beruf/gartenbau.webp", klein: "/fotos/beruf/gartenbau-klein.webp" },
  { art: "beruf", slug: "physiotherapie", gruppe: "healthcare", kldb: ["81", "82"],
    alt: "Physiotherapeut behandelt einen Patienten",
    pfad: "/fotos/beruf/physiotherapie.webp", klein: "/fotos/beruf/physiotherapie-klein.webp" },
  { art: "beruf", slug: "meeresbiologie-feld", gruppe: "research", kldb: ["41", "42"],
    alt: "Biologin nimmt Proben an der Küste",
    pfad: "/fotos/beruf/meeresbiologie-feld.webp", klein: "/fotos/beruf/meeresbiologie-feld-klein.webp" },
  { art: "beruf", slug: "stadtplanung", gruppe: "design", kldb: ["31"],
    alt: "Stadtplaner am Modell",
    pfad: "/fotos/beruf/stadtplanung.webp", klein: "/fotos/beruf/stadtplanung-klein.webp" },
  { art: "beruf", slug: "fahrzeugbau", gruppe: "operations", kldb: ["25", "27"],
    alt: "Ingenieur an einer Fahrzeugplattform",
    pfad: "/fotos/beruf/fahrzeugbau.webp", klein: "/fotos/beruf/fahrzeugbau-klein.webp" },
  { art: "beruf", slug: "maske-kosmetik", gruppe: "customer_success", kldb: ["82"],
    alt: "Visagistin bei der Arbeit",
    pfad: "/fotos/beruf/maske-kosmetik.webp", klein: "/fotos/beruf/maske-kosmetik-klein.webp" },
  { art: "beruf", slug: "luftfahrttechnik", gruppe: "skilled_trades", kldb: ["25"],
    alt: "Fluggerätmechaniker am Triebwerk",
    pfad: "/fotos/beruf/luftfahrttechnik.webp", klein: "/fotos/beruf/luftfahrttechnik-klein.webp" },
  { art: "beruf", slug: "automatisierung", gruppe: "operations", kldb: ["26", "27"],
    alt: "Ingenieur programmiert einen Roboterarm",
    pfad: "/fotos/beruf/automatisierung.webp", klein: "/fotos/beruf/automatisierung-klein.webp" },
  { art: "beruf", slug: "produktdesign", gruppe: "design", kldb: ["27", "93"],
    alt: "Produktdesigner an den Entwurfsskizzen",
    pfad: "/fotos/beruf/produktdesign.webp", klein: "/fotos/beruf/produktdesign-klein.webp" },
  { art: "beruf", slug: "teamleitung", gruppe: "hr", kldb: ["71"],
    alt: "Teamleiter im Gespräch mit dem Team",
    pfad: "/fotos/beruf/teamleitung.webp", klein: "/fotos/beruf/teamleitung-klein.webp" },
  { art: "beruf", slug: "innenarchitektur-planung", gruppe: "design", kldb: ["31", "93"],
    alt: "Innenarchitektin an Plänen und Mustern",
    pfad: "/fotos/beruf/innenarchitektur-planung.webp", klein: "/fotos/beruf/innenarchitektur-planung-klein.webp" },
  { art: "beruf", slug: "koch", gruppe: "operations", kldb: ["29", "63"],
    alt: "Koch richtet einen Teller an",
    pfad: "/fotos/beruf/koch.webp", klein: "/fotos/beruf/koch-klein.webp" },
  { art: "beruf", slug: "zahnmedizin-behandlung", gruppe: "healthcare", kldb: ["81"],
    alt: "Zahnarzt behandelt eine Patientin",
    pfad: "/fotos/beruf/zahnmedizin-behandlung.webp", klein: "/fotos/beruf/zahnmedizin-behandlung-klein.webp" },
  { art: "beruf", slug: "eventmanagement", gruppe: "customer_success", kldb: ["63", "92"],
    alt: "Eventmanagerin bespricht den Aufbau",
    pfad: "/fotos/beruf/eventmanagement.webp", klein: "/fotos/beruf/eventmanagement-klein.webp" },
  { art: "krise", slug: "krisenberichterstattung", gruppe: null, kldb: [],
    alt: "Journalistin berichtet aus einem Krisengebiet",
    pfad: "/fotos/krise/krisenberichterstattung.webp", klein: "/fotos/krise/krisenberichterstattung-klein.webp" },
  { art: "beruf", slug: "content-creation", gruppe: "marketing", kldb: ["92"],
    alt: "Creatorin nimmt ein Video auf",
    pfad: "/fotos/beruf/content-creation.webp", klein: "/fotos/beruf/content-creation-klein.webp" },
  { art: "beruf", slug: "tontechnik", gruppe: "design", kldb: ["94"],
    alt: "Tontechniker am Studiomischpult",
    pfad: "/fotos/beruf/tontechnik.webp", klein: "/fotos/beruf/tontechnik-klein.webp" },
  { art: "beruf", slug: "architektur-entwurf", gruppe: "design", kldb: ["31"],
    alt: "Architekt am Entwurfstisch",
    pfad: "/fotos/beruf/architektur-entwurf.webp", klein: "/fotos/beruf/architektur-entwurf-klein.webp" },
  { art: "beruf", slug: "videobearbeitung", gruppe: "design", kldb: ["92"],
    alt: "Cutter bei der Bildbearbeitung",
    pfad: "/fotos/beruf/videobearbeitung.webp", klein: "/fotos/beruf/videobearbeitung-klein.webp" },
  { art: "beruf", slug: "forschung-labor", gruppe: "research", kldb: ["41"],
    alt: "Wissenschaftlerin am Mikroskop",
    pfad: "/fotos/beruf/forschung-labor.webp", klein: "/fotos/beruf/forschung-labor-klein.webp" },
  { art: "beruf", slug: "immobilien", gruppe: "sales", kldb: ["61"],
    alt: "Immobilienberaterin zeigt einem Paar eine Wohnung",
    pfad: "/fotos/beruf/immobilien.webp", klein: "/fotos/beruf/immobilien-klein.webp" },
  { art: "beruf", slug: "softwareentwicklung-buero", gruppe: "software_data", kldb: ["43"],
    alt: "Entwickler am Arbeitsplatz",
    pfad: "/fotos/beruf/softwareentwicklung-buero.webp", klein: "/fotos/beruf/softwareentwicklung-buero-klein.webp" },
  { art: "beruf", slug: "finanzberatung", gruppe: "finance", kldb: ["72"],
    alt: "Berater im Kundengespräch",
    pfad: "/fotos/beruf/finanzberatung.webp", klein: "/fotos/beruf/finanzberatung-klein.webp" },
  { art: "beruf", slug: "mode-schneiderei", gruppe: "skilled_trades", kldb: ["28"],
    alt: "Schneiderin an der Schneiderbüste",
    pfad: "/fotos/beruf/mode-schneiderei.webp", klein: "/fotos/beruf/mode-schneiderei-klein.webp" },
  { art: "beruf", slug: "pilot", gruppe: "logistics", kldb: ["52"],
    alt: "Pilot im Cockpit",
    pfad: "/fotos/beruf/pilot.webp", klein: "/fotos/beruf/pilot-klein.webp" },
  { art: "krise", slug: "bau-belastung", gruppe: "skilled_trades", kldb: ["32"],
    alt: "Erschöpfter Bauarbeiter auf der Baustelle",
    pfad: "/fotos/krise/bau-belastung.webp", klein: "/fotos/krise/bau-belastung-klein.webp" },
  { art: "krise", slug: "logistik", gruppe: "logistics", kldb: ["51"],
    alt: "Erschöpfter Lagerarbeiter im Regallager",
    pfad: "/fotos/krise/logistik.webp", klein: "/fotos/krise/logistik-klein.webp" },
  { art: "krise", slug: "pflege-belastung", gruppe: "healthcare", kldb: ["81"],
    alt: "Erschöpfte Pflegekraft im Pausenraum",
    pfad: "/fotos/krise/pflege-belastung.webp", klein: "/fotos/krise/pflege-belastung-klein.webp" },
  { art: "krise", slug: "friseur", gruppe: "skilled_trades", kldb: ["82"],
    alt: "Erschöpfte Friseurin im Salon",
    pfad: "/fotos/krise/friseur.webp", klein: "/fotos/krise/friseur-klein.webp" },
  { art: "krise", slug: "einzelhandel", gruppe: "customer_success", kldb: ["62"],
    alt: "Erschöpfte Kassiererin an der Kasse",
    pfad: "/fotos/krise/einzelhandel.webp", klein: "/fotos/krise/einzelhandel-klein.webp" },
  { art: "krise", slug: "gastronomie", gruppe: "operations", kldb: ["63"],
    alt: "Erschöpfte Servicekraft im Lokal",
    pfad: "/fotos/krise/gastronomie.webp", klein: "/fotos/krise/gastronomie-klein.webp" },
  { art: "beruf", slug: "tischler-moebel", gruppe: "skilled_trades", kldb: ["22"],
    alt: "Schreiner an einem fertigen Möbelstück",
    pfad: "/fotos/beruf/tischler-moebel.webp", klein: "/fotos/beruf/tischler-moebel-klein.webp" },
  { art: "beruf", slug: "florist-laden", gruppe: "skilled_trades", kldb: ["12"],
    alt: "Floristin im Blumenladen",
    pfad: "/fotos/beruf/florist-laden.webp", klein: "/fotos/beruf/florist-laden-klein.webp" },
  { art: "beruf", slug: "rettungsdienst-portraet", gruppe: "healthcare", kldb: ["81"],
    alt: "Notfallsanitäterin am Rettungswagen",
    pfad: "/fotos/beruf/rettungsdienst-portraet.webp", klein: "/fotos/beruf/rettungsdienst-portraet-klein.webp" },
  { art: "beruf", slug: "lehre-erwachsene", gruppe: "education", kldb: ["84"],
    alt: "Dozentin vor einer Lerngruppe",
    pfad: "/fotos/beruf/lehre-erwachsene.webp", klein: "/fotos/beruf/lehre-erwachsene-klein.webp" },
  { art: "beruf", slug: "triebfahrzeugfuehrer-fahrt", gruppe: "logistics", kldb: ["52"],
    alt: "Triebfahrzeugführer während der Fahrt",
    pfad: "/fotos/beruf/triebfahrzeugfuehrer-fahrt.webp", klein: "/fotos/beruf/triebfahrzeugfuehrer-fahrt-klein.webp" },
  { art: "beruf", slug: "bauleitung", gruppe: "operations", kldb: ["31", "32"],
    alt: "Bauleiterin bespricht Pläne auf der Baustelle",
    pfad: "/fotos/beruf/bauleitung.webp", klein: "/fotos/beruf/bauleitung-klein.webp" },
  { art: "beruf", slug: "tiermedizin-untersuchung", gruppe: "healthcare", kldb: ["81"],
    alt: "Tierärztin bei der Untersuchung",
    pfad: "/fotos/beruf/tiermedizin-untersuchung.webp", klein: "/fotos/beruf/tiermedizin-untersuchung-klein.webp" },
  { art: "beruf", slug: "modedesign", gruppe: "design", kldb: ["28", "93"],
    alt: "Modedesignerin am Entwurf",
    pfad: "/fotos/beruf/modedesign.webp", klein: "/fotos/beruf/modedesign-klein.webp" },
  { art: "beruf", slug: "elektrotechnik", gruppe: "skilled_trades", kldb: ["26"],
    alt: "Elektriker am Verteilerkasten",
    pfad: "/fotos/beruf/elektrotechnik.webp", klein: "/fotos/beruf/elektrotechnik-klein.webp" },
  { art: "beruf", slug: "baecker", gruppe: "operations", kldb: ["29"],
    alt: "Bäcker holt Brot aus dem Ofen",
    pfad: "/fotos/beruf/baecker.webp", klein: "/fotos/beruf/baecker-klein.webp" },
  { art: "beruf", slug: "physiotherapie-behandlung", gruppe: "healthcare", kldb: ["81", "82"],
    alt: "Physiotherapeutin behandelt eine Patientin",
    pfad: "/fotos/beruf/physiotherapie-behandlung.webp", klein: "/fotos/beruf/physiotherapie-behandlung-klein.webp" },
  { art: "beruf", slug: "florist-werkstatt", gruppe: "skilled_trades", kldb: ["12"],
    alt: "Floristin bei der Straussbindung",
    pfad: "/fotos/beruf/florist-werkstatt.webp", klein: "/fotos/beruf/florist-werkstatt-klein.webp" },
  { art: "beruf", slug: "labor-mikroskop", gruppe: "research", kldb: ["41"],
    alt: "Laborantin am Mikroskop",
    pfad: "/fotos/beruf/labor-mikroskop.webp", klein: "/fotos/beruf/labor-mikroskop-klein.webp" },
  { art: "beruf", slug: "garten-landschaftsbau", gruppe: "operations", kldb: ["12"],
    alt: "Gärtner schneidet eine Hecke",
    pfad: "/fotos/beruf/garten-landschaftsbau.webp", klein: "/fotos/beruf/garten-landschaftsbau-klein.webp" },
  { art: "beruf", slug: "barista", gruppe: "operations", kldb: ["63"],
    alt: "Barista bereitet Kaffee zu",
    pfad: "/fotos/beruf/barista.webp", klein: "/fotos/beruf/barista-klein.webp" },
  { art: "beruf", slug: "kfz-mechatronik", gruppe: "skilled_trades", kldb: ["25"],
    alt: "Kfz-Mechatroniker am Motor",
    pfad: "/fotos/beruf/kfz-mechatronik.webp", klein: "/fotos/beruf/kfz-mechatronik-klein.webp" },
  { art: "beruf", slug: "grundschule", gruppe: "education", kldb: ["84"],
    alt: "Lehrerin mit Schulkindern",
    pfad: "/fotos/beruf/grundschule.webp", klein: "/fotos/beruf/grundschule-klein.webp" },
  { art: "beruf", slug: "tischler-werkstatt", gruppe: "skilled_trades", kldb: ["22"],
    alt: "Schreiner an einem Möbelstück",
    pfad: "/fotos/beruf/tischler-werkstatt.webp", klein: "/fotos/beruf/tischler-werkstatt-klein.webp" },
  { art: "beruf", slug: "tiermedizin-praxis", gruppe: "healthcare", kldb: ["81"],
    alt: "Tierärztin mit Hund und Halterin",
    pfad: "/fotos/beruf/tiermedizin-praxis.webp", klein: "/fotos/beruf/tiermedizin-praxis-klein.webp" },
  { art: "beruf", slug: "mode-handarbeit", gruppe: "skilled_trades", kldb: ["28"],
    alt: "Designerin bei der Applikationsarbeit",
    pfad: "/fotos/beruf/mode-handarbeit.webp", klein: "/fotos/beruf/mode-handarbeit-klein.webp" },
  { art: "beruf", slug: "gemuesebau", gruppe: "operations", kldb: ["11", "12"],
    alt: "Gärtner erntet Tomaten im Gewächshaus",
    pfad: "/fotos/beruf/gemuesebau.webp", klein: "/fotos/beruf/gemuesebau-klein.webp" },
  { art: "beruf", slug: "pflege", gruppe: "healthcare", kldb: ["81"],
    alt: "Pflegekraft im Gespräch mit einer Patientin",
    pfad: "/fotos/beruf/pflege.webp", klein: "/fotos/beruf/pflege-klein.webp" },
  { art: "beruf", slug: "bau", gruppe: "skilled_trades", kldb: ["32"],
    alt: "Polier auf der Baustelle",
    pfad: "/fotos/beruf/bau.webp", klein: "/fotos/beruf/bau-klein.webp" },
  { art: "beruf", slug: "labor-technik", gruppe: "research", kldb: ["41"],
    alt: "Laborantin an einem Analysegerät",
    pfad: "/fotos/beruf/labor-technik.webp", klein: "/fotos/beruf/labor-technik-klein.webp" },
  { art: "beruf", slug: "fotografie", gruppe: "design", kldb: ["92"],
    alt: "Fotograf bei einem Shooting",
    pfad: "/fotos/beruf/fotografie.webp", klein: "/fotos/beruf/fotografie-klein.webp" },
  { art: "beruf", slug: "elektrotechnik-schaltschrank", gruppe: "skilled_trades", kldb: ["26"],
    alt: "Elektriker am Schaltschrank",
    pfad: "/fotos/beruf/elektrotechnik-schaltschrank.webp", klein: "/fotos/beruf/elektrotechnik-schaltschrank-klein.webp" },
  { art: "beruf", slug: "barista-service", gruppe: "customer_success", kldb: ["63"],
    alt: "Barista serviert einen Kaffee",
    pfad: "/fotos/beruf/barista-service.webp", klein: "/fotos/beruf/barista-service-klein.webp" },
  { art: "beruf", slug: "zugbegleitung", gruppe: "logistics", kldb: ["52", "63"],
    alt: "Zugbegleiter am Bahnsteig",
    pfad: "/fotos/beruf/zugbegleitung.webp", klein: "/fotos/beruf/zugbegleitung-klein.webp" },
  { art: "beruf", slug: "florist-portraet", gruppe: "skilled_trades", kldb: ["12"],
    alt: "Floristin im Laden",
    pfad: "/fotos/beruf/florist-portraet.webp", klein: "/fotos/beruf/florist-portraet-klein.webp" },
  { art: "beruf", slug: "feuerwehr-portraet", gruppe: "operations", kldb: ["53"],
    alt: "Feuerwehrmann am Einsatzfahrzeug",
    pfad: "/fotos/beruf/feuerwehr-portraet.webp", klein: "/fotos/beruf/feuerwehr-portraet-klein.webp" },
  { art: "beruf", slug: "baecker-ofen", gruppe: "operations", kldb: ["29"],
    alt: "Bäcker mit frischem Brot",
    pfad: "/fotos/beruf/baecker-ofen.webp", klein: "/fotos/beruf/baecker-ofen-klein.webp" },
  { art: "beruf", slug: "fitness-training", gruppe: "healthcare", kldb: ["82"],
    alt: "Trainer betreut eine Sportlerin",
    pfad: "/fotos/beruf/fitness-training.webp", klein: "/fotos/beruf/fitness-training-klein.webp" },
  { art: "beruf", slug: "kfz-werkstatt", gruppe: "skilled_trades", kldb: ["25"],
    alt: "Kfz-Mechaniker unter der Motorhaube",
    pfad: "/fotos/beruf/kfz-werkstatt.webp", klein: "/fotos/beruf/kfz-werkstatt-klein.webp" },
  { art: "beruf", slug: "eventmanagement-planung", gruppe: "customer_success", kldb: ["63", "92"],
    alt: "Eventmanagerin bei der Abstimmung",
    pfad: "/fotos/beruf/eventmanagement-planung.webp", klein: "/fotos/beruf/eventmanagement-planung-klein.webp" },
  { art: "beruf", slug: "landwirtschaft", gruppe: "operations", kldb: ["11"],
    alt: "Landwirt bei der Ernte",
    pfad: "/fotos/beruf/landwirtschaft.webp", klein: "/fotos/beruf/landwirtschaft-klein.webp" },
];

/** Alle Motive einer Gruppe — für die Auswahl eines Bildes je Berufsfeld. */
export function fotosDerGruppe(gruppe: Berufsgruppe, art: Foto["art"] = "beruf"): Foto[] {
  return FOTOS.filter((f) => f.gruppe === gruppe && f.art === art);
}

/**
 * Ein Motiv zu einem Kurznamen.
 *
 * `null` statt eines Ersatzbildes: Wer kein Motiv findet, soll den
 * Verlauf aus `JobBild.tsx` zeigen und nicht das nächstbeste Foto.
 */
export function foto(slug: string): Foto | null {
  return FOTOS.find((f) => f.slug === slug) ?? null;
}

/**
 * Motive zu einer KldB-Kennung — die genauere Zuordnung.
 *
 * Nur die ersten beiden Ziffern zählen: Die dritte und vierte
 * verfeinern innerhalb der Hauptgruppe, die fünfte ist das
 * Anforderungsniveau. Ein Bild für „Fachkraft" und eines für
 * „Experte" derselben Tätigkeit zu verlangen, hiesse 1.302 Motive zu
 * brauchen statt 36.
 */
export function fotosZuKldb(kldb: string | null | undefined, art: Foto["art"] = "beruf"): Foto[] {
  const hauptgruppe = (kldb ?? "").replace(/\D/g, "").slice(0, 2);
  if (hauptgruppe.length < 2) return [];
  const genau = FOTOS.filter((f) => f.art === art && f.kldb.includes(hauptgruppe));
  if (genau.length > 0) return genau;

  /*
   * Zweite Stufe: derselbe Berufsbereich.
   *
   * ── Warum es die braucht ──────────────────────────────────
   *
   * Für sechs der 36 Hauptgruppen haben wir kein Motiv — darunter
   * Metallbearbeitung (24), Gebäudetechnik (34), Lagerwirtschaft (51)
   * und Reinigung (54). Ohne Zwischenstufe fiel die Auswahl auf das
   * grobe Berufsfeld zurück, und das griff blind:
   *
   *   Anlagenmechaniker Sanitär/Heizung (34) → „Goldschmied"
   *   Helfer Reinigung (54)                  → „Feuerwehr"
   *
   * Beides steckt im Feld „Handwerk" beziehungsweise „Produktion und
   * Betrieb" und ist trotzdem offensichtlich falsch.
   *
   * Die erste Ziffer der KldB ist der Berufsbereich: 3 ist Bau,
   * Architektur und Gebäudetechnik. Ein Bild von der Baustelle für
   * einen Heizungsbauer ist nicht genau, aber es zeigt dieselbe Welt —
   * und das ist der Unterschied zwischen ungenau und falsch.
   */
  const bereich = hauptgruppe[0]!;
  return FOTOS.filter((f) => f.art === art && f.kldb.some((k) => k.startsWith(bereich)));
}

/**
 * Für welche Berufshauptgruppen kein eigenes Motiv vorliegt.
 *
 * Nicht für die Anzeige, sondern für den Bericht: `scripts/
 * _bilder-luecken.mjs` zählt damit, wie viele Stellen an einer Lücke
 * hängen.
 */
export function kldbOhneMotiv(vorhanden: readonly string[]): string[] {
  const belegt = new Set(FOTOS.filter((f) => f.art === "beruf").flatMap((f) => f.kldb));
  return vorhanden.filter((k) => !belegt.has(k)).sort();
}
