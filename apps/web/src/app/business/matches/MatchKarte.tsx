"use client";

import { useState, useTransition } from "react";
import { Check, ChevronDown, Lock, X } from "lucide-react";
import {
  freigabeAnfragen,
  interesseSenden,
  kontaktOeffnen,
  vorschlagAblehnen,
} from "@/lib/arbeitgeber/match-aktionen";
import { cn } from "@/lib/cn";

/**
 * Ein Vorschlag als Karte.
 *
 * ── Warum die Zahl nicht allein steht ─────────────────────────
 *
 * „92" ist keine Auskunft, sondern ein Urteil ohne Begründung. Die
 * Karte zeigt deshalb immer vier Dinge zusammen: die Zahl, woraus sie
 * besteht, worauf sie sich stützt (die Datenbasis) und was sie NICHT
 * beantwortet.
 *
 * ── Warum die offenen Punkte nicht kleiner gesetzt sind ───────
 *
 * Weil sie der wertvollere Teil sind. Was übereinstimmt, bestätigt eine
 * Entscheidung, die man ohnehin treffen wollte; was offen ist, sind die
 * Fragen fürs Gespräch. Sie kleiner zu setzen hiesse, den Score zur
 * Entscheidung zu machen — und das ist er ausdrücklich nicht.
 */

export type KartenDaten = {
  id: string;
  kennung: string;
  stellentitel: string;
  fitGesamt: number | null;
  fitFachlich: number | null;
  fitPersoenlich: number | null;
  fitLangfristig: number | null;
  band: string;
  datenbasis: number;
  belegt: string[];
  offen: string[];
  entwickelbar: string[];
  ausschluss: string[];
  gehaltUeberschneidung: string | null;
  verfuegbarkeit: string | null;
  zustand: string;
  zustandName: string;
  name: string | null;
  kontakt: string | null;
};

const BANDNAME: Record<string, string> = {
  high: "Gut belegt",
  medium: "Teilweise belegt",
  exploratory: "Dünne Grundlage",
  insufficient_data: "Zu wenig Daten für eine Zahl",
};

export function MatchKarte({
  daten,
  organizationId,
  darfHandeln,
}: {
  daten: KartenDaten;
  organizationId: string;
  darfHandeln: boolean;
}) {
  const [offenAuf, setOffenAuf] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, starte] = useTransition();

  function tun(fn: () => Promise<{ ok: boolean; fehler?: string }>) {
    setFehler(null);
    starte(async () => {
      const r = await fn();
      if (!r.ok) setFehler(r.fehler ?? "Das hat nicht geklappt.");
    });
  }

  const kontaktOffen = daten.zustand === "kontakt_offen";

  return (
    <li className="grid gap-4 rounded-(--radius-md) border border-line p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid gap-1">
          <div className="flex flex-wrap items-center gap-2.5">
            {/*
              Die anonyme Kennung ist die des Vorschlags, nicht der
              Person. Zwei Vorschläge derselben Person zu zwei Stellen
              tragen verschiedene — wer sie zusammenführen könnte,
              hätte die Anonymität aufgehoben.
            */}
            <span className="font-mono text-sm font-semibold text-ink">
              {kontaktOffen && daten.name ? daten.name : `Vorschlag ${daten.kennung}`}
            </span>
            <span className="rounded-full bg-inset px-2.5 py-0.5 text-2xs font-medium text-ink-2">
              {daten.zustandName}
            </span>
          </div>
          <span className="text-sm text-ink-3">{daten.stellentitel}</span>
          {/* Die Zahlenschrift gehört Zahlen, nicht Adressen — dieselbe
              Regel wie auf der Bestätigungsseite. */}
          {kontaktOffen && daten.kontakt && (
            <span className="text-sm text-ink-2">{daten.kontakt}</span>
          )}
        </div>

        <div className="grid justify-items-end gap-0.5">
          {daten.fitGesamt === null ? (
            <span className="text-sm font-medium text-ink-2">Keine Zahl</span>
          ) : (
            <span className="font-mono text-2xl font-bold tabular-nums text-ink">
              {daten.fitGesamt}
            </span>
          )}
          <span className="text-2xs text-ink-3">{BANDNAME[daten.band] ?? daten.band}</span>
        </div>
      </div>

      {/* ── Die drei Teilwerte ─────────────────────────────── */}
      <ul className="grid gap-2">
        {(
          [
            ["Fachlich", daten.fitFachlich],
            ["Persönlich", daten.fitPersoenlich],
            ["Langfristig", daten.fitLangfristig],
          ] as const
        ).map(([k, v]) => (
          <li key={k} className="grid grid-cols-[6rem_minmax(0,1fr)_2.5rem] items-center gap-3">
            <span className="text-[13px] text-ink-2">{k}</span>
            <span aria-hidden className="h-1.5 overflow-hidden rounded-full bg-inset">
              <span className="block h-full rounded-full bg-accent" style={{ width: `${v ?? 0}%` }} />
            </span>
            <span className="text-right font-mono text-[13px] tabular-nums text-ink">
              {v ?? "–"}
            </span>
          </li>
        ))}
      </ul>

      {/*
        Die Datenbasis steht direkt unter den Werten.

        Eine 92 aus einem halb ausgefüllten Profil ist etwas anderes
        als eine 92 aus einem vollständigen — und ohne diese Zeile
        sähen beide gleich aus.
      */}
      <p className="text-xs text-ink-3">
        Datenbasis: <span className="font-mono tabular-nums">{daten.datenbasis} %</span> der
        Kriterien hatten Angaben.
      </p>

      {/* ── Begründung ─────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setOffenAuf((v) => !v)}
        aria-expanded={offenAuf}
        className="flex items-center gap-1.5 justify-self-start text-sm text-ink-2 underline-offset-4 hover:underline"
      >
        Begründung
        <ChevronDown aria-hidden className={cn("size-3.5 transition-transform", offenAuf && "rotate-180")} strokeWidth={2} />
      </button>

      {offenAuf && (
        <div className="grid gap-3 rounded-(--radius-sm) bg-sunken p-4">
          <Liste titel="Belegte Übereinstimmungen" punkte={daten.belegt} />
          <Liste titel="Offene Fragen fürs Gespräch" punkte={daten.offen} />
          <Liste titel="Entwickelbare Lücken" punkte={daten.entwickelbar} />
          <Liste titel="Ausschlusskriterien" punkte={daten.ausschluss} ton="kritisch" />
          {(daten.gehaltUeberschneidung || daten.verfuegbarkeit) && (
            <dl className="grid gap-1 border-t border-line pt-3 text-sm">
              {daten.gehaltUeberschneidung && (
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-3">Gehaltsüberschneidung</dt>
                  <dd className="text-ink-2">{daten.gehaltUeberschneidung}</dd>
                </div>
              )}
              {daten.verfuegbarkeit && (
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-3">Verfügbarkeit</dt>
                  <dd className="text-ink-2">{daten.verfuegbarkeit}</dd>
                </div>
              )}
            </dl>
          )}
          <p className="border-t border-line pt-3 text-xs leading-relaxed text-ink-3">
            Der Fit Score ist eine Orientierung und keine automatische Einstellungsentscheidung.
            Nicht eingerechnet werden Alter, Geschlecht, Herkunft, Religion, Familienstand,
            Gesundheit, Foto und Name.
          </p>
        </div>
      )}

      {fehler && (
        <p role="alert" className="rounded-(--radius-sm) border border-critical/40 bg-critical-soft px-3 py-2 text-sm text-ink">
          {fehler}
        </p>
      )}

      {/* ── Handlungen ─────────────────────────────────────── */}
      {darfHandeln && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
          {daten.zustand === "anonym_erkannt" && (
            <Knopf haupt laeuft={laeuft} onClick={() => tun(() => freigabeAnfragen(organizationId, daten.id))}>
              Profilfreigabe anfragen
            </Knopf>
          )}
          {daten.zustand === "profil_freigegeben" && (
            <Knopf haupt laeuft={laeuft} onClick={() => tun(() => interesseSenden(organizationId, daten.id))}>
              Interesse senden
            </Knopf>
          )}
          {daten.zustand === "gegenseitiges_interesse" && (
            <Knopf haupt laeuft={laeuft} onClick={() => tun(() => kontaktOeffnen(organizationId, daten.id))}>
              Kontakt öffnen
            </Knopf>
          )}
          {daten.zustand === "freigabe_angefragt" && (
            <span className="inline-flex items-center gap-1.5 text-sm text-ink-3">
              <Lock aria-hidden className="size-3.5" strokeWidth={1.9} />
              Wartet auf die Entscheidung der Person
            </span>
          )}
          {daten.zustand === "interesse_gesendet" && (
            <span className="inline-flex items-center gap-1.5 text-sm text-ink-3">
              <Check aria-hidden className="size-3.5" strokeWidth={2} />
              Interesse liegt vor — die Person entscheidet
            </span>
          )}

          {!["abgelehnt", "freigabe_widerrufen", "abgelaufen"].includes(daten.zustand) && (
            <Knopf
              laeuft={laeuft}
              onClick={() => tun(() => vorschlagAblehnen(organizationId, daten.id, "Vom Team abgelehnt"))}
            >
              <X aria-hidden className="size-3.5" strokeWidth={2} />
              Passt nicht
            </Knopf>
          )}
        </div>
      )}
    </li>
  );
}

function Liste({ titel, punkte, ton }: { titel: string; punkte: string[]; ton?: "kritisch" }) {
  return (
    <div className="grid gap-1.5">
      <span className="text-2xs font-semibold uppercase tracking-[0.12em] text-ink-3">{titel}</span>
      {punkte.length === 0 ? (
        /*
          Eine leere Liste bleibt sichtbar und sagt, dass sie leer ist.
          Ausgeblendet sähe eine Karte ohne Ausschlusskriterien genauso
          aus wie eine, bei der niemand danach gesucht hat.
        */
        <span className="text-sm italic text-ink-3">Nichts festgestellt.</span>
      ) : (
        <ul className="grid gap-1">
          {punkte.map((p) => (
            <li key={p} className={cn("text-sm leading-relaxed", ton === "kritisch" ? "text-critical" : "text-ink-2")}>
              {p}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Knopf({
  children,
  onClick,
  laeuft,
  haupt,
}: {
  children: React.ReactNode;
  onClick: () => void;
  laeuft: boolean;
  haupt?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={laeuft}
      className={cn(
        "inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-pill) px-4 text-sm transition-colors disabled:opacity-55",
        haupt
          ? "bg-accent font-semibold text-accent-on hover:opacity-90"
          : "border border-line-3 font-medium text-ink hover:bg-soft",
      )}
    >
      {children}
    </button>
  );
}
