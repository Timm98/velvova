import type { Metadata } from "next";
import { getPageContext } from "@/lib/locale";
import { PageHeader } from "@/components/ui/states";
import { Disclosure } from "@/components/ui";
import { ImportForm } from "./ImportForm";

export const metadata: Metadata = { title: "Job-Link analysieren" };
export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const { brand } = await getPageContext();

  return (
    <div className="grid max-w-[860px] gap-8">
      <PageHeader
        eyebrow="Stellen"
        title="Job-Link analysieren"
        lead={`Du hast eine Stelle woanders gefunden? Füge die Adresse ein. ${brand.assistantName} sagt dir, ob wir sie abrufen dürfen — und wenn nicht, wie es trotzdem geht.`}
      />

      <ImportForm assistantName={brand.assistantName} />

      <Disclosure summary="Warum wird nicht einfach jede Seite abgerufen?">
        <div className="grid gap-3 text-sm leading-relaxed text-ink-2">
          <p>
            Eine Stellenanzeige gehört dem, der sie geschrieben hat. Viele Portale erlauben
            ausdrücklich nicht, dass Dritte ihre Inhalte automatisch abrufen und weiterverwenden —
            und daran halten wir uns, auch wenn es technisch ginge.
          </p>
          <p>
            Etwas <span className="font-medium text-ink">umzuformulieren</span> ändert daran
            nichts. Fremde Inhalte durch ein Sprachmodell laufen zu lassen macht sie nicht zu
            eigenen.
          </p>
          <p>
            Was du selbst liest und hierher kopierst, ist etwas anderes: das ist deine Recherche.
            Sie bleibt privat, erscheint in keiner öffentlichen Liste und wird nicht in unseren
            Stellenindex übernommen.
          </p>
        </div>
      </Disclosure>
    </div>
  );
}
