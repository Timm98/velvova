import Link from "next/link";
import { MERKMAL_TEXT, type PremiumMerkmal } from "@/lib/billing/plaene";

/**
 * Der Hinweis auf Premium.
 *
 * Er erscheint an genau einer Sorte Stelle: dort, wo jemand gerade
 * etwas wollte, das Premium kann. Nicht auf der Startseite, nicht im
 * Header, nicht als Banner über der Jobliste.
 *
 * Der Ton ist der schwierige Teil. Ein Verkaufstext an dieser Stelle
 * wäre doppelt schlecht — er unterbricht jemanden mitten in seiner
 * Arbeit UND er klingt, als sei das Produkt an seinem Geld
 * interessierter als an seiner Frage. Deshalb:
 *
 *   - Was wäre möglich, in einem Satz.
 *   - Wozu es gut ist, in einem zweiten.
 *   - Ein Verweis, kein Knopf in Signalfarbe.
 *   - Kein Ausrufezeichen, kein „nur jetzt", keine Dringlichkeit.
 *
 * Die Fläche ist ruhig und liegt UNTER dem Inhalt, nicht darüber. Wer
 * nicht upgraden will, soll ihn überlesen können, ohne dass ihm etwas
 * fehlt.
 */
export function PremiumHinweis({
  merkmal,
  assistantName,
}: {
  merkmal: PremiumMerkmal;
  assistantName: string;
}) {
  const t = MERKMAL_TEXT[merkmal];

  return (
    <aside className="grid gap-1.5 rounded-(--radius-lg) bg-soft px-5 py-4">
      <p className="text-base leading-relaxed text-ink-2">
        {/*
          Ninas Formulierung, nicht die des Marketings: sie bietet an,
          was sie zusätzlich tun könnte, statt ein Produkt zu bewerben.
        */}
        Wenn du möchtest, kann {assistantName} das noch deutlich tiefer aufschlüsseln —{" "}
        {t.nutzen.charAt(0).toLowerCase() + t.nutzen.slice(1)}
      </p>
      <p>
        <Link
          href="/pricing"
          className="text-sm text-accent-text underline underline-offset-[3px]"
        >
          Was Premium sonst noch kann
        </Link>
      </p>
    </aside>
  );
}
