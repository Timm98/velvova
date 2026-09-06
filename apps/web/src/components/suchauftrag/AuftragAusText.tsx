"use client";

import { useState, useTransition } from "react";
import { MessageSquarePlus } from "lucide-react";
import { Button, Card, Input } from "@/components/ui";
import { auftragBestaetigen, suchauftragAusText } from "@/lib/suchauftrag/aktionen";

/**
 * „Such für mich weiter nach …"
 *
 * ══════════════════════════════════════════════════════════════
 * Warum ein Satz und kein Formular
 * ══════════════════════════════════════════════════════════════
 *
 * Ein Formular verlangt, dass jemand seine Suche in Felder zerlegt,
 * bevor er sie gedacht hat. „Lagerstellen in Karlsruhe, mindestens
 * 32.000, keine Nachtschicht" ist ein Satz, den man in fünf Sekunden
 * sagt und in einem Formular in zwei Minuten zusammenklickt.
 *
 * Dasselbe Feld bedient Nina im Gespräch und per Sprache — es ruft die
 * gleiche Aktion.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum danach ein Entwurf steht und kein laufender Auftrag
 * ══════════════════════════════════════════════════════════════
 *
 * Weil ein gesprochener Satz mehrdeutig ist. „Nur noch Teilzeit" kann
 * ab jetzt heissen, für diese Suche oder für heute. Der Entwurf zeigt,
 * was verstanden wurde — und wer es bestätigt, weiss wozu.
 *
 * Was nicht verstanden wurde, steht auch da. Ein Kriterium, das
 * stillschweigend wegfällt, ist der Fall, in dem jemand wochenlang auf
 * Stellen wartet, die seiner Bedingung entsprechen — einer Bedingung,
 * die nie gespeichert wurde.
 */
export function AuftragAusText({ modellBereit }: { modellBereit: boolean }) {
  const [satz, setSatz] = useState("");
  const [laeuft, starten] = useTransition();
  const [entwurf, setEntwurf] = useState<{
    id: string;
    text: string;
    rueckfrage: string | null;
    kriterien: string[];
    verworfen: string[];
    ohneTaetigkeit: boolean;
  } | null>(null);
  const [aktiv, setAktiv] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  /*
   * Ohne Modell wird das Feld nicht angeboten.
   *
   * Ein Eingabefeld, das nichts tut, ist schlimmer als keines: Wer
   * hineinschreibt und nichts bekommt, sucht den Fehler bei sich.
   */
  if (!modellBereit) return null;

  if (aktiv) {
    return (
      <Card>
        <p className="text-sm leading-relaxed text-ink-2">
          Läuft. Nina prüft von jetzt an neue Stellen dagegen und legt dir hin, was passt.
        </p>
      </Card>
    );
  }

  if (entwurf) {
    return (
      <Card>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <h3 className="text-base font-semibold text-ink">So habe ich dich verstanden</h3>
            <ul className="flex flex-wrap gap-1.5">
              {entwurf.kriterien.map((k) => (
                <li key={k} className="rounded-(--radius-sm) bg-sunken px-2 py-1 text-2xs text-ink-2">
                  {k}
                </li>
              ))}
            </ul>
            <p className="max-w-[var(--measure)] text-2xs leading-relaxed text-ink-3">
              {entwurf.text}
            </p>
            {entwurf.rueckfrage && (
              <p className="max-w-[var(--measure)] text-sm leading-relaxed text-caution">
                {entwurf.rueckfrage}
              </p>
            )}
            {entwurf.ohneTaetigkeit && (
              /*
               * Eine Suche ohne Tätigkeit findet jede Stelle am Ort.
               * Das kann gewollt sein — aber nicht versehentlich.
               */
              <p className="max-w-[var(--measure)] text-sm leading-relaxed text-caution">
                Eine Tätigkeit habe ich nicht herausgehört. So suche ich alle Berufe, die zu den
                übrigen Angaben passen. Ist das gewollt?
              </p>
            )}
            {entwurf.verworfen.length > 0 && (
              /*
               * Was wegfiel, steht da. Ein stillschweigend verworfenes
               * Kriterium ist der Fall, in dem jemand auf etwas wartet,
               * das nie gespeichert wurde.
               */
              <p className="max-w-[var(--measure)] text-2xs leading-relaxed text-ink-3">
                Dafür habe ich keine Prüfung: {entwurf.verworfen.join(", ")}. Das kann ich nicht
                zusagen — sag es mir anders, oder lass es weg.
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              disabled={laeuft}
              onClick={() =>
                starten(async () => {
                  const r = await auftragBestaetigen(entwurf.id);
                  if (r.ok) setAktiv(true);
                  else setFehler("Das hat gerade nicht geklappt.");
                })
              }
            >
              Ja, so suchen
            </Button>
            <Button variant="ghost" disabled={laeuft} onClick={() => setEntwurf(null)}>
              Nicht aktivieren
            </Button>
          </div>
          {fehler && <p className="text-2xs text-ink-2">{fehler}</p>}
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
            <MessageSquarePlus aria-hidden className="size-4 text-ink-3" />
            Sag Nina, wonach sie suchen soll
          </h3>
          <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
            In einem Satz, so wie du es sagen würdest. Sie zeigt dir danach, was sie verstanden
            hat — und sucht erst, wenn du zustimmst.
          </p>
        </div>
        <div className="grid gap-2">
          <Input
            value={satz}
            onChange={(e) => setSatz(e.target.value)}
            placeholder="Lagerstellen in Karlsruhe, mindestens 32.000, keine Nachtschicht"
            aria-label="Wonach soll Nina suchen?"
          />
          <Button
            variant="primary"
            disabled={laeuft || satz.trim().length < 10}
            onClick={() =>
              starten(async () => {
                setFehler(null);
                const r = await suchauftragAusText(satz.trim(), "chat");
                if (r.ok) {
                  setEntwurf({
                    id: r.auftragId,
                    text: r.bestaetigungstext,
                    rueckfrage: r.rueckfrage,
                    kriterien: r.kriterien,
                    verworfen: r.verworfen,
                    ohneTaetigkeit: r.ohneTaetigkeit,
                  });
                  setSatz("");
                } else setFehler(grundText(r.grund));
              })
            }
          >
            Verstehen lassen
          </Button>
          {fehler && <p className="text-2xs text-ink-3">{fehler}</p>}
        </div>
      </div>
    </Card>
  );
}

function grundText(grund: string): string {
  switch (grund) {
    case "nichts_erkannt":
      return "Daraus konnte ich keine Bedingung ableiten. Nenn mir am besten Tätigkeit, Ort oder Gehalt.";
    case "budget":
      return "Heute geht das nicht mehr. Stell die Suche solange über die Filter ein.";
    case "kein_modell":
      return "Das ist auf diesem Server nicht eingerichtet.";
    default:
      return "Das hat gerade nicht geklappt.";
  }
}
