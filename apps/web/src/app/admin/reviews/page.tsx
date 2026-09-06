import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getPageContext } from "@/lib/locale";
import { alleBewertungenFuerModeration } from "@/lib/reviews/aktionen";
import { ModerationsListe } from "./ModerationsListe";

export const metadata: Metadata = { title: "Bewertungen moderieren" };
export const dynamic = "force-dynamic";

/**
 * Bewertungen freigeben, ablehnen, kennzeichnen.
 *
 * Dieselbe Zugangsregel wie im übrigen Betriebsbereich: wer nicht
 * „operator" oder „admin" ist, bekommt 404 — nicht „kein Zugriff". Ein
 * 403 verrät, dass es die Seite gibt.
 *
 * Hier steht bewusst MEHR als auf der öffentlichen Seite: die
 * E-Mail-Adresse für Rückfragen, die Moderationsnotiz, der Zustand. Das
 * ist der einzige Ort, an dem diese Felder auftauchen — die öffentliche
 * Sicht `public_reviews` kennt sie gar nicht.
 */
export default async function AdminBewertungenPage() {
  const user = await requireUser();
  const { flags } = await getPageContext();

  if (!flags.adminArea || (user.role !== "operator" && user.role !== "admin")) {
    notFound();
  }

  const zeilen = await alleBewertungenFuerModeration();

  const offen = zeilen.filter((z) => z.status === "pending");
  const frei = zeilen.filter((z) => z.status === "approved");
  const abgelehnt = zeilen.filter((z) => z.status === "rejected");

  return (
    <main id="inhalt" className="mx-auto w-full max-w-[1100px] px-5 py-12 md:px-8">
      <h1 className="font-display text-2xl font-semibold tracking-[-0.02em]">
        Bewertungen moderieren
      </h1>
      <p className="mt-2 max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
        Nichts wird ohne Freigabe sichtbar. Was hier steht, ist der Text einer anderen Person —
        Tippfehler zu bereinigen ist in Ordnung, eine Aussage umzudeuten nicht.
      </p>

      <div className="mt-10 grid gap-12">
        <ModerationsListe
          titel={`Wartet auf Prüfung (${offen.length})`}
          hinweis="Diese Bewertungen sind nirgends sichtbar."
          zeilen={offen}
        />
        <ModerationsListe
          titel={`Freigegeben (${frei.length})`}
          hinweis="Öffentlich sichtbar auf der Startseite und unter /reviews."
          zeilen={frei}
        />
        <ModerationsListe
          titel={`Abgelehnt (${abgelehnt.length})`}
          hinweis="Bleiben gespeichert, damit die Entscheidung nachvollziehbar ist."
          zeilen={abgelehnt}
        />
      </div>
    </main>
  );
}
