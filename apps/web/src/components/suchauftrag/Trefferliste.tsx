import Link from "next/link";
import { CircleHelp } from "lucide-react";
import { gruppenhinweisTrennen } from "@paycheck/domain";
import type { Trefferansicht } from "@/lib/suchauftrag/aktionen";

/**
 * Was Monday gefunden hat.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum der Grund direkt unter dem Titel steht
 * ══════════════════════════════════════════════════════════════
 *
 * Weil das die Frage ist, mit der jemand auf diese Liste schaut:
 * „Warum die?" Eine Liste aus Titeln und Zahlen beantwortet sie nicht
 * — sie verlangt, dass man jede Stelle öffnet, um es herauszufinden.
 *
 * Der Grund ist derselbe, der in der Mail stünde: ein belegter Satz
 * aus der gespeicherten Prüfung, nicht ein neu formulierter.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum ohne Fit-Zahl kein Platzhalter steht
 * ══════════════════════════════════════════════════════════════
 *
 * Ein Strich oder eine 0 sähen aus wie ein Urteil. Fehlt die Zahl,
 * fehlt sie — die Stelle steht trotzdem da, mit dem, was belegt ist.
 */
export function Trefferliste({
  treffer,
  art,
}: {
  treffer: Trefferansicht[];
  /** `empfehlung` oder `frage` — das ändert, was betont wird. */
  art: "empfehlung" | "frage";
}) {
  return (
    <ul className="grid gap-px overflow-hidden rounded-(--radius-surface) bg-line">
      {treffer.map((t) => (
        <li key={t.trefferId} className="bg-raised px-4 py-3.5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <Link
              href={`/app/jobs?job=${t.jobId}`}
              className="text-[0.95rem] font-medium text-ink underline-offset-2 hover:underline"
            >
              {t.titel}
            </Link>
            {t.fitScore !== null && (
              <span className="font-mono text-2xs tabular-nums text-ink-3">{t.fitScore}</span>
            )}
          </div>

          <p className="mt-0.5 text-2xs text-ink-3">
            {[t.arbeitgeber, t.ort].filter(Boolean).join(" · ")}
            {t.gehalt && <> · {t.gehalt}</>}
          </p>

          {art === "empfehlung" ? (
            <>
              {t.gruende.length > 0 && (
                <p className="mt-2 text-sm leading-relaxed text-ink-2">{t.gruende.join(" ")}</p>
              )}
              {/*
                Der Vorbehalt steht nur da, wenn es einen gibt. Ein
                Platzhalter — „keine Nachteile bekannt" — wäre eine
                Aussage über etwas, das niemand geprüft hat.
              */}
              {t.caveat && (
                <p className="mt-1.5 text-2xs leading-relaxed text-caution">Offen: {t.caveat}</p>
              )}
            </>
          ) : (
            <>
              {/*
                Der Gruppenhinweis ist ein Satz, die übrigen offenen
                Punkte sind Feldnamen. Zusammengeworfen entstünde
                „Zu Andere Berufsgruppe: … sagt die Anzeige nichts" —
                deshalb trennt `gruppenhinweisTrennen` sie hier.
              */}
              <p className="mt-2 flex gap-1.5 text-sm leading-relaxed text-ink-2">
                <CircleHelp aria-hidden className="mt-0.5 size-3.5 shrink-0 text-ink-3" />
                <span>
                  {t.caveat ??
                    `Zu ${gruppenhinweisTrennen(t.offenePunkte).uebrige.join(" und ")} sagt die Anzeige nichts.`}
                </span>
              </p>
              {gruppenhinweisTrennen(t.offenePunkte).hinweis && (
                <p className="mt-1 text-2xs leading-relaxed text-caution">
                  {gruppenhinweisTrennen(t.offenePunkte).hinweis}
                </p>
              )}
              {gruppenhinweisTrennen(t.offenePunkte).uebrige.length > 0 && (
                <p className="mt-1 text-2xs text-ink-3">
                  Ungeklärt: {gruppenhinweisTrennen(t.offenePunkte).uebrige.map(feldname).join(", ")}
                </p>
              )}
            </>
          )}

          <p className="mt-2 text-2xs text-ink-3">
            {t.auftragName}
            {t.bereitsGemeldet && <> · schon gemeldet</>}
          </p>
        </li>
      ))}
    </ul>
  );
}

/** Der Schlüssel eines Kriteriums, wie ein Mensch ihn nennt. */
function feldname(schluessel: string): string {
  const namen: Record<string, string> = {
    mindestgehalt: "Gehalt",
    arbeitsort: "Arbeitsort",
    arbeitsmodell: "Arbeitsmodell",
    vertragsform: "Vertragsform",
    wochenstunden: "Arbeitszeit",
    schichtarbeit: "Schichtarbeit",
    befristung: "Befristung",
    reisebereitschaft: "Reiseanteil",
    erfahrungsniveau: "Erfahrung",
    pendelzeit: "Fahrtzeit",
    taetigkeit: "Tätigkeit",
    lizenz: "Nachweise",
    sprache: "Sprache",
  };
  /* Bei einer ODER-Gruppe stehen mehrere Schlüssel zusammen. */
  return schluessel
    .split(" oder ")
    .map((s) => namen[s] ?? s)
    .join(" oder ");
}
