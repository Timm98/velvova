"use client";

import { useState, useTransition } from "react";
import { Download, Mail, Copy, Check } from "lucide-react";
import { bewerbungsstandMelden, type Stand } from "@/lib/bewerbungsstand";
import { cn } from "@/lib/cn";

/**
 * ══════════════════════════════════════════════════════════════════
 * Der letzte Meter: vom Entwurf zur abgeschickten Bewerbung
 * ══════════════════════════════════════════════════════════════════
 *
 * Velvova versendet nicht. Der Mensch versendet, und das ist die
 * bewusste Bauart — ein halbfertiger Versandweg, der scheinbar
 * funktioniert, wäre schlimmer als einer, der ehrlich sagt, dass er
 * nicht verbunden ist.
 *
 * ── Was hier vorher stand ───────────────────────────────────────
 *
 * Ein Textfeld mit dem Satz „Kopier ihn in dein Mailprogramm" — und
 * darin die rohen Kopfzeilen einer Mail:
 *
 *     To: personal@firma.de
 *     Subject: Bewerbung als …
 *     MIME-Version: 1.0
 *     Content-Type: text/plain; charset="utf-8"
 *
 * Das kopiert niemand in ein Mailfenster. Der Weg war vollständig
 * gebaut und endete einen Meter vor dem Ziel.
 *
 * ── Drei Wege, weil Menschen verschieden arbeiten ───────────────
 *
 * Die Datei öffnet sich als fertiger Entwurf im Mailprogramm — der
 * beste Weg, wenn eines eingerichtet ist. Der Mailto-Verweis geht
 * überall, hat aber eine Längengrenze. Der Text zum Kopieren ist der
 * Rückfall, und er enthält jetzt nur den Text, nicht die Kopfzeilen.
 */

const KNOPF =
  "inline-flex min-h-11 items-center gap-2 rounded-(--radius-control) px-4 text-[14px] font-medium transition-colors disabled:opacity-60";

/** Ab hier wird ein Mailto-Verweis in manchen Browsern abgeschnitten. */
const MAILTO_GRENZE = 1800;

export function Entwurfsuebergabe({
  jobId,
  dateiname,
  inhalt,
  empfaenger,
  betreff,
}: {
  jobId: string;
  dateiname: string;
  /** Der vollständige Entwurf samt Kopfzeilen — für die Datei. */
  inhalt: string;
  empfaenger: string;
  betreff: string;
}) {
  const [kopiert, setKopiert] = useState(false);
  const [stand, setStand] = useState<Stand | null>(null);
  const [fehler, setFehler] = useState(false);
  const [laeuft, uebergang] = useTransition();

  /*
   * Nur der Text, ohne Kopfzeilen.
   *
   * Was nach der ersten Leerzeile kommt, ist die Nachricht. Alles
   * davor ist Maschinerie und gehört nicht in ein Mailfenster.
   */
  const nurText = inhalt.includes("\r\n\r\n")
    ? inhalt.slice(inhalt.indexOf("\r\n\r\n") + 4)
    : inhalt;

  const mailto =
    `mailto:${encodeURIComponent(empfaenger)}` +
    `?subject=${encodeURIComponent(betreff)}` +
    `&body=${encodeURIComponent(nurText)}`;

  const zuLang = mailto.length > MAILTO_GRENZE;

  function herunterladen() {
    const blob = new Blob([inhalt], { type: "message/rfc822" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = dateiname;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function kopieren() {
    try {
      await navigator.clipboard.writeText(nurText);
      setKopiert(true);
      setTimeout(() => setKopiert(false), 2500);
    } catch {
      /* Ohne Zwischenablage bleibt der Text im Feld darunter stehen —
         markieren und kopieren geht immer. */
    }
  }

  function melden(s: Stand) {
    setStand(s);
    setFehler(false);
    uebergang(async () => {
      const a = await bewerbungsstandMelden(jobId, s);
      if (!a.ok) setFehler(true);
    });
  }

  return (
    <div className="grid gap-5 rounded-(--radius-lg) border border-line bg-raised p-5">
      <div className="grid gap-1">
        <h3 className="text-[16px] font-semibold text-ink">Der Entwurf ist fertig</h3>
        <p className="max-w-[var(--measure)] text-[14.5px] leading-relaxed text-ink-2">
          Velvova verschickt nichts. Du versendest selbst — so behältst du in der Hand, was in
          deinem Namen bei einem Arbeitgeber ankommt.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={herunterladen}
          className={cn(KNOPF, "bg-accent text-accent-on hover:opacity-90")}
        >
          <Download className="size-4 shrink-0" strokeWidth={1.9} />
          Als Entwurf herunterladen
        </button>

        {!zuLang && (
          <a href={mailto} className={cn(KNOPF, "border border-line text-ink hover:bg-soft")}>
            <Mail className="size-4 shrink-0" strokeWidth={1.9} />
            Im Mailprogramm öffnen
          </a>
        )}

        <button
          type="button"
          onClick={kopieren}
          className={cn(KNOPF, "border border-line text-ink hover:bg-soft")}
        >
          {kopiert ? (
            <Check className="size-4 shrink-0 text-accent-text" strokeWidth={2} />
          ) : (
            <Copy className="size-4 shrink-0" strokeWidth={1.9} />
          )}
          {kopiert ? "Kopiert" : "Text kopieren"}
        </button>
      </div>

      <p className="text-2xs leading-relaxed text-ink-3">
        Die Datei öffnet sich in deinem Mailprogramm als fertiger Entwurf — mit Empfänger und
        Betreff.
        {zuLang && " Für den Mailto-Verweis ist der Text zu lang; nimm die Datei oder kopiere ihn."}
      </p>

      {/*
        Die Frage nach dem Stand steht hier, nicht auf einer eigenen
        Seite.

        Ein Redirect sagt nichts darüber, ob jemand tatsächlich
        abgeschickt hat — und wer gerade den Entwurf in der Hand hat,
        ist der Einzige, der es weiss. Fragt man ihn später, hat er es
        vergessen.
      */}
      <div className="grid gap-2.5 border-t border-line pt-4">
        <span className="text-[14.5px] font-medium text-ink">Hast du sie abgeschickt?</span>

        <div className="flex flex-wrap gap-2.5" role="group" aria-label="Stand der Bewerbung">
          {(
            [
              ["sent", "Ja, abgeschickt"],
              ["not_yet", "Noch nicht"],
              ["later", "Später"],
            ] as const
          ).map(([wert, text]) => (
            <button
              key={wert}
              type="button"
              onClick={() => melden(wert)}
              disabled={laeuft}
              aria-pressed={stand === wert}
              className={cn(
                "inline-flex min-h-10 items-center rounded-(--radius-pill) border px-4 text-[14px] transition-colors",
                stand === wert
                  ? "border-accent bg-accent-soft text-accent-text"
                  : "border-line text-ink-2 hover:bg-soft",
              )}
            >
              {text}
            </button>
          ))}
        </div>

        {stand && !fehler && (
          <p className="text-2xs leading-relaxed text-ink-3">
            {laeuft
              ? "Wird eingetragen …"
              : stand === "sent"
                ? "Eingetragen. Wir erinnern dich, wenn ein Nachfassen sinnvoll wird — vorher nicht."
                : "Eingetragen. Die Bewerbung bleibt vorbereitet, du kannst jederzeit weitermachen."}
          </p>
        )}

        {fehler && (
          <p className="text-2xs leading-relaxed text-critical">
            Das liess sich gerade nicht eintragen. Du kannst den Stand oben auf dieser Seite
            setzen.
          </p>
        )}
      </div>
    </div>
  );
}
