import type { Metadata } from "next";
import { eigeninitiativeStand } from "@/lib/proaktiv/aktionen";
import { Eigeninitiative } from "@/components/proaktiv/Eigeninitiative";

export const metadata: Metadata = { title: "Mondays Eigeninitiative" };
export const dynamic = "force-dynamic";

/**
 * Wie viel Monday von sich aus tun darf.
 *
 * ── Warum das eine eigene Seite ist ───────────────────────────
 *
 * Weil es eine Frage ist, die man einmal beantwortet und danach
 * wiederfinden will. Unter „Benachrichtigungen" wäre sie eine
 * Einstellung über Nachrichten — es geht aber auch um Handlungen.
 */
export default async function NinaEinstellungen() {
  const stand = await eigeninitiativeStand();

  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold text-ink">Mondays Eigeninitiative</h1>
        <p className="max-w-[var(--measure)] leading-relaxed text-ink-2">
          Monday kann kleine Dinge von selbst erledigen — etwa eine Stelle vormerken, die du dir
          mehrfach angesehen hast. Alles davon lässt sich zurücknehmen, und du siehst immer, warum
          sie es getan hat.
        </p>
      </div>
      <Eigeninitiative stand={stand} />
    </div>
  );
}
