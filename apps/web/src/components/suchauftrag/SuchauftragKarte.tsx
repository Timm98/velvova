"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CalendarClock, Check, MailX, Pause, Play, Search, X } from "lucide-react";
import { Badge, Button, Card } from "@/components/ui";
import {
  auftragBestaetigen,
  auftragHeuteAussetzen,
  auftragPause,
  auftragSchliessen,
  auftragWeiter,
  mailsAusschalten,
  type Auftragsansicht,
} from "@/lib/suchauftrag/aktionen";

/**
 * „Monday sucht für dich weiter."
 *
 * ══════════════════════════════════════════════════════════════
 * Warum vier Knöpfe und nicht einer
 * ══════════════════════════════════════════════════════════════
 *
 *   Heute Nacht nicht   setzt genau einen Lauf aus
 *   Pausieren           hält den Auftrag an
 *   E-Mails aus         lässt die Suche laufen
 *   Beenden             schliesst ihn ab
 *
 * Ein einziger Schalter wäre aufgeräumter und falsch: Wer eine Nacht
 * Ruhe will, verliert damit seine Suche — und merkt es erst Wochen
 * später, wenn nichts mehr kommt.
 *
 * Deshalb steht neben jedem Knopf, was er tut. Kurz, aber vollständig.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum ein Entwurf anders aussieht
 * ══════════════════════════════════════════════════════════════
 *
 * Ein Entwurf sucht nicht. Sähe er aus wie ein laufender Auftrag,
 * wartete jemand auf Treffer, die nie kommen. Er zeigt deshalb, was
 * gelten würde, und einen Knopf, der es gelten lässt.
 */
export function SuchauftragKarte({ auftrag }: { auftrag: Auftragsansicht }) {
  const [laeuft, starten] = useTransition();
  const [hinweis, setHinweis] = useState<string | null>(null);

  const entwurf = auftrag.status === "entwurf";
  const pausiert = auftrag.status === "pausiert";

  const tun = (fn: () => Promise<{ ok: boolean; grund?: string }>, erfolg?: string) =>
    starten(async () => {
      const r = await fn();
      setHinweis(r.ok ? (erfolg ?? null) : grundText(r.grund));
    });

  return (
    <Card>
      <div className="grid gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
              <Search aria-hidden className="size-4 text-ink-3" />
              {auftrag.name}
            </h3>
            <p className="text-2xs text-ink-3">{zustandssatz(auftrag)}</p>
          </div>
          <div className="flex items-center gap-2">
            {auftrag.neu > 0 && <Badge tone="positive">{auftrag.neu} neu für dich</Badge>}
            {auftrag.zuKlaeren > 0 && <Badge tone="caution">{auftrag.zuKlaeren} zu klären</Badge>}
          </div>
        </div>

        {/* ── Wonach gesucht wird ────────────────────────────── */}
        {auftrag.kriterien.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {auftrag.kriterien.map((k, i) => (
              <li
                key={`${k.kriterium}-${i}`}
                className={
                  k.staerke === "muss"
                    ? "rounded-(--radius-sm) bg-sunken px-2 py-1 text-2xs text-ink-2"
                    : "rounded-(--radius-sm) border border-line px-2 py-1 text-2xs text-ink-3"
                }
              >
                {kriteriumstext(k)}
                {k.staerke === "muss" && <span className="ml-1 text-ink-3">· muss</span>}
              </li>
            ))}
          </ul>
        )}

        {hinweis && <p className="text-2xs text-ink-2">{hinweis}</p>}

        {/* ── Aktionen ───────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2">
          {entwurf ? (
            <Button
              variant="primary"
              disabled={laeuft}
              onClick={() => tun(() => auftragBestaetigen(auftrag.id), "Läuft. Monday meldet sich, wenn etwas passt.")}
            >
              <Check aria-hidden className="size-4" />
              Ja, so suchen
            </Button>
          ) : pausiert ? (
            <Button variant="primary" disabled={laeuft} onClick={() => tun(() => auftragWeiter(auftrag.id))}>
              <Play aria-hidden className="size-4" />
              Weitersuchen
            </Button>
          ) : (
            <>
              <Button
                variant="ghost"
                disabled={laeuft}
                onClick={() =>
                  tun(() => auftragHeuteAussetzen(auftrag.id), "Der nächste Lauf ist ausgesetzt. Danach geht es weiter.")
                }
              >
                <CalendarClock aria-hidden className="size-4" />
                Heute nicht
              </Button>
              <Button variant="ghost" disabled={laeuft} onClick={() => tun(() => auftragPause(auftrag.id))}>
                <Pause aria-hidden className="size-4" />
                Pausieren
              </Button>
              {auftrag.kanal === "app_und_email" && (
                <Button
                  variant="ghost"
                  disabled={laeuft}
                  onClick={() => tun(() => mailsAusschalten(), "E-Mails sind aus. Die Suche läuft weiter.")}
                >
                  <MailX aria-hidden className="size-4" />
                  E-Mails aus
                </Button>
              )}
            </>
          )}

          <Button
            variant="ghost"
            disabled={laeuft}
            onClick={() => tun(() => auftragSchliessen(auftrag.id), "Beendet.")}
          >
            <X aria-hidden className="size-4" />
            {entwurf ? "Nicht aktivieren" : "Beenden"}
          </Button>

          {auftrag.neu > 0 && (
            <Link
              href="/app/jobs"
              className="ml-auto text-2xs font-medium text-ink-2 underline underline-offset-2"
            >
              Treffer ansehen
            </Link>
          )}
        </div>
      </div>
    </Card>
  );
}

function zustandssatz(a: Auftragsansicht): string {
  if (a.status === "entwurf")
    return "Noch nicht aktiviert. Monday sucht erst, wenn du zustimmst.";
  if (a.status === "pausiert") return "Pausiert. Deine Treffer bleiben erhalten.";

  const teile: string[] = [];
  teile.push(a.kanal === "app_und_email" ? "In Velvova und per E-Mail" : "Nur in Velvova");
  teile.push(a.rhythmus === "woechentlich" ? "wöchentlich" : "täglich");
  teile.push(`um ${a.sendezeitLokal} (${a.zeitzone.replace("_", " ")})`);
  if (a.zuletztGeprueft) {
    teile.push(
      `zuletzt geprüft ${a.zuletztGeprueft.toLocaleString("de-DE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`,
    );
  } else {
    /* Ehrlich: Noch nie gelaufen heisst noch nie gelaufen. */
    teile.push("noch nicht gelaufen");
  }
  return teile.join(" · ");
}

/**
 * Die Kurzform für ein Merkzeichen.
 *
 * Bewusst nicht `kriteriumSatz` aus dem Paket: Der liefert einen
 * Satzteil („mindestens 32.000 EUR im Jahr"), und der gehört in einen
 * Satz, nicht in ein Merkzeichen. Hier stehen zehn davon nebeneinander
 * und müssen auf eine Zeile passen.
 *
 * Der Satzteil steht im Bestätigungstext und in der Mail — dort, wo
 * er gelesen und nicht überflogen wird.
 */
function kriteriumstext(k: { kriterium: string; wert: unknown }): string {
  const wert = Array.isArray(k.wert) ? k.wert.join(" oder ") : String(k.wert);
  switch (k.kriterium) {
    case "taetigkeit":
      return wert;
    case "taetigkeit_ausschluss":
      return `kein ${wert}`;
    case "arbeitsort":
      return wert;
    case "arbeitsmodell":
      return wert === "remote" ? "remote" : wert === "hybrid" ? "hybrid" : "vor Ort";
    case "vertragsform":
      return wert;
    case "mindestgehalt":
      return `ab ${Number(k.wert).toLocaleString("de-DE")} €`;
    case "wochenstunden":
      return `${wert} Std./Woche`;
    case "schichtarbeit":
      return "keine Schicht";
    case "befristung":
      return k.wert === false ? "unbefristet" : "befristet";
    default:
      return `${k.kriterium}: ${wert}`;
  }
}

function grundText(grund?: string): string {
  switch (grund) {
    case "kein_profil":
      return "Für diesen Auftrag steht noch kein Suchprofil.";
    case "nicht_gefunden":
      return "Diesen Auftrag gibt es nicht mehr.";
    case "kein_fenster":
      return "Für diesen Auftrag steht gerade kein Lauf an.";
    default:
      return "Das hat gerade nicht geklappt.";
  }
}
