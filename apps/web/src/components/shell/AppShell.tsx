"use client";

import { useEffect, useState } from "react";
import { brand } from "@paycheck/config";
import { usePathname } from "next/navigation";
import { CreditCard, Globe, LifeBuoy, Palette, ShieldCheck, User } from "lucide-react";
import { CommandPalette } from "./CommandPalette.tsx";
import { AccountMenu } from "./AccountMenu.tsx";
import { kontoGruppen } from "./kontoeintraege.ts";
import { BottomNav, TopNav } from "./TopNav.tsx";
import { AppHinweisleiste } from "./AppHinweisleiste.tsx";
import { VelvovaFooter } from "./VelvovaFooter.tsx";
import type { Landzeile } from "@/lib/jobs/laenderbestand";

/**
 * Seiten, die eine Arbeitsfläche sind und keinen Fussbereich wollen.
 *
 * Wer gerade eine Bewerbung schreibt oder mit Monday spricht, scrollt
 * nicht nach unten, um Impressum und Berufsfelder zu finden.
 */
const ARBEITSFLAECHEN = ["/app/monday", "/app/applications/"];
import { cn } from "@/lib/cn";

/**
 * Das Gerüst.
 *
 * Vier Entscheidungen, die den Charakter bestimmen:
 *
 * 1. **Ein oberer Header statt einer linken Icon-Leiste.** Eine schmale
 *    Spalte aus unbeschrifteten Symbolen ist die Form, die
 *    Verwaltungssoftware benutzt — und sie bringt deren Anmutung mit.
 *    Der Header trägt fünf Bereiche mit Namen und lässt dem Inhalt die
 *    volle Breite.
 *
 * 2. **Fünf Bereiche. Nicht zehn.** Alles Weitere ist ein Unterbereich
 *    oder gehört ins Kontomenü.
 *
 * 3. **Monday ist eine Handlung, kein Ort.** Sie steht als Pille rechts
 *    im Header und öffnet den Drawer, ohne die Seite zu verlassen.
 *
 * 4. **Im Header stehen KEINE Schalter für Sprache, Darstellung oder
 *    Abmelden.** Das sind Entscheidungen, die man einmal trifft; sie
 *    liegen im Kontomenü.
 */

export interface NavLabels {
  home: string;
  discover: string;
  applications: string;
  career: string;
  assistant: string;
  settings: string;
  logout: string;
  skipToContent: string;
  search: string;
  notifications: string;
  languageRegion: string;
  appearance: string;
  privacy: string;
  help: string;
  expand: string;
  collapse: string;
}

export function AppShell({
  labels,
  brandName,
  nachtsZiel = null,
  assistantName,
  userEmail,
  userName,
  unreadCount,
  onLogout,
  children,
  land,
  laender,
  stellenzahl,
  stellenGenau,
  proSekunde,
  gespraechBegonnen,
  bildKennung,
}: {
  labels: NavLabels;
  brandName: string;
  /**
   * Wohin „Hier entdecken" in der Leiste oben führt — oder `null`.
   *
   * `null` heisst: Es läuft bereits eine nächtliche Suche. Dann steht
   * dort die App-Ankündigung, und im Gespräch mit Monday gar nichts.
   */
  nachtsZiel?: string | null;
  assistantName: string;
  userEmail: string;
  userName: string | null;
  unreadCount: number;
  onLogout: React.ReactNode;
  /* Märkte für das Länderraster im Fuss. Serverseitig geladen und
     durchgereicht: AppShell ist eine Client-Komponente und darf die
     Datenbank nicht anfassen. */
  laender?: Landzeile[];
  /* Bestandsgrösse für die Beschriftung der Kopfsuche. */
  stellenzahl?: string;
  /**
   * Der genaue Stand und die gemessene Rate.
   *
   * Ohne sie steht die Zahl in der Kopfzeile still, während sie auf
   * Startseite, Marketingseiten und im Arbeitgeberbereich läuft — auf
   * derselben Sitzung, beim Wechsel zwischen zwei Seiten sichtbar.
   */
  stellenGenau?: number;
  proSekunde?: number;
  /* Ob schon ein Gespräch läuft — entscheidet über die Beschriftung
     im Monday-Streifen. */
  gespraechBegonnen?: boolean;
  /* Ob ein Profilbild hinterlegt ist — für das Kontomenü. */
  bildKennung?: string | null;
  children: React.ReactNode;
  /** Der eingestellte Jobmarkt — für die Regionsauswahl im Fussbereich. */
  land: string;
}) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const accountGruppen = kontoGruppen(labels, brand.assistantName);

  /*
   * Seiten, die exakt das Fenster füllen und selbst scrollen.
   *
   * Die Liste steht hier und nicht in der Seite, weil die Rechnung dem
   * Rahmen gehört: nur er weiss, wie hoch Kopfzeile und untere Leiste
   * sind. Eine Seite, die sich das selbst ausrechnet, rechnet beim
   * nächsten Headerumbau falsch.
   */
  const fülltFenster = pathname === "/app/monday";

  /*
   * Wieder dieselbe Breite wie überall.
   *
   * Die Stellenseite lief zweimal auf mehr als 1200 Pixel — einmal auf
   * 1600 bei zwei Spalten, einmal auf 1920 bei drei. Beide Male war
   * das Ergebnis schlechter als der Ausgangszustand, und beide Male
   * aus demselben Grund: Die zusätzliche Breite landet dort, wo sie
   * nicht gebraucht wird, und die Spalten geraten aus dem Verhältnis.
   *
   * 1200 ist die Breite, auf die alles andere abgestimmt ist. Wer das
   * erneut ändern will, misst vorher — `tests/e2e/seitenbreite.spec.ts`
   * ist der Ort dafür.
   */
  const breiteArbeitsflaeche = false;

  return (
    <div
      className={cn(
        "flex flex-col bg-page",
        /*
         * `h-dvh` statt `min-h-dvh`, wenn die Seite das Fenster füllt.
         *
         * `min-h` erlaubt, dass der Inhalt höher wird — und genau das
         * passierte: Die Gesprächsseite war 108 Pixel höher als das
         * Fenster, das Dokument scrollte um 71, und die Kopfzeile
         * wanderte 34 Pixel nach oben aus dem Bild.
         *
         * `sticky` half nicht: Ein Vorfahr mit `overflow-y: hidden`
         * macht die Kopfzeile an IHM klebend, nicht am Fenster. Sie
         * klebte also an einem Kasten, der selbst wegrutschte.
         *
         * Mit fester Höhe gibt es kein Dokumentrollen mehr — und die
         * Kopfzeile steht, weil nichts sie verschieben kann.
         */
        fülltFenster ? "h-dvh overflow-hidden" : "min-h-dvh",
      )}
    >
      <a href="#inhalt" className="skip-link">
        {labels.skipToContent}
      </a>

      {/*
        * Die App-Leiste über der Navigation — ausser dort, wo das
        * Fenster ganz gefüllt wird.
        *
        * Im Gespräch mit Monday zählt jede Zeile Höhe. Ein Hinweis auf
        * eine App, die es noch nicht gibt, ist es nicht wert, dort
        * dreissig Pixel zu kosten.
        */}
      {/*
        ══════════════════════════════════════════════════════════
        Auch im Gespräch mit Monday
        ══════════════════════════════════════════════════════════

        Hier stand `!fülltFenster` — auf `/app/monday` blieb die Leiste
        weg, mit dem Argument, ein Hinweis auf eine App, die es noch
        nicht gibt, sei dreissig Pixel Höhe im Gespräch nicht wert.

        Das Argument galt der App. Seit dort auch die nächtliche
        Suche steht, gilt es nicht mehr: Sie existiert, sie ist einen
        Klick entfernt, und das Gespräch ist genau der Ort, an dem
        jemand merkt, dass er nicht jeden Tag selbst nachsehen will.

        Die Leiste kostet 32 Pixel und lässt sich wegklicken. Das ist
        der Handel.
      */}
      <AppHinweisleiste nachtsZiel={nachtsZiel} />

      <TopNav
        brandName={brandName}
        userName={userName}
        userEmail={userEmail}
        unreadCount={unreadCount}
        onOpenSearch={() => setPaletteOpen(true)}
        stellenzahl={stellenzahl}
        stellenGenau={stellenGenau}
        proSekunde={proSekunde}
        accountMenu={
          <AccountMenu
            userName={userName}
            userEmail={userEmail}
            gruppen={accountGruppen}
            assistent={brand.assistantName}
            onLogout={onLogout}
            bildKennung={bildKennung}
          />
        }
      />

      {/*
       * Hier lag der Monday-Streifen mit „Willkommen zurück".
       *
       * Er stand über jeder Seite und begrüsste denselben Menschen ein
       * zweites Mal — die Startseite tut das bereits, mit Namen. Zwei
       * Begrüssungen sind keine Freundlichkeit, sondern eine Zeile, die
       * man wegliest.
       *
       * Monday steht jetzt auf der Startseite in voller Grösse, und das
       * Dock liegt weiterhin auf jeder Seite.
       */}

      <main
        id="inhalt"
        data-fuellt-fenster={fülltFenster ? "" : undefined}
        className={cn(
          "mx-auto w-full px-5 md:px-8",
          breiteArbeitsflaeche ? "max-w-[1600px]" : "max-w-(--breite-inhalt)",
          fülltFenster
            ? /*
               * Genau der Rest des Fensters, keine Zeile mehr.
               *
               * Ein Gespräch ist kein Dokument. Scrollt der Seitenkörper
               * mit, wandern Kopf und Eingabefeld beim Tippen aus dem
               * Bild — und auf einem Telefon schiebt die Tastatur die
               * Eingabe zusätzlich weg. Deshalb bekommt diese Seite eine
               * feste Höhe, und nur der Nachrichtenstrom darin scrollt.
               *
               * `100dvh` und nicht `100vh`: auf mobilen Browsern wächst
               * und schrumpft die sichtbare Fläche mit der ein- und
               * ausfahrenden Adressleiste. `vh` kennt nur den grössten
               * Stand und ergibt darunter eine Seite, die immer ein
               * Stück zu hoch ist.
               */
              [
                /*
                 * Der Rest wird gemessen, nicht gerechnet.
                 *
                 * Hier stand eine feste Höhe:
                 *
                 *   h-[calc(100dvh - var(--app-header-height)
                 *                  - var(--nav-bottom-h))]
                 *
                 * Sie stimmte, solange die Kopfzeile 76 Pixel hoch war.
                 * Inzwischen hat sie zwei Reihen und misst 147, und
                 * darüber liegt ein Hinweisband von 37. Über `main`
                 * standen also 184 Pixel, während die Rechnung mit 76
                 * kalkulierte — 108 Pixel zu viel Inhalt, die unter
                 * `overflow-hidden` einfach abgeschnitten wurden.
                 *
                 * Sichtbar wurde das erst, als unter dem Eingabefeld
                 * eine Zeile dazukam: Sie stand bei 862 in einem 800
                 * Pixel hohen Fenster und war schlicht nicht da.
                 *
                 * `flex-1 min-h-0` nimmt stattdessen genau das, was
                 * die Geschwister übrig lassen — egal wie hoch die
                 * werden. `min-h-0` ist dabei der entscheidende Teil:
                 * Ohne ihn steht `min-height: auto`, und ein Flex-Kind
                 * weigert sich, unter seinen Inhalt zu schrumpfen.
                 *
                 * Der untere Rand ersetzt den zweiten Summanden: Die
                 * Leiste unten ist `fixed` und nimmt keinen Platz weg,
                 * also muss ihn jemand reservieren. Ab `md` gibt es
                 * sie nicht mehr.
                 */
                "min-h-0 flex-1 overflow-hidden",
                "mb-(--nav-bottom-h) md:mb-0",
              ]
            : /* Unten Platz für die feste Leiste — aber nur dort, wo es
                 sie gibt. Ab `md` verschwindet sie, und der Freiraum
                 mit ihr. */
              [
                "flex-1",
                "py-8 md:py-10",
                "pb-[calc(var(--nav-bottom-h)_+_env(safe-area-inset-bottom)_+_1rem)] md:pb-10",
              ],
        )}
      >
        {children}
      </main>

      {/*
        * Der grosse Fussbereich — nicht überall.
        *
        * Die Vorgabe sagt es genau: auf Übersichts- und Inhaltsseiten
        * ja, im Gespräch, im Sprachmodus und im Bewerbungseditor
        * nicht. Dort ist die Seite eine Arbeitsfläche, und ein
        * Fussbereich mit dreissig Links darunter stört bei jedem
        * Scrollen.
        */}
      {!fülltFenster && !ARBEITSFLAECHEN.some((p) => pathname.startsWith(p)) && (
        /* `angemeldet`: Die Hülle läuft nur unter einer Sitzung. */
        <VelvovaFooter angemeldet land={land} laender={laender} />
      )}

      <BottomNav />

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        assistantName={assistantName}
        labels={labels}
      />
    </div>
  );
}
