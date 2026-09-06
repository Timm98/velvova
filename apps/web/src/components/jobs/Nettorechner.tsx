"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { alsGeld, rechnerFuer, zuEuro, type Eingabe } from "@/lib/payroll";
import { aufJahresbetrag } from "@/lib/jobs/gehaltsanzeige";
import { eingabeAus } from "@/lib/payroll/eingabe";
import type { Gehaltsangaben } from "@/lib/payroll/angaben";
import { lebensrechnung, type Fixkosten } from "@/lib/lebenswert/rechnung";

/**
 * „Was bleibt mir netto?" — direkt an der Stelle.
 *
 * ── Warum das hier steht und nicht auf einer Rechnerseite ─────
 *
 * Die Frage stellt sich beim Lesen der Zahl, nicht nach einem
 * Seitenwechsel. Und sie stellt sich mit DIESEM Gehalt, nicht mit einem
 * leeren Formular, in das man es abtippt.
 *
 * ── Warum zugeklappt ──────────────────────────────────────────
 *
 * Ein Steuerformular mit acht Feldern auf einer Jobseite ist eine
 * Zumutung für die neunzig Prozent, die nur die Zahl sehen wollen. Also
 * erst die Zahl, und die Felder erst auf Wunsch.
 *
 * Die Zahl steht dabei sofort da — nicht erst nach dem Aufklappen. Ein
 * Rechner, den man erst öffnen muss, um zu sehen, dass er etwas kann,
 * wird nicht geöffnet.
 *
 * ── Warum es im Browser rechnet ───────────────────────────────
 *
 * Derselbe Rechenkern wie auf dem Server, ohne Datenbank und ohne Netz.
 * Wer eine Steuerklasse ändert, sieht das Ergebnis sofort — sonst wären
 * die Felder ein Fragebogen mit Absenden-Knopf.
 */

const KLASSEN: [number, string][] = [
  [1, "I — ledig"],
  [2, "II — alleinerziehend"],
  [3, "III — verheiratet, höheres Einkommen"],
  [4, "IV — verheiratet, ähnlich"],
  [5, "V — verheiratet, geringeres Einkommen"],
];

const LAENDER: [string, string][] = [
  ["BW", "Baden-Württemberg"], ["BY", "Bayern"], ["BE", "Berlin"], ["BB", "Brandenburg"],
  ["HB", "Bremen"], ["HH", "Hamburg"], ["HE", "Hessen"], ["MV", "Mecklenburg-Vorpommern"],
  ["NI", "Niedersachsen"], ["NW", "Nordrhein-Westfalen"], ["RP", "Rheinland-Pfalz"],
  ["SL", "Saarland"], ["SN", "Sachsen"], ["ST", "Sachsen-Anhalt"], ["SH", "Schleswig-Holstein"],
  ["TH", "Thüringen"],
];

const KOSTENFELDER: [keyof Fixkosten, string][] = [
  ["wohnen", "Wohnen"],
  ["mobilitaet", "Mobilität"],
  ["lebensmittel", "Lebensmittel"],
  ["versicherungen", "Versicherungen"],
  ["kredite", "Kredite"],
  ["abos", "Abos"],
  /* Nicht nur „Kinder": In den Steuerangaben oben steht die Anzahl,
     hier der monatliche Betrag. Gleiche Beschriftung, zwei Bedeutungen. */
  ["kinder", "Kosten für Kinder"],
  ["sonstiges", "Sonstiges"],
];

export function Nettorechner({
  bruttoVon,
  bruttoBis,
  waehrung,
  zeitraum,
  land,
  angaben,
  kosten,
  pendelkosten,
}: {
  bruttoVon: number | null;
  bruttoBis: number | null;
  waehrung: string;
  zeitraum: string;
  land: string;
  /** Die gespeicherten Steuerangaben als Ausgangspunkt. */
  angaben: Gehaltsangaben;
  /** Gespeicherte Fixkosten, soweit vorhanden. */
  kosten: Fixkosten;
  /** Was die Stelle zusätzlich an Mobilität kostet, wenn bekannt. */
  pendelkosten: number | null;
}) {
  const [offen, setOffen] = useState(false);

  /*
   * Der Sprung von oben öffnet die Felder gleich mit.
   *
   * Der Link „Mit deinen Angaben rechnen" brachte einen bis hierher —
   * und dann stand da ein Knopf „Details berechnen", den man noch
   * einmal drücken musste. Zwei Klicks für eine Absicht, die man
   * beim ersten schon ausgesprochen hat.
   *
   * Über die Adresse statt über eine Eigenschaft von aussen: Der
   * Anker funktioniert weiterhin ohne JavaScript (er scrollt), und
   * ein geteilter Link mit `#gehaltsrechner` führt jemanden direkt
   * zum offenen Rechner. Eine durchgereichte Eigenschaft könnte
   * beides nicht.
   */
  useEffect(() => {
    const pruefen = () => {
      if (window.location.hash === "#gehaltsrechner") setOffen(true);
    };
    pruefen();
    /* `hashchange` feuert nicht, wenn dieselbe Kennung erneut
       angeklickt wird — dann ist sie aber schon offen. */
    window.addEventListener("hashchange", pruefen);
    return () => window.removeEventListener("hashchange", pruefen);
  }, []);
  const [w, setW] = useState(angaben);
  const [k, setK] = useState<Fixkosten>(kosten);
  /*
   * Bei einer Spanne: unten, Mitte oder oben.
   *
   * Voreingestellt ist die Mitte. Das untere Ende wäre pessimistisch,
   * das obere eine Werbeaussage — und beides würde als „das Gehalt
   * dieser Stelle" gelesen.
   */
  const [ende, setEnde] = useState<"min" | "mitte" | "max">("mitte");

  const brutto = useMemo(() => {
    if (bruttoVon === null && bruttoBis === null) return null;
    const von = bruttoVon ?? bruttoBis!;
    const bis = bruttoBis ?? bruttoVon!;
    /*
     * Umgerechnet wird mit derselben Tabelle wie überall.
     *
     * Hier stand eine eigene: Jahr und Monat, alles andere `null` —
     * also „kein Jahresgehalt". Eine Anzeige mit Stundenlohn bekam
     * damit keine Nettorechnung, obwohl die Zahl dasteht und
     * `gehaltsanzeige` sie längst hochrechnet.
     *
     * Zwei Tabellen hiessen ausserdem, dass dieselbe Stelle je nach
     * Baustein ein anderes Jahresgehalt hat.
     */
    const wert = ende === "min" ? von : ende === "max" ? bis : Math.round((von + bis) / 2);
    return aufJahresbetrag(wert, zeitraum);
  }, [bruttoVon, bruttoBis, zeitraum, ende]);

  const rechner = rechnerFuer(land as Eingabe["land"], w.steuerjahr);
  const ergebnis = brutto !== null && rechner ? rechner.berechne(eingabeAus(w, brutto, land)) : null;
  const nettoMonat = ergebnis?.abgedeckt ? Math.round(zuEuro(ergebnis.nettoMonat)) : null;

  const rechnung = useMemo(
    () =>
      nettoMonat === null
        ? null
        : lebensrechnung(nettoMonat, k, pendelkosten !== null ? { pendeln: pendelkosten } : {}),
    [nettoMonat, k, pendelkosten],
  );

  /* Ohne Gehalt gibt es nichts zu rechnen — und das steht dann da. */
  if (brutto === null) {
    return (
      <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
        Diese Anzeige nennt kein Jahresgehalt. Sobald eines bekannt ist, rechne ich hier aus, was
        davon netto übrig bleibt.
      </p>
    );
  }

  if (!rechner) {
    return (
      <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
        Für {land} habe ich noch kein Steuerregelwerk — eine deutsche Rechnung auf ein Gehalt dort
        wäre eine Zahl, die überzeugend aussieht und nichts bedeutet.
      </p>
    );
  }

  const spanne = bruttoVon !== null && bruttoBis !== null && bruttoVon !== bruttoBis;

  return (
    /* Das Sprungziel `#gehaltsrechner` sitzt eine Ebene höher am
       Abschnitt: Dieser Rechner erscheint nur mit hinterlegten
       Angaben, und ein Link auf eine Kennung, die es nicht immer
       gibt, tut im Browser gar nichts. */
    <div className="grid gap-4">
      {/* ── Die Zahl, sofort ────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
        <span className="grid gap-0.5">
          <span className="abschnitts-titel text-ink-3">
            Brutto
            {/*
              Der Hinweis gehört an die Zahl, nicht in eine Fussnote.
              
              Eine Anzeige mit 22 € pro Stunde ergibt hier 38.720 € im
              Jahr. Ohne den Zusatz hält man das für eine Angabe des
              Arbeitgebers — sie ist eine Hochrechnung mit 1760 Stunden,
              und die trifft bei Teilzeit nicht zu.
            */}
            {zeitraum !== "year" && (
              <span className="ml-1.5 normal-case tracking-normal text-ink-3">
                hochgerechnet
              </span>
            )}
          </span>
          <span className="font-mono text-lg tabular">
            {brutto.toLocaleString("de-DE")} {waehrung === "EUR" ? "€" : waehrung}
          </span>
        </span>
        <span aria-hidden className="pb-1 text-ink-3">→</span>
        <span className="grid gap-0.5">
          <span className="abschnitts-titel text-ink-3">
            Netto im Monat
          </span>
          <span className="font-mono text-[2rem] font-semibold leading-none tabular text-accent-text">
            {nettoMonat !== null ? alsGeld(ergebnis!.abgedeckt ? ergebnis!.nettoMonat : 0) : "–"}
          </span>
        </span>
      </div>

      {spanne && (
        <fieldset className="flex flex-wrap items-center gap-2">
          <legend className="sr-only">Welches Ende der Gehaltsspanne</legend>
          {(
            [
              ["min", `unten · ${bruttoVon!.toLocaleString("de-DE")} €`],
              ["mitte", "Mitte"],
              ["max", `oben · ${bruttoBis!.toLocaleString("de-DE")} €`],
            ] as const
          ).map(([wert, label]) => (
            <button
              key={wert}
              type="button"
              aria-pressed={ende === wert}
              onClick={() => setEnde(wert)}
              className={
                "min-h-8 rounded-(--radius-pill) px-3 text-sm transition-colors " +
                (ende === wert ? "bg-accent-soft text-ink" : "text-ink-2 ring-1 ring-line hover:bg-soft")
              }
            >
              {label}
            </button>
          ))}
        </fieldset>
      )}

      {rechnung && rechnung.fixkostenMonat > 0 && (
        <p className="text-sm leading-relaxed text-ink-2">
          Nach deinen Fixkosten
          {pendelkosten !== null ? " und dem Arbeitsweg" : ""} bleiben{" "}
          <span className="font-mono font-semibold tabular text-ink">
            {rechnung.freiMonat.toLocaleString("de-DE")} €
          </span>{" "}
          im Monat.
        </p>
      )}

      <button
        type="button"
        onClick={() => setOffen((o) => !o)}
        aria-expanded={offen}
        className="inline-flex min-h-9 w-fit items-center gap-1.5 rounded-(--radius-pill) px-4 text-sm text-accent-text ring-1 ring-line transition-colors hover:bg-soft"
      >
        {offen ? "Weniger" : "Details berechnen"}
        <ChevronDown
          aria-hidden
          className={"size-4 transition-transform " + (offen ? "rotate-180" : "")}
          strokeWidth={2}
        />
      </button>

      {offen && (
        <div className="grid gap-6 border-t border-line pt-5">
          {/* ── Steuerangaben ────────────────────────────── */}
          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="pb-1 text-sm font-medium">Deine Steuerangaben</legend>

            <Feld label="Steuerklasse">
              <select
                aria-label="Steuerklasse"
                value={w.steuerklasse}
                onChange={(e) => setW({ ...w, steuerklasse: Number(e.target.value) as typeof w.steuerklasse })}
                className={eingabe}
              >
                {KLASSEN.map(([n, t]) => (
                  <option key={n} value={n}>{t}</option>
                ))}
              </select>
            </Feld>

            <Feld label="Bundesland">
              <select
                aria-label="Bundesland"
                value={w.bundesland}
                onChange={(e) => setW({ ...w, bundesland: e.target.value as typeof w.bundesland })}
                className={eingabe}
              >
                {LAENDER.map(([c, n]) => (
                  <option key={c} value={c}>{n}</option>
                ))}
              </select>
            </Feld>

            {/*
              „Kinder" stand zweimal im selben Formular.
              
              Hier ist es eine Steuerangabe — die Zahl der Kinder
              bestimmt Freibeträge und den Zuschlag zur Pflege-
              versicherung. Weiter unten in den Fixkosten stand
              ebenfalls „Kinder", dort als monatlicher Ausgabeposten.
              
              Zwei Felder mit demselben Namen in einem Formular sind
              nicht doppelt, sondern verwechselbar: Wer oben eine Zahl
              einträgt, sucht unten dieselbe wieder. Beide heissen
              jetzt, was sie sind.
            */}
            <Feld label="Kinder (Freibeträge)" hinweis="Anzahl — beeinflusst Steuer und Pflegeversicherung">
              <input
                type="text"
                inputMode="numeric"
                aria-label="Anzahl der Kinder für Freibeträge"
                value={w.kinderzahl}
                onChange={(e) => {
                  const n = Math.max(0, Math.min(12, Number(e.target.value.replace(/\D/g, "")) || 0));
                  setW({ ...w, kinderzahl: n, hatKinder: n > 0 });
                }}
                className={eingabe}
              />
            </Feld>

            <Feld label="Zusatzbeitrag der Kasse" hinweis="in Prozent — steht auf deiner Abrechnung">
              <input
                type="text"
                inputMode="decimal"
                aria-label="Zusatzbeitrag der Kasse"
                value={(w.zusatzbeitrag * 100).toFixed(2)}
                onChange={(e) => {
                  const n = Number(e.target.value.replace(",", "."));
                  if (Number.isFinite(n) && n >= 0 && n <= 5) setW({ ...w, zusatzbeitrag: n / 100 });
                }}
                className={eingabe}
              />
            </Feld>

            <label className="flex items-center gap-2.5 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={w.kirchensteuer}
                onChange={(e) => setW({ ...w, kirchensteuer: e.target.checked })}
                className="size-4 accent-[var(--accent)]"
              />
              Ich zahle Kirchensteuer
            </label>
          </fieldset>

          {/* ── Fixkosten ────────────────────────────────── */}
          <fieldset className="grid gap-3">
            <legend className="pb-1 text-sm font-medium">Deine monatlichen Kosten</legend>
            <p className="max-w-[var(--measure)] text-2xs leading-relaxed text-ink-3">
              Alles freiwillig. Vier Angaben ergeben eine gröbere Rechnung als acht — aber eine, die
              es vorher nicht gab. Diese Angaben bleiben hier und erscheinen in keiner Bewerbung.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {KOSTENFELDER.map(([schluessel, label]) => (
                <Feld key={schluessel} label={label}>
                  <input
                    type="text"
                    inputMode="numeric"
                    aria-label={`${label} je Monat in Euro`}
                    value={k[schluessel] ?? ""}
                    placeholder="—"
                    onChange={(e) => {
                      const roh = e.target.value.replace(/\D/g, "");
                      setK({ ...k, [schluessel]: roh === "" ? null : Number(roh) });
                    }}
                    className={eingabe}
                  />
                </Feld>
              ))}
            </div>
          </fieldset>

          {/* ── Was übrig bleibt ─────────────────────────── */}
          {rechnung && (
            <div className="grid gap-2 rounded-(--radius-md) bg-soft p-5">
              <Zeile name="Netto im Monat" wert={rechnung.nettoMonat} />
              {rechnung.fixkostenMonat > 0 && (
                <Zeile name="− Fixkosten" wert={-rechnung.fixkostenMonat} />
              )}
              {pendelkosten !== null && pendelkosten > 0 && (
                <Zeile name="− Arbeitsweg" wert={-pendelkosten} />
              )}
              <div className="mt-1 flex items-baseline justify-between gap-4 border-t border-line pt-3">
                <span className="text-[15px] font-medium">Dir bleiben ungefähr</span>
                <span className="font-mono text-xl font-semibold tabular text-accent-text">
                  {rechnung.freiMonat.toLocaleString("de-DE")} €
                </span>
              </div>
              {rechnung.unbekannt.length > 0 && (
                <p className="text-2xs leading-relaxed text-ink-3">
                  Nicht angegeben: {rechnung.unbekannt.join(", ")}. Die Zahl ist entsprechend
                  optimistisch.
                </p>
              )}
            </div>
          )}

          <p className="text-2xs leading-relaxed text-ink-3">
            Schätzung nach den Regeln für {w.steuerjahr}. Die tatsächliche Lohnabrechnung kann
            abweichen.{" "}
            <Link
              href="/app/settings/gehalt"
              className="text-accent-text underline underline-offset-[3px]"
            >
              Angaben dauerhaft speichern
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}

const eingabe =
  /* Pillenform wie die Umschalter darüber. Eckige Felder neben runden
     Knöpfen lasen sich wie zwei verschiedene Bedienelemente für
     dieselbe Sache. */
  "h-11 rounded-(--radius-pill) bg-inset px-4 text-[15px] outline-none ring-1 ring-line focus-visible:ring-2 focus-visible:ring-accent";

function Feld({
  label,
  hinweis,
  children,
}: {
  label: string;
  hinweis?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {hinweis && <span className="text-2xs text-ink-3">{hinweis}</span>}
      {children}
    </label>
  );
}

function Zeile({ name, wert }: { name: string; wert: number }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-sm text-ink-2">{name}</span>
      <span className="font-mono text-[15px] tabular">
        {Math.abs(wert).toLocaleString("de-DE")} €
      </span>
    </div>
  );
}
