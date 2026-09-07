import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { musstZeigen, standLaden } from "@/lib/nina/einrichtung/speicher";
import { weiterZu } from "@/lib/nina/einrichtung/texte";
import { Einrichtung } from "./Einrichtung";

export const metadata: Metadata = { title: "Monday einrichten" };
export const dynamic = "force-dynamic";

/**
 * Der erste Bildschirm nach der Bestätigung.
 *
 * ── Warum die Seite sich selbst überspringt ───────────────────
 *
 * Wer schon eingerichtet hat, wird weitergeschickt. Die Prüfung steht
 * hier und nicht nur in der aufrufenden Weiterleitung: Die Adresse
 * ist aufrufbar, und eine Einwilligungsseite, die einem
 * eingerichteten Konto erneut erscheint, sammelt Zustimmungen, die
 * niemand gelesen hat.
 *
 * Erneut erscheint sie nur bei einer neuen Textfassung oder nach
 * einem Widerruf — beides prüft `musstZeigen`.
 */
export default async function NinaEinrichtenPage() {
  const user = await requireUser();

  /* Unbestätigt gehört niemand hierher: Diese Seite kommt NACH der
     Bestätigung, sonst wäre sie ein Weg daran vorbei. */
  if (!user.emailVerifiedAt) redirect("/bestaetigen");

  const stand = await standLaden(user.id);
  if (!musstZeigen(stand)) redirect(weiterZu(stand.kontotyp));

  return (
    <main className="mx-auto w-full max-w-[1080px] px-5 py-10 md:px-8 md:py-14">
      <Einrichtung
        start={{
          kontotyp: stand.kontotyp,
          bedienart: stand.bedienart,
          sprachspeicherung: stand.sprachspeicherung,
          stufe: stand.stufe,
          briefingAktiv: stand.briefingAktiv,
          briefingRhythmus: stand.briefingRhythmus,
          briefingZeit: stand.briefingZeit,
          zeitzone: stand.zeitzone,
          kanaele: stand.kanaele,
        }}
      />
    </main>
  );
}
