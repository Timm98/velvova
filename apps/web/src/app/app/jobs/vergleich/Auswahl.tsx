"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

/**
 * Welche Stellen verglichen werden.
 *
 * Nur gemerkte: Eine Suche über 1.500 Anzeigen an dieser Stelle wäre
 * eine zweite Jobsuche in der Jobsuche. Wer vergleichen will, hat sich
 * vorher entschieden, was infrage kommt — dafür gibt es „Merken".
 */
export function Auswahl({
  gemerkte,
  ausgewaehlt,
  zeigtVergleich,
}: {
  gemerkte: { id: string; titel: string; firma: string }[];
  ausgewaehlt: string[];
  /** Ob unter der Auswahl gerade eine Tabelle steht. */
  zeigtVergleich: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();

  if (gemerkte.length === 0) {
    /*
     * Zwei verschiedene Lagen, zwei verschiedene Sätze.
     *
     * Wer über einen Verweis mit Kennungen hierherkommt, sieht unten
     * eine funktionierende Tabelle. „Du hast noch keine Stellen
     * gemerkt" darüber liest sich dann wie ein Fehler — die Tabelle
     * steht ja da. Gemeint ist etwas anderes: Zum Wechseln der Auswahl
     * braucht es gespeicherte Stellen.
     */
    return (
      <p className="max-w-[var(--measure)] rounded-(--radius-surface) bg-soft p-5 text-sm leading-relaxed text-ink-2">
        {zeigtVergleich
          ? "Diese Stellen hast du nicht gespeichert. Speichere sie in der Stellenliste, dann kannst du die Auswahl hier ändern."
          : "Du hast noch keine Stellen gespeichert. Speichere zwei, die du gegeneinander abwägst — dann stehen sie hier nebeneinander."}{" "}
        <Link href="/app/jobs" className="text-accent-text underline underline-offset-[3px]">
          Zur Stellenliste
        </Link>
      </p>
    );
  }

  function umschalten(id: string) {
    const jetzt = new Set(ausgewaehlt);
    if (jetzt.has(id)) jetzt.delete(id);
    /*
     * Bei drei ausgewählten passiert beim Klick auf eine vierte nichts.
     *
     * Die Alternative wäre, die älteste stillschweigend zu entfernen —
     * dann verschwindet eine Spalte, die jemand gerade liest, und es
     * sieht nach einem Fehler aus. Das Kästchen ist stattdessen
     * deaktiviert und sagt, warum.
     */
    else if (jetzt.size < 3) jetzt.add(id);
    else return;

    const neu = new URLSearchParams(params.toString());
    if (jetzt.size === 0) neu.delete("ids");
    else neu.set("ids", [...jetzt].join(","));
    router.replace(`/app/jobs/vergleich?${neu.toString()}`, { scroll: false });
  }

  const voll = ausgewaehlt.length >= 3;

  return (
    <fieldset className="grid gap-3">
      <legend className="text-sm font-medium">
        Gemerkte Stellen{" "}
        <span className="font-normal text-ink-3">
          — höchstens drei{voll ? ", drei ausgewählt" : ""}
        </span>
      </legend>
      <ul className="flex flex-wrap gap-2">
        {gemerkte.map((g) => {
          const an = ausgewaehlt.includes(g.id);
          const gesperrt = !an && voll;
          return (
            <li key={g.id}>
              <label
                className={
                  "flex max-w-[18rem] cursor-pointer items-start gap-2.5 rounded-(--radius-md) px-3.5 py-2.5 ring-1 transition-colors " +
                  (an
                    ? "bg-accent-soft ring-accent"
                    : gesperrt
                      ? "cursor-not-allowed bg-inset text-ink-3 ring-line"
                      : "bg-surface ring-line hover:bg-soft")
                }
                title={gesperrt ? "Höchstens drei Stellen nebeneinander." : undefined}
              >
                <input
                  type="checkbox"
                  checked={an}
                  disabled={gesperrt}
                  onChange={() => umschalten(g.id)}
                  className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
                />
                <span className="grid gap-0.5">
                  <span className="text-sm leading-snug">{g.titel}</span>
                  <span className="text-2xs text-ink-2">{g.firma}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
