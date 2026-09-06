"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, ChevronDown, CircleAlert, Pencil, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { bewerte, type Angabe, type Ergebnisstand } from "@/lib/arbeitgeber/onboarding/bewertung";
import { BEREICHSNAME, feldFinden, type Ergebnis } from "@/lib/arbeitgeber/onboarding/felder";
import { wertText } from "@/lib/arbeitgeber/onboarding/fuehrung";
import { angabeQuittieren, angabeSetzen } from "./aktionen";

/**
 * Was aus dem Gespräch geworden ist — während es läuft.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum vier Karten und nicht eine Fortschrittsleiste
 * ══════════════════════════════════════════════════════════════
 *
 * Aus demselben Gespräch entstehen vier verschiedene Dinge: eine
 * Unternehmensseite, eine Stellenanzeige, die Matching-Regeln und der
 * Bewerbungsablauf. Sie brauchen unterschiedliche Angaben und sind
 * unterschiedlich weit.
 *
 * Eine einzige Zahl über allem wäre ein Durchschnitt aus vier Dingen,
 * und ein Durchschnitt sagt an dieser Stelle nichts: 70 % könnte eine
 * fertige Anzeige neben leeren Matching-Regeln sein oder vier halbe
 * Ergebnisse. Der Unterschied entscheidet, was als Nächstes zu tun
 * ist.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum jede Angabe eine Herkunft zeigt
 * ══════════════════════════════════════════════════════════════
 *
 * „Gefunden“, „abgeleitet“ und „bestätigt“ sind drei verschiedene
 * Dinge, und der Unterschied gehört dem Menschen, dessen Firma hier
 * beschrieben wird. Was eine Maschine geschlossen hat, darf nicht
 * aussehen wie etwas, das er selbst gesagt hat.
 */

const HERKUNFT: Record<Angabe["status"], { label: string; klasse: string }> = {
  bestaetigt: { label: "bestätigt", klasse: "bg-positive-soft text-positive-text" },
  gefunden: { label: "verstanden", klasse: "bg-accent-soft text-accent-text" },
  abgeleitet: { label: "abgeleitet", klasse: "bg-caution-soft text-caution-text" },
  unklar: { label: "unklar", klasse: "bg-caution-soft text-caution-text" },
  nicht_angegeben: { label: "nicht angegeben", klasse: "bg-inset text-ink-3" },
};

const ERGEBNISSE: Ergebnis[] = ["profil", "anzeige", "matching", "bewerbung"];

/** Der Ring um die Prozentzahl. */
function Ring({ prozent, bereit }: { prozent: number; bereit: boolean }) {
  const r = 15;
  const umfang = 2 * Math.PI * r;
  return (
    <span className="relative inline-grid h-10 w-10 place-items-center">
      <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx="18" cy="18" r={r} fill="none" strokeWidth="3" className="stroke-line-2" />
        <circle
          cx="18" cy="18" r={r} fill="none" strokeWidth="3" strokeLinecap="round"
          strokeDasharray={`${(umfang * prozent) / 100} ${umfang}`}
          className={bereit ? "stroke-positive" : "stroke-accent"}
        />
      </svg>
      <span className="font-mono text-2xs font-600 tabular-nums text-ink">{prozent}</span>
    </span>
  );
}

/* ── Eine einzelne Angabe, bearbeitbar ────────────────────────── */

function Zeile({
  angabe,
  aufFrisch,
}: {
  angabe: Angabe;
  aufFrisch: (a: Angabe[]) => void;
}) {
  const feld = feldFinden(angabe.bereich, angabe.feld);
  const [bearbeiten, setBearbeiten] = useState(false);
  const [entwurf, setEntwurf] = useState(() => wertText(angabe.wert));
  const [laeuft, start] = useTransition();

  const speichern = () => {
    start(async () => {
      /*
       * Die Umwandlung in das Feldformat passiert auf dem Server.
       * Hier steht der Text so, wie er getippt wurde — der Client
       * entscheidet nicht, was eine Liste ist und was eine Zahl.
       */
      const e = await angabeSetzen({ bereich: angabe.bereich, feld: angabe.feld, wert: entwurf });
      if (e.ok) {
        aufFrisch(e.angaben);
        setBearbeiten(false);
      }
    });
  };

  const quittieren = (status: "bestaetigt" | "nicht_angegeben") => {
    start(async () => {
      const e = await angabeQuittieren({ bereich: angabe.bereich, feld: angabe.feld, status });
      if (e.ok) aufFrisch(e.angaben);
    });
  };

  const herkunft = HERKUNFT[angabe.status];

  return (
    <li className="grid gap-1 border-t border-line-3 py-2 first:border-t-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-2xs uppercase tracking-wide text-ink-3">
          {feld?.label ?? angabe.feld}
        </span>
        <span className={cn("rounded-[4px] px-1.5 py-0.5 text-2xs", herkunft.klasse)}>
          {herkunft.label}
        </span>
      </div>

      {bearbeiten ? (
        <div className="grid gap-2">
          <textarea
            value={entwurf}
            onChange={(e) => setEntwurf(e.target.value)}
            rows={feld?.art === "lang" ? 3 : 1}
            className="w-full rounded-[6px] border border-line bg-surface px-2 py-1.5 text-sm text-ink"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              type="button" onClick={speichern} disabled={laeuft}
              className="rounded-[6px] bg-accent px-2.5 py-1 text-2xs font-600 text-accent-on disabled:opacity-60"
            >
              Übernehmen
            </button>
            <button
              type="button" onClick={() => setBearbeiten(false)}
              className="rounded-[6px] border border-line px-2.5 py-1 text-2xs text-ink-2"
            >
              Abbrechen
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm text-ink">{wertText(angabe.wert)}</p>
          <div className="flex shrink-0 gap-1">
            {angabe.status !== "bestaetigt" && (
              <button
                type="button" onClick={() => quittieren("bestaetigt")} disabled={laeuft}
                title="Stimmt so"
                className="grid h-6 w-6 place-items-center rounded-[5px] text-ink-3 hover:bg-soft hover:text-positive"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button" onClick={() => { setEntwurf(wertText(angabe.wert)); setBearbeiten(true); }}
              title="Ändern"
              className="grid h-6 w-6 place-items-center rounded-[5px] text-ink-3 hover:bg-soft hover:text-ink"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            {angabe.status !== "nicht_angegeben" && (
              <button
                type="button" onClick={() => quittieren("nicht_angegeben")} disabled={laeuft}
                title="Gibt es bei uns nicht"
                className="grid h-6 w-6 place-items-center rounded-[5px] text-ink-3 hover:bg-soft hover:text-critical"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/*
        Die Belegstelle nur bei dem, was nicht bestätigt ist. Bei einer
        bestätigten Angabe ist sie überholt: Da steht jetzt, was ein
        Mensch gesagt hat, und nicht mehr, woraus es gelesen wurde.
      */}
      {angabe.status !== "bestaetigt" && angabe.quelleDetail && (
        <p className="text-2xs italic text-ink-3">„{angabe.quelleDetail}“</p>
      )}
    </li>
  );
}

/* ── Eine Ergebniskarte ───────────────────────────────────────── */

function Karte({
  stand,
  angaben,
  aufFrisch,
}: {
  stand: Ergebnisstand;
  angaben: Angabe[];
  aufFrisch: (a: Angabe[]) => void;
}) {
  const [offen, setOffen] = useState(false);

  /* Nur die Angaben, die in dieses Ergebnis eingehen — dieselbe
     Angabe kann in mehreren Karten stehen, und das ist richtig so:
     Die Gehaltsspanne gehört zur Anzeige UND zum Matching. */
  const meine = useMemo(() => {
    const gehoert = new Set(
      stand.offen.concat(stand.fehlendZwingend).map((f) => `${f.bereich}.${f.feld}`),
    );
    return angaben.filter((a) => {
      const f = feldFinden(a.bereich, a.feld);
      return f?.fuer.includes(stand.ergebnis) && !gehoert.has(`${a.bereich}.${a.feld}`);
    });
  }, [angaben, stand]);

  return (
    <section className="rounded-[10px] border border-line-3 bg-surface">
      <button
        type="button"
        onClick={() => setOffen((o) => !o)}
        aria-expanded={offen}
        className="flex w-full items-center gap-3 px-3 py-3 text-left"
      >
        <Ring prozent={stand.prozent} bereit={stand.bereit} />
        <span className="grid flex-1 gap-0.5">
          <span className="text-sm font-600 text-ink">{stand.name}</span>
          <span className="text-2xs text-ink-3">
            {stand.bestaetigt} bestätigt · {stand.offen.length} offen
            {stand.fehlendZwingend.length > 0 && (
              <span className="text-caution-text"> · {stand.fehlendZwingend.length} nötig</span>
            )}
          </span>
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-ink-3 transition-transform", offen && "rotate-180")} />
      </button>

      {offen && (
        <div className="grid gap-3 border-t border-line-3 px-3 py-3">
          {stand.warnungen.length > 0 && (
            <ul className="grid gap-1.5">
              {stand.warnungen.map((w, i) => (
                <li key={i} className="flex gap-2 rounded-[6px] bg-caution-soft px-2 py-1.5 text-2xs text-caution-text">
                  <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />
                  <span>{w.text}</span>
                </li>
              ))}
            </ul>
          )}

          {meine.length > 0 ? (
            <ul>
              {meine.map((a) => (
                <Zeile key={`${a.bereich}.${a.feld}`} angabe={a} aufFrisch={aufFrisch} />
              ))}
            </ul>
          ) : (
            <p className="text-2xs text-ink-3">Hier steht noch nichts. Erzähl Nina davon.</p>
          )}

          {stand.fehlendZwingend.length > 0 && (
            <div className="grid gap-1 border-t border-line-3 pt-2">
              <p className="flex items-center gap-1.5 text-2xs font-600 text-ink-2">
                <CircleAlert className="h-3 w-3" />
                Ohne diese Angaben geht es nicht nach draussen
              </p>
              <ul className="grid gap-0.5">
                {stand.fehlendZwingend.map((f) => (
                  <li key={`${f.bereich}.${f.feld}`} className="text-2xs text-ink-3">
                    {f.label} <span className="text-line-2">— {BEREICHSNAME[f.bereich] ?? f.bereich}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/* ── Die Vorschau ─────────────────────────────────────────────── */

export function Vorschau({
  angaben,
  aufFrisch,
}: {
  angaben: Angabe[];
  aufFrisch: (a: Angabe[]) => void;
}) {
  const staende = useMemo(() => ERGEBNISSE.map((e) => bewerte(e, angaben)), [angaben]);

  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-600 text-ink">Was daraus wird</h2>
        <span className="text-2xs text-ink-3">{ERGEBNISSE.length} Ergebnisse</span>
      </div>
      {staende.map((s) => (
        <Karte key={s.ergebnis} stand={s} angaben={angaben} aufFrisch={aufFrisch} />
      ))}
      <p className="px-1 pt-1 text-2xs text-ink-3">
        Nichts davon ist veröffentlicht. Du entscheidest am Ende, was wohin geht.
      </p>
    </div>
  );
}

