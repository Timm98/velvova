import Link from "next/link";
import { BERECHTIGUNG_AB, HINWEIS_TEXT, PLAENE, type Berechtigung } from "@/lib/billing/plaene";

/**
 * Ninas Hinweis auf eine Fähigkeit, die sie hier hätte.
 *
 * Er erscheint an genau einer Sorte Stelle: dort, wo jemand gerade
 * etwas wollte, das ein anderer Plan kann. Nicht auf der Startseite,
 * nicht im Header, nicht als Banner über der Jobliste, und nie als
 * Popup.
 *
 * Der Ton ist der schwierige Teil. Ein Verkaufstext an dieser Stelle
 * wäre doppelt schlecht — er unterbricht jemanden mitten in seiner
 * Arbeit UND er klingt, als sei das Produkt an seinem Geld
 * interessierter als an seiner Frage. Deshalb:
 *
 *   - Was Nina zusätzlich tun könnte, in einem Satz.
 *   - Ein Verweis, kein Knopf in Signalfarbe.
 *   - Kein Ausrufezeichen, kein „nur jetzt", keine Dringlichkeit,
 *     keine ablaufende Frist, kein Erfolgsversprechen.
 *
 * Die Fläche ist ruhig und liegt UNTER dem Inhalt, nicht darüber. Wer
 * nicht wechseln will, soll sie überlesen können, ohne dass ihm etwas
 * fehlt — und vor allem: die eigentliche Antwort steht bereits
 * darüber. Nina beantwortet die Frage zuerst und weist danach hin, nie
 * umgekehrt und nie statt einer Antwort.
 */
export function PremiumHinweis({
  fähigkeit,
  assistantName,
}: {
  fähigkeit: Berechtigung;
  assistantName: string;
}) {
  const t = HINWEIS_TEXT[fähigkeit];
  const noetig = PLAENE[BERECHTIGUNG_AB[fähigkeit]];

  return (
    <aside className="grid gap-2 rounded-(--radius-lg) bg-soft px-5 py-4">
      {/*
        Ninas Formulierung, nicht die des Marketings: sie bietet an, was
        sie zusätzlich tun könnte, statt ein Produkt zu bewerben. Der
        Satz steht in der ersten Person, weil er von ihr kommt.
      */}
      <p className="text-base leading-relaxed text-ink-2">{t.angebot}</p>
      <p>
        <Link
          href="/app/settings/abo"
          className="text-sm text-accent-text underline underline-offset-[3px]"
        >
          {t.titel} mit {noetig.name}
        </Link>
        <span className="sr-only">
          {" "}
          — {assistantName} kann das mit {noetig.name}.
        </span>
      </p>
    </aside>
  );
}
