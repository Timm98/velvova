"use client";

import { useEffect, useRef, useState } from "react";
import { brand } from "@paycheck/config";
import { usePathname } from "next/navigation";
import { CreditCard, Globe, LifeBuoy, Palette, ShieldCheck, User } from "lucide-react";
import { CommandPalette } from "./CommandPalette.tsx";
import { AccountMenu } from "./AccountMenu.tsx";
import { kontoGruppen } from "./kontoeintraege.ts";
import { BottomNav, TopNav } from "./TopNav.tsx";
import { Seitenleiste } from "./Seitenleiste.tsx";
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
  planName,
  planHref,
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
  projekte = [],
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
  /** Der Name des laufenden Abos, aus den echten Abodaten. */
  planName: string;
  /** Wohin der Warenkorb in der Leiste führt. */
  planHref: string;
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
  /** Die offenen Vorhaben. Leer heisst: der Abschnitt fehlt. */
  projekte?: { id: string; titel: string; href: string }[];
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
   * ══════════════════════════════════════════════════════════════
   * Wie hoch die klebende Kopfzeile gerade ist
   * ══════════════════════════════════════════════════════════════
   *
   * Sie klebt bei `top-0` mit `z-40`. Alles andere, was auf einer
   * Seite kleben will, muss darunter anfangen — sonst rutscht es
   * beim Rollen dahinter und ist weg.
   *
   * Gemeldet am 8. September 2026: „bei faq verschwindet das links
   * die leiste irgendwie". Die Rechtsleiste dort klebte bei `top-6`,
   * also 24 Pixel unter dem Fensterrand — und die Kopfzeile ist 88
   * Pixel hoch. Sie verschwand nicht, sie lag dahinter.
   *
   * ── Warum gemessen und nicht geschrieben ────────────────────
   *
   * Weil die Höhe nicht feststeht. Über der Navigation sitzt die
   * Hinweisleiste, und die gibt es nur ohne laufendes Abo. Eine
   * feste Zahl wäre für die eine Hälfte der Menschen falsch — und
   * zwar unsichtbar falsch, weil man einen Fehler von 40 Pixeln
   * nicht sieht, bis etwas dahinterrutscht.
   *
   * Der Wert steht auf `documentElement`, damit jede Seite ihn
   * lesen kann, ohne durch den Baum gereicht zu werden.
   */
  const kopfRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const kopf = kopfRef.current;
    if (!kopf) return;
    const schreiben = () =>
      document.documentElement.style.setProperty(
        "--kopfzeile-hoehe",
        `${Math.round(kopf.getBoundingClientRect().height)}px`,
      );
    schreiben();
    const beobachter = new ResizeObserver(schreiben);
    beobachter.observe(kopf);
    return () => {
      beobachter.disconnect();
      document.documentElement.style.removeProperty("--kopfzeile-hoehe");
    };
  }, []);

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
      /*
       * ── Die Arbeitsfläche beginnt hier ──────────────────────────
       *
       * `data-app` schaltet den eigenen Satz Flächen ein — #151515
       * für den Grund, #111111 für die Leiste, #20201F für die
       * Eingabe. Er gilt nur unterhalb dieses Knotens.
       *
       * An der Hülle und nicht im dunklen Theme, weil sonst die
       * öffentliche Seite stillschweigend mitginge. Sie trägt das
       * Marineblau der Marke; die Arbeitsfläche soll zurücktreten.
       */
      data-app=""
      className={cn(
        "flex flex-col bg-(--app-grund) text-(--app-text)",
        /*
         * Ab `md` wird aus der Spalte eine Zeile: links die Leiste,
         * rechts der Inhalt. Beide bekommen die volle Fensterhoehe,
         * damit die Leiste stehenbleibt, waehrend daneben gescrollt
         * wird — genau wie in den Vorlagen.
         *
         * Darunter aendert sich nichts: Dort traegt die untere Leiste
         * die Navigation, und die Seite scrollt wie bisher als Ganzes.
         */
        "md:h-dvh md:flex-row md:overflow-hidden",
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

      <Seitenleiste
        brandName={brandName}
        userName={userName}
        userEmail={userEmail}
        bildKennung={bildKennung ?? null}
        planName={planName}
        planHref={planHref}
        unreadCount={unreadCount}
        gruppen={accountGruppen}
        onLogout={onLogout}
        onSuche={() => setPaletteOpen(true)}
        projekte={projekte}
      />

      {/*
        Die Inhaltsspalte.

        Sie rollt ab `md` selbst, nicht das Dokument. Das ist der
        Grund, warum die Seitenleiste stehenbleibt — und `min-w-0` der
        Grund, warum eine breite Tabelle sie nicht auseinanderdrueckt:
        Ein Flex-Kind weigert sich sonst, unter seinen Inhalt zu
        schrumpfen.
      */}
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col",
          fülltFenster ? "md:h-dvh md:overflow-hidden" : "md:h-dvh md:overflow-y-auto",
        )}
      >

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
      {/*
        ══════════════════════════════════════════════════════════
        Band und Kopfzeile kleben zusammen
        ══════════════════════════════════════════════════════════

        Vorher klebte nur die Kopfzeile. Das Band darüber rollte weg —
        und damit sah die Seite oben je nach Rollstand anders aus:
        gescrollt nur Kopfzeile, oben Band UND Kopfzeile.

        Beim Seitenwechsel wurde das sichtbar. Das Band trägt einen
        eigenen `view-transition-name`, damit es nicht mitfährt; steht
        es aber auf der einen Seite im Bild und auf der anderen nicht,
        hat der Browser nichts zum Stehenlassen und blendet es ein
        oder aus. Ein Element, das nicht Teil der Bewegung sein soll,
        bewegt sich dann doch.

        Zusammen in einer klebenden Hülle ist der obere Rand auf jeder
        Seite und bei jedem Rollstand derselbe.

        Die Hülle trägt das Kleben, nicht die Kinder: Zwei `sticky`
        untereinander kleben jedes für sich am Fensterrand und
        schieben sich übereinander.
      */}
      <div ref={kopfRef} className="sticky top-0 z-40">
        <AppHinweisleiste nachtsZiel={nachtsZiel} />

        <div className="md:hidden">
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
        </div>
      </div>

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

      {/*
        ── Oben rechts: nur der Name ───────────────────────────────

        Kein Kasten, kein Untertitel, keine Werkzeugleiste. Eine Marke
        wirkt hochwertig, wenn sie sich nicht erklärt.

        Nur ab `md`: Darunter trägt `TopNav` bereits den Namen, und
        zweimal derselbe Schriftzug übereinander sieht nicht nach
        Ruhe aus, sondern nach einem Fehler.

        `pointer-events-none`, damit dieser Streifen nichts abfängt.
        Er ist eine Angabe, kein Bedienelement.
      */}
      <div
        aria-hidden
        className="pointer-events-none hidden shrink-0 justify-end px-8 pt-5 pb-1 md:flex"
      >
        <span className="font-titel text-[13px] tracking-[0.14em] text-(--app-text-3) uppercase">
          {brandName}
        </span>
      </div>

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
                 * Hier stand eine feste Höhe: die Fensterhöhe minus
                 * zwei Gestaltungsvariablen — eine für die Kopfzeile,
                 * eine für die untere Leiste.
                 *
                 * (Die Namen stehen hier bewusst NICHT ausgeschrieben:
                 * `design-tokens.test.ts` sucht im Quelltext nach
                 * benutzten Variablen und hielte die Erwähnung in
                 * diesem Kommentar für eine Benutzung. Die Variable
                 * für die Kopfhöhe gibt es nicht mehr; warum, steht in
                 * `globals.css` an ihrer Stelle.)
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
      </div>

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
