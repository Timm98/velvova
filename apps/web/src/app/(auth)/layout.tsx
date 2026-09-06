import Link from "next/link";
import { getPageContext } from "@/lib/locale";

/**
 * Der Rahmen für Anmelden und Registrieren.
 *
 * ── Warum hier kein Seitenkopf steht ──────────────────────────
 *
 * Auf jeder anderen Seite gilt: derselbe Kopf, überall. Hier nicht,
 * und das ist keine Ausnahme aus Bequemlichkeit.
 *
 * Der Kopf trägt Suche, acht Wege und zwei Knöpfe — er ist dafür
 * gebaut, dass man sich in einem grossen Angebot bewegt. Wer auf
 * dieser Seite ist, will genau eine Sache, und jeder Weg daneben ist
 * ein Angebot, sie nicht zu tun. Einer davon führte sogar zurück auf
 * die Anmeldung, auf der er schon steht.
 *
 * Übrig bleibt der Schriftzug oben — als Absender dessen, wonach hier
 * gefragt wird — und unten die Rechtsverweise. Beides sind Angaben,
 * keine Wege.
 *
 * ── Warum das Thema nicht mehr festgestellt ist ───────────────
 *
 * Hier stand `data-theme="light"` mit der Begründung, diese Seiten
 * würden von Menschen geöffnet, die das Produkt noch nicht kennen.
 * Das hebelte die Wahl aus: Wer im Konto auf „dunkel" gestellt hatte,
 * bekam beim nächsten Anmelden eine weisse Seite.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const { t, brand } = await getPageContext();

  return (
    <div className="flex min-h-dvh flex-col bg-page text-ink">
      <a href="#inhalt" className="skip-link">
        {t("nav.skipToContent")}
      </a>

      {/*
        Der Schriftzug führt zurück zur Startseite.

        Ohne Verweis wäre er eine Sackgasse: Wer sich doch nicht
        anmelden will, hätte auf dieser Seite keinen Weg zurück ausser
        der Zurück-Taste.
      */}
      {/*
        Die Abstände sind auf einen Laptop hin gerechnet, nicht auf
        einen grossen Bildschirm.

        Bei 1280 × 900 — der verbreitetsten Grösse — stand der
        Anmeldeknopf unter der Falz: Man musste scrollen, um sich
        anzumelden. Auf einer Seite mit genau einer Aufgabe ist das der
        schlechteste denkbare Fehler.

        Zusammen mit den engeren Innenabständen der Karte passt jetzt
        alles ohne Scrollen ins Bild.
      */}
      <header className="px-5 pb-2 pt-8 text-center md:pt-10">
        <Link
          href="/"
          className="inline-block rounded-(--radius-sm) font-display text-[28px] font-extrabold tracking-[-0.035em] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--primary) md:text-[32px]"
        >
          {brand.name}
        </Link>
      </header>

      <main id="inhalt" className="flex flex-1 items-start justify-center px-5 py-6 md:py-7">
        {/*
          440, nach 600, 480 und 420.

          „Hochkant" ist ein Verhältnis, nicht eine Breite. Die Karte
          ist 760 Pixel hoch:

            600 breit → 1,27  — liest sich als Quadrat
            480 breit → 1,58  — hochkant, aber zurückhaltend
            440 breit → 1,77  — hochkant, ohne zu drängen
            420 breit → 1,86  — schmaler, aber der Hinweis unten
                                brach auf zwei Zeilen um

          Weiter nach unten wird es eng: Bei 440 bleiben nach dem
          Innenabstand 368 Pixel, und darin stehen sechs Codefelder
          nebeneinander. Bei 380 wären es rund 51 Pixel je Feld
          inklusive Abständen, und die Ziffern begännen zu drängeln.
        */}
        <div className="w-full max-w-[440px]">{children}</div>
      </main>

      {/*
        Die Rechtsverweise stehen unten und nicht in der Karte.

        Sie gehören zur Seite, nicht zum Vorgang. In der Karte wären es
        vier weitere Zeilen zwischen dem Nutzer und dem Knopf, den er
        drücken will.
      */}
      <footer className="px-5 pb-8 pt-5">
        <nav
          aria-label="Rechtliches"
          className="mx-auto flex max-w-[640px] flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-ink-3"
        >
          <Link href="/privacy" className="underline-offset-[3px] transition-colors hover:text-ink-2 hover:underline">
            Datenschutzerklärung
          </Link>
          <Link href="/terms" className="underline-offset-[3px] transition-colors hover:text-ink-2 hover:underline">
            Nutzungsbedingungen
          </Link>
          <Link href="/imprint" className="underline-offset-[3px] transition-colors hover:text-ink-2 hover:underline">
            Impressum
          </Link>
          <Link href="/contact" className="underline-offset-[3px] transition-colors hover:text-ink-2 hover:underline">
            Kontakt
          </Link>
        </nav>
      </footer>
    </div>
  );
}
