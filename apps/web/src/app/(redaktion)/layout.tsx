import Link from "next/link";
import { getPageContext } from "@/lib/locale";
import { kopfsitzung } from "@/components/shell/Kopfsitzung";
import { BestandProvider } from "@/components/marketing/BestandProvider";
import { TopNav } from "@/components/shell/TopNav";
import { mondayZiel } from "@/lib/mondayziel";
import { AppHinweisleiste } from "@/components/shell/AppHinweisleiste";
import { VelvovaFooter } from "@/components/shell/VelvovaFooter";
import { laenderbestand } from "@/lib/jobs/laenderbestand";
import { bestandszahl } from "@/lib/jobs/bestandszahl";

/**
 * ══════════════════════════════════════════════════════════════════
 * Rahmen der redaktionellen Unterseiten
 * ══════════════════════════════════════════════════════════════════
 *
 * Eine Kopie von `(public)/layout.tsx` bis auf eine Zeile, und das ist
 * Absicht.
 *
 * Die Alternative wäre, den öffentlichen Rahmen um eine Breiten-Option
 * zu erweitern. Dann hinge an derselben Datei, wie „Lösungen"
 * aussieht UND wie Impressum, Datenschutz, AGB, Preise und die
 * öffentliche Jobsuche aussehen — zwölf Seiten, die in diesem Auftrag
 * ausdrücklich nicht angefasst werden sollen. Jede spätere Änderung
 * an dieser einen Datei träfe sie mit.
 *
 * Der Pfad ändert sich durch die Gruppe nicht: `(redaktion)` steht in
 * Klammern und taucht in der Adresse nicht auf. `/product`,
 * `/how-it-works`, `/help` und `/security` bleiben, was sie waren.
 *
 * Kopfzeile, Hinweisleiste, Bestandszähler und Fusszeile sind
 * unverändert übernommen — dieselben Bauteile, dieselben
 * Eigenschaften, dieselbe Reihenfolge.
 */
export default async function RedaktionLayout({ children }: { children: React.ReactNode }) {
  const { t, brand } = await getPageContext();

  /*
   * Wer angemeldet ist, sieht hier kein „Anmelden" mehr.
   *
   * Das war ein gemeldeter Fehler — und ein hartnäckiger, weil er wie
   * etwas ganz anderes aussah: „Die Hilfe loggt mich aus." Tat sie
   * nicht. Die Sitzung blieb die ganze Zeit gültig, das Cookie
   * unberührt. Aber „Hilfe" führt nach /how-it-works, das liegt in
   * diesem öffentlichen Rahmen, und der bot jedem unbesehen
   * „Anmelden / Konto anlegen" an. Man klickt auf Hilfe, sieht den
   * Anmeldeknopf und zieht den einzig naheliegenden Schluss.
   *
   * Ein Login-Knopf ist eine Aussage über den eigenen Zustand. Wird sie
   * ungeprüft getroffen, ist sie in der Hälfte der Fälle falsch.
   */
  /*
   * `kopfsitzung()` statt `currentUser()`.
   *
   * Hier stand nur die Frage, OB jemand angemeldet ist — und danach
   * richtete sich, ob rechts „Anmelden" steht oder Glocke und Profil.
   * Die Glocke kam, das Profil nicht: `TopNav` rendert an der Stelle
   * `accountMenu`, und das wurde von hier nie übergeben. Angemeldet
   * war rechts neben der Glocke schlicht nichts.
   *
   * `kopfsitzung()` liefert beides — den Zustand und das Menü samt
   * Profilbild — und ist dieselbe Quelle, aus der Startseite und
   * Arbeitgeberbereich sich bedienen. Drei Kopfzeilen, die ihren
   * Anmeldezustand je selbst zusammenbauen, waren zwei zu viel.
   */
  const sitzung = await kopfsitzung();
  const [laender, bestand] = await Promise.all([laenderbestand(), bestandszahl()]);
  const stellenzahl = bestand.text;
  const bestandDaten = bestand;

  const legal = [
    { href: "/how-it-works", label: "So funktioniert es" },
    { href: "/methodology", label: "Methodik" },
    { href: "/security", label: "Sicherheit" },
    { href: "/privacy", label: "Datenschutz" },
  ];

  return (
    /*
     * ══════════════════════════════════════════════════════════
     * Kein festes Hell mehr
     * ══════════════════════════════════════════════════════════
     *
     * Hier stand `data-theme="light"`, mit der Begründung: Diese
     * Seiten werden von Menschen geöffnet, die das Produkt noch nicht
     * kennen — meist bei Tageslicht und oft am Telefon.
     *
     * Das Ergebnis war ein sichtbarer Bruch. Die Startseite folgt der
     * Wahl und war dunkelblau; „Sicherheit", „So funktioniert es" und
     * die öffentliche Jobsuche lagen im selben Verbund, trugen
     * dieselbe Kopfzeile — und waren weiss. Wer von der Startseite auf
     * „Sicherheit" klickte, wechselte mitten im Klick die Farbwelt.
     *
     * Ein Argument, das für die Startseite gälte, aber ausgerechnet
     * dort nicht angewendet wird, ist keines. Diese Seiten folgen
     * jetzt derselben Wahl wie alles andere: der des Nutzers, sonst
     * der seines Geräts.
     */
    <BestandProvider genau={bestandDaten.genau} proSekunde={bestandDaten.proSekunde}>
    <div className="flex min-h-dvh flex-col bg-page text-ink">
      <a href="#inhalt" className="skip-link">
        {t("nav.skipToContent")}
      </a>

      {/*
       * Derselbe Kopf wie in der Anwendung.
       *
       * Hier stand ein eigener, kleinerer: anderes Logo, andere Höhe,
       * andere Wege. Wer aus der Anwendung auf eine Rechtsseite oder
       * die Hilfe klickte, dem wurde mitten in der Arbeit die ganze
       * Umgebung ausgetauscht — und er musste zurückfinden.
       *
       * `angemeldet` entscheidet nur darüber, was rechts steht: Glocke
       * und Profil, oder Anmelden und Konto anlegen. Alles andere ist
       * gleich, bis auf den Pixel.
       */}
      {/*
        Dieselbe Leiste wie überall — hier mit dem Weg zur Anmeldung.
        
        Auf einer öffentlichen Seite gibt es keinen Auftrag, den man
        prüfen könnte, und keinen Abschnitt darunter, auf den ein
        Anker zeigen würde. Der Weg zur nächtlichen Suche führt hier
        über ein Konto — das ist der ehrliche Link.
      */}
      <AppHinweisleiste nachtsZiel={await mondayZiel("/register")} />

      <TopNav
        anmeldeZiel={await mondayZiel("/login")}
        registrierZiel={await mondayZiel("/register")}
        brandName={brand.name}
        userName={sitzung.userName}
        userEmail={sitzung.userEmail}
        unreadCount={sitzung.unreadCount}
        stellenzahl={stellenzahl}
        stellenGenau={bestandDaten.genau}
        proSekunde={bestandDaten.proSekunde}
        angemeldet={sitzung.angemeldet}
        accountMenu={sitzung.accountMenu}
      />

      {/*
        ══════════════════════════════════════════════════════════
        Hier steht keine 760er Spalte — und das ist der einzige
        Unterschied zum öffentlichen Rahmen
        ══════════════════════════════════════════════════════════

        Der öffentliche Rahmen zwängt alles in `max-w-[760px]` mit
        `px-5 py-14`. Für einen Rechtstext ist das genau richtig.

        Die vier redaktionellen Seiten brauchen mehr: Einstieg mit
        Vorschau daneben, zweispaltige Raster, ein Beispiel neben
        seiner Erklärung. In 760 Pixeln steht davon alles
        untereinander.

        Die Spalte wandert deshalb in die Seiten selbst — jeder
        Abschnitt bringt seine eigene Breite mit, Lesetext bekommt
        seine 64 Zeichen, ein Raster darf die vollen 1120 nutzen. Der
        `<main>` gibt nur noch die Fläche.
      */}
      <main id="inhalt" className="flex-1">
        {children}
      </main>

      {/* Auch der Fuss ist derselbe wie in der Anwendung — mit
          Märkten, Zahlungsarten, Region und Rechtlichem. */}
      <VelvovaFooter laender={laender} />
    </div>
    </BestandProvider>
  );
}
