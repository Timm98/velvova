import Link from "next/link";
import { getPageContext } from "@/lib/locale";
import { kopfsitzung } from "@/components/shell/Kopfsitzung";
import { BestandProvider } from "@/components/marketing/BestandProvider";
import { TopNav } from "@/components/shell/TopNav";
import { AppHinweisleiste } from "@/components/shell/AppHinweisleiste";
import { VelvovaFooter } from "@/components/shell/VelvovaFooter";
import { laenderbestand } from "@/lib/jobs/laenderbestand";
import { bestandszahl } from "@/lib/jobs/bestandszahl";

/**
 * Rahmen der öffentlichen Seiten.
 *
 * Keine Sprachumschaltung und keine Darstellungswahl mehr in der
 * Kopfzeile: beides gehört ins Konto, nicht in die dauerhafte Navigation.
 * Was oben steht, muss man mehrmals am Tag brauchen — sonst nimmt es nur
 * Aufmerksamkeit weg.
 */
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
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
     * Öffentliche Seiten sind immer hell.
     *
     * Auch wenn im Konto „dunkel“ steht: Landingpage, Anmeldung und
     * Registrierung werden von Menschen geöffnet, die das Produkt noch
     * nicht kennen — meist bei Tageslicht und oft am Telefon. Das
     * Attribut hier überschreibt die Wahl auf `:root` für genau diesen
     * Teilbaum; die Tokens definieren die helle Palette sowohl für
     * `:root` als auch für `[data-theme="light"]`.
     */
    <BestandProvider genau={bestandDaten.genau} proSekunde={bestandDaten.proSekunde}>
    <div data-theme="light" className="flex min-h-dvh flex-col bg-page text-ink">
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
      <AppHinweisleiste nachtsZiel="/register" />

      <TopNav
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

      <main id="inhalt" className="mx-auto w-full max-w-[760px] flex-1 px-5 py-14 md:py-20">
        {children}
      </main>

      {/* Auch der Fuss ist derselbe wie in der Anwendung — mit
          Märkten, Zahlungsarten, Region und Rechtlichem. */}
      <VelvovaFooter laender={laender} />
    </div>
    </BestandProvider>
  );
}
