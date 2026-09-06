import type { Metadata } from "next";
import { tokenPruefen } from "@/lib/suchauftrag/abmeldung";

export const metadata: Metadata = { title: "E-Mails abbestellen", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Die Bestätigungsseite der Abmeldung.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum hier ein Knopf steht und nicht schon die Bestätigung
 * ══════════════════════════════════════════════════════════════
 *
 * Weil Postfächer Links anklicken, bevor ein Mensch sie sieht.
 * Virenscanner und Vorschaudienste holen jede Adresse in einer Mail
 * ab. Meldete diese Seite beim Aufruf ab, verlöre eine Person ihre
 * Benachrichtigungen, ohne je etwas getan zu haben — und sie könnte
 * es sich nicht erklären.
 *
 * Der Knopf schickt ein POST. Das tut kein Scanner.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das Formular ohne JavaScript funktioniert
 * ══════════════════════════════════════════════════════════════
 *
 * Diese Seite erreicht jemand aus einer Mail heraus, oft auf einem
 * fremden Gerät, manchmal in einem eingeschränkten Browser. Eine
 * Abmeldung, die ein Bündel braucht, ist eine Abmeldung, die manchmal
 * nicht geht — und das ist die eine Funktion, die immer gehen muss.
 */
export default async function AbmeldenSeite({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;
  const token = (t ?? "").trim();
  const befund = token ? await tokenPruefen(token) : ({ ok: false, grund: "unbekannt" } as const);

  return (
    <div className="mx-auto grid max-w-[34rem] gap-6 py-16">
      <h1 className="font-display text-[2rem] font-medium leading-[1.1] tracking-[-0.02em]">
        Keine Jobmails mehr
      </h1>

      {befund.ok ? (
        <>
          <p className="text-[0.95rem] leading-relaxed text-muted">
            {befund.adresse
              ? `Wir stellen die Zusammenfassungen an ${befund.adresse} ab.`
              : "Wir stellen die Zusammenfassungen ab."}{" "}
            Deine Suche läuft weiter — die Treffer findest du weiterhin in Velvova.
          </p>

          <form method="post" action="/api/abmelden" className="grid gap-4">
            <input type="hidden" name="t" value={token} />
            <button
              type="submit"
              className="justify-self-start rounded-(--radius-md) bg-fg px-5 py-2.5 text-sm font-medium text-bg"
            >
              E-Mails abbestellen
            </button>
          </form>

          <p className="text-2xs text-muted">
            Wenn du stattdessen die ganze Suche beenden möchtest, geht das angemeldet unter
            „Suchaufträge“.
          </p>
        </>
      ) : (
        <p className="text-[0.95rem] leading-relaxed text-muted">
          {befund.grund === "abgelaufen"
            ? "Dieser Link ist abgelaufen. Melde dich an, um deine Benachrichtigungen zu ändern."
            : "Dieser Link gilt nicht. Melde dich an, um deine Benachrichtigungen zu ändern."}
        </p>
      )}
    </div>
  );
}
