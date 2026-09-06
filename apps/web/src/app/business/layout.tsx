import type { Metadata } from "next";
import { brand } from "@paycheck/config";
import { requireUser } from "@/lib/auth";
import { meineOrganisationen } from "@/lib/arbeitgeber/zugang";
import { AppHinweisleiste } from "@/components/shell/AppHinweisleiste";
import { VelvovaFooter } from "@/components/shell/VelvovaFooter";
import { TopNav } from "@/components/shell/TopNav";
import { kopfsitzung } from "@/components/shell/Kopfsitzung";
import { BestandProvider } from "@/components/marketing/BestandProvider";
import { HilfeKnopf } from "@/components/marketing/HilfeKnopf";
import { bestandszahl } from "@/lib/jobs/bestandszahl";
import { laenderbestand } from "@/lib/jobs/laenderbestand";
import { BusinessNav } from "./BusinessNav";
import { Fortschritt } from "./Fortschritt";
import { einrichtungsstand } from "@/lib/arbeitgeber/einrichtung";
import { OrgWechsel } from "./OrgWechsel";

export const metadata: Metadata = { title: { default: "Arbeitgeber", template: "%s · Arbeitgeber" } };

/**
 * Der Arbeitgeberbereich.
 *
 * ── Warum ein eigener Bereich und kein Tab in der App ─────────
 *
 * Weil hier eine andere Person arbeitet — nicht dieselbe in einer
 * anderen Rolle. Ein Recruiter, der zwischen „meine Bewerbungen" und
 * „Bewerbungen bei mir" hin- und herspringt, verwechselt beides
 * irgendwann. Bei Bewerbungsdaten ist das keine Unbequemlichkeit,
 * sondern ein Vorfall.
 *
 * ── Warum die Trennung trotzdem NICHT im Kopf sichtbar ist ────
 *
 * Hier stand eine eigene Kopfzeile mit eigenem Zeichen, eigener Marke
 * und eigener Breite. Der Gedanke war richtig — man soll wissen, in
 * wessen Auftrag man liest —, die Umsetzung war es nicht: Wer aus der
 * Startseite hierher wechselte, bekam ein anderes Produkt. Auf einer
 * Fläche, auf der jemand über Bewerbungsdaten entscheidet, ist das
 * genau das falsche Signal.
 *
 * Die Trennung leistet jetzt die Zeile darunter: Bereichsnavigation
 * mit dem Namen der Organisation und dem aktiven Punkt. Der
 * Velvova-Kopf darüber bleibt unverändert — dieselbe Suche, dieselben
 * Wege, dasselbe Konto wie überall.
 */
export default async function BusinessLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [orgs, bestand, laender, sitzung] = await Promise.all([
    meineOrganisationen(user.id),
    bestandszahl(),
    laenderbestand(),
    kopfsitzung(),
  ]);
  const aktiv = orgs[0] ?? null;
  const stand = aktiv ? await einrichtungsstand(aktiv.organizationId) : null;

  return (
    <BestandProvider genau={bestand.genau} proSekunde={bestand.proSekunde}>
      <div
        data-surface="editorial"
        className="flex min-h-dvh flex-col"
        style={{ background: "var(--ed-canvas)", color: "var(--ed-ink)" }}
      >
        <a href="#inhalt" className="skip-link">
          Zum Inhalt springen
        </a>

        <AppHinweisleiste />

        <TopNav
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

        <BusinessNav organisation={aktiv?.name ?? null} />

        {/*
          Die Einrichtungsleiste steht unter der Navigation und
          verschwindet, sobald alle fünf Schritte erledigt sind.

          Bis dahin steht sie über jeder Seite: Ein Unternehmen, das
          seine Unternehmensseite nie veröffentlicht, hat das nicht
          vergessen — es hat nie wieder davon gehört.
        */}
        {stand && <Fortschritt schritte={stand} />}

        {/*
          Der Organisationswechsel steht unter der Navigation, nicht
          darin.

          Er ist kein Weg, sondern eine Angabe darüber, in wessen
          Auftrag die Seite gelesen wird — und er erscheint nur, wenn
          es etwas zu wechseln gibt. Bei einer einzigen Organisation
          wäre er ein Bedienelement ohne Wirkung.
        */}
        {orgs.length > 1 && (
          <div className="border-b border-line">
            <div className="mx-auto w-full max-w-(--breite-inhalt) px-5 py-2.5 md:px-8">
              <OrgWechsel orgs={orgs} aktivId={aktiv?.organizationId ?? null} />
            </div>
          </div>
        )}

        <main id="inhalt" className="mx-auto w-full max-w-(--breite-inhalt) flex-1 px-5 py-10 md:px-8">
          {children}
        </main>

        <VelvovaFooter laender={laender} />
        <HilfeKnopf assistantName={brand.assistantName} />
      </div>
    </BestandProvider>
  );
}
