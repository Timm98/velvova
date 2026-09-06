"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { emailBestaetigen } from "@/lib/suchauftrag/benachrichtigung";

/**
 * Der Knopf, der bestätigt.
 *
 * Er ist der einzige Weg. Das Öffnen der Seite tut nichts — siehe die
 * Begründung eine Datei weiter oben.
 */
export function BestaetigenKnopf({ token }: { token: string }) {
  const [laeuft, starten] = useTransition();
  const [fertig, setFertig] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  if (fertig !== null) {
    return (
      <div className="grid gap-2">
        <p className="flex items-center gap-2 text-[0.95rem] font-medium">
          <Check aria-hidden className="size-4 text-positive" />
          Bestätigt.
        </p>
        <p className="text-[0.95rem] leading-relaxed text-muted">
          {fertig
            ? `Ab jetzt gehen deine Zusammenfassungen an ${fertig}.`
            : "Ab jetzt gehen deine Zusammenfassungen an diese Adresse."}{" "}
          <Link href="/app/suchauftraege" className="underline underline-offset-2">
            Zu deinen Suchaufträgen
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        disabled={laeuft}
        onClick={() =>
          starten(async () => {
            const r = await emailBestaetigen(token);
            if (r.ok) setFertig(r.adresse);
            else
              setFehler(
                r.grund === "verbraucht"
                  ? "Diese Bestätigung wurde schon verwendet — oder du hast inzwischen eine andere Adresse eingetragen."
                  : "Das hat gerade nicht geklappt.",
              );
          })
        }
        className="justify-self-start rounded-(--radius-md) bg-fg px-5 py-2.5 text-sm font-medium text-bg disabled:opacity-60"
      >
        Ja, Jobmails einschalten
      </button>
      {fehler && <p className="text-2xs text-muted">{fehler}</p>}
    </div>
  );
}
