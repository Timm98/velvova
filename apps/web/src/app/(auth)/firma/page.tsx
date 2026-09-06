import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { meineOrganisationen } from "@/lib/arbeitgeber/zugang";
import { GruendenFormular } from "./GruendenFormular";
import { Karte, Titel } from "../Karte";

export const metadata: Metadata = { title: "Firmenkonto anlegen" };
export const dynamic = "force-dynamic";

/**
 * Schritt drei: das Unternehmen anlegen.
 *
 * ── Warum diese Seite im Anmelderahmen liegt ──────────────────
 *
 * Sie lag unter `/business/einrichten`, also im Arbeitgeberrahmen —
 * mit Kopfzeile, Bereichsnavigation und Fortschrittsleiste darüber.
 * Das ist der Rahmen für jemanden, der schon drin ist; hier ist noch
 * niemand drin. Es gab auch nichts zu navigieren: Ohne Organisation
 * führt jeder Punkt der Bereichsnavigation zurück auf diese Seite.
 *
 * Im Anmelderahmen steht dieselbe Karte wie bei Anmeldung und
 * Registrierung — gleiche Breite, gleiche Rundung, gleicher
 * Innenabstand. Wer die Strecke durchläuft, sieht dreimal dieselbe
 * Fläche mit anderem Inhalt statt dreimal ein anderes Produkt.
 */
export default async function FirmaAnlegenPage() {
  const user = await requireUser();
  const orgs = await meineOrganisationen(user.id);
  /* Wer schon eine Organisation hat, hat diesen Schritt hinter sich.
     Ihn vor ein Formular zu stellen, das eine zweite anlegen würde,
     ist die falsche Voreinstellung. */
  if (orgs.length > 0) redirect("/business");

  return (
    <div className="grid gap-5">
      <Karte>
        <Titel>Firmenkonto anlegen</Titel>

        <p className="text-[15px] leading-relaxed text-ink-2">
          Für Unternehmen, die selbst ausschreiben. Ihr legt Stellen an, bekommt Bewerbungen und
          arbeitet mit Kolleginnen daran — getrennt von eurer eigenen Jobsuche.
        </p>

        <GruendenFormular />
      </Karte>

      {/*
        Der Hinweis steht unter der Karte, nicht darin. Er gehört nicht
        zum Vorgang, sondern zu dem, was danach gilt.
      */}
      <p className="text-center text-xs leading-relaxed text-ink-3">
        Veröffentlichen könnt ihr, sobald wir die Zugehörigkeit zum Unternehmen bestätigt haben.
        Bis dahin sind eure Stellen Entwürfe und für niemanden ausserhalb sichtbar.
      </p>
    </div>
  );
}
