import type { Metadata } from "next";
import { arbeitgeberKontext } from "@/lib/arbeitgeber/zugang";
import { angabenLaden, gespraechHolen, verlaufLaden } from "@/lib/arbeitgeber/onboarding/angaben";
import { ERSTER_ZUG, naechsterZug } from "@/lib/arbeitgeber/onboarding/fuehrung";
import { Gespraech } from "./Gespraech";

export const metadata: Metadata = { title: "Stelle einrichten" };
export const dynamic = "force-dynamic";

/**
 * Das Onboarding.
 *
 * ── Warum der Verlauf vom Server kommt ────────────────────────
 *
 * Wer den Browser schliesst und morgen wiederkommt, findet das
 * Gespräch dort vor, wo es aufgehört hat. Ein Gespräch, das nur im
 * Arbeitsspeicher lebt, verlangt beim zweiten Besuch dieselben
 * Antworten noch einmal — und das ist genau die Erfahrung, die dieses
 * Onboarding ersetzen soll.
 */
export default async function OnboardingPage() {
  const { user, organisation } = await arbeitgeberKontext();

  const gespraech = await gespraechHolen({
    organizationId: organisation.organizationId,
    userId: user.id,
  });

  const [angaben, verlauf] = await Promise.all([
    angabenLaden(gespraech.id, user.id),
    verlaufLaden(gespraech.id, user.id),
  ]);

  /* Beim ersten Besuch die Begrüssung, sonst die Frage, die zum
     aktuellen Stand gehört — nicht die letzte gespeicherte. Wer
     zwischendurch rechts etwas eingetragen hat, soll nicht noch
     einmal danach gefragt werden. */
  const frage =
    verlauf.length === 0
      ? ERSTER_ZUG.text
      : naechsterZug({ angaben }).text;

  return (
    <main className="mx-auto w-full max-w-[1180px] px-4 py-8 sm:px-6">
      <header className="grid gap-1 pb-5">
        <h1 className="text-xl font-600 text-ink">Stelle einrichten</h1>
        <p className="max-w-[62ch] text-sm text-ink-2">
          Erzähl Nina von der Stelle. Aus einem Gespräch entstehen vier Dinge —
          eure Unternehmensseite, die Anzeige, die Matching-Regeln und der
          Bewerbungsablauf. Rechts siehst du live, was daraus wird.
        </p>
      </header>

      <Gespraech
        startVerlauf={verlauf.map((n) => ({ rolle: n.rolle as "nina" | "mensch", text: n.text }))}
        startAngaben={angaben}
        startFrage={frage}
      />
    </main>
  );
}
