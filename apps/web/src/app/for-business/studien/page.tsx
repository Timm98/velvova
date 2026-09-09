import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { brand } from "@paycheck/config";
import { AppHinweisleiste } from "@/components/shell/AppHinweisleiste";
import { VelvovaFooter } from "@/components/shell/VelvovaFooter";
import { TopNav } from "@/components/shell/TopNav";
import { mondayZiel } from "@/lib/mondayziel";
import { kopfsitzung } from "@/components/shell/Kopfsitzung";
import { BestandProvider } from "@/components/marketing/BestandProvider";
import { HilfeKnopf } from "@/components/marketing/HilfeKnopf";
import { Methodik } from "@/components/marketing/Studienlage";
import { bestandszahl } from "@/lib/jobs/bestandszahl";
import { laenderbestand } from "@/lib/jobs/laenderbestand";

export const metadata: Metadata = {
  title: "Studien und Methodik",
  description:
    "Die Untersuchungen hinter dem Unternehmensbereich — mit Herausgeber, Jahr und den Grenzen jedes Befunds.",
};

export const dynamic = "force-dynamic";

/**
 * Die vollständige Studienlage.
 *
 * ── Warum eine eigene Seite ───────────────────────────────────
 *
 * Fünfundfünfzig Befunde sind rund zweitausend Wörter. Auf der Seite,
 * die zur Anmeldung führt, stehen sie zwischen jemandem und dem Knopf.
 * Wer sie liest, liest sie ohnehin nicht dort, sondern wenn er es
 * genau wissen will — und dann soll er sie vollständig finden, nicht
 * in einer Auswahl, die wir für ihn getroffen haben.
 */
export default async function StudienSeite() {
  const [bestand, laender, sitzung] = await Promise.all([
    bestandszahl(),
    laenderbestand(),
    kopfsitzung(),
  ]);

  return (
    <BestandProvider genau={bestand.genau} proSekunde={bestand.proSekunde}>
      <div
        data-surface="editorial"
        className="min-h-dvh"
        style={{ background: "var(--ed-canvas)", color: "var(--ed-ink)" }}
      >
        <a href="#inhalt" className="skip-link">
          Zum Inhalt springen
        </a>
        <AppHinweisleiste />
        <TopNav
        anmeldeZiel={await mondayZiel("/login")}
        registrierZiel={await mondayZiel("/register")}
          brandName={brand.name}
          userName={sitzung.userName}
          userEmail={sitzung.userEmail}
          unreadCount={sitzung.unreadCount}
          stellenzahl={bestand.text}
          stellenGenau={bestand.genau}
          proSekunde={bestand.proSekunde}
          angemeldet={sitzung.angemeldet}
          accountMenu={sitzung.accountMenu}
        />

        <main id="inhalt">
          <div className="mx-auto w-full max-w-[1240px] px-5 pt-10 md:px-8">
            <Link
              href="/for-business"
              className="inline-flex min-h-11 items-center gap-2 text-sm underline-offset-4 hover:underline"
              style={{ color: "var(--ed-ink-2)" }}
            >
              <ArrowLeft aria-hidden className="size-4" strokeWidth={2} />
              Zurück zu {brand.name} für Unternehmen
            </Link>
          </div>

          {/*
            Der Satz, der über allem stehen muss.

            Die Befunde darunter stammen von IAB, KOFA, DIHK und der
            Bundesagentur. Sie beschreiben den Arbeitsmarkt, nicht
            Velvova. Ohne diesen Hinweis liest man eine Seite mit
            Zahlen unter dem Logo eines Anbieters als dessen
            Leistungsnachweis — und genau das sind sie nicht.

            Wirkungszahlen zu Velvova gibt es hier keine, weil es
            keine Messung gibt.
          */}
          <div className="mx-auto w-full max-w-[1240px] px-5 pt-8 md:px-8">
            <p
              className="max-w-[64ch] rounded-(--radius-md) border border-line p-4 text-[14px] leading-[1.6]"
              style={{ color: "var(--ed-ink-2)" }}
            >
              Alle Befunde auf dieser Seite stammen von Dritten und beschreiben den Arbeitsmarkt.
              Sie sind kein Nachweis für die Wirkung von {brand.name} — eine eigene Messung dazu
              liegt nicht vor.
            </p>
          </div>

          <Methodik />
        </main>

        <VelvovaFooter laender={laender} />
        <HilfeKnopf assistantName={brand.assistantName} />
      </div>
    </BestandProvider>
  );
}
