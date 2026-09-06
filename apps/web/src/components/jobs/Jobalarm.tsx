"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Bell, Check, ShieldCheck } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { auftragBestaetigen, suchauftragAusFiltern } from "@/lib/suchauftrag/aktionen";

/**
 * „Diese Suche von Nina weiterführen lassen."
 *
 * ══════════════════════════════════════════════════════════════
 * Was hier vorher nicht stimmte
 * ══════════════════════════════════════════════════════════════
 *
 * Der Knopf schrieb eine Zeile nach `job_alarme` — eine Tabelle, die
 * niemand las. Der Text sagte das immerhin offen („die
 * Benachrichtigung wird gerade eingerichtet"), aber die Suche lief
 * trotzdem nicht: Es gab keinen Dienst, der sie ausgeführt hätte.
 *
 * Jetzt entsteht ein echter Suchauftrag mit Kriterien, den der
 * Hintergrunddienst abarbeitet.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum zwei Schritte
 * ══════════════════════════════════════════════════════════════
 *
 * Ein Klick auf einen Filter ist eine Handlung, keine Aussage — er
 * kann eine Erkundung sein. Der erste Schritt legt deshalb einen
 * Entwurf an und zeigt, was gelten würde; erst der zweite lässt ihn
 * gelten.
 *
 * Das ist keine zusätzliche Hürde, sondern der Unterschied zwischen
 * „ich habe etwas angeklickt" und „ich habe zugestimmt". Ohne ihn
 * müsste später jemand belegen, wann die Zustimmung erfolgt sein soll.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum hier keine Adresse mehr abgefragt wird
 * ══════════════════════════════════════════════════════════════
 *
 * Weil E-Mail eine dritte Entscheidung ist, und sie braucht eine
 * bestätigte Adresse. Ein Feld, das eine Adresse annimmt, ohne dass
 * je etwas hinausgeht, ist genau die Erfolgsmeldung ohne Wirkung, die
 * dieses Produkt nicht haben soll. Der Auftrag läuft in Velvova; die
 * Mail schaltet man in den Suchaufträgen dazu.
 */
export function Jobalarm({
  params,
  vorschlag,
}: {
  /** Die aktuellen Filter — daraus werden die Kriterien. */
  params: Record<string, string | undefined>;
  vorschlag: string;
}) {
  const [laeuft, starten] = useTransition();
  const [entwurf, setEntwurf] = useState<{ id: string; name: string } | null>(null);
  const [aktiv, setAktiv] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  if (aktiv) {
    return (
      <Card>
        <div className="grid gap-1.5">
          <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
            <Check aria-hidden className="size-4 text-positive" />
            Nina sucht ab jetzt weiter.
          </h2>
          <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
            Der Auftrag läuft unter{" "}
            <strong className="font-medium text-ink">{entwurf?.name ?? vorschlag}</strong>. Neue
            Stellen prüft sie dagegen und legt dir hin, was passt.
          </p>
          <p className="max-w-[var(--measure)] text-2xs leading-relaxed text-ink-3">
            Ändern, pausieren oder E-Mails dazuschalten kannst du unter{" "}
            <Link href="/app/suchauftraege" className="underline underline-offset-2">
              Suchaufträge
            </Link>
            .
          </p>
        </div>
      </Card>
    );
  }

  if (entwurf) {
    return (
      <Card>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <h2 className="text-base font-semibold text-ink">So würde Nina weitersuchen</h2>
            <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
              <strong className="font-medium text-ink">{entwurf.name}</strong> — mit den Filtern,
              die du gerade gesetzt hast. Nichts davon ist bisher aktiv.
            </p>
            <p className="max-w-[var(--measure)] text-2xs leading-relaxed text-ink-3">
              Die Treffer bleiben in Velvova. E-Mails sind aus, bis du sie einschaltest.
            </p>
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
            <Button asChild variant="ghost">
              <Link href="/app/suchauftraege">Ändern</Link>
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
      <div className="grid gap-4">
        <div className="grid gap-2">
          <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
            <Bell aria-hidden className="size-4 text-ink-3" />
            Nina sucht weiter, auch wenn du nicht da bist.
          </h2>
          <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
            Sie merkt sich diese Suche und prüft von da an jede neue Stelle dagegen — Tag für
            Tag, ohne dass du etwas tun musst. Was nicht passt, siehst du nie. Was passt, legt
            sie dir hin und sagt dir, warum.
          </p>

          <p className="flex max-w-[var(--measure)] gap-2 rounded-(--radius-md) bg-sunken px-3 py-2.5 text-sm leading-relaxed text-ink-2">
            <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-positive" />
            <span>
              Dabei bleibst du anonym. Kein Unternehmen erfährt, wer du bist — bis du eine
              Chance siehst und selbst freigibst, dass Kontakt entstehen darf.
            </span>
          </p>
        </div>

        <div className="grid gap-1.5">
          <Button
            variant="primary"
            disabled={laeuft}
            onClick={() =>
              starten(async () => {
                const r = await suchauftragAusFiltern(params);
                if (r.ok && r.auftragId) setEntwurf({ id: r.auftragId, name: r.name ?? vorschlag });
                else setFehler("Für diese Suche fehlen noch Angaben — setze mindestens einen Filter.");
              })
            }
          >
            Diese Suche weiterführen lassen
          </Button>
          {fehler && <p className="text-2xs text-ink-3">{fehler}</p>}
        </div>
      </div>
    </Card>
  );
}
