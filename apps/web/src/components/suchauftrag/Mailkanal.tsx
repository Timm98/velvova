"use client";

import { useState, useTransition } from "react";
import { Check, Clock, Mail } from "lucide-react";
import { Button, Card, Input } from "@/components/ui";
import { emailAnmelden, type Mailstand } from "@/lib/suchauftrag/benachrichtigung";
import { mailsAusschalten } from "@/lib/suchauftrag/aktionen";

/**
 * Der Mailkanal — ein und aus.
 *
 * ══════════════════════════════════════════════════════════════
 * Vier Zustände, und jeder sagt die Wahrheit
 * ══════════════════════════════════════════════════════════════
 *
 *   Kein Versand eingerichtet   der Server kann keine Mail schicken
 *   Nichts eingetragen          es gibt keine Adresse
 *   Wartet auf Bestätigung      Adresse da, Klick fehlt
 *   Aktiv                       bestätigt, es geht etwas hinaus
 *
 * Der erste ist der wichtigste. Ein Formular, das eine Adresse
 * annimmt, obwohl auf diesem Server nie eine Mail hinausgeht, ist die
 * Erfolgsmeldung ohne Wirkung — und beim ersten ausbleibenden Hinweis
 * widerlegt.
 */
export function Mailkanal({ stand }: { stand: Mailstand }) {
  const [adresse, setAdresse] = useState(stand.adresse ?? "");
  const [laeuft, starten] = useTransition();
  const [meldung, setMeldung] = useState<string | null>(null);

  const gueltig = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(adresse.trim());

  /* ── Der Server kann gar nicht senden ─────────────────────── */
  if (stand.fehlt.length > 0) {
    return (
      <Card>
        <div className="grid gap-1.5">
          <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
            <Mail aria-hidden className="size-4 text-ink-3" />
            E-Mail noch nicht eingerichtet
          </h3>
          <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
            Auf diesem Server geht noch keine Mail hinaus. Deine Treffer sammelt Nina trotzdem —
            du findest sie hier, und es geht nichts verloren.
          </p>
        </div>
      </Card>
    );
  }

  /* ── Bestätigt und aktiv ──────────────────────────────────── */
  if (stand.aktiv && stand.bestaetigt) {
    return (
      <Card>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
              <Check aria-hidden className="size-4 text-positive" />
              Zusammenfassungen gehen an {stand.adresse}
            </h3>
            <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
              Nur wenn etwas Passendes dabei ist. Kein Treffer heisst keine Mail — eine tägliche
              Enttäuschung wäre keine Nachricht.
            </p>
          </div>
          <Button
            variant="ghost"
            disabled={laeuft}
            onClick={() =>
              starten(async () => {
                await mailsAusschalten();
                setMeldung("E-Mails sind aus. Die Suche läuft weiter.");
              })
            }
          >
            E-Mails aus
          </Button>
          {meldung && <p className="text-2xs text-ink-2">{meldung}</p>}
        </div>
      </Card>
    );
  }

  /* ── Wartet auf den Klick ─────────────────────────────────── */
  if (stand.wartetSeit !== null) {
    return (
      <Card>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
              <Clock aria-hidden className="size-4 text-ink-3" />
              Bestätigung offen
            </h3>
            <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
              Wir haben {stand.adresse} eine Mail geschickt. Bis du dort bestätigst, geht keine
              Zusammenfassung hinaus.
            </p>
          </div>
          <div className="grid gap-2">
            <Input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={adresse}
              onChange={(e) => setAdresse(e.target.value)}
              aria-label="Andere Adresse"
            />
            <Button
              variant="ghost"
              disabled={laeuft || !gueltig}
              onClick={() =>
                starten(async () => {
                  const r = await emailAnmelden(adresse);
                  setMeldung(
                    r.ok
                      ? "Neue Bestätigungsmail unterwegs."
                      : "Diese Adresse konnten wir nicht eintragen.",
                  );
                })
              }
            >
              Noch einmal senden
            </Button>
            {meldung && <p className="text-2xs text-ink-2">{meldung}</p>}
          </div>
        </div>
      </Card>
    );
  }

  /* ── Nichts eingetragen ───────────────────────────────────── */
  return (
    <Card>
      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
            <Mail aria-hidden className="size-4 text-ink-3" />
            Treffer auch per E-Mail?
          </h3>
          <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
            Eine kurze Zusammenfassung am Morgen — und nur dann, wenn etwas Passendes dabei ist.
            Wir schicken dir zuerst eine Bestätigung; erst danach geht etwas hinaus.
          </p>
        </div>
        <div className="grid gap-2">
          <Input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={adresse}
            onChange={(e) => setAdresse(e.target.value)}
            placeholder="du@beispiel.de"
            aria-label="Adresse für Zusammenfassungen"
          />
          <Button
            variant="primary"
            disabled={laeuft || !gueltig}
            onClick={() =>
              starten(async () => {
                const r = await emailAnmelden(adresse);
                setMeldung(
                  r.ok
                    ? r.entwurf
                      ? "Bestätigungsmail erzeugt — auf diesem Server landet sie im Serverprotokoll."
                      : "Bestätigungsmail unterwegs. Sie gilt sieben Tage."
                    : grundText(r.grund),
                );
              })
            }
          >
            Bestätigung anfordern
          </Button>
          {meldung && <p className="text-2xs text-ink-2">{meldung}</p>}
          <p className="text-2xs leading-relaxed text-ink-3">
            Kein Newsletter, keine Werbung. Abbestellen mit einem Klick aus jeder Mail — deine
            Suche läuft dann weiter.
          </p>
        </div>
      </div>
    </Card>
  );
}

function grundText(grund: string): string {
  switch (grund) {
    case "adresse_ungueltig":
      return "Diese Adresse sieht noch nicht vollständig aus.";
    case "gesperrt":
      /*
       * Ehrlich, aber ohne Detail: Warum eine Adresse gesperrt ist,
       * geht denjenigen nichts an, der sie gerade eintippt — sie kann
       * vorher jemand anderem gehört haben.
       */
      return "An diese Adresse können wir nicht schreiben. Nimm bitte eine andere.";
    default:
      return "Auf diesem Server ist der Versand nicht eingerichtet.";
  }
}
