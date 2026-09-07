"use client";

import { useState, useTransition } from "react";
import { ChevronDown, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { loescheGehaltsangaben, speichereGehaltsangaben } from "@/lib/payroll/einstellungen";
import type { Gehaltsangaben } from "@/lib/payroll/angaben";
import { alsGeld, ausEuro, rechnerFuer } from "@/lib/payroll";
import { eingabeAus } from "@/lib/payroll/eingabe";
import { Gehaltslabor } from "./Gehaltslabor";

/**
 * Die Steuerangaben — in zwei Ebenen.
 *
 * Oben stehen die vier, die das Ergebnis am stärksten verschieben:
 * Steuerklasse, Bundesland, Kirchensteuer, Zusatzbeitrag. Alles Weitere
 * liegt hinter „Mehr Angaben" — nicht weil es unwichtig wäre, sondern
 * weil eine Wand aus zwölf Feldern dazu führt, dass niemand eines davon
 * ausfüllt.
 *
 * Daneben rechnet die Vorschau mit: wer eine Angabe ändert, sieht
 * sofort, was sie ausmacht. Das ist der eigentliche Grund, warum diese
 * Felder überhaupt jemand anfasst — ohne sichtbare Wirkung sind sie ein
 * Fragebogen.
 */

const BUNDESLAENDER: [string, string][] = [
  ["BW", "Baden-Württemberg"], ["BY", "Bayern"], ["BE", "Berlin"],
  ["BB", "Brandenburg"], ["HB", "Bremen"], ["HH", "Hamburg"],
  ["HE", "Hessen"], ["MV", "Mecklenburg-Vorpommern"], ["NI", "Niedersachsen"],
  ["NW", "Nordrhein-Westfalen"], ["RP", "Rheinland-Pfalz"], ["SL", "Saarland"],
  ["SN", "Sachsen"], ["ST", "Sachsen-Anhalt"], ["SH", "Schleswig-Holstein"],
  ["TH", "Thüringen"],
];

const KLASSEN: [number, string][] = [
  [1, "I — ledig oder getrennt"],
  [2, "II — alleinerziehend"],
  [3, "III — verheiratet, höheres Einkommen"],
  [4, "IV — verheiratet, ähnliches Einkommen"],
  [5, "V — verheiratet, geringeres Einkommen"],
  [6, "VI — zweites Arbeitsverhältnis"],
];

/** Das Beispielgehalt der Vorschau. */
const VORSCHAU_BRUTTO = 45_000;

export function GehaltsFormular({
  angaben,
  bruttoVorschlag,
}: {
  angaben: Gehaltsangaben;
  /** Das Brutto der aktuellen Stelle, wenn hinterlegt — für das Labor unten. */
  bruttoVorschlag: number | null;
}) {
  const [w, setW] = useState(angaben);
  const [mehr, setMehr] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [loeschfrage, setLoeschfrage] = useState(false);

  /*
   * Die Vorschau rechnet im Browser mit.
   *
   * Derselbe Rechenkern wie auf dem Server — er hängt an keiner
   * Datenbank und keinem Netz. Ohne sichtbare Wirkung wären diese
   * Felder ein Fragebogen; mit ihr merkt man, dass der Zusatzbeitrag
   * der Krankenkasse mehrere hundert Euro im Jahr ausmacht.
   */
  const rechner = rechnerFuer("DE", w.steuerjahr);
  const vorschau = rechner?.berechne(eingabeAus(w, VORSCHAU_BRUTTO, "DE"));

  return (
    <form
      className="grid gap-8"
      action={(daten) =>
        startTransition(async () => {
          const r = await speichereGehaltsangaben(daten);
          setMeldung(r.text);
        })
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-12">
        <div className="grid content-start gap-5">
          <Feld label="Steuerklasse" id="steuerklasse">
            <select
              id="steuerklasse"
              name="steuerklasse"
              value={w.steuerklasse}
              onChange={(e) => setW({ ...w, steuerklasse: Number(e.target.value) as typeof w.steuerklasse })}
              className={eingabe}
            >
              {KLASSEN.map(([n, t]) => (
                <option key={n} value={n}>{t}</option>
              ))}
            </select>
          </Feld>

          <Feld label="Bundesland" id="bundesland" hinweis="Bestimmt Kirchensteuersatz und in Sachsen den Pflegebeitrag.">
            <select
              id="bundesland"
              name="bundesland"
              value={w.bundesland}
              onChange={(e) => setW({ ...w, bundesland: e.target.value as typeof w.bundesland })}
              className={eingabe}
            >
              {BUNDESLAENDER.map(([k, t]) => (
                <option key={k} value={k}>{t}</option>
              ))}
            </select>
          </Feld>

          <Feld
            label="Zusatzbeitrag deiner Krankenkasse"
            id="zusatzbeitrag"
            hinweis="Steht auf deiner Abrechnung oder auf der Seite deiner Kasse. Er macht mehrere hundert Euro im Jahr aus."
          >
            <div className="flex items-center gap-2">
              <input
                id="zusatzbeitrag"
                name="zusatzbeitrag"
                type="number"
                step="0.01"
                min="0"
                max="5"
                value={(w.zusatzbeitrag * 100).toFixed(2)}
                onChange={(e) => setW({ ...w, zusatzbeitrag: Number(e.target.value) / 100 })}
                className={cn(eingabe, "w-28 font-mono tabular")}
              />
              <span className="text-sm text-ink-2">Prozent</span>
            </div>
          </Feld>

          <label className="flex cursor-pointer items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              name="kirchensteuer"
              checked={w.kirchensteuer}
              onChange={(e) => setW({ ...w, kirchensteuer: e.target.checked })}
              className="mt-0.5 size-4 accent-[var(--accent)]"
            />
            <span className="text-ink-2">Ich zahle Kirchensteuer</span>
          </label>

          {/* ── Zweite Ebene ──────────────────────────────── */}
          <button
            type="button"
            onClick={() => setMehr((v) => !v)}
            aria-expanded={mehr}
            className="inline-flex min-h-10 items-center gap-1.5 justify-self-start text-sm text-accent-text"
          >
            {mehr ? "Weniger Angaben" : "Mehr Angaben"}
            <ChevronDown aria-hidden className={cn("size-4 transition-transform", mehr && "rotate-180")} strokeWidth={2} />
          </button>

          {mehr && (
            <div className="grid gap-5 border-l-2 border-line-2 pl-5">
              <Feld label="Krankenversicherung" id="krankenversicherung">
                <select
                  id="krankenversicherung"
                  name="krankenversicherung"
                  value={w.krankenversicherung}
                  onChange={(e) =>
                    setW({ ...w, krankenversicherung: e.target.value as typeof w.krankenversicherung })
                  }
                  className={eingabe}
                >
                  <option value="gesetzlich">Gesetzlich</option>
                  <option value="privat">Privat</option>
                </select>
              </Feld>

              <Feld label="Krankenkasse" id="krankenkasse" hinweis="Freiwillig. Nur zur Wiedererkennung.">
                <input
                  id="krankenkasse"
                  name="krankenkasse"
                  maxLength={120}
                  value={w.krankenkasse ?? ""}
                  onChange={(e) => setW({ ...w, krankenkasse: e.target.value })}
                  className={eingabe}
                />
              </Feld>

              <Feld label="Kinder" id="kinderzahl" hinweis="Wirkt auf Pflegeversicherung, Soli und Kirchensteuer.">
                <input
                  id="kinderzahl"
                  name="kinderzahl"
                  type="number"
                  min="0"
                  max="12"
                  value={w.kinderzahl}
                  onChange={(e) =>
                    setW({ ...w, kinderzahl: Number(e.target.value), hatKinder: Number(e.target.value) > 0 })
                  }
                  className={cn(eingabe, "w-24 font-mono tabular")}
                />
              </Feld>

              <Feld label="Zahlungen im Jahr" id="zahlungen" hinweis="12, 13 oder 14 — je nach Vertrag.">
                <select
                  id="zahlungen"
                  name="zahlungen"
                  value={w.zahlungen}
                  onChange={(e) => setW({ ...w, zahlungen: Number(e.target.value) as typeof w.zahlungen })}
                  className={cn(eingabe, "w-28")}
                >
                  <option value={12}>12</option>
                  <option value={13}>13</option>
                  <option value={14}>14</option>
                </select>
              </Feld>
            </div>
          )}
        </div>

        {/* ── Vorschau ────────────────────────────────────── */}
        <aside className="grid content-start gap-3 rounded-(--radius-surface) bg-inset p-5">
          <p className="abschnitts-titel text-ink-3">
            Beispiel: {alsGeld(ausEuro(VORSCHAU_BRUTTO))} brutto im Jahr
          </p>
          {vorschau?.abgedeckt ? (
            <>
              <p className="font-display text-3xl font-normal tracking-[-0.02em] tabular">
                {alsGeld(vorschau.nettoMonat)}
              </p>
              <p className="text-sm text-ink-2">
                voraussichtlich netto im Monat — {alsGeld(vorschau.nettoJahr)} im Jahr
              </p>
              <ul className="mt-2 grid gap-1 border-t border-line-2 pt-3">
                {[...vorschau.steuern, ...vorschau.sozialversicherung].map((a) => (
                  <li key={a.key} className="flex justify-between gap-3 text-xs">
                    <span className="text-ink-2">{a.label}</span>
                    <span className="font-mono tabular text-ink-3">{alsGeld(a.jahr)}</span>
                  </li>
                ))}
              </ul>
              <p className="pt-1 text-2xs leading-relaxed text-ink-3">
                Schätzung. Die tatsächliche Lohnabrechnung kann abweichen.
              </p>
            </>
          ) : (
            <p className="text-sm leading-relaxed text-ink-2">
              {vorschau?.abgedeckt === false
                ? vorschau.grund
                : "Für dieses Steuerjahr habe ich keine Regeln."}
            </p>
          )}
        </aside>
      </div>

      {/* ── Speichern: eine eigene Entscheidung ──────────── */}
      <div className="grid gap-3 rounded-(--radius-md) bg-inset px-4 py-3.5">
        <label className="flex cursor-pointer items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            name="speichern"
            defaultChecked={angaben.gespeichert}
            className="mt-0.5 size-4 accent-[var(--accent)]"
          />
          <span className="grid gap-0.5">
            <span className="font-medium text-ink">Diese Angaben für künftige Schätzungen speichern</span>
            <span className="text-xs leading-relaxed text-ink-2">
              Ohne Häkchen gelten sie nur für diese Berechnung. Steuerklasse und Kinderzahl sagen
              etwas über deine Lebensform — du entscheidest, ob das bei uns liegt.
            </span>
          </span>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 items-center gap-2 rounded-(--radius-pill) bg-accent px-6 text-sm font-medium text-accent-on transition-colors hover:bg-accent-hover disabled:opacity-70"
        >
          {pending && <Loader2 className="size-4 animate-spin" strokeWidth={2} />}
          Übernehmen
        </button>

        {angaben.gespeichert &&
          (loeschfrage ? (
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-critical">Alle Steuerangaben löschen?</span>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const r = await loescheGehaltsangaben();
                    setMeldung(r.text);
                    setLoeschfrage(false);
                  })
                }
                className="inline-flex min-h-9 items-center rounded-(--radius-pill) bg-critical px-4 text-sm text-white"
              >
                Ja, löschen
              </button>
              <button
                type="button"
                onClick={() => setLoeschfrage(false)}
                className="inline-flex min-h-9 items-center rounded-(--radius-pill) px-4 text-sm text-ink-2 hover:bg-soft"
              >
                Abbrechen
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setLoeschfrage(true)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-pill) px-4 text-sm text-ink-2 transition-colors hover:bg-soft hover:text-ink"
            >
              <Trash2 aria-hidden className="size-4" strokeWidth={1.9} />
              Gespeicherte Angaben löschen
            </button>
          ))}
      </div>

      {meldung && (
        <p role="status" className="rounded-(--radius-md) bg-positive-soft px-4 py-3 text-sm text-ink">
          {meldung}
        </p>
      )}

      {/*
       * Das Labor bekommt `w`, nicht `angaben`.
       *
       * `angaben` ist der gespeicherte Stand. `w` ist, was gerade in den
       * Feldern steht. Nur mit `w` stimmt, was der Abschnitt darüber
       * verspricht: Steuerklasse ändern und unten sofort sehen, was das
       * für die nächste Verhandlung bedeutet — ohne erst zu speichern.
       */}
      <Gehaltslabor angaben={w} bruttoVorschlag={bruttoVorschlag} />
    </form>
  );
}

const eingabe =
  "min-h-11 rounded-(--radius-sm) border border-line bg-surface px-3.5 text-[15px] text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/25";

function Feld({
  label,
  id,
  hinweis,
  children,
}: {
  label: string;
  id: string;
  hinweis?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hinweis && <p className="max-w-[var(--measure)] text-xs leading-relaxed text-ink-3">{hinweis}</p>}
    </div>
  );
}
